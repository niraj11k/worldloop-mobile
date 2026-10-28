import { useSavedRoundStore } from '@store/useSavedRoundStore';
import {
  abandonSession,
  applyComputerCannotMove,
  applyValidation,
  beginComputerTurn,
  beginValidation,
  chargeHint,
  createSession,
  setInput,
} from '@features/game/gameSession';
import { storage, STORAGE_KEYS } from '@services/storage/storage';
import type { GameSessionState } from '@app-types/game';
import type { ValidationResult } from '@features/game/ruleEngine';

const valid = (word: string): ValidationResult => ({
  isValid: true,
  normalizedWord: word,
  reason: null,
  entry: null,
});

const playerPlays = (state: GameSessionState, word: string): GameSessionState =>
  applyValidation(beginValidation(setInput(state, word)), {
    submittedWord: word,
    result: valid(word),
    scoreAwarded: 12,
  });

const roundInPlay = (): GameSessionState => ({
  ...playerPlays(
    createSession({ sessionId: 'session-1', difficulty: 'hard', startingWord: 'apple' }),
    'eagle',
  ),
  phase: 'input_empty',
});

/**
 * The app being killed: the store is a module-level singleton, so clearing it
 * without touching storage is exactly what a force-quit leaves behind.
 */
const killApp = () => useSavedRoundStore.setState({ saved: null, paused: null, status: 'idle' });

describe('useSavedRoundStore', () => {
  beforeEach(async () => {
    killApp();
    await storage.removeItem(STORAGE_KEYS.CURRENT_SESSION);
    await storage.removeItem(STORAGE_KEYS.PAUSED_SESSION);
  });

  it('has nothing to resume on a fresh install', async () => {
    await useSavedRoundStore.getState().load();
    expect(useSavedRoundStore.getState().saved).toBeNull();
    expect(useSavedRoundStore.getState().status).toBe('ready');
  });

  it('restores a killed round with its chain, score, and hints intact', async () => {
    const round = chargeHint(roundInPlay());
    await useSavedRoundStore.getState().save(round);

    killApp();
    await useSavedRoundStore.getState().load();

    const restored = useSavedRoundStore.getState().saved;
    expect(restored?.sessionId).toBe('session-1');
    expect(restored?.difficulty).toBe('hard');
    expect(restored?.chain.map(move => move.normalizedWord)).toEqual(['apple', 'eagle']);
    expect(restored?.score).toBe(12);
    expect(restored?.hintsUsed).toBe(1);
    expect(restored?.requiredLetter).toBe('e');
  });

  it('restores a round killed mid-computer-turn ready to finish that turn', async () => {
    await useSavedRoundStore.getState().save(beginComputerTurn(roundInPlay()));

    killApp();
    await useSavedRoundStore.getState().load();

    expect(useSavedRoundStore.getState().saved?.phase).toBe('computer_thinking');
  });

  it('keeps only the latest state of a round', async () => {
    const first = roundInPlay();
    await useSavedRoundStore.getState().save(first);
    await useSavedRoundStore.getState().save(playerPlays(first, 'echo'));

    killApp();
    await useSavedRoundStore.getState().load();

    expect(useSavedRoundStore.getState().saved?.chain).toHaveLength(3);
  });

  it('clears the slot instead of saving a finished round', async () => {
    await useSavedRoundStore.getState().save(roundInPlay());
    await useSavedRoundStore
      .getState()
      .save(applyComputerCannotMove(roundInPlay(), { playerRepliesRemaining: 4 }));

    expect(useSavedRoundStore.getState().saved).toBeNull();
    await expect(storage.getItem(STORAGE_KEYS.CURRENT_SESSION)).resolves.toBeNull();
  });

  it('clears the slot for an abandoned round too', async () => {
    await useSavedRoundStore.getState().save(abandonSession(roundInPlay()));
    expect(useSavedRoundStore.getState().saved).toBeNull();
  });

  it('keeps nothing for a game the player has not moved in yet', async () => {
    await useSavedRoundStore.getState().save(roundInPlay());
    await useSavedRoundStore
      .getState()
      .save(createSession({ sessionId: 'session-2', difficulty: 'easy', startingWord: 'apple' }));

    expect(useSavedRoundStore.getState().saved).toBeNull();
    await expect(storage.getItem(STORAGE_KEYS.CURRENT_SESSION)).resolves.toBeNull();
  });

  it('offers nothing to resume after the round is given up', async () => {
    await useSavedRoundStore.getState().save(roundInPlay());
    await useSavedRoundStore.getState().clear();

    killApp();
    await useSavedRoundStore.getState().load();

    expect(useSavedRoundStore.getState().saved).toBeNull();
  });

  it('treats an unreadable saved round as nothing to resume', async () => {
    await storage.setItem(STORAGE_KEYS.CURRENT_SESSION, '{ not json');
    await useSavedRoundStore.getState().load();
    expect(useSavedRoundStore.getState().saved).toBeNull();
  });

  it('leaves the guest profile alone when clearing the round', async () => {
    await storage.setItem(STORAGE_KEYS.GUEST_PROFILE, 'profile-value');
    await useSavedRoundStore.getState().save(roundInPlay());
    await useSavedRoundStore.getState().clear();

    await expect(storage.getItem(STORAGE_KEYS.GUEST_PROFILE)).resolves.toBe('profile-value');
    await storage.removeItem(STORAGE_KEYS.GUEST_PROFILE);
  });
});

/**
 * D-13's rules, as the store enforces them (WL-410). Each `it` names the rule
 * it pins, so a failure here reads as which rule broke.
 */
describe('useSavedRoundStore — paused games (D-13)', () => {
  const easyGame = (): GameSessionState => ({
    ...playerPlays(
      createSession({ sessionId: 'easy-1', difficulty: 'easy', startingWord: 'apple' }),
      'eagle',
    ),
    phase: 'input_empty',
  });
  const mediumGame = (): GameSessionState => ({
    ...playerPlays(
      createSession({ sessionId: 'medium-1', difficulty: 'medium', startingWord: 'table' }),
      'eagle',
    ),
    phase: 'input_empty',
  });
  const store = () => useSavedRoundStore.getState();

  beforeEach(async () => {
    killApp();
    await storage.removeItem(STORAGE_KEYS.CURRENT_SESSION);
    await storage.removeItem(STORAGE_KEYS.PAUSED_SESSION);
  });

  it('Pause & Exit moves the game into the pause slot and out of the current one', async () => {
    await store().save(easyGame());
    await expect(store().pause(easyGame())).resolves.toBe(true);

    expect(store().paused?.sessionId).toBe('easy-1');
    expect(store().saved).toBeNull();
    await expect(storage.getItem(STORAGE_KEYS.CURRENT_SESSION)).resolves.toBeNull();
  });

  it('a paused game survives the app being killed, with no expiry', async () => {
    await store().pause(chargeHint(easyGame()));

    killApp();
    await store().load();

    const restored = store().paused;
    expect(restored?.sessionId).toBe('easy-1');
    expect(restored?.chain.map(move => move.normalizedWord)).toEqual(['apple', 'eagle']);
    expect(restored?.hintsUsed).toBe(1);
    expect(store().saved).toBeNull();
  });

  it('rule 2/4: a second game cannot be paused while one already is', async () => {
    await store().pause(easyGame());

    await expect(store().pause(mediumGame())).resolves.toBe(false);
    expect(store().paused?.sessionId).toBe('easy-1');
  });

  it('rule 4: once the paused game has ended, another can be paused', async () => {
    await store().pause(easyGame());
    await store().clearPaused();

    await expect(store().pause(mediumGame())).resolves.toBe(true);
    expect(store().paused?.sessionId).toBe('medium-1');
  });

  it('refuses to pause a game with nothing in it, or one that is over', async () => {
    const untouched = createSession({ sessionId: 'x', difficulty: 'hard', startingWord: 'apple' });
    await expect(store().pause(untouched)).resolves.toBe(false);
    await expect(store().pause(abandonSession(easyGame()))).resolves.toBe(false);
    expect(store().paused).toBeNull();
  });

  it('resuming moves the paused game back into play and frees the pause slot', async () => {
    await store().pause(easyGame());

    const resumed = await store().resumePaused();

    expect(resumed?.sessionId).toBe('easy-1');
    expect(store().saved?.sessionId).toBe('easy-1');
    expect(store().paused).toBeNull();
    await expect(storage.getItem(STORAGE_KEYS.PAUSED_SESSION)).resolves.toBeNull();

    // …so the same game can be paused again.
    await expect(store().pause(easyGame())).resolves.toBe(true);
  });

  it('rule 3: the paused game cannot be resumed while another game is still open', async () => {
    await store().pause(easyGame());
    await store().save(mediumGame());

    await expect(store().resumePaused()).resolves.toBeNull();
    expect(store().paused?.sessionId).toBe('easy-1');
    expect(store().saved?.sessionId).toBe('medium-1');
  });

  it('a pause interrupted mid-write keeps the game, as the one still in play', async () => {
    // Pause writes the pause slot first and clears the current slot second; an
    // app killed between the two leaves the same game in both.
    const game = easyGame();
    await store().save(game);
    await storage.setItem(STORAGE_KEYS.PAUSED_SESSION, await storage.getItem(STORAGE_KEYS.CURRENT_SESSION) ?? '');

    killApp();
    await store().load();

    expect(store().saved?.sessionId).toBe('easy-1');
    expect(store().paused).toBeNull();
    await expect(storage.getItem(STORAGE_KEYS.PAUSED_SESSION)).resolves.toBeNull();
  });

  it('a force-quit with one game paused and another in play restores both', async () => {
    await store().pause(easyGame());
    await store().save(mediumGame());

    killApp();
    await store().load();

    expect(store().paused?.difficulty).toBe('easy');
    expect(store().saved?.difficulty).toBe('medium');
  });

  it('a paused game killed mid-computer-turn resumes ready to finish that turn', async () => {
    await store().pause(beginComputerTurn(easyGame()));

    killApp();
    await store().load();

    expect(store().paused?.phase).toBe('computer_thinking');
  });

  it('Delete My Data (clearAll) empties both slots', async () => {
    await store().pause(easyGame());
    await store().save(mediumGame());

    await store().clearAll();
    killApp();
    await store().load();

    expect(store().saved).toBeNull();
    expect(store().paused).toBeNull();
  });

  it('ending the open game leaves the paused game alone', async () => {
    await store().pause(easyGame());
    await store().save(mediumGame());

    await store().clear();

    expect(store().saved).toBeNull();
    expect(store().paused?.sessionId).toBe('easy-1');
  });
});

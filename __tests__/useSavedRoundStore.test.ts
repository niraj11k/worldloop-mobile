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
const killApp = () => useSavedRoundStore.setState({ saved: null, status: 'idle' });

describe('useSavedRoundStore', () => {
  beforeEach(async () => {
    killApp();
    await storage.removeItem(STORAGE_KEYS.CURRENT_SESSION);
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

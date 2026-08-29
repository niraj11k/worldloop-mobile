import {
  SESSION_SCHEMA_VERSION,
  parseSavedSession,
  restorePhase,
  restoreSession,
  serializeSession,
} from '@features/game/sessionPersistence';
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
import type { GameSessionState, TurnPhase } from '@app-types/game';
import type { ValidationResult } from '@features/game/ruleEngine';

const valid = (word: string): ValidationResult => ({
  isValid: true,
  normalizedWord: word,
  reason: null,
  entry: null,
});

const newSession = (): GameSessionState =>
  createSession({ sessionId: 'session-1', difficulty: 'medium', startingWord: 'apple' });

const playerPlays = (state: GameSessionState, word: string): GameSessionState =>
  applyValidation(beginValidation(setInput(state, word)), {
    submittedWord: word,
    result: valid(word),
    scoreAwarded: 12,
  });

/** A round mid-play, back at the player's turn. */
const inProgress = (): GameSessionState => ({
  ...playerPlays(newSession(), 'eagle'),
  phase: 'input_empty',
});

const reparse = (session: GameSessionState) => parseSavedSession(serializeSession(session));

describe('serialize / parse round-trip', () => {
  it('restores the chain, score, and hints exactly', () => {
    const saved = chargeHint(inProgress());
    const restored = reparse(saved);

    expect(restored).toEqual(saved);
    expect(restored?.chain).toHaveLength(2);
    expect(restored?.score).toBe(12);
    expect(restored?.hintsUsed).toBe(1);
    expect(restored?.requiredLetter).toBe('e');
  });

  it('keeps the personal-best baseline the round started with', () => {
    // WL-111: the baseline is fixed at session creation, so a resumed round
    // must not silently re-price its milestone against a newer profile.
    const withBaseline: GameSessionState = { ...inProgress(), previousBestChainLength: 7 };
    expect(reparse(withBaseline)?.previousBestChainLength).toBe(7);
  });
});

describe('parseSavedSession rejects what is not worth restoring', () => {
  it('returns null when nothing is saved', () => {
    expect(parseSavedSession(null)).toBeNull();
  });

  it('returns null for junk', () => {
    expect(parseSavedSession('not json')).toBeNull();
    expect(parseSavedSession('[]')).toBeNull();
    expect(parseSavedSession('{"schemaVersion":1}')).toBeNull();
  });

  it('discards a round written by a different schema version', () => {
    const stored = JSON.parse(serializeSession(inProgress()));
    stored.schemaVersion = SESSION_SCHEMA_VERSION + 1;
    expect(parseSavedSession(JSON.stringify(stored))).toBeNull();
  });

  it('discards a finished round', () => {
    // Restoring one would replay a game-over the player already saw, and
    // record the round against their profile twice.
    const won = applyComputerCannotMove(playerPlays(newSession(), 'eagle'), {
      playerRepliesRemaining: 4,
    });
    expect(reparse(won)).toBeNull();
    expect(reparse(abandonSession(inProgress()))).toBeNull();
  });

  it('discards a round whose chain disagrees with the word on the board', () => {
    // Neither half can be trusted after this: the required letter, whose turn
    // it is, and the duplicate check all follow from the chain.
    const tampered: GameSessionState = { ...inProgress(), currentWord: 'otter' };
    expect(reparse(tampered)).toBeNull();
  });

  it('discards a round with an empty chain', () => {
    expect(reparse({ ...inProgress(), chain: [] })).toBeNull();
  });

  it('discards a round with a malformed move', () => {
    const stored = JSON.parse(serializeSession(inProgress()));
    delete stored.session.chain[1].normalizedWord;
    expect(parseSavedSession(JSON.stringify(stored))).toBeNull();
  });

  it('discards a round with an unknown difficulty', () => {
    const stored = JSON.parse(serializeSession(inProgress()));
    stored.session.difficulty = 'nightmare';
    expect(parseSavedSession(JSON.stringify(stored))).toBeNull();
  });

  it('discards a round with an impossible score', () => {
    const stored = JSON.parse(serializeSession(inProgress()));
    stored.session.score = 'lots';
    expect(parseSavedSession(JSON.stringify(stored))).toBeNull();
  });
});

describe('restorePhase', () => {
  it('resumes the computer’s turn if the app died during it', () => {
    // The player's word is already in the chain; something owes them a reply.
    expect(restorePhase('computer_thinking')).toBe('computer_thinking');
    expect(restorePhase('valid_move')).toBe('computer_thinking');
  });

  it('rewinds an in-flight submission to the player’s turn', () => {
    // The verdict never arrived and the word never reached the chain, so the
    // player retypes it rather than the app guessing.
    expect(restorePhase('validating')).toBe('input_empty');
  });

  it('drops a rejection the player can no longer read', () => {
    // The error message is not part of the session.
    expect(restorePhase('invalid_word')).toBe('input_empty');
  });

  it('forgets whatever was typed', () => {
    const phases: TurnPhase[] = ['player_turn', 'input_empty'];
    phases.forEach(phase => expect(restorePhase(phase)).toBe('input_empty'));
  });
});

describe('restoreSession', () => {
  it('changes only the phase', () => {
    const saved = beginComputerTurn(playerPlays(newSession(), 'eagle'));
    const restored = restoreSession(saved);

    expect(restored.phase).toBe('computer_thinking');
    expect({ ...restored, phase: saved.phase }).toEqual(saved);
  });

  it('lands a mid-typing round back on an empty input', () => {
    const typing = setInput(inProgress(), 'ea');
    expect(typing.phase).toBe('player_turn');
    expect(restoreSession(typing).phase).toBe('input_empty');
  });
});

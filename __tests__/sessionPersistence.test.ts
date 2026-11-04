import {
  SESSION_SCHEMA_VERSION,
  parseSavedSession,
  readSavedSession,
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
import savedGameV1 from './fixtures/savedGames/v1.json';
import savedGameV2 from './fixtures/savedGames/v2.json';

/**
 * One real save per shipped format, each written by the code of its own
 * version. Bumping `SESSION_SCHEMA_VERSION` means adding the next one here.
 */
const FIXTURES: Record<number, string> = {
  1: JSON.stringify(savedGameV1),
  2: JSON.stringify(savedGameV2),
};

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

const SAVED_AT = new Date('2026-10-30T09:15:00.000Z');
const serialize = (session: GameSessionState) => serializeSession(session, SAVED_AT);
const reparse = (session: GameSessionState) => parseSavedSession(serialize(session));

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
    const stored = JSON.parse(serialize(inProgress()));
    delete stored.session.chain[1].normalizedWord;
    expect(parseSavedSession(JSON.stringify(stored))).toBeNull();
  });

  it('discards a round with an unknown difficulty', () => {
    const stored = JSON.parse(serialize(inProgress()));
    stored.session.difficulty = 'nightmare';
    expect(parseSavedSession(JSON.stringify(stored))).toBeNull();
  });

  it('discards a round with an impossible score', () => {
    const stored = JSON.parse(serialize(inProgress()));
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

/**
 * D-14 / WL-411: saves must survive app updates. One real save per shipped
 * format lives in `__tests__/fixtures/savedGames/`, each written by the code
 * of its own version, and every one of them must keep restoring. Bumping
 * `SESSION_SCHEMA_VERSION` without a conversion and a new fixture fails here.
 */
describe('saves from every shipped format keep restoring', () => {
  const fixtures = Object.entries(FIXTURES).map(([version, raw]) => ({
    version: Number(version),
    raw,
  }));

  it('has a committed fixture for every format, up to the current one', () => {
    const versions = fixtures.map(f => f.version).sort((a, b) => a - b);
    const expected = Array.from({ length: SESSION_SCHEMA_VERSION }, (_, i) => i + 1);
    expect(versions).toEqual(expected);
  });

  it.each(fixtures.map(f => [f.version, f.raw] as const))(
    'restores the v%i fixture',
    (_version, raw) => {
      expect(readSavedSession(raw).kind).toBe('restored');
    },
  );

  it('restores a v1 save exactly — the format before WL-411', () => {
    // Written by the v1 code: a game killed mid-computer-turn, a hint used.
    const result = readSavedSession(FIXTURES[1]!);
    if (result.kind !== 'restored') throw new Error(`expected restored, got ${result.kind}`);

    expect(result.session.chain.map(move => move.normalizedWord)).toEqual([
      'apple',
      'eagle',
      'elephant',
      'tiger',
    ]);
    expect(result.session.score).toBe(26);
    expect(result.session.hintsUsed).toBe(1);
    expect(result.session.phase).toBe('computer_thinking');
    expect(result.session.previousBestChainLength).toBe(4);
    // v1 never recorded when it was played, so the age is unknown, not guessed.
    expect(result.savedAt).toBeNull();
  });

  it('reads the last-played time from a v2 save', () => {
    const result = readSavedSession(FIXTURES[2]!);
    expect(result.kind === 'restored' && result.savedAt).toBe('2026-10-30T19:45:00.000Z');
  });
});

describe('readSavedSession says what a slot held', () => {
  it('is empty when nothing is saved', () => {
    expect(readSavedSession(null)).toEqual({ kind: 'empty' });
  });

  it('round-trips the last-played time', () => {
    const result = readSavedSession(serialize(inProgress()));
    expect(result.kind === 'restored' && result.savedAt).toBe(SAVED_AT.toISOString());
  });

  it('silently discards junk and corrupt current-format saves — no game was lost', () => {
    expect(readSavedSession('not json')).toEqual({ kind: 'discarded' });
    expect(readSavedSession('{"no":"version"}')).toEqual({ kind: 'discarded' });
    const stored = JSON.parse(serialize(inProgress()));
    stored.session.score = 'lots';
    expect(readSavedSession(JSON.stringify(stored))).toEqual({ kind: 'discarded' });
  });

  it('reports a game from a newer build (after a downgrade) as lost, naming it', () => {
    const stored = JSON.parse(serialize(inProgress()));
    stored.schemaVersion = SESSION_SCHEMA_VERSION + 1;
    expect(readSavedSession(JSON.stringify(stored))).toEqual({
      kind: 'lost_in_update',
      difficulty: 'medium',
    });
  });

  it('reports an older save that fails after converting as lost', () => {
    const stored = JSON.parse(serialize(inProgress()));
    stored.schemaVersion = 1;
    delete stored.savedAt;
    stored.session.currentWord = 'otter'; // disagrees with the chain
    expect(readSavedSession(JSON.stringify(stored))).toEqual({
      kind: 'lost_in_update',
      difficulty: 'medium',
    });
  });

  it('still reports the loss when the difficulty can no longer be read', () => {
    const stored = JSON.parse(serialize(inProgress()));
    stored.schemaVersion = SESSION_SCHEMA_VERSION + 1;
    stored.session.difficulty = 'nightmare';
    expect(readSavedSession(JSON.stringify(stored))).toEqual({
      kind: 'lost_in_update',
      difficulty: null,
    });
  });

  it('does not report a finished game in an old format — there was nothing to lose', () => {
    const won = applyComputerCannotMove(playerPlays(newSession(), 'eagle'), {
      playerRepliesRemaining: 4,
    });
    const stored = JSON.parse(serialize(won));
    stored.schemaVersion = SESSION_SCHEMA_VERSION + 1;
    expect(readSavedSession(JSON.stringify(stored))).toEqual({ kind: 'discarded' });
  });

  it('keeps the game when only its last-played time is bad', () => {
    const stored = JSON.parse(serialize(inProgress()));
    stored.savedAt = 'last Tuesday';
    const result = readSavedSession(JSON.stringify(stored));
    expect(result.kind).toBe('restored');
    expect(result.kind === 'restored' && result.savedAt).toBeNull();
  });
});

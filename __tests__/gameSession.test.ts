import {
  createSession,
  setInput,
  beginValidation,
  applyValidation,
  beginComputerTurn,
  applyComputerMove,
  applyComputerCannotMove,
  applyPlayerCannotMove,
  abandonSession,
  failSession,
  isRoundOver,
  usedWords,
} from '@features/game/gameSession';
import type { GameSessionState, GameStatus, TurnPhase } from '@app-types/game';
import type { ValidationResult } from '@features/game/ruleEngine';

const valid = (word: string): ValidationResult => ({
  isValid: true,
  normalizedWord: word,
  reason: null,
});

const invalid = (word: string, reason: ValidationResult['reason']): ValidationResult => ({
  isValid: false,
  normalizedWord: word,
  reason,
});

const newSession = (startingWord = 'apple'): GameSessionState =>
  createSession({ sessionId: 's1', difficulty: 'medium', startingWord });

/** Plays one accepted player word, for tests that need a move on the chain. */
const playerPlays = (state: GameSessionState, word: string): GameSessionState =>
  applyValidation(beginValidation(setInput(state, word)), {
    submittedWord: word,
    result: valid(word),
  });

describe('createSession', () => {
  it('starts active with the player up and the required letter derived', () => {
    const state = newSession('apple');
    expect(state.status).toBe('active');
    expect(state.phase).toBe('input_empty');
    expect(state.currentWord).toBe('apple');
    expect(state.requiredLetter).toBe('e');
    expect(state.score).toBe(0);
  });

  it('seeds the opening word into the chain as the computer move', () => {
    // Otherwise the duplicate rule never sees it and either side could
    // replay the opener later in the round.
    const state = newSession('apple');
    expect(state.chain).toHaveLength(1);
    expect(state.chain[0]).toMatchObject({ actor: 'computer', normalizedWord: 'apple' });
    expect(usedWords(state).has('apple')).toBe(true);
  });

  it('normalizes the starting word', () => {
    const state = newSession('  APPLE  ');
    expect(state.currentWord).toBe('apple');
    expect(state.requiredLetter).toBe('e');
  });
});

describe('turn phases', () => {
  it('moves between input_empty and player_turn as the player types', () => {
    let state = newSession();
    expect(state.phase).toBe('input_empty');
    state = setInput(state, 'ea');
    expect(state.phase).toBe('player_turn');
    state = setInput(state, '   ');
    expect(state.phase).toBe('input_empty');
  });

  it('enters validating on submit', () => {
    expect(beginValidation(setInput(newSession(), 'eagle')).phase).toBe('validating');
  });

  it('enters computer_thinking when the turn is handed over', () => {
    expect(beginComputerTurn(newSession()).phase).toBe('computer_thinking');
  });

  it('reaches every TurnPhase value across a full turn cycle', () => {
    // The seven values in types/game.ts must all be reachable, not merely
    // declared (Delivery Plan WL-110).
    const seen = new Set<TurnPhase>();
    let state = newSession('apple');
    seen.add(state.phase); // input_empty
    state = setInput(state, 'eagle');
    seen.add(state.phase); // player_turn
    state = beginValidation(state);
    seen.add(state.phase); // validating

    const rejected = applyValidation(state, {
      submittedWord: 'eagle',
      result: invalid('eagle', 'duplicate'),
    });
    seen.add(rejected.phase); // invalid_word

    state = applyValidation(state, { submittedWord: 'eagle', result: valid('eagle') });
    seen.add(state.phase); // valid_move
    state = beginComputerTurn(state);
    seen.add(state.phase); // computer_thinking
    seen.add(applyComputerCannotMove(state, { playerRepliesRemaining: 5 }).phase); // no_computer_move

    expect(seen).toEqual(
      new Set<TurnPhase>([
        'input_empty',
        'player_turn',
        'validating',
        'computer_thinking',
        'invalid_word',
        'valid_move',
        'no_computer_move',
      ]),
    );
  });
});

describe('applyValidation', () => {
  it('appends an accepted word and advances the required letter', () => {
    const state = playerPlays(newSession('apple'), 'eagle');
    expect(state.phase).toBe('valid_move');
    expect(state.currentWord).toBe('eagle');
    expect(state.requiredLetter).toBe('e');
    expect(state.chain).toHaveLength(2);
    expect(state.chain[1]).toMatchObject({ actor: 'player', normalizedWord: 'eagle' });
  });

  it('adds the awarded score', () => {
    const base = beginValidation(setInput(newSession(), 'eagle'));
    const state = applyValidation(base, {
      submittedWord: 'eagle',
      result: valid('eagle'),
      scoreAwarded: 14,
    });
    expect(state.score).toBe(14);
  });

  it('keeps the round playable after a rejection so the player can edit', () => {
    // Wireframe doc section 10 — the player must be able to recover.
    const before = beginValidation(setInput(newSession('apple'), 'zebra'));
    const after = applyValidation(before, {
      submittedWord: 'zebra',
      result: invalid('zebra', 'wrong_letter'),
    });
    expect(after.phase).toBe('invalid_word');
    expect(after.status).toBe('active');
    expect(after.requiredLetter).toBe('e');
    expect(after.chain).toHaveLength(1);
  });

  it('treats a reasonless rejection as empty input, not an error', () => {
    const before = beginValidation(newSession());
    const after = applyValidation(before, {
      submittedWord: '',
      result: invalid('', null),
    });
    expect(after.phase).toBe('input_empty');
  });
});

describe('round endings', () => {
  it('ends as computer_win when the computer blocks the player', () => {
    // The load-bearing ending: starving the player's letter is exactly what
    // option_reduction_score exists to do.
    const state = applyComputerMove(beginComputerTurn(newSession()), {
      word: 'jinx',
      playerRepliesRemaining: 0,
    });
    expect(state.status).toBe('computer_win');
    expect(isRoundOver(state)).toBe(true);
  });

  it('continues when the computer moves and the player still has replies', () => {
    const state = applyComputerMove(beginComputerTurn(newSession()), {
      word: 'eagle',
      playerRepliesRemaining: 120,
    });
    expect(state.status).toBe('active');
    expect(state.phase).toBe('input_empty');
    expect(state.requiredLetter).toBe('e');
  });

  it('ends as player_win when the computer is stuck but a human would not be', () => {
    const state = applyComputerCannotMove(beginComputerTurn(newSession()), {
      playerRepliesRemaining: 40,
    });
    expect(state.status).toBe('player_win');
    expect(state.phase).toBe('no_computer_move');
  });

  it('ends as draw when neither side can move', () => {
    // Wireframe section 14's "draw or exhausted dictionary".
    const state = applyComputerCannotMove(beginComputerTurn(newSession()), {
      playerRepliesRemaining: 0,
    });
    expect(state.status).toBe('draw');
  });

  it('ends as computer_win when the player has no reply at turn start', () => {
    expect(applyPlayerCannotMove(newSession()).status).toBe('computer_win');
  });

  it('ends as abandoned when the player leaves', () => {
    expect(abandonSession(newSession()).status).toBe('abandoned');
  });

  it('ends as technical_failure when the round breaks', () => {
    expect(failSession(newSession()).status).toBe('technical_failure');
  });

  it('reaches every GameStatus value', () => {
    // All six, including the technical_failure value WL-110 added.
    const statuses = new Set<GameStatus>([
      newSession().status,
      applyComputerMove(newSession(), { word: 'jinx', playerRepliesRemaining: 0 }).status,
      applyComputerCannotMove(newSession(), { playerRepliesRemaining: 3 }).status,
      applyComputerCannotMove(newSession(), { playerRepliesRemaining: 0 }).status,
      abandonSession(newSession()).status,
      failSession(newSession()).status,
    ]);
    expect(statuses).toEqual(
      new Set<GameStatus>([
        'active',
        'computer_win',
        'player_win',
        'draw',
        'abandoned',
        'technical_failure',
      ]),
    );
  });
});

describe('a finished round is immutable', () => {
  const finished = abandonSession(newSession('apple'));

  it('ignores every ordinary transition once the round is over', () => {
    // Late taps and queued computer moves are an ordinary race in a UI with
    // async turns; they must not resurrect a round or overwrite its result.
    expect(setInput(finished, 'eagle')).toBe(finished);
    expect(beginValidation(finished)).toBe(finished);
    expect(beginComputerTurn(finished)).toBe(finished);
    expect(
      applyValidation(finished, { submittedWord: 'eagle', result: valid('eagle') }),
    ).toBe(finished);
    expect(applyComputerMove(finished, { word: 'eagle', playerRepliesRemaining: 9 })).toBe(
      finished,
    );
    expect(applyComputerCannotMove(finished, { playerRepliesRemaining: 9 })).toBe(finished);
    expect(applyPlayerCannotMove(finished)).toBe(finished);
    expect(abandonSession(finished)).toBe(finished);
  });

  it('still records a technical failure over an existing result', () => {
    // Deliberately not inert: a build that breaks after a round ended should
    // not look healthy in the metrics.
    expect(failSession(finished).status).toBe('technical_failure');
  });

  it('does not let a late move change the score or chain', () => {
    const late = applyValidation(finished, {
      submittedWord: 'eagle',
      result: valid('eagle'),
      scoreAwarded: 99,
    });
    expect(late.score).toBe(0);
    expect(late.chain).toHaveLength(1);
  });
});

describe('usedWords', () => {
  it('accumulates both players\' words', () => {
    let state = playerPlays(newSession('apple'), 'eagle');
    state = applyComputerMove(beginComputerTurn(state), {
      word: 'ended',
      playerRepliesRemaining: 50,
    });
    expect(usedWords(state)).toEqual(new Set(['apple', 'eagle', 'ended']));
  });
});

describe('a full round plays through', () => {
  it('alternates turns and accumulates chain and score', () => {
    let state = newSession('apple');

    state = playerPlays(state, 'eagle');
    state = applyComputerMove(beginComputerTurn(state), {
      word: 'ember',
      playerRepliesRemaining: 80,
    });
    state = playerPlays(state, 'radish');
    state = applyComputerMove(beginComputerTurn(state), {
      word: 'harp',
      playerRepliesRemaining: 60,
    });

    expect(state.status).toBe('active');
    expect(state.chain.map(m => m.normalizedWord)).toEqual([
      'apple',
      'eagle',
      'ember',
      'radish',
      'harp',
    ]);
    expect(state.chain.map(m => m.actor)).toEqual([
      'computer',
      'player',
      'computer',
      'player',
      'computer',
    ]);
    expect(state.chain.map(m => m.turnNumber)).toEqual([1, 2, 3, 4, 5]);
    expect(state.requiredLetter).toBe('p');
  });
});

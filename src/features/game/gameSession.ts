/**
 * Game session state machine (WL-110).
 *
 * Owns the seven `TurnPhase` values and the six `GameStatus` values declared
 * in `types/game.ts`, and the shape ratified as `GameSessionState` in the
 * Data Model doc section 4.1.
 *
 * ## Pure by design
 *
 * Every transition here is synchronous and takes the facts it needs as
 * arguments — it never calls the dictionary, the rule engine or the
 * difficulty engine itself. Two reasons:
 *
 * - The transient phases (`validating`, `computer_thinking`) exist so the UI
 *   can *render* them. If a transition awaited the work itself, those phases
 *   would never be observable and Wireframe doc section 9 could not be
 *   satisfied.
 * - Transitions have to be exhaustively testable, including endings that are
 *   rare or impossible to provoke through the real dictionary.
 *
 * The caller does the async work and feeds results back in. Turn *timing* —
 * the minimum think delay and the timeout path — belongs to WL-306, not here.
 *
 * ## How a round ends
 *
 * Wireframe doc section 14 requires five result states, and PRD section 24
 * requires detecting both no-valid-move conditions. The mapping:
 *
 * | Situation | Status |
 * |---|---|
 * | Player's turn, dictionary offers no reply for the required letter | `computer_win` |
 * | Computer has no candidate, but the player would have had a reply | `player_win` |
 * | Neither side can move from the required letter | `draw` |
 * | Player leaves the round | `abandoned` |
 * | Something broke | `technical_failure` |
 *
 * The first row is the load-bearing one. Blocking the player is precisely
 * what `option_reduction_score` exists to do, so "the player has no valid
 * move" is the computer's main route to winning — not an edge case. PRD
 * section 9.4 targets a 20-40% player win rate on Hard, which is only
 * reachable if the computer wins by starving letters.
 *
 * `draw` is kept distinct from `player_win` for the case Wireframe section 14
 * names "draw or exhausted dictionary": the computer draws from a subset of
 * what the player may submit, so a computer with no candidates usually means
 * a human could still have continued (`player_win`). Only when the wider
 * player set is empty too has the dictionary genuinely run out.
 */
import type { GameSessionState, GameStatus, Move, TurnPhase } from '@app-types/game';
import type { ValidationResult } from '@features/game/ruleEngine';
import { getRequiredLetter, normalizeWord } from '@features/game/ruleEngine';
import { roundEndBonus } from '@features/scoring/scoringEngine';

/** A completed round: every status except `active`. */
export function isRoundOver(state: GameSessionState): boolean {
  return state.status !== 'active';
}

/**
 * The single place a round's score is finalized, so every ending path — win,
 * loss, draw, abandonment, failure — prices itself the same way (WL-111).
 * `roundEndBonus` decides which of those actually pay out.
 */
function endRound(state: GameSessionState, status: GameStatus): GameSessionState {
  const bonus = roundEndBonus({
    status,
    chainLength: state.chain.length,
    previousBestChainLength: state.previousBestChainLength,
  });

  return { ...state, status, phase: 'no_computer_move', score: state.score + bonus };
}

/**
 * Transitions are inert once a round is over, rather than throwing.
 *
 * A late tap arriving after the round ended — a queued computer move, a
 * double-tapped Submit — is an ordinary race in a UI with async turns, not a
 * programming error, and it must not resurrect a finished round or overwrite
 * its result.
 */
function ignoreIfOver<T extends unknown[]>(
  fn: (state: GameSessionState, ...args: T) => GameSessionState,
): (state: GameSessionState, ...args: T) => GameSessionState {
  return (state, ...args) => (isRoundOver(state) ? state : fn(state, ...args));
}

export function createSession(params: {
  sessionId: string;
  difficulty: GameSessionState['difficulty'];
  startingWord: string;
  isOfflineSession?: boolean;
  /**
   * The player's longest chain so far, for the personal-best bonus. Omit
   * when no profile has been loaded — WL-402 supplies the real value, and
   * until then no milestone should be invented.
   */
  previousBestChainLength?: number | null;
}): GameSessionState {
  const startingWord = normalizeWord(params.startingWord);

  // The starting word is seeded into the chain as the computer's opening
  // move, not held outside it. `usedWords` reads the chain, so leaving it out
  // would let either side replay the opener later in the round — the
  // duplicate rule (PRD section 8.4) would never see it.
  const opener: Move = {
    moveId: `${params.sessionId}-0`,
    turnNumber: 1,
    actor: 'computer',
    submittedWord: params.startingWord,
    normalizedWord: startingWord,
    isValid: true,
    invalidReason: null,
    hintUsed: false,
    scoreAwarded: 0,
  };

  return {
    sessionId: params.sessionId,
    difficulty: params.difficulty,
    currentWord: startingWord,
    requiredLetter: getRequiredLetter(startingWord),
    status: 'active',
    // The opener is the computer's, so the player is up first with an empty
    // input (Wireframe doc section 9, "input empty").
    phase: 'input_empty',
    chain: [opener],
    score: 0,
    hintsUsed: 0,
    isOfflineSession: params.isOfflineSession ?? true,
    previousBestChainLength: params.previousBestChainLength ?? null,
  };
}

/**
 * Reflects typing. Wireframe section 9 separates "input empty" from "player
 * turn" because Submit is disabled in the former.
 */
export const setInput = ignoreIfOver(
  (state: GameSessionState, rawInput: string): GameSessionState => {
    const phase: TurnPhase = normalizeWord(rawInput).length === 0 ? 'input_empty' : 'player_turn';
    return phase === state.phase ? state : { ...state, phase };
  },
);

/** Submit pressed; the caller now runs validation. */
export const beginValidation = ignoreIfOver(
  (state: GameSessionState): GameSessionState => ({ ...state, phase: 'validating' }),
);

/**
 * Applies the rule engine's verdict on the player's word.
 *
 * An invalid word does not end the turn: Wireframe doc section 10 requires
 * the player to be able to edit and resubmit, so the round stays active and
 * the required letter is unchanged.
 */
export const applyValidation = ignoreIfOver(
  (
    state: GameSessionState,
    params: { submittedWord: string; result: ValidationResult; scoreAwarded?: number },
  ): GameSessionState => {
    const { submittedWord, result } = params;

    if (!result.isValid) {
      return {
        ...state,
        // A rejection with no reason is the empty-input case, which is a
        // non-error state rather than a failed submission.
        phase: result.reason === null ? 'input_empty' : 'invalid_word',
      };
    }

    const scoreAwarded = params.scoreAwarded ?? 0;
    const move: Move = {
      moveId: `${state.sessionId}-${state.chain.length}`,
      turnNumber: state.chain.length + 1,
      actor: 'player',
      submittedWord,
      normalizedWord: result.normalizedWord,
      isValid: true,
      invalidReason: null,
      hintUsed: false,
      scoreAwarded,
    };

    return {
      ...state,
      phase: 'valid_move',
      chain: [...state.chain, move],
      currentWord: result.normalizedWord,
      requiredLetter: getRequiredLetter(result.normalizedWord),
      score: state.score + scoreAwarded,
    };
  },
);

/** Hands over to the computer; the caller now picks its word. */
export const beginComputerTurn = ignoreIfOver(
  (state: GameSessionState): GameSessionState => ({ ...state, phase: 'computer_thinking' }),
);

/**
 * Applies the computer's chosen word.
 *
 * `playerRepliesRemaining` is how many words the player could still submit
 * starting with the new required letter — `replyCountForLetter` answers this
 * directly. Zero means the computer has blocked the player, which ends the
 * round in the computer's favour.
 */
export const applyComputerMove = ignoreIfOver(
  (
    state: GameSessionState,
    params: { word: string; playerRepliesRemaining: number; scoreAwarded?: number },
  ): GameSessionState => {
    const normalizedWord = normalizeWord(params.word);
    const move: Move = {
      moveId: `${state.sessionId}-${state.chain.length}`,
      turnNumber: state.chain.length + 1,
      actor: 'computer',
      submittedWord: params.word,
      normalizedWord,
      isValid: true,
      invalidReason: null,
      hintUsed: false,
      scoreAwarded: params.scoreAwarded ?? 0,
    };

    const next: GameSessionState = {
      ...state,
      chain: [...state.chain, move],
      currentWord: normalizedWord,
      requiredLetter: getRequiredLetter(normalizedWord),
      score: state.score + (params.scoreAwarded ?? 0),
      phase: 'input_empty',
    };

    return params.playerRepliesRemaining <= 0 ? endRound(next, 'computer_win') : next;
  },
);

/**
 * The computer has no legal word for the required letter.
 *
 * `playerRepliesRemaining` is for the *same* letter the computer just failed
 * on. The computer draws from a subset of what the player may submit, so this
 * is usually non-zero — the computer is stuck where a human would not be, and
 * the player wins. Zero means the dictionary itself is exhausted, which
 * Wireframe section 14 treats as a draw rather than a win for either side.
 */
export const applyComputerCannotMove = ignoreIfOver(
  (state: GameSessionState, params: { playerRepliesRemaining: number }): GameSessionState =>
    endRound(state, params.playerRepliesRemaining <= 0 ? 'draw' : 'player_win'),
);

/**
 * The player has no legal reply. Checked when a turn begins, so a round
 * restored mid-play (WL-403) reaches the same verdict as one played straight
 * through.
 */
export const applyPlayerCannotMove = ignoreIfOver((state: GameSessionState): GameSessionState =>
  endRound(state, 'computer_win'),
);

/** Player left the round deliberately (Wireframe section 13, "Exit to Home"). */
export const abandonSession = ignoreIfOver((state: GameSessionState): GameSessionState =>
  endRound(state, 'abandoned'),
);

/**
 * The round cannot continue for a technical reason — a corrupt dictionary
 * asset, or any unexpected failure mid-turn.
 *
 * Unlike the other endings this one is NOT inert on a finished round: a
 * failure is worth recording even if something already set a result, and
 * silently dropping it is how a broken build looks healthy in the metrics.
 */
export function failSession(state: GameSessionState): GameSessionState {
  return endRound(state, 'technical_failure');
}

/** Words already played this round, for the rule engine and reply counts. */
export function usedWords(state: GameSessionState): Set<string> {
  return new Set(state.chain.map(move => move.normalizedWord));
}

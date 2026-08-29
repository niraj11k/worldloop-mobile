/**
 * Saving and restoring a round in progress (WL-403).
 *
 * Spec: Wireframe doc section 13 — "preserve the current game state", "do not
 * lose the chain if the user leaves temporarily". Save after every turn,
 * restore on launch.
 *
 * Pure, like the rest of `features/game`: this module decides what a saved
 * round means, `services/game/sessionRepository` does the I/O, and
 * `useSavedRoundStore` owns when.
 *
 * ## Why this parser is strict where the profile's is forgiving
 *
 * `parseProfile` repairs what it can, because a player's whole history is at
 * stake and one bad field must not cost them every score they have. A saved
 * round is the opposite trade: it is worth minutes, not months, and a
 * half-repaired round is a *playable object* — a chain missing entries, a
 * required letter that doesn't match the last word, a score that no longer
 * follows from the moves. Restoring that is worse than starting fresh, so
 * anything that doesn't read back exactly is discarded.
 */
import type { GameSessionState, Move, TurnPhase } from '@app-types/game';
import { isRoundOver } from '@features/game/gameSession';

/**
 * Bumped when a change to `GameSessionState` makes an already-saved round
 * unreadable. Unlike the profile's version there is no migration path and
 * there shouldn't be one: a round from an older build is discarded, which
 * costs the player one unfinished round rather than any lasting data.
 */
export const SESSION_SCHEMA_VERSION = 1;

interface SavedRound {
  schemaVersion: number;
  session: GameSessionState;
}

const DIFFICULTIES: GameSessionState['difficulty'][] = ['easy', 'medium', 'hard'];

export function serializeSession(session: GameSessionState): string {
  const saved: SavedRound = { schemaVersion: SESSION_SCHEMA_VERSION, session };
  return JSON.stringify(saved);
}

/**
 * Reads a saved round back, or `null` if there isn't one worth restoring.
 *
 * A *finished* round is rejected as firmly as a corrupt one. Nothing should
 * ever save one — the screen clears the slot when a round ends — but if one
 * were somehow left behind, restoring it would drop the player into a
 * game-over screen for a round they already saw, and re-record it against
 * their profile.
 */
export function parseSavedSession(raw: string | null): GameSessionState | null {
  if (raw === null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!isObject(parsed)) return null;
  if (parsed.schemaVersion !== SESSION_SCHEMA_VERSION) return null;
  if (!isObject(parsed.session)) return null;

  const session = parsed.session as Partial<GameSessionState>;
  if (
    typeof session.sessionId !== 'string' ||
    session.sessionId.length === 0 ||
    !DIFFICULTIES.includes(session.difficulty as GameSessionState['difficulty']) ||
    typeof session.currentWord !== 'string' ||
    typeof session.requiredLetter !== 'string' ||
    typeof session.status !== 'string' ||
    typeof session.phase !== 'string' ||
    !isCount(session.score) ||
    !isCount(session.hintsUsed) ||
    !Array.isArray(session.chain) ||
    session.chain.length === 0 ||
    !session.chain.every(isMove)
  ) {
    return null;
  }

  const restored = session as GameSessionState;
  if (isRoundOver(restored)) return null;

  // The chain is the round: if its last word isn't the word on the board, the
  // two disagree about whose turn it is and what letter is required, and no
  // amount of repair can say which one was right.
  const lastMove = restored.chain[restored.chain.length - 1];
  if (lastMove === undefined || lastMove.normalizedWord !== restored.currentWord) {
    return null;
  }

  return {
    ...restored,
    isOfflineSession: restored.isOfflineSession ?? true,
    previousBestChainLength: isCount(restored.previousBestChainLength)
      ? restored.previousBestChainLength
      : null,
  };
}

/**
 * Puts a restored round back into a phase the player can act from.
 *
 * A round is saved in whatever phase it was in when the app went away, and
 * three of the seven aren't resumable as-is:
 *
 * - `validating` — a word was in flight and its verdict is unknown. It never
 *   reached the chain, so the round rewinds to the player's turn; they retype
 *   it. Guessing the verdict instead would be inventing a move.
 * - `invalid_word` — the error message isn't part of the session, so the
 *   state would restore with a rejection the player can no longer read.
 * - `valid_move` / `computer_thinking` — the player's word *is* in the chain
 *   and the computer owes a reply that never arrived. This is the one case
 *   that can't just settle into "your turn": that would leave the player
 *   needing a word starting with their own word's last letter, playing
 *   against themselves. It restores as `computer_thinking`, and the caller
 *   runs the computer's turn — the same work the killed process was doing.
 *
 * `player_turn` becomes `input_empty` for the same reason `validating` does:
 * what was typed is not part of the round.
 */
export function restorePhase(phase: TurnPhase): TurnPhase {
  return phase === 'valid_move' || phase === 'computer_thinking'
    ? 'computer_thinking'
    : 'input_empty';
}

/** The restored round, ready to hand to the screen. */
export function restoreSession(session: GameSessionState): GameSessionState {
  return { ...session, phase: restorePhase(session.phase) };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isMove(value: unknown): value is Move {
  if (!isObject(value)) return false;
  return (
    typeof value.moveId === 'string' &&
    typeof value.turnNumber === 'number' &&
    (value.actor === 'player' || value.actor === 'computer') &&
    typeof value.submittedWord === 'string' &&
    typeof value.normalizedWord === 'string' &&
    typeof value.isValid === 'boolean' &&
    typeof value.hintUsed === 'boolean' &&
    typeof value.scoreAwarded === 'number'
  );
}

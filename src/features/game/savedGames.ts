/**
 * The rules for paused games (Delivery Plan D-13, WL-410).
 *
 * Pure, like the rest of `features/game`: this module decides what the two
 * save slots are allowed to hold, `services/game/sessionRepository` does the
 * I/O, and `useSavedRoundStore` owns when.
 *
 * D-13's four rules:
 *
 * 1. Never two games of the same difficulty.
 * 2. At most one *paused* game — kept for later, shown on Home, no expiry.
 * 3. Moving to another difficulty needs the current game paused or ended.
 * 4. A second game can only be paused once the first paused game has ended,
 *    and the player ends it themselves by going back to it. There is
 *    deliberately no shortcut that ends a game the player isn't looking at.
 *
 * Rule 4 has a consequence worth stating where the rules live: a game started
 * while another is paused can only ever be *ended*, never paused, because the
 * paused game can't be reached without leaving the new one first.
 *
 * Rule 1 holds by construction rather than by a check here: the only way to
 * start a game of the paused game's difficulty is the Difficulty screen,
 * which offers Resume or End and Start New for it (`difficultyStartFor`).
 */
import type { GameSessionState } from '@app-types/game';

export interface SavedGames {
  /** The game being played, or one a crash or force-quit interrupted. */
  current: GameSessionState | null;
  /** The one game the player chose to keep for later. */
  paused: GameSessionState | null;
}

/**
 * Settles the two slots read back at launch into a state the rules allow.
 *
 * Pausing and resuming each write one slot and then clear the other, so an
 * app killed between the two writes can leave the *same* game in both. That
 * game is treated as the one being played: it is still offered on Home, so
 * nothing is lost, and the pause slot is free again. Keeping both copies
 * would show the player one game twice, and let it be played on from two
 * different points.
 */
export function reconcileSavedGames(slots: SavedGames): SavedGames {
  if (
    slots.current !== null &&
    slots.paused !== null &&
    slots.current.sessionId === slots.paused.sessionId
  ) {
    return { current: slots.current, paused: null };
  }
  return slots;
}

/**
 * Rules 2 and 4: a game can be paused only while the pause slot is free.
 *
 * A game resumed from the pause slot moves out of it (see the store's
 * `resumePaused`), so the slot is free again while that game is played and
 * it can be paused a second time. The `sessionId` comparison only covers the
 * moment between the two writes, where the slot can still hold this game.
 */
export function canPause(paused: GameSessionState | null, session: GameSessionState): boolean {
  return paused === null || paused.sessionId === session.sessionId;
}

/**
 * What the Difficulty screen offers for the difficulty the player selected
 * (Wireframe §6, D-13).
 *
 * - `new` — nothing is paused: an ordinary new game.
 * - `resume_or_restart` — this difficulty's game is paused: Resume it, or End
 *   and Start New. Rule 1 means a second game of it can't simply be started.
 * - `new_unpausable` — another difficulty's game is paused: a new game starts,
 *   but by rule 4 it can only be ended, never paused, and the screen says so
 *   before it starts rather than when the player tries to leave.
 */
export type DifficultyStart = 'new' | 'resume_or_restart' | 'new_unpausable';

export function difficultyStartFor(
  difficulty: GameSessionState['difficulty'],
  paused: GameSessionState | null,
): DifficultyStart {
  if (paused === null) return 'new';
  return paused.difficulty === difficulty ? 'resume_or_restart' : 'new_unpausable';
}

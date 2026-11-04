/**
 * Saving and restoring a game in progress (WL-403), across app updates and
 * days away (D-14, WL-411).
 *
 * Spec: Wireframe doc section 13 — "preserve the current game state", "do not
 * lose the chain if the user leaves temporarily". Save after every turn,
 * restore on launch.
 *
 * Pure, like the rest of `features/game`: this module decides what a saved
 * game means, `services/game/sessionRepository` does the I/O, and
 * `useSavedRoundStore` owns when.
 *
 * ## Why this parser is strict where the profile's is forgiving
 *
 * `parseProfile` repairs what it can, because a player's whole history is at
 * stake and one bad field must not cost them every score they have. A saved
 * game is a different trade: a half-repaired game is a *playable object* — a
 * chain missing entries, a required letter that doesn't match the last word,
 * a score that no longer follows from the moves. Restoring that is worse than
 * starting fresh, so anything that doesn't read back exactly is discarded.
 *
 * ## Why it now converts old formats rather than discarding them
 *
 * Until D-14 a save from an older build was simply dropped: a round was worth
 * minutes. A paused game can now be worth days of play, so an app update must
 * not cost it. Strictness and conversion are not in tension — conversion
 * changes the *envelope* a save is stored in, version by version, and the
 * game inside is then validated exactly as strictly as before.
 */
import type { GameSessionState, Move, TurnPhase } from '@app-types/game';
import { isRoundOver } from '@features/game/gameSession';

/**
 * The format saves are written in. **Bumping it is a two-part change:** add a
 * conversion from the previous version to `CONVERSIONS`, and commit a save
 * written by the new version to `__tests__/fixtures/savedGames/`. The fixture
 * test fails until both are done, so an update can't ship that strands saves.
 *
 * - v1 (WL-403): `{ schemaVersion, session }`.
 * - v2 (WL-411): adds `savedAt`, the last time the game was played, for Home's
 *   "3 days ago" (D-14).
 */
export const SESSION_SCHEMA_VERSION = 2;

interface SavedRound {
  schemaVersion: number;
  /** ISO time the game was last saved — its last-played time. `null` if unknown. */
  savedAt: string | null;
  session: GameSessionState;
}

type StoredObject = Record<string, unknown>;

/**
 * One step per shipped format, keyed by the version it converts *from*. Each
 * step only reshapes the envelope; the game inside is validated afterwards.
 */
const CONVERSIONS: Record<number, (saved: StoredObject) => StoredObject> = {
  // v1 → v2: a v1 save never recorded when it was played.
  1: saved => ({ ...saved, schemaVersion: 2, savedAt: null }),
};

const DIFFICULTIES: GameSessionState['difficulty'][] = ['easy', 'medium', 'hard'];

export function serializeSession(session: GameSessionState, savedAt: Date): string {
  const saved: SavedRound = {
    schemaVersion: SESSION_SCHEMA_VERSION,
    savedAt: savedAt.toISOString(),
    session,
  };
  return JSON.stringify(saved);
}

/**
 * What a save slot turned out to hold.
 *
 * - `empty` — nothing saved.
 * - `restored` — a game worth resuming, converted to the current format if it
 *   was older.
 * - `discarded` — nothing worth keeping: unreadable, corrupt, or a game that
 *   was already over. Dropped silently, as before WL-411; there is no game the
 *   player would recognise as lost.
 * - `lost_in_update` — a real game from another app version that couldn't be
 *   converted. Home says so once (D-14) rather than the game vanishing.
 *   `difficulty` names it when it can still be read.
 */
export type SaveReadResult =
  | { kind: 'empty' }
  | { kind: 'restored'; session: GameSessionState; savedAt: string | null }
  | { kind: 'discarded' }
  | { kind: 'lost_in_update'; difficulty: GameSessionState['difficulty'] | null };

export function readSavedSession(raw: string | null): SaveReadResult {
  if (raw === null) return { kind: 'empty' };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { kind: 'discarded' };
  }
  if (!isObject(parsed) || typeof parsed.schemaVersion !== 'number') {
    return { kind: 'discarded' };
  }

  const original: StoredObject = parsed;
  const fromVersion = parsed.schemaVersion;
  const lost = (): SaveReadResult =>
    gameWasActive(original)
      ? { kind: 'lost_in_update', difficulty: readableDifficulty(original) }
      : { kind: 'discarded' };

  // Convert one version at a time up to the current one. A missing step — a
  // version this build never knew, such as one from a newer build after a
  // downgrade — means the save can't be read.
  let saved: StoredObject = original;
  for (let version = fromVersion; version < SESSION_SCHEMA_VERSION; version++) {
    const convert = CONVERSIONS[version];
    if (convert === undefined) return lost();
    saved = convert(saved);
  }
  if (saved.schemaVersion !== SESSION_SCHEMA_VERSION) return lost();

  const session = validateSession(saved.session);
  if (session === null) {
    // A current-format save that fails validation was corrupt, not lost to an
    // update. An older one that fails after converting is the update's fault.
    return fromVersion === SESSION_SCHEMA_VERSION ? { kind: 'discarded' } : lost();
  }

  return { kind: 'restored', session, savedAt: readSavedAt(saved.savedAt) };
}

/**
 * The game in a save, or `null` if there isn't one worth restoring — the
 * shorthand for callers that don't care *why*.
 */
export function parseSavedSession(raw: string | null): GameSessionState | null {
  const result = readSavedSession(raw);
  return result.kind === 'restored' ? result.session : null;
}

/**
 * Validates the game inside a save.
 *
 * A *finished* game is rejected as firmly as a corrupt one. Nothing should
 * ever save one — the screen clears the slot when a game ends — but if one
 * were somehow left behind, restoring it would drop the player into a
 * game-over screen for a game they already saw, and re-record it against
 * their profile.
 */
function validateSession(value: unknown): GameSessionState | null {
  if (!isObject(value)) return null;

  const session = value as Partial<GameSessionState>;
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

  // The chain is the game: if its last word isn't the word on the board, the
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
 * Only a game still in play is worth telling the player about. A finished one
 * in an old format would have been discarded in any version.
 */
function gameWasActive(saved: StoredObject): boolean {
  return isObject(saved.session) && saved.session.status === 'active';
}

function readableDifficulty(saved: StoredObject): GameSessionState['difficulty'] | null {
  const difficulty = isObject(saved.session) ? saved.session.difficulty : undefined;
  return DIFFICULTIES.includes(difficulty as GameSessionState['difficulty'])
    ? (difficulty as GameSessionState['difficulty'])
    : null;
}

/** A bad timestamp costs only the "3 days ago" label, never the game. */
function readSavedAt(value: unknown): string | null {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : null;
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

/**
 * Persistence for saved games (WL-403, WL-410).
 *
 * The I/O boundary for the two save slots, mirroring `profileRepository`: it
 * owns the keys and the serialization and nothing else. Local-only, like
 * everything else in a guest-only v1 (D-03 — there is no server to sync a
 * half-played game to).
 *
 * - `current` (`CURRENT_SESSION`) — the game being played, written after
 *   every change so it survives the app being killed (WL-403).
 * - `paused` (`PAUSED_SESSION`) — the one game the player chose to keep for
 *   later (D-13). Same format and the same strict parsing as `current`.
 */
import { storage, STORAGE_KEYS } from '@services/storage/storage';
import { reportError } from '@services/crashReporting/crashReporting';
import { parseSavedSession, serializeSession } from '@features/game/sessionPersistence';
import type { GameSessionState } from '@app-types/game';

export type SaveSlot = 'current' | 'paused';

const SLOT_KEYS: Record<SaveSlot, string> = {
  current: STORAGE_KEYS.CURRENT_SESSION,
  paused: STORAGE_KEYS.PAUSED_SESSION,
};

/**
 * The game in a slot, or `null` if there is nothing worth restoring — an
 * empty slot, one this build can't read, or one that didn't survive
 * validation.
 *
 * A read failure resolves to `null` rather than throwing: the worst case is
 * the player starts a new game, and that must not be dressed up as a launch
 * crash. It is still reported, because a save slot that never reads back
 * looks exactly like a feature nobody uses.
 */
export async function loadSavedRound(
  slot: SaveSlot = 'current',
): Promise<GameSessionState | null> {
  try {
    return parseSavedSession(await storage.getItem(SLOT_KEYS[slot]));
  } catch (error) {
    reportError(error, { scope: `sessionRepository.load.${slot}` });
    return null;
  }
}

export async function saveRound(
  session: GameSessionState,
  slot: SaveSlot = 'current',
): Promise<void> {
  await storage.setItem(SLOT_KEYS[slot], serializeSession(session));
}

/** Empties a slot — the game finished, moved to the other slot, or was let go. */
export async function clearSavedRound(slot: SaveSlot = 'current'): Promise<void> {
  await storage.removeItem(SLOT_KEYS[slot]);
}

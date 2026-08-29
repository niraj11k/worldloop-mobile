/**
 * Persistence for the round in progress (WL-403).
 *
 * The I/O boundary for `CURRENT_SESSION`, mirroring `profileRepository`: it
 * owns the key and the serialization and nothing else. Local-only, like
 * everything else in a guest-only v1 (D-03 — there is no server to sync a
 * half-played round to).
 */
import { storage, STORAGE_KEYS } from '@services/storage/storage';
import { reportError } from '@services/crashReporting/crashReporting';
import { parseSavedSession, serializeSession } from '@features/game/sessionPersistence';
import type { GameSessionState } from '@app-types/game';

/**
 * The saved round, or `null` if there is nothing worth restoring — no saved
 * round, one this build can't read, or one that didn't survive validation.
 *
 * A read failure resolves to `null` rather than throwing: the worst case is
 * the player starts a new round, and that must not be dressed up as a launch
 * crash. It is still reported, because a save slot that never reads back
 * looks exactly like a feature nobody uses.
 */
export async function loadSavedRound(): Promise<GameSessionState | null> {
  try {
    return parseSavedSession(await storage.getItem(STORAGE_KEYS.CURRENT_SESSION));
  } catch (error) {
    reportError(error, { scope: 'sessionRepository.load' });
    return null;
  }
}

export async function saveRound(session: GameSessionState): Promise<void> {
  await storage.setItem(STORAGE_KEYS.CURRENT_SESSION, serializeSession(session));
}

/** Empties the slot — the round finished, or the player let it go. */
export async function clearSavedRound(): Promise<void> {
  await storage.removeItem(STORAGE_KEYS.CURRENT_SESSION);
}

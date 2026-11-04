import { create } from 'zustand';

import { restoreSession, type SaveReadResult } from '@features/game/sessionPersistence';
import { isRoundInProgress } from '@features/game/gameSession';
import { canPause, reconcileSavedGames } from '@features/game/savedGames';
import {
  clearSavedRound,
  loadSavedRound,
  saveRound,
  type SaveSlot,
} from '@services/game/sessionRepository';
import { reportError } from '@services/crashReporting/crashReporting';
import type { GameSessionState } from '@app-types/game';

interface SavedRoundState {
  /**
   * The game being played, or one a crash or force-quit interrupted, already
   * phase-normalized by `restoreSession` — or `null` when there is none.
   */
  saved: GameSessionState | null;
  /** When `saved` was last played (ISO), or `null` if unknown (D-14). */
  savedAt: string | null;
  /**
   * The one game the player chose to keep for later (D-13), or `null`.
   * Phase-normalized the same way.
   */
  paused: GameSessionState | null;
  /** When `paused` was last played (ISO), or `null` if unknown (D-14). */
  pausedAt: string | null;
  /**
   * Games an app update couldn't carry over (D-14), named by difficulty where
   * it could still be read. Home says so once; `dismissLostSaves` clears it.
   */
  lostSaves: (GameSessionState['difficulty'] | null)[];
  /** `idle` until `load` runs at launch; `ready` after. */
  status: 'idle' | 'loading' | 'ready';
  load: () => Promise<void>;
  /**
   * Persist the game in progress. A game with nothing in it to lose — finished,
   * or not yet moved in — clears the slot instead.
   */
  save: (session: GameSessionState) => Promise<void>;
  clear: () => Promise<void>;
  /**
   * Move a game into the pause slot (Pause & Exit). Resolves `false`, and
   * changes nothing, when D-13 doesn't allow it: the pause slot already holds
   * another game, or there is nothing in this one to keep.
   */
  pause: (session: GameSessionState) => Promise<boolean>;
  /**
   * Move the paused game back to being the game in play, and return it.
   * Resolves `null`, and changes nothing, when there is no paused game or
   * another game is still open (rule 3: that one must be paused or ended
   * first).
   */
  resumePaused: () => Promise<GameSessionState | null>;
  /** Empty the pause slot — its game was ended. */
  clearPaused: () => Promise<void>;
  /** Empty both slots — Delete My Data. */
  clearAll: () => Promise<void>;
  /** The player has seen the lost-in-update notice. */
  dismissLostSaves: () => void;
}

/**
 * Saved games: the game in progress (WL-403) and the one paused game (D-13,
 * WL-410), each with its last-played time (D-14, WL-411).
 *
 * Wireframe section 13 asks that a temporary exit not cost the player their
 * chain. Backgrounding alone never did — the process is still alive — so what
 * the `saved` slot actually protects against is the app being *killed*:
 * force-quit, an OS eviction under memory pressure, or a crash. In every one
 * of those the app has no warning and no chance to flush, which is why the
 * game is written after each turn rather than on the way out.
 *
 * The `paused` slot is the other kind of exit: one the player chose. The
 * rules for what the two slots may hold are in `features/game/savedGames`.
 *
 * "Last played" is simply when the game was last written, which is after
 * every change while it is played, and when it is paused or resumed.
 *
 * Loaded once at launch, so the screens can ask synchronously whether there
 * is a game to resume.
 */
export const useSavedRoundStore = create<SavedRoundState>((set, get) => ({
  saved: null,
  savedAt: null,
  paused: null,
  pausedAt: null,
  lostSaves: [],
  status: 'idle',

  load: async () => {
    if (get().status === 'loading') return;
    set({ status: 'loading' });

    const [currentRead, pausedRead] = await Promise.all([
      loadSavedRound('current'),
      loadSavedRound('paused'),
    ]);
    const current = restoredFrom(currentRead);
    const paused = restoredFrom(pausedRead);
    const settled = reconcileSavedGames({
      current: current === null ? null : restoreSession(current.session),
      paused: paused === null ? null : restoreSession(paused.session),
    });
    const lost: [SaveSlot, SaveReadResult][] = (
      [
        ['current', currentRead],
        ['paused', pausedRead],
      ] as [SaveSlot, SaveReadResult][]
    ).filter(([, read]) => read.kind === 'lost_in_update');

    set({
      saved: settled.current,
      savedAt: settled.current === null ? null : (current?.savedAt ?? null),
      paused: settled.paused,
      pausedAt: settled.paused === null ? null : (paused?.savedAt ?? null),
      lostSaves: lost.map(([, read]) => (read.kind === 'lost_in_update' ? read.difficulty : null)),
      status: 'ready',
    });

    // A game that reconciliation found in both slots is the one in play; drop
    // the stale pause-slot copy from storage too, so the next launch doesn't
    // have to settle it again.
    if (paused !== null && settled.paused === null) {
      await writeSafely(() => clearSavedRound('paused'), 'useSavedRoundStore.load');
    }
    // A save lost in an update is cleared, so the notice about it is shown on
    // this launch only, not on every launch after.
    for (const [slot] of lost) {
      await writeSafely(() => clearSavedRound(slot), 'useSavedRoundStore.load');
    }
  },

  save: async session => {
    // Nothing to keep. A finished game must never sit in the slot: restoring
    // one would show the player a game-over screen they already saw, and
    // record it against their profile a second time. A game the player hasn't
    // moved in holds only the computer's opening word, which a new game deals
    // again anyway (`isRoundInProgress`); keeping it would offer Home a
    // "Resume" for an empty game, and under D-13 make Start Game ask whether
    // to pause or end it.
    if (!isRoundInProgress(session)) {
      await get().clear();
      return;
    }

    const now = new Date();
    set({ saved: session, savedAt: now.toISOString() });
    // Same reasoning as the profile store: this is called from a turn
    // resolving, which can do nothing useful with a rejection, and an
    // unhandled one there would be a crash mid-game.
    await writeSafely(() => saveRound(session, 'current', now), 'useSavedRoundStore.save');
  },

  clear: async () => {
    set({ saved: null, savedAt: null });
    await writeSafely(() => clearSavedRound('current'), 'useSavedRoundStore.clear');
  },

  pause: async session => {
    if (!canPause(get().paused, session) || !isRoundInProgress(session)) {
      return false;
    }

    // Normalized like a restored game, because that is what a paused game is
    // when the player comes back to it: a word in flight is retyped, and a
    // computer reply that was owed is finished on resume.
    const now = new Date();
    set({
      paused: restoreSession(session),
      pausedAt: now.toISOString(),
      saved: null,
      savedAt: null,
    });
    // Pause slot first, then the current slot. An app killed between the two
    // leaves the game in both slots, which `load` settles as still in play —
    // never in neither.
    await writeSafely(() => saveRound(session, 'paused', now), 'useSavedRoundStore.pause');
    await writeSafely(() => clearSavedRound('current'), 'useSavedRoundStore.pause');
    return true;
  },

  resumePaused: async () => {
    const { paused, saved } = get();
    if (paused === null || saved !== null) return null;

    const now = new Date();
    set({ saved: paused, savedAt: now.toISOString(), paused: null, pausedAt: null });
    // Same order as `pause`, mirrored: the game is in the current slot before
    // it leaves the pause slot.
    await writeSafely(
      () => saveRound(paused, 'current', now),
      'useSavedRoundStore.resumePaused',
    );
    await writeSafely(() => clearSavedRound('paused'), 'useSavedRoundStore.resumePaused');
    return paused;
  },

  clearPaused: async () => {
    set({ paused: null, pausedAt: null });
    await writeSafely(() => clearSavedRound('paused'), 'useSavedRoundStore.clearPaused');
  },

  clearAll: async () => {
    set({ saved: null, savedAt: null, paused: null, pausedAt: null, lostSaves: [] });
    await writeSafely(() => clearSavedRound('current'), 'useSavedRoundStore.clearAll');
    await writeSafely(() => clearSavedRound('paused'), 'useSavedRoundStore.clearAll');
  },

  dismissLostSaves: () => {
    set({ lostSaves: [] });
  },
}));

function restoredFrom(
  read: SaveReadResult,
): { session: GameSessionState; savedAt: string | null } | null {
  return read.kind === 'restored' ? { session: read.session, savedAt: read.savedAt } : null;
}

async function writeSafely(write: () => Promise<void>, scope: string): Promise<void> {
  try {
    await write();
  } catch (error) {
    reportError(error, { scope });
  }
}

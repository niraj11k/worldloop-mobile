import { create } from 'zustand';

import { restoreSession } from '@features/game/sessionPersistence';
import { isRoundOver } from '@features/game/gameSession';
import {
  clearSavedRound,
  loadSavedRound,
  saveRound,
} from '@services/game/sessionRepository';
import { reportError } from '@services/crashReporting/crashReporting';
import type { GameSessionState } from '@app-types/game';

interface SavedRoundState {
  /**
   * The round waiting to be resumed, already phase-normalized by
   * `restoreSession` — or `null` when there is nothing to resume.
   */
  saved: GameSessionState | null;
  /** `idle` until `load` runs at launch; `ready` after. */
  status: 'idle' | 'loading' | 'ready';
  load: () => Promise<void>;
  /** Persist the round in progress. Finished rounds clear the slot instead. */
  save: (session: GameSessionState) => Promise<void>;
  clear: () => Promise<void>;
}

/**
 * The saved round in progress (WL-403).
 *
 * Wireframe section 13 asks that a temporary exit not cost the player their
 * chain. Backgrounding alone never did — the process is still alive — so what
 * this actually protects against is the app being *killed*: force-quit, an
 * OS eviction under memory pressure, or a crash. In every one of those the
 * app has no warning and no chance to flush, which is why the round is
 * written after each turn rather than on the way out.
 *
 * Loaded once at launch, so the screens can ask synchronously whether there
 * is a round to resume.
 */
export const useSavedRoundStore = create<SavedRoundState>((set, get) => ({
  saved: null,
  status: 'idle',

  load: async () => {
    if (get().status === 'loading') return;
    set({ status: 'loading' });

    const stored = await loadSavedRound();
    set({
      saved: stored === null ? null : restoreSession(stored),
      status: 'ready',
    });
  },

  save: async session => {
    // A finished round must never sit in the slot: restoring one would show
    // the player a game-over screen they already saw, and record the round
    // against their profile a second time.
    if (isRoundOver(session)) {
      await get().clear();
      return;
    }

    set({ saved: session });
    try {
      await saveRound(session);
    } catch (error) {
      // Same reasoning as the profile store: this is called from a turn
      // resolving, which can do nothing useful with a rejection, and an
      // unhandled one there would be a crash mid-round.
      reportError(error, { scope: 'useSavedRoundStore.save' });
    }
  },

  clear: async () => {
    set({ saved: null });
    try {
      await clearSavedRound();
    } catch (error) {
      reportError(error, { scope: 'useSavedRoundStore.clear' });
    }
  },
}));

import { create } from 'zustand';

import {
  createGuestProfile,
  markSeen,
  recordRoundCompleted,
  resetStatistics,
  updateSettings,
} from '@features/profile/guestProfile';
import {
  clearGuestProfile,
  loadGuestProfile,
  saveGuestProfile,
} from '@services/profile/profileRepository';
import { reportError } from '@services/crashReporting/crashReporting';
import type { GameSessionState } from '@app-types/game';
import type { GuestProfile, GuestSettings } from '@app-types/profile';

/**
 * `idle` before the first `load`, `loading` during it, `ready` afterwards.
 *
 * There is no `error` state, and that is the design: a profile that cannot be
 * read is replaced by a fresh one (see `load`), so the app always reaches
 * `ready`. Nothing in a guest-only, local-first v1 becomes more correct by
 * refusing to let someone play.
 */
export type ProfileStatus = 'idle' | 'loading' | 'ready';

interface ProfileState {
  profile: GuestProfile | null;
  status: ProfileStatus;
  /**
   * Whether `load` had to *create* the guest rather than read one — i.e.
   * whether this is the app's first launch (WL-406).
   *
   * Derived rather than stored: "first launch" and "no profile existed yet"
   * are the same fact, and Architecture section 8.1 has the profile created
   * on first use, so a `hasSeenWelcome` flag would be a second field saying
   * what this one already says. A reinstall therefore shows the welcome
   * again, which is right — that install genuinely is new. Deleting guest
   * data from Settings does *not*, because it writes a replacement profile
   * immediately, and the app is not new to someone who just used its
   * settings screen.
   *
   * The trade-off, deliberately accepted: someone who opens the app, reads
   * the Welcome screen, and force-quits without tapping Play Now does not see
   * it again, because their profile was already written. Recording "seen"
   * only on Play Now would need that extra field, for an edge case where the
   * player has already read the screen.
   */
  isFirstLaunch: boolean;
  /** Load the stored profile, or create one on first launch. */
  load: () => Promise<void>;
  /** Fold a finished round into the profile (WL-402). */
  recordRound: (session: GameSessionState) => Promise<void>;
  setSettings: (patch: Partial<GuestSettings>) => Promise<void>;
  /** Wireframe section 16, "Reset statistics" — keeps discovered words. */
  resetStats: () => Promise<void>;
  /** Guest Deletion doc: erase everything and start a new guest. */
  deleteGuestData: () => Promise<void>;
}

/**
 * The loaded guest profile (WL-402).
 *
 * Holds the profile for the screens and is the only writer to storage —
 * every mutation applies a pure function from `features/profile/guestProfile`
 * and persists the result, so the in-memory copy and the stored one cannot
 * drift. Screens never call the repository themselves.
 *
 * Writes are awaited but not blocking on any UI path: MMKV is synchronous
 * underneath, and this store's callers (a finished round, a settings toggle)
 * are all events, never renders.
 */
export const useProfileStore = create<ProfileState>((set, get) => ({
  profile: null,
  status: 'idle',
  isFirstLaunch: false,

  load: async () => {
    if (get().status === 'loading') return;
    set({ status: 'loading' });

    const now = new Date();
    const stored = await loadGuestProfile();
    // Architecture section 8.1: the profile is created locally and
    // immediately on first use, with no server call — so "nothing stored" is
    // not an error path, it is the first launch, and this is where a new
    // guest comes into existence. A fresh install therefore always gets a new
    // guest id, which is exactly what the uninstall/reinstall case should do
    // (Guest Deletion doc: nothing survives off-device to reclaim).
    const profile = stored === null ? createGuestProfile({ now }) : markSeen(stored, now);

    await persist(profile);
    set({ profile, status: 'ready', isFirstLaunch: stored === null });
  },

  recordRound: async session => {
    await mutate(set, get, profile => recordRoundCompleted(profile, session, new Date()));
  },

  setSettings: async patch => {
    await mutate(set, get, profile => updateSettings(profile, patch));
  },

  resetStats: async () => {
    await mutate(set, get, profile => resetStatistics(profile, new Date()));
  },

  deleteGuestData: async () => {
    // Cleared before the replacement is written, so an interruption between
    // the two leaves no profile rather than the old one — a deletion that
    // half-fails must not leave the data behind.
    await clearGuestProfile();
    const profile = createGuestProfile({ now: new Date() });
    await persist(profile);
    set({ profile, status: 'ready' });
  },
}));

/**
 * Applies a pure update to the loaded profile and persists it.
 *
 * A no-op before `load` has produced a profile: the alternative would be to
 * create one here, which would race the load already in flight and could
 * discard a real stored profile in favour of an empty one.
 */
async function mutate(
  set: (partial: Partial<ProfileState>) => void,
  get: () => ProfileState,
  update: (profile: GuestProfile) => GuestProfile,
): Promise<void> {
  const current = get().profile;
  if (current === null) return;

  const next = update(current);
  // Set before the write, not after: the screens are showing the round the
  // player just finished, and the numbers should not wait on storage.
  set({ profile: next });
  await persist(next);
}

/**
 * Writes the profile, reporting rather than throwing.
 *
 * Every action here is called from an event handler that cannot do anything
 * useful with a rejection — a finished round, a settings toggle — and an
 * unhandled rejection out of one of those is a crash, which is a far worse
 * outcome than a statistic not being saved. The in-memory profile stays
 * correct for the rest of the session either way, so the loss is bounded by
 * the next successful write.
 */
async function persist(profile: GuestProfile): Promise<void> {
  try {
    await saveGuestProfile(profile);
  } catch (error) {
    reportError(error, { scope: 'useProfileStore.persist' });
  }
}

import { useProfileStore } from '@store/useProfileStore';
import type { GuestSettings } from '@app-types/profile';

interface SettingsState extends GuestSettings {
  toggleSound: () => void;
  toggleHaptics: () => void;
}

/**
 * Settings.
 * Spec: Wireframe doc section 16 (v1 settings list).
 * No theme setting: dark mode is cut from v1 (Delivery Plan D-05, closed 2026-08-26).
 *
 * ## Why this is a view over the profile, not a store of its own
 *
 * It used to be a standalone zustand store with its own `soundEnabled` /
 * `hapticsEnabled` and a note that persistence "is not yet wired up" (WL-402
 * is that wiring). Persisting it separately would have put settings in two
 * places at once: Data Model section 2 makes `settings` a field *of*
 * `GuestProfile`, and the Guest Deletion doc has settings deleted along with
 * the rest of the guest's data. Two stores would then need to agree on
 * creation, reset, and deletion — three chances to drift. So settings live in
 * the profile, and this reads them back out with the shape callers expect.
 *
 * The toggles persist immediately, which is also what Wireframe section 16
 * asks of every setting ("takes effect immediately"). Before the profile has
 * loaded they read as their defaults and the toggles are no-ops — a window of
 * a frame or two at launch, and nothing is lost, since there is no profile to
 * write to yet.
 */
export function useSettingsStore(): SettingsState {
  const profile = useProfileStore(state => state.profile);
  const setSettings = useProfileStore(state => state.setSettings);

  const soundEnabled = profile?.settings.soundEnabled ?? true;
  const hapticsEnabled = profile?.settings.hapticsEnabled ?? true;

  return {
    soundEnabled,
    hapticsEnabled,
    toggleSound: () => {
      setSettings({ soundEnabled: !soundEnabled });
    },
    toggleHaptics: () => {
      setSettings({ hapticsEnabled: !hapticsEnabled });
    },
  };
}

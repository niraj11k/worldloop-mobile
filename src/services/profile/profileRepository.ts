/**
 * Guest profile persistence (WL-402).
 *
 * The I/O boundary between the pure profile logic in `features/profile` and
 * the storage service — it owns the key, the serialization, and nothing else.
 * Local-only by design: Architecture doc section 8.1 and the Guest Deletion
 * doc's "Best v1 approach" both put the whole profile on-device, and D-03
 * leaves no server to send it to.
 */
import { storage, STORAGE_KEYS } from '@services/storage/storage';
import { reportError } from '@services/crashReporting/crashReporting';
import { parseProfile, serializeProfile } from '@features/profile/guestProfile';
import type { GuestProfile } from '@app-types/profile';

/**
 * The stored profile, or `null` if there isn't a usable one — a fresh
 * install, or storage that came back unreadable.
 *
 * A read failure is deliberately indistinguishable from a fresh install *to
 * the caller*: both mean "no profile to work from", and the response is the
 * same either way. What must not happen is the app failing to start because
 * storage misbehaved, so the throw is swallowed here rather than propagated
 * into launch — but it is reported, because "every install looks brand new"
 * is exactly the kind of failure that otherwise shows up only as flat
 * retention numbers.
 */
export async function loadGuestProfile(): Promise<GuestProfile | null> {
  try {
    return parseProfile(await storage.getItem(STORAGE_KEYS.GUEST_PROFILE));
  } catch (error) {
    reportError(error, { scope: 'profileRepository.load' });
    return null;
  }
}

export async function saveGuestProfile(profile: GuestProfile): Promise<void> {
  await storage.setItem(STORAGE_KEYS.GUEST_PROFILE, serializeProfile(profile));
}

/**
 * Erases the stored profile outright — the Guest Deletion doc's in-app
 * "delete my data" requirement (store compliance), and the only function here
 * that destroys anything. The caller decides what replaces it.
 */
export async function clearGuestProfile(): Promise<void> {
  await storage.removeItem(STORAGE_KEYS.GUEST_PROFILE);
}

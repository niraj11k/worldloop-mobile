import {
  clearGuestProfile,
  loadGuestProfile,
  saveGuestProfile,
} from '@services/profile/profileRepository';
import { createGuestProfile, updateSettings } from '@features/profile/guestProfile';
import { storage, STORAGE_KEYS } from '@services/storage/storage';

const NOW = new Date('2026-08-29T10:00:00.000Z');
const newProfile = () => createGuestProfile({ now: NOW, guestId: 'guest-test' });

describe('profileRepository', () => {
  afterEach(async () => {
    await storage.removeItem(STORAGE_KEYS.GUEST_PROFILE);
  });

  it('has nothing to load on a fresh install', async () => {
    await expect(loadGuestProfile()).resolves.toBeNull();
  });

  it('round-trips a profile through storage', async () => {
    const profile = newProfile();
    await saveGuestProfile(profile);
    await expect(loadGuestProfile()).resolves.toEqual(profile);
  });

  it('overwrites the previous profile rather than accumulating', async () => {
    await saveGuestProfile(newProfile());
    await saveGuestProfile(updateSettings(newProfile(), { hapticsEnabled: false }));
    const loaded = await loadGuestProfile();
    expect(loaded?.settings.hapticsEnabled).toBe(false);
  });

  it('reads back nothing after the guest deletes their data', async () => {
    await saveGuestProfile(newProfile());
    await clearGuestProfile();
    await expect(loadGuestProfile()).resolves.toBeNull();
  });

  it('treats an unreadable stored value as no profile', async () => {
    // Corrupt storage must look like a fresh install, not crash the launch.
    await storage.setItem(STORAGE_KEYS.GUEST_PROFILE, '{ this is not json');
    await expect(loadGuestProfile()).resolves.toBeNull();
  });

  it('leaves other stored keys alone when clearing the profile', async () => {
    await storage.setItem(STORAGE_KEYS.CURRENT_SESSION, 'in-progress-round');
    await saveGuestProfile(newProfile());
    await clearGuestProfile();

    await expect(storage.getItem(STORAGE_KEYS.CURRENT_SESSION)).resolves.toBe(
      'in-progress-round',
    );
    await storage.removeItem(STORAGE_KEYS.CURRENT_SESSION);
  });
});

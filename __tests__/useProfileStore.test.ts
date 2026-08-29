import { useProfileStore } from '@store/useProfileStore';
import { loadGuestProfile } from '@services/profile/profileRepository';
import {
  applyComputerCannotMove,
  applyValidation,
  beginValidation,
  createSession,
  setInput,
} from '@features/game/gameSession';
import { storage, STORAGE_KEYS } from '@services/storage/storage';
import type { ValidationResult } from '@features/game/ruleEngine';

const valid = (word: string): ValidationResult => ({
  isValid: true,
  normalizedWord: word,
  reason: null,
  entry: null,
});

/** A finished, won round with one player word. */
const wonRound = (sessionId = 'session-1') => {
  const opened = createSession({ sessionId, difficulty: 'easy', startingWord: 'apple' });
  const played = applyValidation(beginValidation(setInput(opened, 'eagle')), {
    submittedWord: 'eagle',
    result: valid('eagle'),
    scoreAwarded: 10,
  });
  return applyComputerCannotMove(played, { playerRepliesRemaining: 5 });
};

/**
 * Everything the app forgets when it is killed: the store is a module-level
 * singleton, so resetting it is what makes the next `load` a genuine cold
 * start against whatever is actually in storage.
 */
const coldStart = () =>
  useProfileStore.setState({ profile: null, status: 'idle', isFirstLaunch: false });

describe('useProfileStore', () => {
  beforeEach(async () => {
    coldStart();
    await storage.removeItem(STORAGE_KEYS.GUEST_PROFILE);
  });

  it('creates and persists a guest on first launch (Architecture §8.1)', async () => {
    await useProfileStore.getState().load();

    const profile = useProfileStore.getState().profile;
    expect(useProfileStore.getState().status).toBe('ready');
    expect(profile).not.toBeNull();
    // Written immediately, not on first change — a player who opens the app
    // once and never plays is still the same guest next time.
    await expect(loadGuestProfile()).resolves.toMatchObject({ guestId: profile!.guestId });
  });

  it('keeps the same guest across a cold start', async () => {
    await useProfileStore.getState().load();
    const firstId = useProfileStore.getState().profile!.guestId;

    coldStart();
    await useProfileStore.getState().load();

    expect(useProfileStore.getState().profile!.guestId).toBe(firstId);
  });

  it('creates a new guest on a fresh install', async () => {
    await useProfileStore.getState().load();
    const firstId = useProfileStore.getState().profile!.guestId;

    // A reinstall: the app's storage is gone, nothing survives off-device.
    coldStart();
    await storage.removeItem(STORAGE_KEYS.GUEST_PROFILE);
    await useProfileStore.getState().load();

    expect(useProfileStore.getState().profile!.guestId).not.toBe(firstId);
  });

  describe('first launch (WL-406)', () => {
    it('reports a first launch when the guest had to be created', async () => {
      await useProfileStore.getState().load();
      expect(useProfileStore.getState().isFirstLaunch).toBe(true);
    });

    it('does not report one when a stored profile was read', async () => {
      // What decides whether the Welcome screen is the stack's entry point,
      // so a returning player must never come back as "first launch".
      await useProfileStore.getState().load();
      coldStart();
      await useProfileStore.getState().load();

      expect(useProfileStore.getState().isFirstLaunch).toBe(false);
    });

    it('reports one again after a reinstall', async () => {
      await useProfileStore.getState().load();
      coldStart();
      await storage.removeItem(STORAGE_KEYS.GUEST_PROFILE);
      await useProfileStore.getState().load();

      expect(useProfileStore.getState().isFirstLaunch).toBe(true);
    });
  });

  it('records a finished round and keeps it across a cold start', async () => {
    await useProfileStore.getState().load();
    await useProfileStore.getState().recordRound(wonRound());

    coldStart();
    await useProfileStore.getState().load();

    const profile = useProfileStore.getState().profile!;
    expect(profile.gamesPlayed).toBe(1);
    expect(profile.localScores).toHaveLength(1);
    expect(profile.discoveredWords.map(word => word.word)).toEqual(['eagle']);
  });

  it('persists a settings toggle immediately (Wireframe §16)', async () => {
    await useProfileStore.getState().load();
    await useProfileStore.getState().setSettings({ soundEnabled: false });

    await expect(loadGuestProfile()).resolves.toMatchObject({
      settings: { soundEnabled: false, hapticsEnabled: true },
    });
  });

  it('clears statistics without touching discovered words or identity', async () => {
    await useProfileStore.getState().load();
    const guestId = useProfileStore.getState().profile!.guestId;
    await useProfileStore.getState().recordRound(wonRound());
    await useProfileStore.getState().resetStats();

    const profile = useProfileStore.getState().profile!;
    expect(profile.gamesPlayed).toBe(0);
    expect(profile.localScores).toEqual([]);
    expect(profile.discoveredWords).toHaveLength(1);
    expect(profile.guestId).toBe(guestId);
  });

  it('deletes guest data and starts a new guest (Guest Deletion doc)', async () => {
    await useProfileStore.getState().load();
    await useProfileStore.getState().recordRound(wonRound());
    const oldId = useProfileStore.getState().profile!.guestId;

    await useProfileStore.getState().deleteGuestData();

    const profile = useProfileStore.getState().profile!;
    expect(profile.guestId).not.toBe(oldId);
    expect(profile.gamesPlayed).toBe(0);
    expect(profile.discoveredWords).toEqual([]);
    await expect(loadGuestProfile()).resolves.toMatchObject({ guestId: profile.guestId });
  });

  it('ignores a mutation attempted before the profile has loaded', async () => {
    // Nothing to write to yet, and inventing a profile here would race the
    // load and could bury a real one.
    await useProfileStore.getState().recordRound(wonRound());

    expect(useProfileStore.getState().profile).toBeNull();
    await expect(loadGuestProfile()).resolves.toBeNull();
  });
});

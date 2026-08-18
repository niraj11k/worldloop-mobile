import { storage, STORAGE_KEYS } from '@services/storage/storage';

describe('storage', () => {
  afterEach(async () => {
    await Promise.all(Object.values(STORAGE_KEYS).map(key => storage.removeItem(key)));
  });

  it('returns null for a key that was never set', async () => {
    await expect(storage.getItem(STORAGE_KEYS.CURRENT_SESSION)).resolves.toBeNull();
  });

  it('round-trips a written value', async () => {
    await storage.setItem(STORAGE_KEYS.SETTINGS, '{"soundEnabled":true}');
    await expect(storage.getItem(STORAGE_KEYS.SETTINGS)).resolves.toBe('{"soundEnabled":true}');
  });

  it('overwrites an existing value for the same key', async () => {
    await storage.setItem(STORAGE_KEYS.GUEST_PROFILE, 'first');
    await storage.setItem(STORAGE_KEYS.GUEST_PROFILE, 'second');
    await expect(storage.getItem(STORAGE_KEYS.GUEST_PROFILE)).resolves.toBe('second');
  });

  it('removes a value', async () => {
    await storage.setItem(STORAGE_KEYS.ACCOUNT_PROMPT_STATE, 'value');
    await storage.removeItem(STORAGE_KEYS.ACCOUNT_PROMPT_STATE);
    await expect(storage.getItem(STORAGE_KEYS.ACCOUNT_PROMPT_STATE)).resolves.toBeNull();
  });

  it('keeps keys independent of each other', async () => {
    await storage.setItem(STORAGE_KEYS.GUEST_PROFILE, 'guest-value');
    await storage.setItem(STORAGE_KEYS.SETTINGS, 'settings-value');
    await storage.removeItem(STORAGE_KEYS.GUEST_PROFILE);

    await expect(storage.getItem(STORAGE_KEYS.GUEST_PROFILE)).resolves.toBeNull();
    await expect(storage.getItem(STORAGE_KEYS.SETTINGS)).resolves.toBe('settings-value');
  });
});

/**
 * Local storage service.
 *
 * Wraps device-local persistence for guest profile, settings, and the
 * current in-progress game (Data Model doc sections 2 and 4).
 *
 * Library choice (AsyncStorage vs. MMKV) is listed as open in the
 * Architecture doc — both are included in package.json as candidates.
 * This module isolates that choice behind a small interface so switching
 * later doesn't ripple through the app.
 */

export interface StorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export const STORAGE_KEYS = {
  GUEST_PROFILE: 'wordloop:guest_profile',
  SETTINGS: 'wordloop:settings',
  CURRENT_SESSION: 'wordloop:current_session',
  ACCOUNT_PROMPT_STATE: 'wordloop:account_prompt_state',
} as const;

/**
 * STUB adapter. Replace with AsyncStorage or MMKV binding once the storage
 * library decision is finalized.
 */
export const storage: StorageAdapter = {
  async getItem(_key) {
    return null;
  },
  async setItem(_key, _value) {
    return;
  },
  async removeItem(_key) {
    return;
  },
};

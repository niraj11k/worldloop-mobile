/**
 * Local storage service.
 *
 * Wraps device-local persistence for guest profile, settings, and the
 * current in-progress game (Data Model doc sections 2 and 4).
 *
 * Library: MMKV (Delivery Plan D-07, closed). Chosen for synchronous reads
 * on the small, frequently-toggled SETTINGS key, and because zustand (this
 * project's state library) has first-class MMKV persist-middleware support.
 * This module still isolates the choice behind a small interface so a
 * future change doesn't ripple through the app.
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
 * STUB adapter. Replace with an MMKV binding in WL-002 (Phase 0, gated on
 * native projects existing so the round-trip can be verified on-device).
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

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
import { createMMKV } from 'react-native-mmkv';

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
  /** WL-505's locally-queued word reports, exported from Settings (D-03). */
  WORD_REPORTS: 'wordloop:word_reports',
} as const;

const mmkv = createMMKV({ id: 'wordloop-storage' });

export const storage: StorageAdapter = {
  async getItem(key) {
    return mmkv.getString(key) ?? null;
  },
  async setItem(key, value) {
    mmkv.set(key, value);
  },
  async removeItem(key) {
    mmkv.remove(key);
  },
};

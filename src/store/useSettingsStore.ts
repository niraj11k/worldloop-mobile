import { create } from 'zustand';

/**
 * Settings store.
 * Spec: Wireframe doc section 16 (v1 settings list).
 * No theme setting: dark mode is cut from v1 (Delivery Plan D-05, closed 2026-08-26).
 * Persistence to local storage (src/services/storage) is not yet wired up.
 */
interface SettingsState {
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  toggleSound: () => void;
  toggleHaptics: () => void;
}

export const useSettingsStore = create<SettingsState>(set => ({
  soundEnabled: true,
  hapticsEnabled: true,
  toggleSound: () => set(s => ({ soundEnabled: !s.soundEnabled })),
  toggleHaptics: () => set(s => ({ hapticsEnabled: !s.hapticsEnabled })),
}));

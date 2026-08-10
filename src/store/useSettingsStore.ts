import { create } from 'zustand';

/**
 * Settings store.
 * Spec: Wireframe doc section 16 (v1 settings list).
 * Persistence to local storage (src/services/storage) is not yet wired up.
 */
interface SettingsState {
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  theme: 'system' | 'light' | 'dark';
  toggleSound: () => void;
  toggleHaptics: () => void;
  setTheme: (theme: SettingsState['theme']) => void;
}

export const useSettingsStore = create<SettingsState>(set => ({
  soundEnabled: true,
  hapticsEnabled: true,
  theme: 'system',
  toggleSound: () => set(s => ({ soundEnabled: !s.soundEnabled })),
  toggleHaptics: () => set(s => ({ hapticsEnabled: !s.hapticsEnabled })),
  setTheme: theme => set({ theme }),
}));

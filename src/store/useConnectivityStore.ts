import { create } from 'zustand';
import NetInfo from '@react-native-community/netinfo';

interface ConnectivityState {
  /**
   * `null` until the first reading arrives.
   *
   * Distinguished from `false` deliberately: at launch the app does not yet
   * know, and rendering "You're offline" for the frame before the first
   * reading would be a false alarm on every cold start.
   */
  isOnline: boolean | null;
  /** Starts listening. Returns the unsubscribe. */
  subscribe: () => () => void;
}

/**
 * Device connectivity (WL-506, Wireframe §17's "network unavailable").
 *
 * ## Why this exists at all in an offline-native app
 *
 * D-03 leaves v1 with no backend, and every source of truth the player
 * touches is on the device: the word list (WL-105), the definitions (WL-501),
 * the profile and the saved round (WL-402/403). **Nothing in a round needs the
 * network**, which is exactly why the notice is worth showing — the player has
 * no way to know that, and a word game that keeps working on a train is a
 * reassurance rather than a warning.
 *
 * That also means this must never gate anything. It drives one banner. If a
 * future change makes a feature depend on connectivity, that feature owns its
 * own degraded state; this store stays a fact about the device.
 *
 * `@react-native-community/netinfo` was added for this — React Native's core
 * exposes no connectivity API, so the alternative was a store flag nothing
 * ever set, which is the dead-code shape WL-502 deliberately removed a
 * Pronunciation button to avoid.
 */
export const useConnectivityStore = create<ConnectivityState>(set => ({
  isOnline: null,

  subscribe: () =>
    NetInfo.addEventListener(state => {
      // `isInternetReachable` is null while NetInfo is still probing, and a
      // connected-but-unprobed device is treated as online: the cost of a
      // wrong "offline" banner is higher than the cost of not showing one,
      // since nothing here degrades either way.
      set({ isOnline: state.isConnected === true && state.isInternetReachable !== false });
    }),
}));

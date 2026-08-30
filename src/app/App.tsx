import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from '@navigation/RootNavigator';
import { useConnectivityStore } from '@store/useConnectivityStore';
import { useProfileStore } from '@store/useProfileStore';
import { useSavedRoundStore } from '@store/useSavedRoundStore';

/**
 * App root.
 *
 * Kept deliberately thin: providers and navigation only. Feature logic
 * belongs in src/features, screen composition belongs in src/screens.
 *
 * The one piece of work here is reading what the last run left behind: the
 * guest profile (WL-402) and any round still in progress (WL-403).
 * Architecture doc section 8.1 has the profile created locally and
 * immediately on first use with no server call, so this runs at launch
 * rather than behind any screen. Nothing is gated on either — the game is
 * playable before they resolve, and a round that starts first simply runs
 * with no personal-best baseline (the `null` case `previousBestChainLength`
 * already defines).
 *
 * Loading the saved round here, rather than on Home, is what makes "restore
 * on launch" true of the app rather than of one screen: by the time any
 * screen renders, whether there is a round to resume is a synchronous
 * question.
 *
 * Connectivity is watched here too (WL-506), for the same reason: it is a fact
 * about the device rather than about a screen. Nothing is gated on it — D-03
 * leaves v1 with no backend and every source of truth on the device, so it
 * drives one reassuring notice and nothing else. Architecture §3's
 * offline/online *reconciliation* strategy is a post-v1 concern and is still
 * unbuilt; this is not that.
 *
 * TODO (see Architecture doc, open items):
 * - Wrap with a guest/account session provider once the Account Service exists.
 */
export function App(): React.JSX.Element {
  const loadProfile = useProfileStore(state => state.load);
  const loadSavedRound = useSavedRoundStore(state => state.load);
  const subscribeConnectivity = useConnectivityStore(state => state.subscribe);

  useEffect(() => {
    loadProfile();
    loadSavedRound();
  }, [loadProfile, loadSavedRound]);

  // Separate effect with its own cleanup: the loads above run once and are
  // done, while this holds a native listener for the life of the app.
  useEffect(() => subscribeConnectivity(), [subscribeConnectivity]);

  return (
    <SafeAreaProvider>
      <RootNavigator />
    </SafeAreaProvider>
  );
}

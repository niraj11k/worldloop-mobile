import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from '@navigation/RootNavigator';
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
 * TODO (see Architecture doc, open items):
 * - Wrap with a guest/account session provider once the Account Service exists.
 * - Wrap with a connectivity provider to drive the offline/online reconciliation
 *   strategy described in Architecture doc section 3.
 */
export function App(): React.JSX.Element {
  const loadProfile = useProfileStore(state => state.load);
  const loadSavedRound = useSavedRoundStore(state => state.load);

  useEffect(() => {
    loadProfile();
    loadSavedRound();
  }, [loadProfile, loadSavedRound]);

  return (
    <SafeAreaProvider>
      <RootNavigator />
    </SafeAreaProvider>
  );
}

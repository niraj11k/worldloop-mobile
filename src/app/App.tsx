import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from '@navigation/RootNavigator';
import { useProfileStore } from '@store/useProfileStore';

/**
 * App root.
 *
 * Kept deliberately thin: providers and navigation only. Feature logic
 * belongs in src/features, screen composition belongs in src/screens.
 *
 * The one piece of work here is loading the guest profile (WL-402).
 * Architecture doc section 8.1 has it created locally and immediately on
 * first use with no server call, so this runs at launch rather than behind
 * any screen: `load` reads the stored profile or creates a new guest, and
 * nothing is gated on it — the game is playable before it resolves, and a
 * round that starts first simply runs with no personal-best baseline (the
 * `null` case `previousBestChainLength` already defines).
 *
 * TODO (see Architecture doc, open items):
 * - Wrap with a guest/account session provider once the Account Service exists.
 * - Wrap with a connectivity provider to drive the offline/online reconciliation
 *   strategy described in Architecture doc section 3.
 */
export function App(): React.JSX.Element {
  const loadProfile = useProfileStore(state => state.load);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  return (
    <SafeAreaProvider>
      <RootNavigator />
    </SafeAreaProvider>
  );
}

import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from '@navigation/RootNavigator';

/**
 * App root.
 *
 * Kept deliberately thin: providers and navigation only. Feature logic
 * belongs in src/features, screen composition belongs in src/screens.
 *
 * TODO (see Architecture doc, open items):
 * - Wrap with a guest/account session provider once the Account Service exists.
 * - Wrap with a connectivity provider to drive the offline/online reconciliation
 *   strategy described in Architecture doc section 3.
 */
export function App(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <RootNavigator />
    </SafeAreaProvider>
  );
}

import React from 'react';
import { View, Text, Pressable } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'AccountCreation'>;

/**
 * Account creation screen (modal presentation).
 * Spec: Guest Account Trigger Policy doc wireframe + Architecture doc section 8.4.
 *
 * Dormant for v1 (Delivery Plan D-04, closed): unreachable in practice, since
 * SettingsScreen hides the entry point behind ACCOUNTS_ENABLED_V1 and the
 * soft-prompt policy that would be the other entry point is itself not
 * wired into any live screen yet. Kept implemented, not deleted — this is
 * the 1.1 accounts release's screen.
 *
 * Auth providers proposed: Apple, Google, Email magic link.
 * [Unverified] Apple Sign-In requirement against current App Store policy
 * has not been confirmed — check before implementing the provider list.
 *
 * On success, guest data must be linked, not discarded (Data Model doc
 * section 2, `is_linked` / `linked_user_id`).
 */
export function AccountCreationScreen({ route, navigation }: Props): React.JSX.Element {
  const { entryPoint } = route.params;

  return (
    <View style={{ flex: 1, justifyContent: 'center' }}>
      <Text>Keep your progress</Text>
      <Text>
        Save scores, streaks, and discovered words across devices.
      </Text>

      {/* entryPoint drives the "Account creation started" analytics event
          (Architecture doc section 10) — not yet wired up. */}
      <Text>Entry point: {entryPoint}</Text>

      <Pressable onPress={() => {/* TODO: Apple sign-in */}}>
        <Text>Sign in with Apple</Text>
      </Pressable>
      <Pressable onPress={() => {/* TODO: Google sign-in */}}>
        <Text>Continue with Google</Text>
      </Pressable>
      <Pressable onPress={() => {/* TODO: email magic link */}}>
        <Text>Email me a link</Text>
      </Pressable>

      <Text>Your guest progress will be linked to this account.</Text>

      <Pressable onPress={() => navigation.goBack()}>
        <Text>Not now</Text>
      </Pressable>
    </View>
  );
}

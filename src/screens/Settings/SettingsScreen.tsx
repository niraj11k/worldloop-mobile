import React from 'react';
import { View, Text, Pressable, Switch } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/types';
import { ACCOUNTS_ENABLED_V1 } from '@constants/gameConstants';
import { Icon } from '@components/common/icons/Icon';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

/**
 * Settings screen.
 * Spec: Architecture doc section 8.6, as amended by Delivery Plan D-04
 * (closed 2026-08-17): v1 ships guest-only, so the Account row shows only
 * "Continue as guest" with no Create Account button — Wireframe doc section
 * 16's original pre-accounts guidance, not the accounts-in-v1 addendum.
 * Gated behind ACCOUNTS_ENABLED_V1 rather than deleted, since section 8.6's
 * design is still correct for the 1.1 accounts release.
 *
 * Account row behaviour once ACCOUNTS_ENABLED_V1 flips true:
 * - Guest: shows "Continue as guest" + "Create Account" button.
 * - Signed in: shows linked provider + "Sign Out".
 * - Not frequency-capped, unlike game-over / milestone soft prompts.
 */
export function SettingsScreen({ navigation }: Props): React.JSX.Element {
  // TODO: read from auth/session store once Account Service exists (1.1).
  const isSignedIn = false;

  return (
    <View style={{ flex: 1 }}>
      {/*
        WL-401: `headerShown` is false for the whole stack, so a screen with
        no back control of its own leaves iOS users with nothing but the edge
        swipe — an invisible affordance, and the only way out of this screen
        on that platform. Android's hardware back always worked, which is
        exactly why the gap was easy to miss. Styling belongs to WL-407, which
        owns this screen's real layout; this is the control itself.
      */}
      <Pressable
        onPress={() => navigation.goBack()}
        accessibilityRole="button"
        accessibilityLabel="Back">
        <Icon name="back" />
      </Pressable>

      <Text>Settings</Text>

      <View>
        <Text>Account</Text>
        {!ACCOUNTS_ENABLED_V1 ? (
          <Text>Continue as guest</Text>
        ) : isSignedIn ? (
          <>
            <Text>Signed in</Text>
            <Pressable onPress={() => {/* TODO: sign out */}}>
              <Text>Sign Out</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text>Continue as guest</Text>
            <Pressable
              onPress={() => navigation.navigate('AccountCreation', { entryPoint: 'settings' })}>
              <Text>Create Account</Text>
            </Pressable>
          </>
        )}
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text>Sound</Text>
        <Switch value={true} onValueChange={() => {}} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text>Haptics</Text>
        <Switch value={true} onValueChange={() => {}} />
      </View>

      <Pressable onPress={() => {/* TODO: reset stats */}}>
        <Text>Reset Statistics</Text>
      </Pressable>
      <Pressable onPress={() => {/* TODO: report word flow */}}>
        <Text>Report a Word</Text>
      </Pressable>
    </View>
  );
}

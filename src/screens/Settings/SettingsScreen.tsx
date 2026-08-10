import React from 'react';
import { View, Text, Pressable, Switch } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

/**
 * Settings screen.
 * Spec: Architecture doc section 8.6 (updated Settings, replacing the
 * original Wireframe doc section 16 guidance to avoid account settings —
 * that guidance predates the decision to include accounts in v1).
 *
 * Account row behaviour:
 * - Guest: shows "Continue as guest" + "Create Account" button.
 * - Signed in: shows linked provider + "Sign Out".
 * - Not frequency-capped, unlike game-over / milestone soft prompts.
 */
export function SettingsScreen({ navigation }: Props): React.JSX.Element {
  // TODO: read from auth/session store once Account Service exists.
  const isSignedIn = false;

  return (
    <View style={{ flex: 1 }}>
      <Text>Settings</Text>

      <View>
        <Text>Account</Text>
        {isSignedIn ? (
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

import React from 'react';
import { View, Text, Pressable } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Welcome'>;

/**
 * Welcome screen.
 * Spec: Wireframe doc section 4.1.
 *
 * Behaviour to implement:
 * - "Play Now" -> Home (or directly to Difficulty, per PRD "2 taps from Home" rule)
 * - "How to Play" -> HowToPlay
 * - No account required, no long explanation.
 */
export function WelcomeScreen({ navigation }: Props): React.JSX.Element {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>WordLoop</Text>
      <Text>Build the word chain</Text>
      <Text>
        Each word starts with the last letter of the previous word.
      </Text>
      <Pressable onPress={() => navigation.replace('Home')}>
        <Text>Play Now</Text>
      </Pressable>
      <Pressable onPress={() => navigation.navigate('HowToPlay')}>
        <Text>How to Play</Text>
      </Pressable>
    </View>
  );
}

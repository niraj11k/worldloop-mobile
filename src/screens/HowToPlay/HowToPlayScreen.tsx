import React from 'react';
import { View, Text, Pressable } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'HowToPlay'>;

/**
 * How to Play screen.
 * Spec: Wireframe doc section 7. Uses a real worked example, not just
 * abstract rules, per the spec.
 */
export function HowToPlayScreen({ navigation }: Props): React.JSX.Element {
  return (
    <View style={{ flex: 1 }}>
      <Text>How to Play</Text>
      <Text>Computer: APPLE</Text>
      <Text>You need a word starting with E</Text>
      <Text>You: ELEPHANT</Text>
      <Text>Computer needs a word starting with T</Text>
      <Text>Names are not allowed.</Text>
      <Text>Repeated words are not allowed.</Text>
      <Text>Minimum length: 3 letters.</Text>
      <Pressable onPress={() => navigation.goBack()}>
        <Text>Got It</Text>
      </Pressable>
    </View>
  );
}

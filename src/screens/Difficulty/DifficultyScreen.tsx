import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList, Difficulty } from '@navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Difficulty'>;

const DIFFICULTIES: { value: Difficulty; label: string; description: string }[] = [
  { value: 'easy', label: 'Easy', description: 'Relaxed play. Computer chooses broadly.' },
  { value: 'medium', label: 'Medium', description: 'Computer starts blocking.' },
  { value: 'hard', label: 'Hard', description: 'Computer looks for traps.' },
];

/**
 * Difficulty selection screen.
 * Spec: Wireframe doc section 6.
 *
 * Behaviour to implement:
 * - Default selection: Easy.
 * - Continue enabled by default (Easy preselected).
 * - Selected difficulty persists into the game session.
 */
export function DifficultyScreen({ navigation }: Props): React.JSX.Element {
  const [selected, setSelected] = useState<Difficulty>('easy');

  return (
    <View style={{ flex: 1 }}>
      <Text>Choose Difficulty</Text>
      {DIFFICULTIES.map(d => (
        <Pressable key={d.value} onPress={() => setSelected(d.value)}>
          <Text>
            {d.value === selected ? '● ' : '○ '}
            {d.label}
          </Text>
          <Text>{d.description}</Text>
        </Pressable>
      ))}
      <Pressable onPress={() => navigation.navigate('Game', { difficulty: selected })}>
        <Text>Continue</Text>
      </Pressable>
    </View>
  );
}

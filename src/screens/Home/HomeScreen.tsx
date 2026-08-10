import React from 'react';
import { View, Text, Pressable } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

/**
 * Home screen.
 * Spec: Wireframe doc section 5.
 *
 * Required elements: Start Game, Best Score, Best Streak, Word Review entry,
 * How to Play entry, Settings entry, optional daily-challenge placeholder
 * (layout only, no functionality — confirmed out of scope for v1).
 *
 * Explicit decision (PRD/Wireframe doc): do NOT add a shop, social feed,
 * leaderboard, or school dashboard here in v1.
 */
export function HomeScreen({ navigation }: Props): React.JSX.Element {
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text>WordLoop</Text>
        <Pressable onPress={() => navigation.navigate('Settings')}>
          <Text>⚙</Text>
        </Pressable>
      </View>

      <Text>Ready for a chain?</Text>

      <Pressable onPress={() => navigation.navigate('Difficulty')}>
        <Text>Start Game</Text>
      </Pressable>

      {/* TODO: bind to local stats store once Score/RoundSummary persistence exists */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
        <View>
          <Text>Best Score</Text>
          <Text>--</Text>
        </View>
        <View>
          <Text>Best Streak</Text>
          <Text>--</Text>
        </View>
      </View>

      {/* Daily challenge placeholder — layout only, per confirmed scope */}
      <View accessibilityLabel="daily-challenge-placeholder" />

      <Pressable onPress={() => navigation.navigate('WordReview', { sessionId: 'latest' })}>
        <Text>Word Review</Text>
      </Pressable>
      <Pressable onPress={() => navigation.navigate('HowToPlay')}>
        <Text>How to Play</Text>
      </Pressable>
    </View>
  );
}

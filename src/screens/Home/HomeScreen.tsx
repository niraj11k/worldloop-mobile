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

      {/*
        WL-206: the only entry point to the component gallery, and the reason
        it is here rather than behind a gesture — a dev screen nobody can find
        is a dev screen nobody uses, which is the failure mode the previous
        specimen screens had (registered, but reachable only by editing
        `initialRouteName`).

        `__DEV__` keeps it out of release builds entirely: the route itself is
        not registered there either (see RootNavigator), so this cannot become
        a dead link in production. It is deliberately last and unstyled so it
        never reads as product — Wireframe §5 fixes what belongs on Home, and
        this is not one of those things.
      */}
      {__DEV__ && (
        <Pressable onPress={() => navigation.navigate('Gallery')}>
          <Text>Component gallery (dev)</Text>
        </Pressable>
      )}
    </View>
  );
}

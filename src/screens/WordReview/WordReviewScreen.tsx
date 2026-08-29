import React from 'react';
import { View, Text, FlatList, Pressable } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'WordReview'>;

/**
 * Word Review screen.
 * Spec: Wireframe doc section 15 / PRD section 12.
 * Shows words from the completed round with independently-loading
 * definitions/pronunciation (never blocks the list — Wireframe doc, PRD
 * section 12).
 *
 * Still the WL-002 skeleton: WL-502 builds the real screen on WL-501's
 * definition overlay, and it has no data to show until WL-503 wires
 * `discoveredWords` (which WL-402 is already recording) into it. WL-408 gave
 * its controls roles and labels rather than leaving unlabelled buttons in the
 * app — a screen reader reaching this screen today hears what each control
 * is, even though two of them are still inert.
 */
export function WordReviewScreen({ route, navigation }: Props): React.JSX.Element {
  const { sessionId } = route.params;

  // TODO: load DiscoveredWord[] for this session (Data Model doc section 7)
  const words: string[] = [];

  return (
    <View style={{ flex: 1 }}>
      <Text>Word Review</Text>
      {words.length === 0 ? (
        <Text>No reviewed words yet. Play a game to discover new vocabulary.</Text>
      ) : (
        <FlatList
          data={words}
          keyExtractor={w => w}
          renderItem={({ item }) => (
            <View>
              <Text>{item.toUpperCase()}</Text>
              {/*
                Labels name the *word* as well as the action, because a list
                of a dozen entries otherwise announces "Definition, button"
                twelve times with nothing to tell them apart. WL-501/502 own
                what these open.
              */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Definition of ${item}`}>
                <Text>Definition</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Pronunciation of ${item}`}>
                <Text>Pronunciation</Text>
              </Pressable>
            </View>
          )}
        />
      )}
      {/*
        `popTo`, not `navigate` (WL-401): reached from Game Over, the stack
        below this screen is Home → Difficulty → Game, and a `navigate` would
        push a *second* Home on top of all of it in React Navigation 7. `popTo`
        unwinds to the Home already there, from either entry point (Game Over
        or Home itself).
      */}
      <Pressable
        onPress={() => navigation.popTo('Home')}
        accessibilityRole="button"
        accessibilityLabel="Back to Home">
        <Text>Back to Home</Text>
      </Pressable>
    </View>
  );
}

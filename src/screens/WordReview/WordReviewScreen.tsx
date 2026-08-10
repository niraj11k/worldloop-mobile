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
              <Pressable>
                <Text>Definition</Text>
              </Pressable>
              <Pressable>
                <Text>Pronunciation</Text>
              </Pressable>
            </View>
          )}
        />
      )}
      <Pressable onPress={() => navigation.navigate('Home')}>
        <Text>Back to Home</Text>
      </Pressable>
    </View>
  );
}

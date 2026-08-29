import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/types';
import { Button } from '@components/common/Button';
import { Card } from '@components/common/Card';
import { palette, spacing, typeScale, displayTextProps } from '@theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Welcome'>;

/**
 * Welcome screen.
 * Spec: Wireframe doc section 4.1, built on the WL-204 component set
 * (WL-406).
 *
 * Section 4.1's purpose is "explain WordLoop in a few seconds and move the
 * user into gameplay", and its last requirement is that the screen "should
 * not contain a long explanation" — so this is the wordmark, the promise, one
 * sentence of mechanic, and the two controls, and nothing else. The rules
 * belong on How to Play, which is one tap away.
 *
 * ## Shown once (WL-406)
 *
 * This is the stack's initial route only on a first launch;
 * `RootNavigator` starts at Home on every launch after. "First launch" is
 * `useProfileStore`'s `isFirstLaunch`, which is true when the guest profile
 * had to be created rather than read — see that field for why it isn't a
 * stored flag.
 *
 * `Play Now` uses `replace`, so Home becomes the stack root and back from
 * there exits the app rather than returning to a welcome the player has
 * already dismissed (the WL-401 back-behaviour table).
 */
export function WelcomeScreen({ navigation }: Props): React.JSX.Element {
  return (
    // WL-408: scrolls, so the two controls stay reachable when the intro
    // takes the whole screen at the largest text size.
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}>
      <View style={styles.intro}>
        <Text {...displayTextProps} style={styles.wordmark} accessibilityRole="header">
          WordLoop
        </Text>
        <Text {...displayTextProps} style={styles.tagline}>Build the word chain</Text>

        {/*
          The one sentence of explanation, in a tilted card — informational,
          not interactive, which is what makes the rotation legal (Design
          System sections 3 and 4). It is the only decorative element here,
          and it is carrying the actual mechanic rather than filling space.
        */}
        <Card fill="sunbeam" rotation={-2}>
          <Text style={styles.explanation}>
            Each word starts with the last letter of the previous word.
          </Text>
        </Card>
      </View>

      <View style={styles.actions}>
        <Button
          label="Play Now"
          tone="grape"
          onPress={() => navigation.replace('Home')}
          style={styles.fullWidthButton}
        />
        <Button
          label="How to Play"
          variant="secondary"
          onPress={() => navigation.navigate('HowToPlay')}
          style={styles.fullWidthButton}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.paper },
  content: {
    flexGrow: 1,
    padding: spacing.lg,
    // The intro sits centred in the space above; the controls stay at the
    // bottom, where a thumb is, rather than floating in the middle with it —
    // until the content outgrows the screen, at which point it scrolls.
    justifyContent: 'space-between',
  },
  intro: { flex: 1, justifyContent: 'center', gap: spacing.lg },
  wordmark: { ...typeScale.wordmark, color: palette.ink },
  tagline: { ...typeScale.screenTitle, color: palette.ink },
  explanation: { ...typeScale.body, color: palette.ink },
  actions: { gap: spacing.md, paddingBottom: spacing.xl },
  fullWidthButton: { alignSelf: 'stretch' },
});

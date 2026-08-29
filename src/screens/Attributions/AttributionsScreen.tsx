import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/types';
import { Card } from '@components/common/Card';
import { IconButton } from '@components/common/IconButton';
import { ATTRIBUTIONS } from '@constants/attributions';
import { palette, spacing, typeScale, displayTextProps } from '@theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Attributions'>;

/**
 * Attributions.
 * Spec: WL-407, carrying the notices WL-101 and WL-104 identified as
 * obligations — ESDB, WordNet, LDNOOBW (CC-BY-4.0), and the two OFL fonts.
 *
 * ## Why the notices are re-wrapped but not rewritten
 *
 * These notices are typed for an 80-column terminal, and every one of their
 * hard line breaks lands mid-sentence on a phone — the device then wraps the
 * already-wrapped line, and the result reads as broken rather than as legal
 * text. So each paragraph is reflowed for the screen it is actually on:
 * single newlines inside a paragraph become spaces, blank lines stay as
 * paragraph breaks.
 *
 * That changes only where lines end. Every word, every paragraph, and their
 * order are exactly what the licence says — and the *stored* text in
 * `ATTRIBUTIONS` is byte-identical to its source, which `attributions.test.ts`
 * checks against the licence review and the bundled OFL file. Reflowing at
 * render is presentation; the obligation is that the notice appear, not that
 * it appear at 78 characters wide.
 *
 * Each notice sits in its own `Card` with a plain-language line above it
 * saying what WordLoop actually uses the thing for. That sentence is the
 * app's own voice and is not part of the notice; the licences require the
 * text, not an explanation, but a screen that only recites four legal blocks
 * tells a curious player nothing.
 */
/**
 * Splits a notice into paragraphs and unwraps each one, so the device does
 * the line breaking instead of a 1990s terminal width. See the docblock.
 */
function paragraphsOf(notice: string): string[] {
  return notice
    .split(/\n\s*\n/)
    .map(paragraph => paragraph.replace(/\s*\n\s*/g, ' ').trim())
    .filter(paragraph => paragraph.length > 0);
}

export function AttributionsScreen({ navigation }: Props): React.JSX.Element {
  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <IconButton name="back" accessibilityLabel="Back" onPress={() => navigation.goBack()} />
        <Text {...displayTextProps} style={styles.title} accessibilityRole="header">
          Attributions
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.intro}>
          WordLoop is built on work other people shared. These are their terms.
        </Text>

        {ATTRIBUTIONS.map(attribution => (
          <Card key={attribution.title} style={styles.card}>
            <Text {...displayTextProps} style={styles.cardTitle}>{attribution.title}</Text>
            <Text style={styles.usage}>{attribution.usage}</Text>
            {paragraphsOf(attribution.notice).map((paragraph, index) => (
              <Text key={index} style={styles.notice}>
                {paragraph}
              </Text>
            ))}
          </Card>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.paper },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  // Wraps rather than clipping at large text sizes (WL-408).
  title: { ...typeScale.screenTitle, color: palette.ink, flexShrink: 1 },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  intro: { ...typeScale.body, color: palette.ink },
  card: { gap: spacing.sm },
  cardTitle: { ...typeScale.chainWord, color: palette.ink },
  usage: { ...typeScale.body, color: palette.ink },
  notice: { ...typeScale.caption, color: palette.ink },
});

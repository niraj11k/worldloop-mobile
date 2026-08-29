import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/types';
import { Badge } from '@components/common/Badge';
import { Button } from '@components/common/Button';
import { Card } from '@components/common/Card';
import {
  HINT_LIMIT_PER_ROUND,
  HOW_TO_PLAY_EXAMPLE,
  HOW_TO_PLAY_RULES,
} from '@constants/gameConstants';
import { palette, spacing, typeScale } from '@theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'HowToPlay'>;

/**
 * How to Play screen.
 * Spec: Wireframe doc section 7, built on the WL-204 component set (WL-406).
 *
 * ## The example comes first, and it is a real one
 *
 * Section 7's purpose is to "explain the game without requiring the user to
 * read a manual", and its closing requirement is a real example "rather than
 * only abstract instructions" — so the worked chain leads and the rules
 * follow it. The example is the doc's own: apple → elephant → table, with
 * each step showing who played, what they played, and the letter that word
 * hands over. That handoff letter is what the game will put in the
 * required-letter callout, shown here as the same `Badge` the game uses for
 * its difficulty tag, so the shape is familiar before the player ever sees a
 * round.
 *
 * ## All six rules, and only the six
 *
 * Section 7 lists exactly six v1 rules. The screen before this one showed
 * three, missing "start with the required letter" (the rule the game is
 * built on), "use a valid dictionary word", and hints. They live in
 * `HOW_TO_PLAY_RULES` so the list is countable rather than scattered through
 * JSX, and so the hint rule can interpolate the real limit instead of
 * hardcoding a number that WL-605 may retune.
 *
 * The screen scrolls: six rules plus a worked example is more content than a
 * small phone shows at the largest system text size, and unlike the game
 * screen there is nothing here that must stay on screen at all times.
 */
export function HowToPlayScreen({ navigation }: Props): React.JSX.Element {
  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title} accessibilityRole="header">
          How to Play
        </Text>

        <View style={styles.example}>
          {HOW_TO_PLAY_EXAMPLE.map(step => (
            <Card
              key={step.word}
              // Grouped so a screen reader hears one sentence per step
              // instead of an actor, a word, and a loose letter.
              accessibilityLabel={`${step.actor} played ${step.word}. Next word starts with ${step.handoff.toUpperCase()}.`}
              style={styles.exampleCard}>
              <Text style={styles.exampleActor}>{step.actor}</Text>
              <Text style={styles.exampleWord}>{step.word.toUpperCase()}</Text>
              <View style={styles.handoff}>
                <Text style={styles.exampleActor}>Next word starts with</Text>
                <Badge label={step.handoff.toUpperCase()} />
              </View>
            </Card>
          ))}
        </View>

        <View style={styles.rules}>
          {HOW_TO_PLAY_RULES.map(rule => (
            <View key={rule} style={styles.rule}>
              {/*
                A typographic marker, not colour or an icon: Design System
                section 7 rules out generic icon sets, and the arrow echoes
                the chain separator the game screen already uses.
              */}
              <Text style={styles.ruleMarker}>→</Text>
              <Text style={styles.ruleText}>
                {rule.replace('{hints}', String(HINT_LIMIT_PER_ROUND))}
              </Text>
            </View>
          ))}
        </View>

        <Button
          label="Got It"
          tone="grape"
          onPress={() => navigation.goBack()}
          style={styles.gotItButton}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.paper },
  content: { padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing.xxl },
  title: { ...typeScale.screenTitle, color: palette.ink },
  example: { gap: spacing.md },
  exampleCard: { gap: spacing.xs },
  exampleActor: { ...typeScale.caption, color: palette.ink },
  exampleWord: { ...typeScale.chainWord, color: palette.ink },
  handoff: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rules: { gap: spacing.md },
  rule: { flexDirection: 'row', gap: spacing.sm },
  ruleMarker: { ...typeScale.body, color: palette.ink },
  // `flex: 1` so a rule that wraps stays inside the row rather than pushing
  // its marker off the left edge.
  ruleText: { ...typeScale.body, color: palette.ink, flex: 1 },
  gotItButton: { alignSelf: 'stretch' },
});

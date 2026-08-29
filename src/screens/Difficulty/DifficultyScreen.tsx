import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList, Difficulty } from '@navigation/types';
import { Button } from '@components/common/Button';
import { Card } from '@components/common/Card';
import { IconButton } from '@components/common/IconButton';
import { palette, spacing, shadow, typeScale, displayTextProps, CONTENT_MAX_WIDTH } from '@theme/theme';

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
 * The engine side of this screen was already done before this task —
 * `difficultyEngine.ts` (WL-108/109) implements three genuinely different
 * selection strategies, and `GameScreen` already threads `route.params.difficulty`
 * into both `createSession` and every `selectComputerWord` call. This task is
 * the screen itself: Easy always starts selected (a plain `useState`, never
 * `null`), so Continue is never actually reachable in a disabled state — no
 * dead disabled-state code for a condition that can't occur.
 *
 * Selection reads via fill *and* the leading dot glyph, not colour alone
 * (Design System section 4). Selected fill reuses `sunbeam`, the same tone
 * `Badge` already uses for the difficulty tag shown in-game — the colour
 * picked here is the colour that follows the player into the round.
 */
export function DifficultyScreen({ navigation }: Props): React.JSX.Element {
  const [selected, setSelected] = useState<Difficulty>('easy');

  return (
    // WL-408: three option cards plus Continue outgrow a small phone at the
    // largest text size, and Continue is the only way forward.
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <IconButton name="back" accessibilityLabel="Back" onPress={() => navigation.goBack()} />
        <Text {...displayTextProps} style={styles.title}>Choose Difficulty</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.options}>
        {DIFFICULTIES.map(d => {
          const isSelected = d.value === selected;
          return (
            <Pressable
              key={d.value}
              onPress={() => setSelected(d.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`${d.label}: ${d.description}`}>
              <Card
                fill={isSelected ? 'sunbeam' : 'paper'}
                style={!isSelected ? styles.unselectedCard : undefined}>
                <View style={styles.optionHeader}>
                  <Text style={styles.optionDot}>{isSelected ? '●' : '○'}</Text>
                  <Text {...displayTextProps} style={styles.optionLabel}>{d.label}</Text>
                </View>
                <Text style={styles.optionDescription}>{d.description}</Text>
              </Card>
            </Pressable>
          );
        })}
      </View>

      <Button
        label="Continue"
        tone="grape"
        onPress={() => navigation.navigate('Game', { difficulty: selected })}
        style={styles.continueButton}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.xxl,
    // WL-409: tablets get a centred column rather than a stretched phone
    // layout; no phone is affected (see CONTENT_MAX_WIDTH).
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  // Balances the back icon so the title stays visually centred.
  headerSpacer: { width: 24 },
  // `flexShrink` so the title wraps instead of running off the right edge at
  // large text sizes (WL-408); `textAlign` keeps it centred once it does.
  title: { ...typeScale.screenTitle, color: palette.ink, flexShrink: 1, textAlign: 'center' },
  options: { gap: spacing.md },
  unselectedCard: { boxShadow: shadow.control },
  optionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  optionDot: { ...typeScale.body, color: palette.ink },
  optionLabel: { ...typeScale.chainWord, color: palette.ink },
  optionDescription: { ...typeScale.body, color: palette.ink },
  continueButton: { alignSelf: 'center' },
});

import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList, Difficulty } from '@navigation/types';
import { Button } from '@components/common/Button';
import { Card } from '@components/common/Card';
import { ConfirmSheet } from '@components/common/ConfirmSheet';
import { IconButton } from '@components/common/IconButton';
import {
  END_AND_START_NEW_CONFIRM,
  resumeGameLabel,
  unpausableGameNote,
} from '@constants/gameConstants';
import { abandonSession } from '@features/game/gameSession';
import { difficultyStartFor } from '@features/game/savedGames';
import { useProfileStore } from '@store/useProfileStore';
import { useSavedRoundStore } from '@store/useSavedRoundStore';
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
 *
 * ## With a paused game (D-13, Wireframe §6)
 *
 * There is never more than one game per difficulty. Selecting the paused
 * game's difficulty replaces Continue with Resume or End and Start New, and
 * its card says it holds a paused game. Selecting another difficulty keeps
 * Continue, but says first that the new game can be ended but not paused —
 * the player learns rule 4's consequence here, before starting, rather than
 * when trying to leave.
 */
export function DifficultyScreen({ navigation }: Props): React.JSX.Element {
  const [selected, setSelected] = useState<Difficulty>('easy');
  const pausedGame = useSavedRoundStore(state => state.paused);
  const resumePaused = useSavedRoundStore(state => state.resumePaused);
  const clearPaused = useSavedRoundStore(state => state.clearPaused);
  const recordRound = useProfileStore(state => state.recordRound);
  const [confirmEndPaused, setConfirmEndPaused] = useState(false);

  const start = difficultyStartFor(selected, pausedGame);

  const handleResume = async () => {
    const game = await resumePaused();
    if (game !== null) {
      navigation.navigate('Game', { difficulty: game.difficulty, resume: true });
    }
  };

  /**
   * End and Start New: the paused game is recorded as `abandoned`, the same
   * as End Game anywhere else (WL-410's interim recording until WL-412), and a
   * new game of the same difficulty starts.
   */
  const handleEndPausedAndStart = async () => {
    setConfirmEndPaused(false);
    if (pausedGame !== null) {
      recordRound(abandonSession(pausedGame));
    }
    await clearPaused();
    navigation.navigate('Game', { difficulty: selected });
  };

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
          const pausedHere = pausedGame?.difficulty === d.value ? pausedGame : null;
          const pausedLine =
            pausedHere === null ? null : `Paused game · ${pausedHere.chain.length} words`;
          return (
            <Pressable
              key={d.value}
              onPress={() => setSelected(d.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`${d.label}: ${d.description}${
                pausedLine === null ? '' : ` ${pausedLine}.`
              }`}>
              <Card
                fill={isSelected ? 'sunbeam' : 'paper'}
                style={!isSelected ? styles.unselectedCard : undefined}>
                <View style={styles.optionHeader}>
                  <Text style={styles.optionDot}>{isSelected ? '●' : '○'}</Text>
                  <Text {...displayTextProps} style={styles.optionLabel}>{d.label}</Text>
                </View>
                <Text style={styles.optionDescription}>{d.description}</Text>
                {pausedLine !== null && <Text style={styles.pausedLine}>{pausedLine}</Text>}
              </Card>
            </Pressable>
          );
        })}
      </View>

      {start === 'resume_or_restart' && pausedGame !== null ? (
        <View style={styles.pausedActions}>
          <Button
            label={resumeGameLabel(pausedGame.difficulty, pausedGame.chain.length)}
            tone="grape"
            onPress={handleResume}
            style={styles.continueButton}
          />
          <Button
            label={END_AND_START_NEW_CONFIRM.confirmLabel}
            variant="secondary"
            onPress={() => setConfirmEndPaused(true)}
            accessibilityHint="Ends your paused game and starts a new one. Asks first."
            style={styles.continueButton}
          />
        </View>
      ) : (
        <>
          {start === 'new_unpausable' && pausedGame !== null && (
            <Text style={styles.note}>{unpausableGameNote(pausedGame.difficulty)}</Text>
          )}
          <Button
            label="Continue"
            tone="grape"
            onPress={() => navigation.navigate('Game', { difficulty: selected })}
            style={styles.continueButton}
          />
        </>
      )}

      {/*
        Always mounted, with only its copy depending on the paused game, which
        confirming clears — see the same note on Home's open-game choice.
      */}
      <ConfirmSheet
        visible={confirmEndPaused && pausedGame !== null}
        title={pausedGame === null ? '' : END_AND_START_NEW_CONFIRM.title(pausedGame.difficulty)}
        message={
          pausedGame === null
            ? ''
            : END_AND_START_NEW_CONFIRM.message(pausedGame.difficulty, pausedGame.chain.length)
        }
        confirmLabel={END_AND_START_NEW_CONFIRM.confirmLabel}
        cancelLabel={END_AND_START_NEW_CONFIRM.cancelLabel}
        onConfirm={handleEndPausedAndStart}
        onCancel={() => setConfirmEndPaused(false)}
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
  pausedLine: { ...typeScale.caption, color: palette.ink },
  note: { ...typeScale.body, color: palette.ink },
  continueButton: { alignSelf: 'center' },
  // Buttons default to `alignSelf: 'flex-start'`, so each is centred like
  // Continue rather than relying on the container.
  pausedActions: { gap: spacing.md },
});

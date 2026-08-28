import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@components/common/Button';
import { Card } from '@components/common/Card';
import { GAME_OVER_CONTENT } from '@constants/gameConstants';
import { isSettledResult } from '@features/scoring/scoringEngine';
import { palette, spacing, typeScale } from '@theme/theme';
import type { GameSessionState, GameStatus } from '@app-types/game';

interface GameOverPanelProps {
  session: GameSessionState;
  onReviewWords: () => void;
  onPlayAgain: () => void;
  onHome: () => void;
}

/**
 * Game-over panel.
 * Spec: Wireframe doc section 14. Not a navigation route — `navigation/types.ts`
 * places `GameOver` as a child of `Game`, the same tier as the `Hint` overlay,
 * and `RootStackParamList` has no route for it. `GameScreen` renders this in
 * place once the round ends, the same way it already rendered a minimal
 * version of this before WL-308.
 *
 * All 5 `GameStatus` results (Wireframe section 14's "required result
 * states") share this one component — `GAME_OVER_CONTENT` supplies the
 * per-status headline and description, `GameStatus` already being exactly
 * that closed set (including `technical_failure`, decided at WL-110 — this
 * task renders it, it does not re-decide it).
 *
 * "Words played" and "Longest chain" are the same number here on purpose,
 * not a duplicate to collapse: a round's chain only ever grows until the
 * round ends, so both labels describe `session.chain.length` — matching the
 * Wireframe mockup's own example, which shows them equal (18/18).
 */
export function GameOverPanel({
  session,
  onReviewWords,
  onPlayAgain,
  onHome,
}: GameOverPanelProps): React.JSX.Element {
  const content = GAME_OVER_CONTENT[session.status as Exclude<GameStatus, 'active'>];
  const wordsPlayed = session.chain.length;

  // The same settled-status gate `roundEndBonus` and the profile's own
  // recording use (WL-402 pulled it out into one function), so this can never
  // claim a milestone the round didn't pay out or the profile won't keep.
  const isPersonalBest =
    isSettledResult(session.status) &&
    session.previousBestChainLength !== null &&
    session.chain.length > session.previousBestChainLength;

  return (
    <Card style={styles.card}>
      <Text style={styles.label}>Round Complete</Text>
      <Text style={styles.headline}>{content.headline}</Text>
      <Text style={styles.description}>{content.description}</Text>

      <View style={styles.stats}>
        <Text style={styles.statLine}>Score: {session.score}</Text>
        <Text style={styles.statLine}>Words played: {wordsPlayed}</Text>
        <Text style={styles.statLine}>Longest chain: {wordsPlayed}</Text>
        <Text style={styles.statLine}>Hints used: {session.hintsUsed}</Text>
        {isPersonalBest && (
          <Text style={styles.statLine}>New personal best!</Text>
        )}
      </View>

      <View style={styles.actions}>
        <Button label="Play Again" tone="grape" onPress={onPlayAgain} />
        <Button label="Review Words" variant="secondary" onPress={onReviewWords} />
        <Button label="Home" variant="secondary" onPress={onHome} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: 'center', gap: spacing.sm },
  label: { ...typeScale.body, color: palette.ink },
  headline: { ...typeScale.wordmark, color: palette.ink, textAlign: 'center' },
  description: { ...typeScale.body, color: palette.ink, textAlign: 'center' },
  stats: { alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm },
  statLine: { ...typeScale.body, color: palette.ink },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
  },
});

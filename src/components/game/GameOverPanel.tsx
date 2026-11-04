import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@components/common/Button';
import { Card } from '@components/common/Card';
import { gameOverCopy } from '@features/game/endGameMessage';
import { isSettledResult } from '@features/scoring/scoringEngine';
import { palette, spacing, typeScale, displayTextProps } from '@theme/theme';
import type { GameSessionState } from '@app-types/game';

interface GameOverPanelProps {
  session: GameSessionState;
  /**
   * The words in this round the player had never played before (WL-503), in
   * the order found. The stat line is omitted when there are none — "New words
   * discovered: 0" is a scoreboard for something the player did not fail at —
   * and the End Game message names them when there are (D-15).
   */
  newWords: string[];
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
 *
 * ## When the player ended the game (D-15)
 *
 * End Game is recorded as `computer_win`, but the panel never says so: it
 * shows one of §14's five encouraging messages, chosen from this game's real
 * numbers, then the sign-off. A genuine computer win keeps
 * `GAME_OVER_CONTENT`'s copy. All of that is decided in `gameOverCopy`, which
 * is pure and unit-tested; this component only lays it out.
 */
export function GameOverPanel({
  session,
  newWords,
  onReviewWords,
  onPlayAgain,
  onHome,
}: GameOverPanelProps): React.JSX.Element {
  const wordsPlayed = session.chain.length;

  // The same settled-status gate `roundEndBonus` and the profile's own
  // recording use (WL-402 pulled it out into one function), so this can never
  // claim a milestone the round didn't pay out or the profile won't keep.
  const isPersonalBest =
    isSettledResult(session.status) &&
    session.previousBestChainLength !== null &&
    session.chain.length > session.previousBestChainLength;

  const copy = gameOverCopy({ session, isPersonalBest, newWords });

  return (
    <Card style={styles.card}>
      <Text style={styles.label}>Round Complete</Text>
      <Text {...displayTextProps} style={styles.headline}>{copy.headline}</Text>
      <Text style={styles.description}>{copy.description}</Text>
      {copy.signOff !== null && <Text style={styles.signOff}>{copy.signOff}</Text>}

      <View style={styles.stats}>
        <Text style={styles.statLine}>Score: {session.score}</Text>
        <Text style={styles.statLine}>Words played: {wordsPlayed}</Text>
        <Text style={styles.statLine}>Longest chain: {wordsPlayed}</Text>
        <Text style={styles.statLine}>Hints used: {session.hintsUsed}</Text>
        {/*
          Wireframe section 14's "new words discovered", deferred at WL-308
          because nothing computed it then and wired here by WL-503. Counted
          off the profile rather than the chain — the profile is what knows
          whether the player had ever played the word before.
        */}
        {copy.showNewWordsStat && (
          <Text style={styles.statLine}>
            New words discovered: {newWords.length}
          </Text>
        )}
        {copy.showPersonalBestStat && (
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
  signOff: { ...typeScale.body, color: palette.ink, textAlign: 'center' },
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

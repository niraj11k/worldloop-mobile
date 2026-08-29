import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/types';
import { Button } from '@components/common/Button';
import { Card } from '@components/common/Card';
import { ConfirmSheet } from '@components/common/ConfirmSheet';
import { Icon } from '@components/common/icons/Icon';
import { HOME_EMPTY_STATE, START_NEW_ROUND_CONFIRM } from '@constants/gameConstants';
import { abandonSession } from '@features/game/gameSession';
import { useProfileStore } from '@store/useProfileStore';
import { useSavedRoundStore } from '@store/useSavedRoundStore';
import { palette, spacing, typeScale } from '@theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

/**
 * Home screen.
 * Spec: Wireframe doc section 5, empty state from section 17, built on the
 * WL-204 component set (WL-405).
 *
 * Required elements, all present: Start Game, Best Score, Best Streak, Word
 * Review, How to Play, Settings. Explicitly *not* here, per section 5's own
 * "important decision": no shop, social feed, leaderboard, or school
 * dashboard — "they would compete with the main action."
 *
 * ## What the layout is doing
 *
 * Section 5's purpose line is "give the user immediate access to gameplay",
 * so the screen is ordered by how much each thing matters: wordmark, then the
 * primary action, then the statistics that give it a reason, then the two
 * secondary entries. Start Game is the only primary-tone control on the
 * screen; everything else is `secondary`, so there is never a second thing
 * competing for the same glance.
 *
 * The two stat cards are the screen's decoration as well as its content —
 * saturated fills, `ink` borders, and opposing tilts (Design System sections
 * 3 and 4, "asymmetry is a feature"). They are informational, not
 * interactive, which is what makes rotating them legal; nothing else on this
 * screen is tilted, because everything else is a control.
 *
 * ## The daily-challenge placeholder is gone
 *
 * Section 5 lists it as *optional*, and v1 has no daily challenge (confirmed
 * out of scope), so what was here was an empty `View` carrying a marker
 * label — no layout, nothing to see, and one more node for a screen reader to
 * walk past. Reinstate it when there is a challenge to put in it.
 */
export function HomeScreen({ navigation }: Props): React.JSX.Element {
  const profile = useProfileStore(state => state.profile);
  const recordRound = useProfileStore(state => state.recordRound);
  const savedRound = useSavedRoundStore(state => state.saved);
  const clearSavedRound = useSavedRoundStore(state => state.clear);
  const [confirmNewRound, setConfirmNewRound] = useState(false);

  /**
   * Three states, not two (WL-402/405). `gamesPlayed`, not "a profile
   * exists": a fresh guest has a profile from its first launch (Architecture
   * section 8.1), so the profile's existence says nothing about whether there
   * are statistics to show. And until it has loaded there is no answer yet —
   * telling a returning player "no games completed yet" for a frame, then
   * replacing it with their real score, is worse than showing nothing for
   * that frame.
   */
  const hasPlayed = profile !== null && profile.gamesPlayed > 0;

  /**
   * Start Game, with WL-401's rule applied to a round that isn't on screen:
   * nothing discards a round without asking. With nothing saved this is just
   * a navigation.
   */
  const handleStartGame = () => {
    if (savedRound === null) {
      navigation.navigate('Difficulty');
      return;
    }
    setConfirmNewRound(true);
  };

  /**
   * The saved round is given up here rather than when the new round is dealt,
   * so it is recorded as `abandoned` against the profile the same way a
   * discarded round on the game screen is — one rule, both paths.
   */
  const handleDiscardSavedRound = () => {
    if (savedRound !== null) {
      recordRound(abandonSession(savedRound));
    }
    clearSavedRound();
    setConfirmNewRound(false);
    navigation.navigate('Difficulty');
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.wordmark} accessibilityRole="header">
          WordLoop
        </Text>
        {/*
          Icon-only control, so the label lives on the Pressable — the glyph is
          decorative and hidden from assistive tech (WL-207). A gear is only
          "Settings" in context.
        */}
        <Pressable
          onPress={() => navigation.navigate('Settings')}
          accessibilityRole="button"
          accessibilityLabel="Settings"
          hitSlop={spacing.sm}>
          <Icon name="settings" />
        </Pressable>
      </View>

      <Text style={styles.tagline}>Ready for a chain?</Text>

      <View style={styles.primaryActions}>
        <Button
          label="Start Game"
          tone="grape"
          onPress={handleStartGame}
          style={styles.fullWidthButton}
        />

        {/*
          WL-403: only rendered while a round is actually saved, so it is never
          a control that does nothing. The chain length tells the player which
          round is waiting without making them open it to find out.
        */}
        {savedRound !== null && (
          <Button
            label={`Resume Game · ${savedRound.chain.length} words`}
            variant="secondary"
            onPress={() =>
              navigation.navigate('Game', {
                difficulty: savedRound.difficulty,
                resume: true,
              })
            }
            style={styles.fullWidthButton}
          />
        )}
      </View>

      {/*
        Wireframe section 17's "Home without statistics", verbatim, and
        Wireframe section 5's two stat readouts otherwise. Both are grouped
        for assistive tech so each card reads as one phrase ("Best score: 120")
        rather than a label and a number that arrive separately.

        "Best streak" is the consecutive-*wins* streak — see `GuestStreak` for
        why that reading of an under-specified field, and the WL-402 note in
        the Delivery Plan for the decision this task did not overrule.
      */}
      {profile === null ? null : hasPlayed ? (
        <View style={styles.stats}>
          <Card
            fill="tangerine"
            rotation={-2}
            style={styles.statCard}
            accessibilityLabel={`Best score: ${profile.bests.score}`}>
            <Text style={styles.statLabel}>Best Score</Text>
            <Text style={styles.statValue}>{profile.bests.score}</Text>
          </Card>
          <Card
            fill="sunbeam"
            rotation={3}
            style={styles.statCard}
            accessibilityLabel={`Best streak: ${profile.localStreak.best}`}>
            <Text style={styles.statLabel}>Best Streak</Text>
            <Text style={styles.statValue}>{profile.localStreak.best}</Text>
          </Card>
        </View>
      ) : (
        <Card rotation={-2} style={styles.emptyState}>
          <Text style={styles.emptyStateHeadline}>{HOME_EMPTY_STATE.headline}</Text>
          <Text style={styles.emptyStateBody}>{HOME_EMPTY_STATE.body}</Text>
        </Card>
      )}

      <View style={styles.secondaryActions}>
        <Button
          label="Word Review"
          variant="secondary"
          onPress={() => navigation.navigate('WordReview', { sessionId: 'latest' })}
        />
        <Button
          label="How to Play"
          variant="secondary"
          onPress={() => navigation.navigate('HowToPlay')}
        />
      </View>

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
          <Text style={styles.devLink}>Component gallery (dev)</Text>
        </Pressable>
      )}

      <ConfirmSheet
        visible={confirmNewRound}
        title={START_NEW_ROUND_CONFIRM.title}
        message={START_NEW_ROUND_CONFIRM.message}
        confirmLabel={START_NEW_ROUND_CONFIRM.confirmLabel}
        cancelLabel={START_NEW_ROUND_CONFIRM.cancelLabel}
        onConfirm={handleDiscardSavedRound}
        onCancel={() => setConfirmNewRound(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.paper,
    padding: spacing.lg,
    gap: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  wordmark: { ...typeScale.wordmark, color: palette.ink },
  tagline: { ...typeScale.body, color: palette.ink },
  primaryActions: { gap: spacing.md },
  // Buttons are `alignSelf: 'flex-start'` by default; the primary action gets
  // the full width because it is the one thing this screen exists for.
  fullWidthButton: { alignSelf: 'stretch' },
  stats: { flexDirection: 'row', gap: spacing.lg },
  // Equal halves, so neither stat reads as the more important of the two.
  statCard: { flex: 1, alignItems: 'center', gap: spacing.xs },
  statLabel: { ...typeScale.caption, color: palette.ink },
  statValue: { ...typeScale.chainWord, color: palette.ink },
  emptyState: { gap: spacing.sm },
  emptyStateHeadline: { ...typeScale.chainWord, color: palette.ink },
  emptyStateBody: { ...typeScale.body, color: palette.ink },
  secondaryActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  devLink: { ...typeScale.caption, color: palette.ink },
});

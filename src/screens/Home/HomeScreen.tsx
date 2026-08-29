import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/types';
import { ConfirmSheet } from '@components/common/ConfirmSheet';
import { Icon } from '@components/common/icons/Icon';
import { START_NEW_ROUND_CONFIRM } from '@constants/gameConstants';
import { abandonSession } from '@features/game/gameSession';
import { useProfileStore } from '@store/useProfileStore';
import { useSavedRoundStore } from '@store/useSavedRoundStore';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

/**
 * Home screen.
 * Spec: Wireframe doc section 5.
 *
 * Required elements: Start Game, Best Score, Best Streak, Word Review entry,
 * How to Play entry, Settings entry, optional daily-challenge placeholder
 * (layout only, no functionality — confirmed out of scope for v1).
 *
 * Explicit decision (PRD/Wireframe doc): do NOT add a shop, social feed,
 * leaderboard, or school dashboard here in v1.
 *
 * ## Resuming a saved round (WL-403)
 *
 * Wireframe section 13 requires a round to survive a temporary exit but never
 * says where the player picks it back up, and section 5's element list
 * predates there being anything to resume. Home is the answer by elimination:
 * it is the first screen after launch, and the alternative — dropping the
 * player straight into a half-played round on open — takes the decision away
 * from them. So the entry appears only while a round is actually saved, and
 * Start Game asks before replacing it. Behaviour is WL-403's; the styling and
 * final layout are WL-405's, like the statistics above.
 */
export function HomeScreen({ navigation }: Props): React.JSX.Element {
  const profile = useProfileStore(state => state.profile);
  const recordRound = useProfileStore(state => state.recordRound);
  const savedRound = useSavedRoundStore(state => state.saved);
  const clearSavedRound = useSavedRoundStore(state => state.clear);
  const [confirmNewRound, setConfirmNewRound] = useState(false);

  // `gamesPlayed`, not "a profile exists": a fresh guest has a profile from
  // its first launch (Architecture §8.1), so the profile's existence says
  // nothing about whether there are statistics to show.
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
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text>WordLoop</Text>
        {/*
          Icon-only control, so the label lives on the Pressable — the glyph is
          decorative and hidden from assistive tech (WL-207). A gear is only
          "Settings" in context.
        */}
        <Pressable
          onPress={() => navigation.navigate('Settings')}
          accessibilityRole="button"
          accessibilityLabel="Settings">
          <Icon name="settings" />
        </Pressable>
      </View>

      <Text>Ready for a chain?</Text>

      <Pressable onPress={handleStartGame}>
        <Text>Start Game</Text>
      </Pressable>

      {/*
        WL-403: only rendered while a round is actually saved, so it is never
        a control that does nothing. The chain length tells the player which
        round is waiting without making them open it to find out.
      */}
      {savedRound !== null && (
        <Pressable
          onPress={() =>
            navigation.navigate('Game', {
              difficulty: savedRound.difficulty,
              resume: true,
            })
          }>
          <Text>Resume Game ({savedRound.chain.length} words)</Text>
        </Pressable>
      )}

      {/*
        Bound to the persisted guest profile (WL-402) — this is the screen the
        Delivery Plan's "profile survives cold start" criterion is visible on.
        Still shows `--` before the profile has loaded and on a fresh install
        with nothing recorded; Wireframe §17's proper "No games completed yet"
        empty state, and this screen's layout, are WL-405's.

        "Best streak" is the consecutive-*wins* streak — see `GuestStreak` for
        why that reading, and the WL-402 note in the Delivery Plan for the
        decision WL-405 may overrule.
      */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
        <View>
          <Text>Best Score</Text>
          <Text>{hasPlayed ? profile.bests.score : '--'}</Text>
        </View>
        <View>
          <Text>Best Streak</Text>
          <Text>{hasPlayed ? profile.localStreak.best : '--'}</Text>
        </View>
      </View>

      {/* Daily challenge placeholder — layout only, per confirmed scope */}
      <View accessibilityLabel="daily-challenge-placeholder" />

      <Pressable onPress={() => navigation.navigate('WordReview', { sessionId: 'latest' })}>
        <Text>Word Review</Text>
      </Pressable>
      <Pressable onPress={() => navigation.navigate('HowToPlay')}>
        <Text>How to Play</Text>
      </Pressable>

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
          <Text>Component gallery (dev)</Text>
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

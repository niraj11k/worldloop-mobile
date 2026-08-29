import React from 'react';
import { StyleSheet, View } from 'react-native';

import { BottomSheet } from '@components/common/BottomSheet';
import { Button } from '@components/common/Button';
import { spacing } from '@theme/theme';

interface PauseSheetProps {
  visible: boolean;
  onResume: () => void;
  onHowToPlay: () => void;
  onRestart: () => void;
  onExit: () => void;
}

/**
 * Pause screen.
 * Spec: Wireframe doc section 13 — Resume Game, How to Play, Restart Game,
 * Exit to Home, in that order.
 *
 * A sheet rather than a route, like the Hint sheet (`navigation/types.ts`
 * places Pause at the same tier as Hint, a child of Game rather than a
 * `RootStackParamList` entry). That is also what satisfies section 13's first
 * requirement — "preserve the current game state" — by construction: the
 * round is still mounted underneath, so there is no state to save and reload
 * just to show four buttons.
 *
 * ## Where the confirmations are
 *
 * Section 13 requires confirming before restarting or exiting, and both do —
 * but only one of them confirms *here*. Exit to Home is a navigation, and
 * WL-401's guard already holds every route off the game screen behind the
 * "Leave this round?" dialog; raising a second, near-identical dialog first
 * would ask the same question twice in a row. Restart is not a navigation and
 * nothing else guards it, so `GameScreen` confirms it. Both are dismissible
 * and neither is pre-selected, per section 13's own requirement.
 *
 * Each action closes this sheet before doing anything, so no confirmation
 * ever has to render on top of it — two stacked native modals is a rendering
 * problem on both platforms, and an unnecessary one here.
 */
export function PauseSheet({
  visible,
  onResume,
  onHowToPlay,
  onRestart,
  onExit,
}: PauseSheetProps): React.JSX.Element {
  return (
    // Android back and a scrim tap both resume: the sheet is a pause, and the
    // least destructive reading of "get me out of this" is to carry on
    // playing. Nothing here is lost by dismissing it.
    <BottomSheet visible={visible} onRequestClose={onResume} title="Paused">
      <View style={styles.actions}>
        <Button label="Resume Game" tone="grape" onPress={onResume} />
        <Button label="How to Play" variant="secondary" onPress={onHowToPlay} />
        <Button
          label="Restart Game"
          variant="secondary"
          onPress={onRestart}
          accessibilityHint="Starts this round again from a new word. Asks first."
        />
        <Button
          label="Exit to Home"
          variant="secondary"
          onPress={onExit}
          accessibilityHint="Leaves the round and returns Home. Asks first."
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  // One action per row, in the order Wireframe section 13 lists them.
  actions: { gap: spacing.md, marginTop: spacing.sm },
});

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@components/common/BottomSheet';
import { Button } from '@components/common/Button';
import { palette, spacing, typeScale } from '@theme/theme';

interface PauseSheetProps {
  visible: boolean;
  onResume: () => void;
  onHowToPlay: () => void;
  onRestart: () => void;
  /** Keep this game for later and return Home (D-13). */
  onPauseAndExit: () => void;
  /** End this game. Asks first. */
  onEndGame: () => void;
  /**
   * Why Pause & Exit isn't offered, when it isn't: another difficulty's game
   * already holds the one pause slot (D-13 rule 4). `null` offers it.
   */
  pauseUnavailableNote: string | null;
}

/**
 * Pause screen.
 * Spec: Wireframe doc section 13 — Resume Game, How to Play, Restart Game,
 * Pause & Exit, End Game, in that order (D-13 replaced Exit to Home with the
 * last two).
 *
 * A sheet rather than a route, like the Hint sheet (`navigation/types.ts`
 * places Pause at the same tier as Hint, a child of Game rather than a
 * `RootStackParamList` entry). That is also what satisfies section 13's first
 * requirement — "preserve the current game state" — by construction: the
 * game is still mounted underneath, so there is no state to save and reload
 * just to show the buttons.
 *
 * ## Where the confirmations are
 *
 * Section 13 requires confirming before restarting, ending, or exiting.
 * Restart and End Game give something up, so `GameScreen` confirms each.
 * Pause & Exit gives nothing up — the game is kept — so it goes straight
 * Home. Both leave routes skip the Back control's "Leave this game?" dialog:
 * the player has already chosen which way to leave, and asking again would
 * be the same question twice in a row.
 *
 * When the pause slot is full, Pause & Exit isn't offered, and a note says
 * why (Wireframe §13). Hidden rather than disabled: a disabled button would
 * still be read out and tapped at, and the note already explains the absence.
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
  onPauseAndExit,
  onEndGame,
  pauseUnavailableNote,
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
          accessibilityHint="Ends this game and starts a new one at the same difficulty. Asks first."
        />
        {pauseUnavailableNote === null ? (
          <Button
            label="Pause & Exit"
            variant="secondary"
            onPress={onPauseAndExit}
            accessibilityHint="Keeps this game to pick up later, and returns Home."
          />
        ) : (
          <Text style={styles.note}>{pauseUnavailableNote}</Text>
        )}
        <Button
          label="End Game"
          variant="secondary"
          onPress={onEndGame}
          accessibilityHint="Ends this game and returns Home. Asks first."
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  // One action per row, in the order Wireframe section 13 lists them.
  actions: { gap: spacing.md, marginTop: spacing.sm },
  note: { ...typeScale.caption, color: palette.ink },
});

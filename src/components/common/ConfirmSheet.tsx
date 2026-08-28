import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@components/common/BottomSheet';
import { Button } from '@components/common/Button';
import { palette, spacing, typeScale } from '@theme/theme';

export interface ConfirmSheetProps {
  visible: boolean;
  title: string;
  message: string;
  /** The destructive action's label, e.g. "Discard Round". */
  confirmLabel: string;
  /** The safe action's label. Defaults to "Cancel". */
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  testID?: string;
}

/**
 * Confirmation dialog — the surface behind WL-401's "confirm before any
 * action that discards a round" rule, and the one WL-404's Pause screen
 * reuses for Restart and Exit to Home (Wireframe section 13).
 *
 * Built on `BottomSheet` rather than RN's `Alert`: `Alert` renders the
 * platform's own dialog, which carries none of the design system's component
 * language (Design System section 4 — thick `ink` border, hard offset shadow,
 * no blur) and cannot be made to. The one thing `Alert` would have given for
 * free is that it can't be dismissed by accident, so that property is rebuilt
 * here explicitly:
 *
 * - `dismissOnScrimPress={false}` — a stray tap outside the dialog is exactly
 *   the accident this component exists to prevent, and `BottomSheet` names
 *   this task as the caller that needs it.
 * - Android hardware back resolves to **cancel**, not confirm. Back is the
 *   gesture that most often opens this dialog in the first place; pressing it
 *   again must not become a two-tap way to destroy the round.
 *
 * ## Why the destructive action is the secondary button
 *
 * Design System section 4 offers exactly two primary fills (`grape`,
 * `tangerine`) and no destructive tone — `red-alert` is a status colour for
 * error text and input borders, not a button fill in the matrix. Rather than
 * invent one, the emphasis is inverted: the *safe* choice takes the primary
 * button and the destructive one takes `secondary`. That is the conventional
 * treatment for a confirmation anyway, and it keeps every fill on this screen
 * inside the contrast matrix WL-202 verified.
 *
 * The safe action is also rendered first, so a screen reader reaches "keep
 * playing" before "discard".
 */
export function ConfirmSheet({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  testID,
}: ConfirmSheetProps): React.JSX.Element {
  return (
    <BottomSheet
      visible={visible}
      onRequestClose={onCancel}
      title={title}
      dismissOnScrimPress={false}
      testID={testID}>
      <Text style={styles.message}>{message}</Text>

      <View style={styles.actions}>
        <Button label={cancelLabel} tone="grape" onPress={onCancel} />
        <Button label={confirmLabel} variant="secondary" onPress={onConfirm} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  message: { ...typeScale.body, color: palette.ink },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
    flexWrap: 'wrap',
  },
});

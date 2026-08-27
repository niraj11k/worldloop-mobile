import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import {
  palette,
  scrim,
  spacing,
  radius,
  borderWidth,
  shadow,
  typeScale,
} from '@theme/theme';

/**
 * Bottom sheet / modal — Design System §4, "Modals / bottom sheets".
 *
 * The surface behind the Hint sheet, Word Definition overlay, and Pause screen
 * (Wireframe §11-§13). Heavier shadow than a card (10-12px) to read as elevated,
 * and a 4px `ink` border — §4 sets that as a floor for this component
 * specifically, not the 3px other components use.
 *
 * ## What this deliberately does not do
 *
 * **No entry animation.** §4 specifies "spring-based scale/slide, respecting
 * reduced-motion", and §5 owns motion — that is WL-205, which must also supply
 * the non-animated equivalent. Wiring a spring here would mean WL-205 either
 * inherits an untested animation or rips one out. `animationType="none"` is set
 * explicitly rather than left to default, so the absence is a decision rather
 * than an oversight.
 *
 * ## Dismissal
 *
 * `onRequestClose` fires for the Android hardware back button *and* for a tap
 * on the scrim. Both matter: Wireframe §19 requires Android back to work
 * everywhere, and a scrim tap is the gesture users try first. Callers that must
 * not be dismissed casually (a confirmation) should pass
 * `dismissOnScrimPress={false}` — WL-401 owns the confirm-before-discard rule.
 */

export interface BottomSheetProps {
  visible: boolean;
  onRequestClose: () => void;
  children: React.ReactNode;
  /** Rendered as the sheet's heading and used as its accessibility label. */
  title?: string;
  /** Defaults to true. Set false where a deliberate choice is required. */
  dismissOnScrimPress?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function BottomSheet({
  visible,
  onRequestClose,
  children,
  title,
  dismissOnScrimPress = true,
  style,
  testID,
}: BottomSheetProps): React.JSX.Element {
  return (
    <Modal
      visible={visible}
      transparent
      // See the docblock: motion is WL-205's, and this makes that explicit.
      animationType="none"
      onRequestClose={onRequestClose}
      testID={testID}>
      <View style={styles.scrim}>
        {/*
          The scrim is a sibling of the sheet rather than its parent, so a tap
          inside the sheet cannot bubble out and dismiss it. Marked
          accessibility-hidden: it is a dismissal affordance for pointer users,
          and exposing an unlabelled full-screen button to a screen reader would
          be noise — those users dismiss via the back gesture or an explicit
          control inside the sheet.
        */}
        <Pressable
          style={styles.scrimPressable}
          onPress={dismissOnScrimPress ? onRequestClose : undefined}
          importantForAccessibility="no"
          accessibilityElementsHidden
          pointerEvents={dismissOnScrimPress ? 'auto' : 'none'}
        />

        <View
          style={[styles.sheet, style]}
          accessibilityViewIsModal
          accessibilityLabel={title}>
          {title ? <Text style={styles.title}>{title}</Text> : null}
          {children}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: 'flex-end', backgroundColor: scrim },
  scrimPressable: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  sheet: {
    backgroundColor: palette.paper,
    padding: spacing.lg,
    gap: spacing.md,
    // §4: modals carry the heaviest shadow and a 4px border floor.
    borderWidth: borderWidth.thick,
    borderColor: palette.ink,
    // Only the top corners round — the sheet is anchored to the bottom edge.
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    boxShadow: shadow.modal,
  },
  title: { ...typeScale.screenTitle, color: palette.ink },
});

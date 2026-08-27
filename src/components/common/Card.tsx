import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import {
  palette,
  spacing,
  radius,
  borderWidth,
  shadow,
  rotation,
  rotate,
} from '@theme/theme';
import type { FillToken } from '@theme/theme';

/**
 * Card — Design System §4.
 *
 * `ink` border, 20px radius, 6-8px hard offset shadow, and any section 1 fill.
 *
 * ## Rotation is opt-in, clamped, and deliberately awkward to abuse
 *
 * §3 permits `-2deg` to `3deg` on cards and stickers, and §0 calls that
 * intentional imperfection "a feature, not an accident". But §3 also forbids
 * rotating anything interactive — rotation interferes with tap targets and with
 * the predictable focus states Wireframe §18 requires — and §4 adds that cards
 * containing the input field or primary game controls must never rotate.
 *
 * A component cannot inspect its own children for interactive elements, so that
 * rule cannot be enforced here. What this does instead: rotation defaults to
 * none, must be asked for explicitly, and is clamped to the §3 range so a
 * plausible-looking `rotation={15}` cannot ship. The remaining judgement — is
 * this card decorative or interactive — stays with the caller, which is where
 * the information actually is.
 */

export interface CardProps {
  children: React.ReactNode;
  /** Any section 1 fill. Defaults to `paper`. */
  fill?: Extract<FillToken, 'paper' | 'grape' | 'tangerine' | 'bubblegum' | 'limeade' | 'sunbeam' | 'redAlert'>;
  /**
   * Degrees of tilt, clamped to §3's -2..3. Decorative and informational cards
   * only — never a card holding the input field or primary game controls (§4).
   */
  rotation?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  /** Set when the card is a meaningful grouping for a screen reader. */
  accessibilityLabel?: string;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export function Card({
  children,
  fill = 'paper',
  rotation: tilt = 0,
  style,
  testID,
  accessibilityLabel,
}: CardProps): React.JSX.Element {
  const tilted = clamp(tilt, rotation.cardMin, rotation.cardMax);

  return (
    <View
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      accessible={accessibilityLabel !== undefined}
      style={[
        styles.base,
        { backgroundColor: palette[fill] },
        tilted !== 0 ? { transform: rotate(tilted) } : null,
        style,
      ]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    padding: spacing.lg,
    backgroundColor: palette.paper,
    borderWidth: borderWidth.base,
    borderColor: palette.ink,
    borderRadius: radius.card,
    boxShadow: shadow.card,
    gap: spacing.sm,
  },
});

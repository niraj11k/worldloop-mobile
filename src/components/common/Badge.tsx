import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import {
  palette,
  spacing,
  radius,
  borderWidth,
  shadow,
  rotation,
  rotate,
  typeScale,
  textOn,
} from '@theme/theme';

/**
 * Badge / tag / sticker — Design System §4.
 *
 * Pill-shaped, `sunbeam` or `bubblegum` fill, thin `ink` border, small hard
 * shadow, and — per §4 — "often rotated 3-6 degrees for the sticker feel".
 * Used for streak counts, difficulty tags, and "new word" callouts.
 *
 * ## The tilt is stable per badge, not random per render
 *
 * §0 asks for intentional imperfection, which pushes toward varying the angle
 * rather than tilting every sticker identically. But deriving it from
 * `Math.random()` at render time would re-roll the angle on every state change
 * — a streak badge would visibly jump each time the number ticked up, which
 * reads as a glitch rather than as character, and would fight §5's rule that
 * only the *changing* element animates.
 *
 * So the angle is derived from the label: same badge, same tilt, every render,
 * while different badges on one screen still sit at different angles. Callers
 * can override it, and 0 turns it off.
 */

export interface BadgeProps {
  label: string;
  /** §4 names these two for stickers. Defaults to `sunbeam`. */
  fill?: 'sunbeam' | 'bubblegum';
  /**
   * Degrees of tilt, clamped to §3's 3-6 for stickers. Omit for the derived
   * per-label angle; pass 0 for no rotation.
   */
  rotation?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  /** Defaults to `label`. Set when the badge needs more context spoken. */
  accessibilityLabel?: string;
}

/** Small deterministic hash, so one label always yields one angle. */
function tiltFor(label: string): number {
  let hash = 0;
  for (let i = 0; i < label.length; i++) {
    hash = (hash * 31 + label.charCodeAt(i)) | 0;
  }
  const span = rotation.badgeMax - rotation.badgeMin;
  const magnitude = rotation.badgeMin + (Math.abs(hash) % (span + 1));
  // Alternate direction so a row of stickers leans both ways rather than
  // marching in the same direction.
  return hash % 2 === 0 ? magnitude : -magnitude;
}

const clampMagnitude = (value: number, min: number, max: number) => {
  if (value === 0) return 0;
  const sign = value < 0 ? -1 : 1;
  return sign * Math.min(Math.max(Math.abs(value), min), max);
};

export function Badge({
  label,
  fill = 'sunbeam',
  rotation: tilt,
  style,
  testID,
  accessibilityLabel,
}: BadgeProps): React.JSX.Element {
  const angle = useMemo(
    () =>
      tilt === undefined
        ? tiltFor(label)
        : clampMagnitude(tilt, rotation.badgeMin, rotation.badgeMax),
    [label, tilt],
  );

  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={accessibilityLabel ?? label}
      style={[
        styles.base,
        { backgroundColor: palette[fill] },
        angle !== 0 ? { transform: rotate(angle) } : null,
        style,
      ]}>
      <Text style={[styles.label, { color: textOn(fill) }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    // §4: badges take the thinner 2-3px border, not the 3-4px of larger
    // components.
    borderWidth: borderWidth.thin,
    borderColor: palette.ink,
    borderRadius: radius.pill,
    boxShadow: shadow.badge,
  },
  label: { ...typeScale.caption },
});

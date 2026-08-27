import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { motion } from '@theme/motion';
import { palette, typeScale } from '@theme/theme';
import { useReducedMotion } from '@hooks/useReducedMotion';

/**
 * Computer "thinking" indicator — Design System §5.
 *
 * "A simple 3-dot pulse in the monospace face, **not a spinner** — keeps the
 * handmade, typographic feel rather than borrowing a generic loading spinner."
 * So these are real monospace full stops, not dots drawn as views, and there is
 * no rotating element anywhere in it.
 *
 * ## Reduced motion, and why this one needs a label
 *
 * The fallback shows the three dots static, at full opacity. But static dots
 * alone are ambiguous — they could equally be a truncation — so unlike the
 * other primitives this one **requires the caller to render accompanying text**
 * ("WordLoop is thinking…", Wireframe §9). That text is what actually carries
 * the state; the pulse only makes it feel alive.
 *
 * The whole element is therefore marked as one accessibility node with a label,
 * so a screen reader announces the state rather than reading three full stops.
 * `accessibilityRole="progressbar"` communicates indeterminate activity — the
 * one thing a static row of dots cannot say on its own.
 */

export interface ThinkingDotsProps {
  /** Spoken instead of the dots. Should match the visible status text. */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const DOTS = [0, 1, 2];

export function ThinkingDots({
  accessibilityLabel = 'WordLoop is thinking',
  style,
  testID,
}: ThinkingDotsProps): React.JSX.Element {
  const reduced = useReducedMotion();
  // One value per dot; the stagger between them is what makes it read as a
  // travelling pulse rather than three dots blinking in unison.
  const values = useRef(DOTS.map(() => new Animated.Value(1))).current;

  useEffect(() => {
    if (reduced) {
      values.forEach(v => v.setValue(1));
      return;
    }

    const { dotDurationMs, staggerMs, minOpacity } = motion.thinking;

    const loops = values.map((value, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * staggerMs),
          Animated.timing(value, {
            toValue: minOpacity,
            duration: dotDurationMs / 2,
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 1,
            duration: dotDurationMs / 2,
            useNativeDriver: true,
          }),
          // Pad the tail so every dot's cycle is the same length regardless of
          // its stagger; otherwise the dots drift out of phase over time.
          Animated.delay((DOTS.length - 1 - i) * staggerMs),
        ]),
      ),
    );

    loops.forEach(l => l.start());
    // A loop that outlives its component runs forever. This indicator unmounts
    // the moment the computer's turn ends, so stopping is not optional.
    return () => loops.forEach(l => l.stop());
  }, [reduced, values]);

  return (
    <View
      testID={testID}
      style={[styles.row, style]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}>
      {DOTS.map(i => (
        <Animated.Text key={i} style={[styles.dot, { opacity: values[i] }]}>
          .
        </Animated.Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  dot: { ...typeScale.chainWord, color: palette.ink },
});

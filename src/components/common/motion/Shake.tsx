import React, { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { motion } from '@theme/motion';
import { useReducedMotion } from '@hooks/useReducedMotion';

/**
 * Horizontal shake — Design System §5, invalid word submitted.
 *
 * **Reduced-motion fallback: nothing happens, and that is complete rather than
 * lazy.** §5 spells it out — "reduced-motion: no shake, border flash only" —
 * and then gives the reason: "the shake must never be the only signal, since
 * the error text (section 4, Input fields) already carries the meaning".
 *
 * So this primitive is the one effect in §5 whose fallback is genuinely *no
 * substitute*: the information is already carried, permanently and
 * non-visually, by the `Input` component's error state — a `red-alert` border,
 * a marker, the message text, and an assertive live-region announcement. The
 * shake only draws the eye of someone who can already see all four.
 *
 * Wrapping something whose error signal is *not* independently carried would
 * be a misuse of this component.
 */

export interface ShakeProps {
  children: React.ReactNode;
  /** Shakes when this value changes. The first render never shakes. */
  trigger: unknown;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function Shake({ children, trigger, style, testID }: ShakeProps): React.JSX.Element {
  const reduced = useReducedMotion();
  const translateX = useRef(new Animated.Value(0)).current;
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (reduced) return;

    const { distance, cycles, durationMs } = motion.shake;
    const leg = (toValue: number) =>
      Animated.timing(translateX, {
        toValue,
        duration: durationMs,
        useNativeDriver: true,
      });

    const animation = Animated.sequence([
      ...Array.from({ length: cycles }).flatMap(() => [leg(-distance), leg(distance)]),
      // Always finish on centre, so an interrupted-and-restarted shake cannot
      // leave the control resting off-axis.
      leg(0),
    ]);

    animation.start();
    return () => {
      animation.stop();
      translateX.setValue(0);
    };
  }, [trigger, reduced, translateX]);

  return (
    <Animated.View testID={testID} style={[style, { transform: [{ translateX }] }]}>
      {children}
    </Animated.View>
  );
}

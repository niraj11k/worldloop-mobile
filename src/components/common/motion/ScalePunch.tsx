import React, { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { motion } from '@theme/motion';
import { useReducedMotion } from '@hooks/useReducedMotion';

/**
 * Scale-punch — Design System §5, streak counter: "1.0 → 1.15 → 1.0, ~200ms".
 *
 * Fires whenever `trigger` changes, so callers pass the value whose *change* is
 * the event (a streak count, a score). That is deliberate over an imperative
 * ref: the animation is then a consequence of state, and cannot drift out of
 * sync with what is rendered.
 *
 * **Reduced-motion fallback**, exactly as §5 specifies: "number updates
 * instantly, brief 100ms opacity flash only (no scale)". The dip is to 0.6
 * rather than 0 — a flash to fully transparent reads as the element vanishing
 * and reappearing, which is a bigger visual event than the punch it replaces.
 */

export interface ScalePunchProps {
  children: React.ReactNode;
  /** Punches when this value changes. The first render never animates. */
  trigger: unknown;
  /** §5's "slightly bigger version" for milestone streaks. */
  milestone?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function ScalePunch({
  children,
  trigger,
  milestone = false,
  style,
  testID,
}: ScalePunchProps): React.JSX.Element {
  const reduced = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const firstRender = useRef(true);

  useEffect(() => {
    // Mounting is not an increment. Punching on first render would make every
    // badge on a freshly opened screen jump for no reason.
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }

    const peak = milestone ? motion.punch.milestoneScale : motion.punch.scale;
    const half = motion.punch.durationMs / 2;

    const animation = reduced
      ? Animated.sequence([
          Animated.timing(opacity, {
            toValue: 0.6,
            duration: motion.reduced.flashMs / 2,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 1,
            duration: motion.reduced.flashMs / 2,
            useNativeDriver: true,
          }),
        ])
      : Animated.sequence([
          Animated.timing(scale, {
            toValue: peak,
            duration: half,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 1,
            duration: half,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
        ]);

    animation.start();
    // Stopping on cleanup matters: without it, a punch still running when the
    // component unmounts leaves the driver updating a detached node.
    return () => animation.stop();
  }, [trigger, milestone, reduced, scale, opacity]);

  return (
    <Animated.View
      testID={testID}
      style={[style, { transform: [{ scale }], opacity }]}>
      {children}
    </Animated.View>
  );
}

import React, { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { motion } from '@theme/motion';
import { useReducedMotion } from '@hooks/useReducedMotion';

/**
 * Spring scale-in — Design System §5.
 *
 * Two things in §5 are the same primitive: the level-up modal's "spring
 * scale-in", and the "small scale-in" a valid word uses to stamp onto the chain
 * display. One component serves both rather than two near-identical ones.
 *
 * **Reduced-motion fallback**, as §5 states for the modal: "instant appearance,
 * no scale". Nothing is lost — the element appearing *is* the state change, so
 * unlike the punch there is no signal that needs substituting.
 *
 * ## The chain-display constraint
 *
 * §5 requires that when a word stamps in, "the chain display itself doesn't
 * reflow/animate other entries — only the new entry animates in". Wrapping each
 * entry individually is what satisfies that: the animation is on the entry, not
 * on the list, so no sibling is touched. Scaling a whole list container would
 * violate it, and would also be the busy, distracting result §5 is guarding
 * against.
 */

export interface SpringInProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function SpringIn({ children, style, testID }: SpringInProps): React.JSX.Element {
  const reduced = useReducedMotion();

  // Start at the resting value when reduced motion is on, so there is no first
  // frame at the smaller scale to flash before the effect runs.
  const scale = useRef(
    new Animated.Value(reduced ? 1 : motion.spring.fromScale),
  ).current;

  useEffect(() => {
    if (reduced) {
      scale.setValue(1);
      return;
    }

    const animation = Animated.spring(scale, {
      toValue: 1,
      damping: motion.spring.damping,
      stiffness: motion.spring.stiffness,
      mass: motion.spring.mass,
      useNativeDriver: true,
    });

    animation.start();
    return () => animation.stop();
  }, [reduced, scale]);

  return (
    <Animated.View testID={testID} style={[style, { transform: [{ scale }] }]}>
      {children}
    </Animated.View>
  );
}

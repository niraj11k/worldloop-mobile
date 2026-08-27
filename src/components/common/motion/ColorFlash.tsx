import React, { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { motion } from '@theme/motion';
import { useReducedMotion } from '@hooks/useReducedMotion';

/**
 * Colour flash — Design System §5.
 *
 * Used for the valid-move fill flashing `limeade`, and for the streak badge's
 * "colour flash to `sunbeam` and back". Fires when `trigger` changes.
 *
 * ## Reduced motion still flashes — and that is the point
 *
 * Unlike the punch and the shake, the *colour* here is the signal, not a
 * decoration on top of one. Suppressing it entirely would remove information
 * from the very users §5's rule exists to protect. So under reduced motion the
 * colour still changes; what is removed is the animated *transition* — it
 * switches instantly, holds, and switches back.
 *
 * That is the correct reading of the setting: reduced motion targets movement
 * and vestibular triggers, not colour. WCAG's flashing threshold (2.3.1) is
 * about three or more flashes per second; this is a single brief change well
 * under that, and it is never the only carrier of the state — §4's error text
 * and §5's chain stamp both accompany it.
 *
 * ## Why this cannot use the native driver
 *
 * `backgroundColor` is not a transform or an opacity, so it is animated on the
 * JS thread (`useNativeDriver: false`). Acceptable here because the flash is
 * short and does not run alongside a gesture; anything longer-running should
 * prefer opacity or transform so it can be driven natively.
 */

export interface ColorFlashProps {
  children: React.ReactNode;
  /** Flashes when this value changes. The first render never flashes. */
  trigger: unknown;
  /** The resting fill. */
  from: string;
  /** The colour to flash to. */
  to: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function ColorFlash({
  children,
  trigger,
  from,
  to,
  style,
  testID,
}: ColorFlashProps): React.JSX.Element {
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(0)).current;
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }

    const animation = reduced
      ? Animated.sequence([
          // Instant on, hold, instant off — the signal without the transition.
          Animated.timing(progress, { toValue: 1, duration: 0, useNativeDriver: false }),
          Animated.delay(motion.reduced.flashMs),
          Animated.timing(progress, { toValue: 0, duration: 0, useNativeDriver: false }),
        ])
      : Animated.sequence([
          Animated.timing(progress, {
            toValue: 1,
            duration: motion.flash.inMs,
            useNativeDriver: false,
          }),
          Animated.delay(motion.flash.holdMs),
          Animated.timing(progress, {
            toValue: 0,
            duration: motion.flash.outMs,
            useNativeDriver: false,
          }),
        ]);

    animation.start();
    return () => animation.stop();
  }, [trigger, reduced, progress]);

  const backgroundColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [from, to],
  });

  return (
    <Animated.View testID={testID} style={[style, { backgroundColor }]}>
      {children}
    </Animated.View>
  );
}

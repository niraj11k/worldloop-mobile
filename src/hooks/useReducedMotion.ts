import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Whether the OS reduced-motion setting is on.
 *
 * Spec: Design System §5 ("All motion must respect the system-level
 * reduced-motion setting") and Wireframe §18 ("Reduced-motion option").
 * Task: WL-205.
 *
 * Maps to **Settings → Accessibility → Motion → Reduce Motion** on iOS and
 * **Settings → Accessibility → Remove animations** on Android.
 *
 * ## Why this subscribes rather than reading once
 *
 * The setting can be toggled while the app is running — that is precisely what
 * someone does when motion starts making them ill mid-round — so a one-shot
 * read at mount would leave the app animating until the next cold start. The
 * listener is what makes the setting take effect immediately, which is also
 * what Wireframe §16 promises of every settings toggle.
 *
 * ## Defaulting to `false`
 *
 * The initial value is `false` (animate) rather than `true`, because the async
 * read resolves within a frame or two and starting in the reduced state would
 * make every screen visibly "snap" into motion on launch for the majority of
 * users who have not enabled it. The trade-off is that a user who *has*
 * enabled it may see the first frame of one animation; that is the smaller
 * harm, and the effects here are short enough that none of them completes in
 * that window.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let active = true;

    AccessibilityInfo.isReduceMotionEnabled().then(value => {
      // The component may have unmounted while the native call was in flight.
      if (active) setReduced(value);
    });

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduced,
    );

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return reduced;
}

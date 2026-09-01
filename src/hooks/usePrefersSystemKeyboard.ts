import { useEffect, useState } from 'react';
import { AccessibilityInfo, useWindowDimensions } from 'react-native';

import { MAX_SYSTEM_KEYBOARD_FONT_SCALE } from '@theme/theme';

/**
 * Whether the game screen should hand typing back to the OS keyboard instead of
 * using the in-app letter keyboard.
 *
 * Spec: Delivery Plan D-11, Design System §4 ("Keys"). Task: WL-311.
 *
 * D-11 replaced the OS keyboard on the game screen, and this hook is the half
 * of that decision that keeps it defensible. The in-app keyboard is better for
 * the *game* — no autocorrect rewriting judged words, a height the layout
 * actually knows, no Devanagari keyboard on an English word list — but it is
 * strictly worse for two groups of players, and neither of them is a rounding
 * error.
 *
 * ## Screen readers
 *
 * 26 custom buttons are reachable, labelled, and technically operable. They are
 * still a downgrade: the OS keyboard gives VoiceOver and TalkBack users
 * dictation, the rotor, braille input, and years of muscle memory, none of
 * which a set of `Pressable`s can offer. Wireframe §18 asks for screen-reader
 * labels; meeting that literally while making the app slower to use would be
 * satisfying the letter of the requirement against its purpose.
 *
 * ## Large text
 *
 * A key is sized by the 10-column grid it sits in, so its label is capped at
 * `MAX_KEY_FONT_SCALE` rather than scaling freely — the one place in the app
 * where OS text scaling is not honoured in full. Past
 * `MAX_SYSTEM_KEYBOARD_FONT_SCALE` that compromise stops being acceptable, and
 * a player at that setting has told the OS they need larger text: the OS
 * keyboard can honour that and this one cannot.
 *
 * `fontScale` comes from `useWindowDimensions` rather than
 * `PixelRatio.getFontScale()` because that hook re-renders when the setting
 * changes; the `PixelRatio` call is a one-shot read that would leave the
 * keyboard wrong until the next cold start.
 */
export function usePrefersSystemKeyboard(): boolean {
  const [screenReaderEnabled, setScreenReaderEnabled] = useState(false);
  const { fontScale } = useWindowDimensions();

  useEffect(() => {
    let active = true;

    AccessibilityInfo.isScreenReaderEnabled().then(value => {
      // The component may have unmounted while the native call was in flight.
      if (active) setScreenReaderEnabled(value);
    });

    const subscription = AccessibilityInfo.addEventListener(
      'screenReaderChanged',
      setScreenReaderEnabled,
    );

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return screenReaderEnabled || fontScale > MAX_SYSTEM_KEYBOARD_FONT_SCALE;
}

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import {
  palette,
  spacing,
  radius,
  borderWidth,
  shadow,
  typeScale,
  textOn,
  disabledFill,
  pressTranslate,
  MIN_TAP_TARGET,
} from '@theme/theme';
import type { FillToken } from '@theme/theme';

/**
 * Button — Design System §4.
 *
 * Carries both halves of the hybrid the design thesis requires: a thick `ink`
 * border and a hard offset shadow, on rounded, puffy geometry.
 *
 * ## What this component makes impossible
 *
 * - **A failing label colour.** The caller picks a *fill*, never a text
 *   colour; the label is derived through `textOn()` from the WL-202 contrast
 *   matrix. There is no prop that can express `paper` on `tangerine` (2.66:1).
 * - **A borderless variant.** WL-202 found the `ink` outline is load-bearing
 *   for WCAG 1.4.11, not decoration — `sunbeam` and `tangerine` are too close
 *   to `paper` to form a boundary on their own. So the border is not
 *   configurable.
 * - **A blurred shadow.** Shadows come only from the `shadow.*` tokens, each
 *   of which is `blurRadius: 0` (asserted in `__tests__/theme.test.ts`).
 * - **A tap target under 48pt** (Wireframe §18).
 */

export type ButtonVariant = 'primary' | 'secondary';
/** §4: a primary button is filled with `grape` or `tangerine`. */
export type ButtonTone = 'grape' | 'tangerine';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  /** Ignored for `secondary`, which is always `paper` per §4. */
  tone?: ButtonTone;
  disabled?: boolean;
  /** Defaults to `label`. Set when the visible text is not the whole story. */
  accessibilityLabel?: string;
  accessibilityHint?: string;
  /**
   * `switch` for a control that toggles a setting rather than performing an
   * action, paired with `checked` (WL-407).
   *
   * The design system defines no toggle component — §4 has buttons, cards,
   * modals, inputs and badges, and nothing else — so Settings expresses a
   * setting as a button whose label *is* its state ("ON" / "OFF"), which is
   * also how Wireframe §16's own sketch draws it. That is a fine control to
   * look at and the wrong thing to *announce*: a screen reader saying
   * "Sound, ON, button" leaves the listener to guess whether ON is the state
   * or the outcome. This prop lets the caller say which it is without
   * anything else about the button changing.
   */
  role?: 'button' | 'switch';
  /** Only meaningful with `role="switch"`. */
  checked?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Resolves the fill token, which then determines the label colour.
 *
 * A disabled control uses a *pre-composited* fill rather than `opacity` on the
 * container: opacity would fade the `ink` border §4 says a disabled button must
 * keep, and the label with it, landing far below the 9.30:1 WL-202 measured.
 *
 * Secondary has no disabled fill of its own, and that is not an oversight —
 * `paper` at 40% over a `paper` page is still `paper`. §4 answers this itself:
 * a disabled control "loses the offset shadow entirely (reads as 'flat',
 * reinforcing non-interactivity without relying on color alone)". For
 * secondary, the dropped shadow *is* the whole signal, and it is carried to
 * assistive tech by `accessibilityState` regardless.
 */
function fillFor(variant: ButtonVariant, tone: ButtonTone, disabled: boolean): FillToken {
  if (variant === 'secondary') return 'paper';
  if (!disabled) return tone;
  return tone === 'grape' ? 'disabledGrape' : 'disabledTangerine';
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  tone = 'grape',
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
  role = 'button',
  checked,
  style,
  testID,
}: ButtonProps): React.JSX.Element {
  const fill = fillFor(variant, tone, disabled);

  const backgroundColor =
    fill === 'disabledGrape'
      ? disabledFill.grape
      : fill === 'disabledTangerine'
        ? disabledFill.tangerine
        : palette[fill];

  // §4: primary carries a 6px shadow, secondary 4px, and a disabled control
  // drops it entirely.
  const restingShadow = disabled
    ? shadow.none
    : variant === 'primary'
      ? shadow.controlPrimary
      : shadow.control;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={role}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={role === 'switch' ? { disabled, checked } : { disabled }}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor },
        // The press-into-shadow move (§4): the control slides exactly as far as
        // its shadow was offset and the shadow goes, so it lands where the
        // shadow used to be and reads as pushed into the page.
        pressed && !disabled
          ? {
              boxShadow: shadow.none,
              transform: [
                { translateX: pressTranslate },
                { translateY: pressTranslate },
              ],
            }
          : { boxShadow: restingShadow },
        style,
      ]}>
      {/*
        The shadow offset is drawn outside the border box, so a button flush
        against a container edge would clip it. Callers lay these out with
        `gap`, but this wrapper keeps the label centred independently of the
        press transform above.
      */}
      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: textOn(fill) }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: MIN_TAP_TARGET,
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderWidth: borderWidth.base,
    borderColor: palette.ink,
    borderRadius: radius.control,
    alignSelf: 'flex-start',
  },
  labelRow: { flexDirection: 'row', justifyContent: 'center' },
  label: { ...typeScale.buttonLabel },
});

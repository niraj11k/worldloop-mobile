import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { Icon } from '@components/common/icons/Icon';
import type { IconName } from '@components/common/icons/Icon';
import { MIN_TAP_TARGET } from '@theme/theme';

export interface IconButtonProps {
  name: IconName;
  onPress: () => void;
  /**
   * Required, not optional. An icon-only control has no visible text, so
   * without this a screen reader announces the button and nothing else —
   * which is how "back" and "pause" become two identical unlabelled buttons
   * in the same header.
   */
  accessibilityLabel: string;
  accessibilityHint?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * An icon-only control (WL-408).
 *
 * Every icon control in the app was a bare `Pressable` wrapping an `Icon`,
 * repeated at six call sites, and each one was **too small to tap reliably**:
 * a 24pt glyph with `hitSlop` of 8 gives a 40pt target, under both WCAG
 * 2.5.5's 44×44 and Android's 48dp — and Wireframe §18 asks for "large tap
 * targets" outright. The fix belongs in one component rather than in six
 * corrections that the seventh call site would miss, so this enforces
 * `MIN_TAP_TARGET` (48, the number that satisfies both platforms — see the
 * token) as a floor on both axes.
 *
 * The glyph stays visually 24pt; the *target* grows around it. That keeps the
 * headers looking exactly as they did while making them usable.
 *
 * ## No visual disabled state, deliberately
 *
 * Design System §4 defines disabled for buttons — keep the border, drop the
 * fill to 40%, lose the shadow, switch the label to `ink` — and an icon-only
 * control has none of those things to change. The palette's one muted value
 * (`ink-muted`) is explicitly "placeholder text only. Never a fill, never a
 * border, never real content", so greying the glyph would break a rule the
 * contrast work (WL-202) deliberately set. Rather than invent a treatment
 * here, the state is carried where it is actually required: `accessibilityState`
 * tells assistive tech, and the control stops responding. **This is a Design
 * System gap** — if disabled icon controls become common, §4 should say what
 * one looks like. Today there is exactly one (the pause control during a
 * turn, for a few hundred milliseconds).
 */
export function IconButton({
  name,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  disabled = false,
  style,
  testID,
}: IconButtonProps): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      testID={testID}
      style={[styles.base, style]}>
      <Icon name={name} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minWidth: MIN_TAP_TARGET,
    minHeight: MIN_TAP_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

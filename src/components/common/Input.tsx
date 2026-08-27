import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import type { StyleProp, TextInputProps, ViewStyle } from 'react-native';

import {
  palette,
  inkMuted,
  spacing,
  radius,
  borderWidth,
  typeScale,
  MIN_TAP_TARGET,
} from '@theme/theme';

/**
 * Input — Design System §4, Input fields.
 *
 * `paper` fill, `ink` border, 16px radius, monospace type. Two state changes,
 * both of which §4 and Wireframe §18 treat as hard requirements rather than
 * styling preferences:
 *
 * **Focus** shifts the border to `grape` *and* draws a separate focus ring.
 * §4 is explicit that this "must not be dropped for aesthetic reasons". Two
 * signals rather than one because a border colour change alone is easy to miss
 * and, on its own, is a colour-only signal. `grape` measures 5.32:1 against
 * `paper`, clearing WCAG 1.4.11's 3:1 for a UI boundary (WL-202).
 *
 * **Error** shifts the border to `red-alert` *and* shows a marker and message.
 * Never colour alone — that is the "no colour-only meaning" rule from §1 and
 * Wireframe §18. The message is also announced: it carries `role="alert"` and
 * an assertive live region, which is Wireframe §18's "accessible error
 * announcements". Without that, a screen-reader user submits a word, hears
 * nothing, and has no idea why the round did not advance.
 *
 * No shadow: §4 gives shadows to buttons, cards, badges and modals, not to
 * input fields, which sit *in* the page rather than above it.
 */

export interface InputProps
  extends Omit<TextInputProps, 'style' | 'placeholderTextColor'> {
  /** Required — Wireframe §18 wants a label on every control. */
  accessibilityLabel: string;
  /** The message to show and announce. `null` when the field is valid. */
  error?: string | null;
  style?: StyleProp<ViewStyle>;
}

export function Input({
  accessibilityLabel,
  error = null,
  style,
  onFocus,
  onBlur,
  ...rest
}: InputProps): React.JSX.Element {
  const [focused, setFocused] = useState(false);

  const borderColor = error
    ? palette.redAlert
    : focused
      ? palette.grape
      : palette.ink;

  return (
    <View style={style}>
      <TextInput
        {...rest}
        accessibilityLabel={accessibilityLabel}
        // Ties the field to its message, so the error is reachable from the
        // input rather than only announced once when it appears.
        accessibilityHint={error ?? rest.accessibilityHint}
        placeholderTextColor={inkMuted}
        onFocus={e => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={e => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          styles.field,
          { borderColor },
          // The second focus signal, drawn outside the border box so it reads
          // as a ring around the control rather than a thicker border.
          focused ? styles.focusRing : null,
        ]}
      />

      {error ? (
        <View
          style={styles.errorRow}
          accessibilityRole="alert"
          accessibilityLiveRegion="assertive">
          {/*
            A typographic marker, not an icon from a library: §7 rejects stock
            icon sets, and the custom set is WL-207. This is the same reasoning
            §5 gives for the 3-dot "thinking" indicator over a spinner. WL-207
            may replace it with a drawn glyph.
          */}
          <View style={styles.errorMarker}>
            <Text style={styles.errorMarkerText}>!</Text>
          </View>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    minHeight: MIN_TAP_TARGET,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: palette.paper,
    borderWidth: borderWidth.base,
    borderRadius: radius.control,
    ...typeScale.body,
    color: palette.ink,
  },
  focusRing: {
    outlineColor: palette.grape,
    outlineStyle: 'solid',
    outlineWidth: borderWidth.thin,
    outlineOffset: spacing.xs / 2,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  errorMarker: {
    width: 20,
    height: 20,
    borderRadius: radius.pill,
    backgroundColor: palette.redAlert,
    borderWidth: borderWidth.thin,
    borderColor: palette.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // `ink` on `red-alert` is 5.05:1 (WL-202); `paper` would be 3.42:1 and fail
  // at this size.
  errorMarkerText: { ...typeScale.caption, color: palette.ink },
  errorText: { ...typeScale.caption, color: palette.ink, flexShrink: 1 },
});

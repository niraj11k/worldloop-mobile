import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { palette, borderWidth } from '@theme/theme';

/**
 * The custom icon set — Design System §7. Task: WL-207.
 *
 * §7 rejects stock icon sets outright ("standard Material/Feather-style line
 * icons will fight this aesthetic") and asks instead for shapes "in a chunky,
 * single-weight style that matches the border weight used on components (3-4px
 * strokes)".
 *
 * ## Why these are Views and not SVG
 *
 * The obvious route is `react-native-svg`, and it was considered. Three things
 * pointed the other way:
 *
 * 1. **§7's own wording.** It does not ask for illustration; it asks for
 *    strokes *matching the component border weight*. Built from Views, these
 *    icons literally use `borderWidth.base` and the palette — the same tokens
 *    the components do — so "matches" is enforced rather than eyeballed. An
 *    SVG would hard-code a stroke width that silently stops matching the day
 *    the border scale is retuned.
 * 2. **Chunky geometry is what Views are good at.** Every glyph here is bars,
 *    rings, arcs and one triangle. This is not a case of contorting a design
 *    to dodge a dependency — the design already asked for the shapes Views
 *    draw cleanly.
 * 3. **`react-native-svg` is a native dependency**, with a pod install, a
 *    Gradle surface, and a CI native-build risk, for seven glyphs.
 *
 * **The escape hatch, stated plainly:** if the set ever needs organic or
 * illustrative shapes — §7 also contemplates illustration for empty states —
 * that is the point to add `react-native-svg`, not to keep torturing Views.
 * Nothing here makes that harder: callers use `<Icon name=… />` and never see
 * the implementation.
 *
 * ## Accessibility
 *
 * Icons are decorative and hidden from assistive tech. **An icon-only control
 * must carry its own `accessibilityLabel`** — the icon cannot supply one,
 * because a `⚙` is only "Settings" in context. Exposing each glyph as its own
 * focusable node would just add unlabelled stops to the traversal order.
 */

/**
 * The complete set, as a runtime value rather than only a type.
 *
 * That is what lets the gallery iterate every icon instead of listing them by
 * hand — so a new glyph is displayed for review automatically, and cannot be
 * added without being seen.
 *
 * `alert` is not in §7's list and is needed anyway: §4's Input error state
 * requires "an icon/text label" beside the message, and WL-204 shipped a
 * typographic `!` as a placeholder pending this task. §7's list reads as
 * illustrative rather than exhaustive ("a small custom set"), so this is an
 * addition rather than a contradiction — recorded here rather than slipped in.
 */
export const ICON_NAMES = [
  'settings',
  'back',
  'pause',
  'hint',
  'close',
  'sound',
  'haptics',
  'alert',
] as const;

export type IconName = (typeof ICON_NAMES)[number];

export interface IconProps {
  name: IconName;
  /** Box size in points. Stroke weight scales with it. */
  size?: number;
  /** Defaults to `ink`. Pass the text colour of whatever surface it sits on. */
  color?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Stroke weight for a given box.
 *
 * §7 says 3-4px "matching the border weight used on components", so the floor
 * is `borderWidth.base`. It scales above that rather than staying pinned,
 * because a 3px stroke in a 48pt box reads as spindly — and "single-weight"
 * means every icon shares one weight at a given size, not that weight never
 * responds to size.
 */
const strokeFor = (size: number) => Math.max(borderWidth.base, Math.round(size / 8));

export function Icon({
  name,
  size = 24,
  color = palette.ink,
  style,
  testID,
}: IconProps): React.JSX.Element {
  const w = strokeFor(size);

  return (
    <View
      testID={testID}
      style={[styles.box, { width: size, height: size }, style]}
      // Decorative: the label belongs to the control, not the glyph.
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden>
      {GLYPHS[name](size, w, color)}
    </View>
  );
}

// --- Primitives -------------------------------------------------------------

const bar = (
  key: string,
  width: number,
  height: number,
  color: string,
  extra?: ViewStyle,
) => (
  <View
    key={key}
    style={[
      styles.absolute,
      {
        width,
        height,
        backgroundColor: color,
        // Rounded ends keep the strokes puffy rather than brutalist-sharp,
        // matching the geometry §3 gives every other component.
        borderRadius: Math.min(width, height) / 2,
      },
      extra,
    ]}
  />
);

const ring = (key: string, diameter: number, w: number, color: string, extra?: ViewStyle) => (
  <View
    key={key}
    style={[
      styles.absolute,
      {
        width: diameter,
        height: diameter,
        borderRadius: diameter / 2,
        borderWidth: w,
        borderColor: color,
      },
      extra,
    ]}
  />
);

/**
 * A quarter-ish arc: a ring whose other three borders are transparent.
 * `transparent` is the absence of a colour rather than a colour choice, which
 * is why the design-token lint rule exempts it.
 */
const arc = (key: string, diameter: number, w: number, color: string, extra?: ViewStyle) => (
  <View
    key={key}
    style={[
      styles.absolute,
      {
        width: diameter,
        height: diameter,
        borderRadius: diameter / 2,
        borderWidth: w,
        borderColor: 'transparent',
        borderRightColor: color,
      },
      extra,
    ]}
  />
);

// --- Glyphs -----------------------------------------------------------------

const GLYPHS: Record<
  IconName,
  (size: number, w: number, color: string) => React.ReactNode
> = {
  /** A ring with radiating teeth — a gear, drawn chunky rather than detailed. */
  settings: (s, w, c) => {
    const d = s * 0.46;
    const tooth = s * 0.16;
    const radius = s * 0.33;
    return [
      ring('ring', d, w, c),
      ...Array.from({ length: 6 }, (_, i) =>
        bar(`tooth-${i}`, w, tooth, c, {
          transform: [{ rotate: `${i * 60}deg` }, { translateY: -radius }],
        }),
      ),
    ];
  },

  /**
   * A chevron: a square showing only two borders, rotated 45°. Cheaper and
   * more precise than two rotated bars, which need their join hand-fitted.
   */
  back: (s, w, c) => [
    <View
      key="chevron"
      style={[
        styles.absolute,
        {
          width: s * 0.4,
          height: s * 0.4,
          borderLeftWidth: w,
          borderBottomWidth: w,
          borderColor: c,
          transform: [{ rotate: '45deg' }, { translateX: w / 2 }, { translateY: -w / 2 }],
        },
      ]}
    />,
  ],

  /** Two bars, deliberately thicker than a stroke — a pause glyph reads as solid. */
  pause: (s, w, c) => {
    const gap = s * 0.15;
    return [
      bar('l', w * 1.5, s * 0.58, c, { transform: [{ translateX: -gap }] }),
      bar('r', w * 1.5, s * 0.58, c, { transform: [{ translateX: gap }] }),
    ];
  },

  /**
   * A bulb over a screw base.
   *
   * The two base bars are the same width as each other and clearly narrower
   * than the bulb — read as threads. An earlier version tapered them (neck
   * wider than base), which is backwards for a bulb and made the whole glyph
   * read closer to a ♀ symbol than a light.
   */
  hint: (s, w, c) => {
    const d = s * 0.5;
    const baseWidth = s * 0.26;
    return [
      ring('bulb', d, w, c, { transform: [{ translateY: -s * 0.13 }] }),
      bar('thread-1', baseWidth, w, c, { transform: [{ translateY: s * 0.24 }] }),
      bar('thread-2', baseWidth, w, c, { transform: [{ translateY: s * 0.38 }] }),
    ];
  },

  close: (s, w, c) => [
    bar('a', s * 0.7, w, c, { transform: [{ rotate: '45deg' }] }),
    bar('b', s * 0.7, w, c, { transform: [{ rotate: '-45deg' }] }),
  ],

  /** Driver, cone, and two waves. */
  sound: (s, w, c) => [
    bar('body', s * 0.16, s * 0.3, c, { transform: [{ translateX: -s * 0.26 }] }),
    <View
      key="cone"
      style={[
        styles.absolute,
        {
          width: 0,
          height: 0,
          borderTopWidth: s * 0.26,
          borderBottomWidth: s * 0.26,
          borderRightWidth: s * 0.22,
          borderColor: 'transparent',
          borderRightColor: c,
          transform: [{ translateX: -s * 0.14 }],
        },
      ]}
    />,
    arc('w1', s * 0.3, w, c, { transform: [{ translateX: s * 0.18 }] }),
    arc('w2', s * 0.54, w, c, { transform: [{ translateX: s * 0.3 }] }),
  ],

  /** A handset between two shake marks. */
  haptics: (s, w, c) => [
    <View
      key="phone"
      style={[
        styles.absolute,
        {
          width: s * 0.34,
          height: s * 0.6,
          borderWidth: w,
          borderColor: c,
          borderRadius: s * 0.1,
        },
      ]}
    />,
    bar('l', w, s * 0.22, c, { transform: [{ translateX: -s * 0.3 }] }),
    bar('r', w, s * 0.22, c, { transform: [{ translateX: s * 0.3 }] }),
  ],

  /** A ring around a drawn exclamation — strokes, not a typographic glyph. */
  alert: (s, w, c) => {
    const d = s * 0.82;
    return [
      ring('ring', d, w, c),
      bar('stem', w, s * 0.26, c, { transform: [{ translateY: -s * 0.06 }] }),
      bar('dot', w, w, c, { transform: [{ translateY: s * 0.19 }] }),
    ];
  },
};

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center' },
  // Every part is centred and then transformed from there, so each glyph is
  // described in offsets from the middle rather than absolute coordinates.
  absolute: { position: 'absolute' },
});

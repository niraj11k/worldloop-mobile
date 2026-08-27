import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { gallery } from '../galleryStyles';
import {
  palette,
  spacing,
  radius,
  borderWidth,
  rotation,
  rotate,
  shadow,
  typeScale,
} from '@theme/theme';

/**
 * Foundations — the raw WL-203 tokens (Design System §1, §3, §4).
 *
 * Covers only what the components cannot show on their own: shadow behaviour,
 * the radius and border scales, the rotation range, spacing, and the fills with
 * their mandated text colours.
 *
 * The old single-file specimen also carried a hand-rolled "button states" block
 * built from raw views. That predated the real `Button` (WL-204) and now merely
 * duplicated it — two button implementations that would drift apart, with the
 * hand-rolled one silently becoming wrong. It is gone; the Components section
 * shows the real thing.
 */
export function FoundationsSection(): React.JSX.Element {
  return (
    <View>
      <Text style={gallery.h2}>Hard vs blurred</Text>
      <Text style={gallery.caption}>
        The control. Left uses the shadow tokens (blurRadius 0). Right is
        deliberately blurred — what Android&apos;s elevation would give us. These
        must look clearly different; if they match, blurRadius is being ignored
        and §4 is not actually being honoured.
      </Text>
      <View style={gallery.row}>
        <View style={[styles.swatch, styles.swatchHard]}>
          <Text style={styles.swatchLabel}>HARD</Text>
        </View>
        <View style={[styles.swatch, styles.swatchBlurred]}>
          <Text style={styles.swatchLabel}>BLURRED</Text>
        </View>
      </View>

      <Text style={gallery.h2}>Shadow scale (§4)</Text>
      {(
        [
          ['badge', shadow.badge, '2-4px'],
          ['control', shadow.control, '4px — secondary button'],
          ['controlPrimary', shadow.controlPrimary, '6px — primary button'],
          ['card', shadow.card, '6-8px'],
          ['modal', shadow.modal, '10-12px'],
        ] as const
      ).map(([name, value, spec]) => (
        <View key={name} style={styles.shadowRow}>
          <View style={[styles.shadowBox, { boxShadow: value }]} />
          <View style={styles.shadowMeta}>
            <Text style={gallery.label}>{name}</Text>
            <Text style={gallery.caption}>{spec}</Text>
          </View>
        </View>
      ))}

      <Text style={gallery.h2}>Radii (§3)</Text>
      <View style={gallery.row}>
        <View style={[styles.box, { borderRadius: radius.card }]}>
          <Text style={styles.swatchLabel}>20</Text>
        </View>
        <View style={[styles.box, { borderRadius: radius.control }]}>
          <Text style={styles.swatchLabel}>16</Text>
        </View>
        <View style={[styles.box, { borderRadius: radius.pill }]}>
          <Text style={styles.swatchLabel}>pill</Text>
        </View>
      </View>

      <Text style={gallery.h2}>Border weights (§4)</Text>
      <Text style={gallery.caption}>
        Not configurable on any component: WL-202 found the ink outline is
        load-bearing for WCAG 1.4.11, since sunbeam (1.34:1) and tangerine
        (2.66:1) cannot form a boundary against paper on their own.
      </Text>
      <View style={gallery.row}>
        {(
          [
            ['thin', borderWidth.thin],
            ['base', borderWidth.base],
            ['thick', borderWidth.thick],
          ] as const
        ).map(([name, w]) => (
          <View key={name} style={[styles.box, { borderWidth: w }]}>
            <Text style={styles.swatchLabel}>{name}</Text>
          </View>
        ))}
      </View>

      <Text style={gallery.h2}>Rotation (§3)</Text>
      <Text style={gallery.caption}>
        Decorative only. Never applied to buttons, inputs, or the required
        letter — rotation interferes with tap targets and predictable focus.
      </Text>
      <View style={gallery.row}>
        {(
          [rotation.cardMin, rotation.cardMax, rotation.badgeMax] as const
        ).map(deg => (
          <View key={deg} style={[styles.tag, { transform: rotate(deg) }]}>
            <Text style={styles.swatchLabel}>
              {deg > 0 ? `+${deg}` : deg}°
            </Text>
          </View>
        ))}
      </View>

      <Text style={gallery.h2}>Spacing (§3)</Text>
      <View style={styles.spacingCol}>
        {(Object.entries(spacing) as [string, number][]).map(([name, value]) => (
          <View key={name} style={styles.spacingRow}>
            <Text style={styles.spacingName}>{name}</Text>
            <View style={[styles.spacingBar, { width: value * 4 }]} />
            <Text style={gallery.caption}>{value}</Text>
          </View>
        ))}
      </View>

      <Text style={gallery.h2}>Fills, with their mandatory text colour</Text>
      <Text style={gallery.caption}>
        Grape is the only fill dark enough to carry paper text; every other
        accent takes ink (WL-202 contrast matrix). Components derive this
        themselves — see the Components section.
      </Text>
      <View style={styles.fillsWrap}>
        <View style={[styles.fill, { backgroundColor: palette.grape }]}>
          <Text style={styles.onGrape}>grape</Text>
        </View>
        {(
          ['tangerine', 'bubblegum', 'limeade', 'sunbeam', 'redAlert'] as const
        ).map(name => (
          <View key={name} style={[styles.fill, { backgroundColor: palette[name] }]}>
            <Text style={styles.onAccent}>{name}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  swatch: {
    width: 96,
    height: 64,
    borderWidth: borderWidth.base,
    borderColor: palette.ink,
    borderRadius: radius.card,
    backgroundColor: palette.sunbeam,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchHard: { boxShadow: shadow.card },
  // The one deliberate departure from token-only styling in the whole gallery,
  // and the reason is the point of the control: this is a WRONG shadow,
  // rendered so the correct one can be told apart from it. A "blurred" token
  // would be a token nothing should ever legitimately use.
  swatchBlurred: {
    // eslint-disable-next-line no-restricted-syntax
    boxShadow: [{ offsetX: 7, offsetY: 7, blurRadius: 12, color: palette.ink }],
  },
  swatchLabel: { ...typeScale.caption, color: palette.ink },

  shadowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xl,
    marginBottom: spacing.lg,
  },
  shadowBox: {
    width: 64,
    height: 44,
    backgroundColor: palette.paper,
    borderWidth: borderWidth.base,
    borderColor: palette.ink,
    borderRadius: radius.control,
  },
  shadowMeta: { flexShrink: 1 },

  box: {
    width: 76,
    height: 60,
    backgroundColor: palette.bubblegum,
    borderWidth: borderWidth.base,
    borderColor: palette.ink,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: shadow.control,
  },
  tag: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    backgroundColor: palette.sunbeam,
    borderWidth: borderWidth.thin,
    borderColor: palette.ink,
    borderRadius: radius.pill,
    boxShadow: shadow.badge,
  },

  spacingCol: { gap: spacing.xs, marginBottom: spacing.md },
  spacingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  spacingName: { ...typeScale.caption, color: palette.ink, width: 40 },
  spacingBar: { height: 12, backgroundColor: palette.grape },

  fillsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  fill: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderWidth: borderWidth.base,
    borderColor: palette.ink,
    borderRadius: radius.control,
    boxShadow: shadow.badge,
  },
  onGrape: { ...typeScale.buttonLabel, color: palette.paper },
  onAccent: { ...typeScale.buttonLabel, color: palette.ink },
});

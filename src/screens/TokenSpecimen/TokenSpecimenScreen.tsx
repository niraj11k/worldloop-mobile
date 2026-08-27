import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  palette,
  spacing,
  radius,
  borderWidth,
  rotation,
  rotate,
  shadow,
  typeScale,
  pressTranslate,
  disabledFill,
} from '@theme/theme';

/**
 * Dev-only design token specimen — WL-203's on-device verification surface.
 *
 * Unlike `FontSpecimen`, this screen is **not** exempt from the design-token
 * lint rule (with one narrow exception noted below). It styles itself entirely
 * from `@theme/theme`, so if the tokens are wrong or missing, this screen is
 * the first thing that breaks.
 *
 * ## What actually needed verifying
 *
 * Design System §4 mandates "hard offset shadow, no blur", and §8 explicitly
 * rejects blurred shadows as reading like generic claymorphism. That is not a
 * free requirement in React Native:
 *
 *   - the legacy `shadow*` props are iOS-only
 *   - Android's `elevation` draws a *blurred* Material shadow whose offset and
 *     colour cannot be controlled
 *
 * So on Android the entire signature mechanic of this design system is
 * unimplementable through the legacy props. `boxShadow` (RN 0.86, New
 * Architecture) is the only route, and it is new enough here that a successful
 * build proves nothing about what it paints. Hence the control below: every
 * hard shadow is rendered beside a deliberately blurred one. If `blurRadius: 0`
 * were being ignored or clamped, the two would look identical — which is
 * exactly the kind of silent, plausible-looking failure the font work ran into
 * twice.
 *
 * WL-206's component gallery should absorb this screen.
 */
export function TokenSpecimenScreen(): React.JSX.Element {
  const [pressed, setPressed] = useState(false);

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.h1}>Design tokens</Text>
      <Text style={styles.caption}>
        Every value on this screen comes from @theme/theme. Nothing is inline.
      </Text>

      <Text style={styles.h2}>Hard vs blurred</Text>
      <Text style={styles.caption}>
        The control. Left uses the shadow tokens (blurRadius 0). Right is
        deliberately blurred — what Android&apos;s elevation would give us. These
        must look clearly different; if they match, blurRadius is being ignored
        and §4 is not actually being honoured.
      </Text>
      <View style={styles.pairRow}>
        <View style={[styles.swatch, styles.swatchHard]}>
          <Text style={styles.swatchLabel}>HARD</Text>
        </View>
        <View style={[styles.swatch, styles.swatchBlurred]}>
          <Text style={styles.swatchLabel}>BLURRED</Text>
        </View>
      </View>

      <Text style={styles.h2}>Shadow scale (§4)</Text>
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
            <Text style={styles.rowLabel}>{name}</Text>
            <Text style={styles.caption}>{spec}</Text>
          </View>
        </View>
      ))}

      <Text style={styles.h2}>Radii (§3)</Text>
      <View style={styles.pairRow}>
        <View style={[styles.radiusBox, { borderRadius: radius.card }]}>
          <Text style={styles.swatchLabel}>20</Text>
        </View>
        <View style={[styles.radiusBox, { borderRadius: radius.control }]}>
          <Text style={styles.swatchLabel}>16</Text>
        </View>
        <View style={[styles.radiusBox, styles.pillBox]}>
          <Text style={styles.swatchLabel}>pill</Text>
        </View>
      </View>

      <Text style={styles.h2}>Border weights (§4)</Text>
      <View style={styles.pairRow}>
        {(
          [
            ['thin', borderWidth.thin],
            ['base', borderWidth.base],
            ['thick', borderWidth.thick],
          ] as const
        ).map(([name, w]) => (
          <View key={name} style={[styles.radiusBox, { borderWidth: w }]}>
            <Text style={styles.swatchLabel}>{name}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.h2}>Button states (§4)</Text>
      <Text style={styles.caption}>
        Press the primary button: it translates {pressTranslate}pt toward its
        shadow and drops it, so it reads as pressed into the page. The disabled
        one keeps an ink label — a paper label on a 40% fill measures 1.86:1
        (WL-202).
      </Text>
      <View style={styles.buttonCol}>
        <Pressable
          onPressIn={() => setPressed(true)}
          onPressOut={() => setPressed(false)}
          style={[styles.button, pressed ? styles.buttonPressed : styles.buttonRaised]}>
          <Text style={styles.buttonLabelOnGrape}>
            {pressed ? 'PRESSED' : 'PRIMARY'}
          </Text>
        </Pressable>

        <View style={[styles.button, styles.buttonSecondary]}>
          <Text style={styles.buttonLabelOnPaper}>SECONDARY</Text>
        </View>

        <View style={[styles.button, styles.buttonDisabled]}>
          <Text style={styles.buttonLabelOnPaper}>DISABLED</Text>
        </View>
      </View>

      <Text style={styles.h2}>Rotation (§3)</Text>
      <Text style={styles.caption}>
        Decorative only. Never applied to buttons, inputs, or the required
        letter.
      </Text>
      <View style={styles.pairRow}>
        <View style={[styles.badge, { transform: rotate(rotation.cardMin) }]}>
          <Text style={styles.badgeLabel}>{rotation.cardMin}°</Text>
        </View>
        <View style={[styles.badge, { transform: rotate(rotation.cardMax) }]}>
          <Text style={styles.badgeLabel}>+{rotation.cardMax}°</Text>
        </View>
        <View style={[styles.badge, { transform: rotate(rotation.badgeMax) }]}>
          <Text style={styles.badgeLabel}>+{rotation.badgeMax}°</Text>
        </View>
      </View>

      <Text style={styles.h2}>Spacing (§3)</Text>
      <View style={styles.spacingCol}>
        {(Object.entries(spacing) as [string, number][]).map(([name, value]) => (
          <View key={name} style={styles.spacingRow}>
            <Text style={styles.spacingName}>{name}</Text>
            <View style={[styles.spacingBar, { width: value * 4 }]} />
            <Text style={styles.caption}>{value}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.h2}>Fills, with their mandatory text colour</Text>
      <Text style={styles.caption}>
        Grape is the only fill dark enough to carry paper text; every other
        accent takes ink (WL-202 contrast matrix).
      </Text>
      <View style={styles.fillsWrap}>
        <View style={[styles.fill, styles.fillGrape]}>
          <Text style={styles.buttonLabelOnGrape}>grape</Text>
        </View>
        {(
          [
            ['tangerine', styles.fillTangerine],
            ['bubblegum', styles.fillBubblegum],
            ['limeade', styles.fillLimeade],
            ['sunbeam', styles.fillSunbeam],
            ['redAlert', styles.fillRedAlert],
          ] as const
        ).map(([name, fillStyle]) => (
          <View key={name} style={[styles.fill, fillStyle]}>
            <Text style={styles.buttonLabelOnPaper}>{name}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: palette.paper },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.sm },

  h1: { ...typeScale.wordmark, color: palette.ink },
  h2: {
    ...typeScale.screenTitle,
    color: palette.ink,
    marginTop: spacing.xl,
  },
  caption: { ...typeScale.caption, color: palette.ink },
  rowLabel: { ...typeScale.body, color: palette.ink },

  pairRow: {
    flexDirection: 'row',
    gap: spacing.xl,
    alignItems: 'center',
    flexWrap: 'wrap',
    marginVertical: spacing.md,
  },

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
  // The one place this screen departs from token-only styling, and the reason
  // is the whole point of the screen: this is a deliberately WRONG shadow,
  // rendered as a control so the correct one can be told apart from it. A
  // "blurred" token would be a token nothing should ever legitimately use, so
  // this is a single-line disable rather than a hole in the rule.
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

  radiusBox: {
    width: 76,
    height: 60,
    backgroundColor: palette.bubblegum,
    borderWidth: borderWidth.base,
    borderColor: palette.ink,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: shadow.control,
  },
  pillBox: { borderRadius: radius.pill },

  buttonCol: { gap: spacing.lg, marginTop: spacing.md, alignItems: 'flex-start' },
  button: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderWidth: borderWidth.base,
    borderColor: palette.ink,
    borderRadius: radius.control,
  },
  buttonRaised: { backgroundColor: palette.grape, boxShadow: shadow.controlPrimary },
  buttonPressed: {
    backgroundColor: palette.grape,
    boxShadow: shadow.none,
    transform: [{ translateX: pressTranslate }, { translateY: pressTranslate }],
  },
  buttonSecondary: { backgroundColor: palette.paper, boxShadow: shadow.control },
  // Pre-composited fill, NOT `opacity` — see the `disabledFill` docblock in
  // palette.ts. A container opacity would fade the ink border §4 says a
  // disabled control must keep, and the label with it.
  buttonDisabled: {
    backgroundColor: disabledFill.grape,
    boxShadow: shadow.none,
  },
  buttonLabelOnGrape: { ...typeScale.buttonLabel, color: palette.paper },
  buttonLabelOnPaper: { ...typeScale.buttonLabel, color: palette.ink },

  badge: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    backgroundColor: palette.sunbeam,
    borderWidth: borderWidth.thin,
    borderColor: palette.ink,
    borderRadius: radius.pill,
    boxShadow: shadow.badge,
  },
  badgeLabel: { ...typeScale.caption, color: palette.ink },

  spacingCol: { gap: spacing.xs, marginTop: spacing.md },
  spacingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  spacingName: { ...typeScale.caption, color: palette.ink, width: 40 },
  spacingBar: { height: 12, backgroundColor: palette.grape },

  fillsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.md },
  fill: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderWidth: borderWidth.base,
    borderColor: palette.ink,
    borderRadius: radius.control,
    boxShadow: shadow.badge,
  },
  fillGrape: { backgroundColor: palette.grape },
  fillTangerine: { backgroundColor: palette.tangerine },
  fillBubblegum: { backgroundColor: palette.bubblegum },
  fillLimeade: { backgroundColor: palette.limeade },
  fillSunbeam: { backgroundColor: palette.sunbeam },
  fillRedAlert: { backgroundColor: palette.redAlert },
});

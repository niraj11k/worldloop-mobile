import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Badge } from '@components/common/Badge';
import { BottomSheet } from '@components/common/BottomSheet';
import { Button } from '@components/common/Button';
import { Card } from '@components/common/Card';
import { Input } from '@components/common/Input';
import { ColorFlash } from '@components/common/motion/ColorFlash';
import { ScalePunch } from '@components/common/motion/ScalePunch';
import { Shake } from '@components/common/motion/Shake';
import { SpringIn } from '@components/common/motion/SpringIn';
import { ThinkingDots } from '@components/common/motion/ThinkingDots';
import { useReducedMotion } from '@hooks/useReducedMotion';

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
  const [sheetOpen, setSheetOpen] = useState(false);
  const [text, setText] = useState('');

  // WL-205 motion triggers. Each is a counter so that repeating the same
  // action still changes the value and re-fires the effect.
  const reducedMotion = useReducedMotion();
  const [streak, setStreak] = useState(4);
  const [validCount, setValidCount] = useState(0);
  const [invalidCount, setInvalidCount] = useState(0);
  const [stampKey, setStampKey] = useState(0);

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.h1}>Design tokens</Text>
      <Text style={styles.caption}>
        Every value on this screen comes from @theme/theme. Nothing is inline.
      </Text>

      {/*
        Pinned to the top rather than sitting with the Motion section further
        down: this is the state every effect below depends on, and an
        instrument whose reading you have to go looking for is one people stop
        checking. Any screenshot of this screen now records which mode it was
        taken in.
      */}
      <View
        style={[
          styles.motionBanner,
          { backgroundColor: reducedMotion ? palette.sunbeam : palette.limeade },
        ]}>
        <Text style={styles.motionBannerText}>
          {reducedMotion
            ? 'REDUCED MOTION IS ON — fallbacks active'
            : 'REDUCED MOTION IS OFF — full animation'}
        </Text>
      </View>

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

      {/* ---- WL-204: the shared components, in every state §4 specifies ---- */}

      <Text style={styles.h1}>Components</Text>
      <Text style={styles.caption}>
        The real components from @components/common, not a restatement. Label
        colours are derived from each fill through the contrast matrix, so no
        combination here can be a failing one.
      </Text>

      <Text style={styles.h2}>Button</Text>
      <View style={styles.componentCol}>
        <Button label="Primary grape" onPress={() => {}} />
        <Button label="Primary tangerine" tone="tangerine" onPress={() => {}} />
        <Button label="Secondary" variant="secondary" onPress={() => {}} />
        <Button label="Disabled grape" disabled onPress={() => {}} />
        <Button label="Disabled tangerine" tone="tangerine" disabled onPress={() => {}} />
        <Button
          label="Disabled secondary"
          variant="secondary"
          disabled
          onPress={() => {}}
        />
      </View>
      <Text style={styles.caption}>
        Press any enabled button to see it translate into its own shadow.
        Disabled secondary keeps its paper fill — §4 makes the dropped shadow
        the signal there, since paper at 40% over paper is still paper.
      </Text>

      <Text style={styles.h2}>Card</Text>
      <View style={styles.componentCol}>
        <Card>
          <Text style={styles.rowLabel}>Default paper card, no rotation</Text>
        </Card>
        <Card rotation={-2}>
          <Text style={styles.rowLabel}>Tilted -2°, the §3 minimum</Text>
        </Card>
        <Card fill="sunbeam" rotation={99}>
          <Text style={styles.rowLabel}>
            Asked for 99° — clamped to the §3 maximum of 3°
          </Text>
        </Card>
      </View>

      <Text style={styles.h2}>Input</Text>
      <View style={styles.componentCol}>
        <Input
          accessibilityLabel="Example word entry"
          placeholder="Enter a word beginning with E"
          value={text}
          onChangeText={setText}
        />
        <Text style={styles.caption}>
          Focus it: the border turns grape and a separate ring appears — §4
          requires both, and a border change alone would be a colour-only signal.
        </Text>
        <Input
          accessibilityLabel="Example word entry with an error"
          placeholder="Enter a word"
          value="zzz"
          error="That word isn't in our dictionary."
        />
      </View>

      <Text style={styles.h2}>Badge</Text>
      <View style={styles.badgeWrap}>
        <Badge label="STREAK 6" />
        <Badge label="HARD" fill="bubblegum" />
        <Badge label="NEW WORD" />
        <Badge label="No tilt" rotation={0} />
      </View>
      <Text style={styles.caption}>
        Tilt is derived from the label, so it is stable across re-renders — a
        streak badge must not jump to a new angle every time the number ticks up.
      </Text>

      <Text style={styles.h2}>BottomSheet</Text>
      <View style={styles.componentCol}>
        <Button label="Open sheet" onPress={() => setSheetOpen(true)} />
      </View>

      {/* ---- WL-205: motion primitives and their reduced-motion fallbacks ---- */}

      <Text style={styles.h1}>Motion</Text>
      <Text style={styles.caption}>
        Live from the OS setting (iOS: Accessibility → Motion → Reduce Motion;
        Android: Accessibility → Remove animations). Toggle it while this screen
        is open — the banner and every effect below switch immediately, without
        a relaunch.
      </Text>

      <Text style={styles.h2}>Scale-punch</Text>
      <Text style={styles.caption}>
        §5: 1.0 → 1.15 → 1.0 over ~200ms. Reduced: no scale, a 100ms opacity
        flash, and the number still updates.
      </Text>
      <View style={styles.motionRow}>
        <ScalePunch trigger={streak}>
          <Badge label={`STREAK ${streak}`} rotation={0} />
        </ScalePunch>
        <ScalePunch trigger={streak} milestone>
          <Badge label={`MILESTONE ${streak}`} fill="bubblegum" rotation={0} />
        </ScalePunch>
      </View>
      <Button label="Increment streak" onPress={() => setStreak(s => s + 1)} />

      <Text style={styles.h2}>Colour flash</Text>
      <Text style={styles.caption}>
        §5: the valid-move fill flashes limeade, ink border retained. Reduced:
        still flashes — colour is the signal here, not decoration — but switches
        instantly instead of easing.
      </Text>
      <ColorFlash
        trigger={validCount}
        from={palette.paper}
        to={palette.limeade}
        style={styles.flashBox}>
        <Text style={styles.rowLabel}>PLANET</Text>
      </ColorFlash>
      <Button label="Submit valid word" onPress={() => setValidCount(c => c + 1)} />

      <Text style={styles.h2}>Horizontal shake</Text>
      <Text style={styles.caption}>
        §5: short shake on an invalid word. Reduced: no shake at all — the
        border, marker, message and live-region announcement already carry it,
        which is why this is the one effect with no substitute.
      </Text>
      <Shake trigger={invalidCount}>
        <Input
          accessibilityLabel="Shake demonstration"
          value="zzz"
          error="That word isn't in our dictionary."
        />
      </Shake>
      <Button
        label="Submit invalid word"
        tone="tangerine"
        onPress={() => setInvalidCount(c => c + 1)}
      />

      <Text style={styles.h2}>Spring scale-in</Text>
      <Text style={styles.caption}>
        §5: the modal entry and the chain stamp are the same primitive. Reduced:
        instant appearance. Only the new entry animates — the others must not
        reflow.
      </Text>
      <View style={styles.motionCol}>
        <SpringIn key={stampKey}>
          <Card rotation={0}>
            <Text style={styles.rowLabel}>Newest word stamps in</Text>
          </Card>
        </SpringIn>
        <Card rotation={0}>
          <Text style={styles.rowLabel}>Older entry — must not move</Text>
        </Card>
      </View>
      <Button label="Stamp a word" onPress={() => setStampKey(k => k + 1)} />

      <Text style={styles.h2}>Thinking indicator</Text>
      <Text style={styles.caption}>
        §5: a 3-dot pulse in the monospace face, never a spinner. Reduced: dots
        hold static — the accompanying text is what carries the state, which is
        why this primitive requires one.
      </Text>
      <View style={styles.thinkingRow}>
        <Text style={styles.rowLabel}>WordLoop is thinking</Text>
        <ThinkingDots />
      </View>

      <BottomSheet
        visible={sheetOpen}
        onRequestClose={() => setSheetOpen(false)}
        title="Bottom sheet">
        <Text style={styles.rowLabel}>
          4px ink border, heaviest shadow, top corners rounded. Tap the scrim or
          use the back gesture to dismiss.
        </Text>
        <Text style={styles.caption}>
          No entry animation on purpose — motion is WL-205, which also owns the
          reduced-motion fallback.
        </Text>
        <Button label="Close" onPress={() => setSheetOpen(false)} />
      </BottomSheet>
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

  componentCol: { gap: spacing.md, marginTop: spacing.md, alignItems: 'flex-start' },
  motionBanner: {
    borderWidth: borderWidth.base,
    borderColor: palette.ink,
    borderRadius: radius.control,
    padding: spacing.md,
    marginTop: spacing.md,
    boxShadow: shadow.control,
  },
  motionBannerText: { ...typeScale.buttonLabel, color: palette.ink, textAlign: 'center' },
  motionRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    alignItems: 'center',
    flexWrap: 'wrap',
    marginVertical: spacing.md,
  },
  motionCol: { gap: spacing.md, marginVertical: spacing.md },
  flashBox: {
    borderWidth: borderWidth.base,
    borderColor: palette.ink,
    borderRadius: radius.control,
    padding: spacing.lg,
    marginVertical: spacing.md,
    alignSelf: 'flex-start',
  },
  thinkingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginVertical: spacing.md,
  },
  badgeWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.md,
    alignItems: 'center',
  },
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

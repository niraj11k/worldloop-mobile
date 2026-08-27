import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { palette } from '@theme/palette';
import { fontFamily, typeScale } from '@theme/typography';

/**
 * Dev-only font specimen — WL-201's on-device verification surface.
 *
 * Renders every role in the Design System section 2 type scale at its exact
 * size, so "both faces render on device at every size in the scale" can be
 * confirmed by looking at a real device rather than asserted from a successful
 * build.
 *
 * ## Why this screen measures instead of just displaying
 *
 * React Native's font resolution fails *silently*: an unlinked or misnamed
 * family renders in the platform's default face with no warning, no error, and
 * no red box. A screenshot of correctly-sized text therefore proves nothing on
 * its own — it looks entirely plausible while being 100% system font.
 *
 * So each face is rendered twice at the same size: once in the target family,
 * once with no `fontFamily` at all. If the widths come back identical, the
 * custom face did not load and the system font is standing in. The banner at
 * the top reports that as a hard PASS/FAIL rather than leaving it to the eye.
 *
 * `JetBrainsMono` gets a second, independent check: it is monospace, so a
 * narrow string and a wide one of equal character count must measure equal.
 * The platform defaults are proportional, so this fails if the fallback is in
 * play — and unlike the width comparison it does not depend on the system font
 * happening to differ.
 *
 * WL-206 (component gallery) should absorb this screen rather than duplicating
 * it.
 */

type Widths = Record<string, number>;

/**
 * Three probe strings, not one.
 *
 * The heuristic here is "if the target face measures exactly as wide as the
 * platform default, the target did not load and we are looking at the
 * fallback". That is sound in spirit but not per-string: two unrelated
 * typefaces can coincidentally share an advance width for one particular
 * string. This is not hypothetical — the first version of this screen used
 * only `Handgloves 0123`, and Baloo2-ExtraBold at 20px measured 153pt, exactly
 * matching San Francisco, so a correctly-loaded face was reported as a
 * fallback.
 *
 * A face is therefore treated as loaded if it differs from the system font on
 * *any* of these. Colliding on one string is plausible; colliding on three
 * with deliberately different glyph mixes is not.
 */
const PROBES = ['Handgloves 0123', 'WWWMMM@#%', 'quick brown fox jumps'];

/** Same character count, opposite width profile in any proportional face. */
const NARROW = 'illlliiii';
const WIDE = 'MMMMWWWWW';

export function FontSpecimenScreen(): React.JSX.Element {
  const [widths, setWidths] = useState<Widths>({});

  const measure = useCallback(
    (key: string) => (e: { nativeEvent: { layout: { width: number } } }) => {
      const w = e.nativeEvent.layout.width;
      setWidths(prev => (prev[key] === w ? prev : { ...prev, [key]: w }));
    },
    [],
  );

  const loaded = (family: string) => {
    const pairs = PROBES.map((_, i) => [widths[`${family}#${i}`], widths[`__system__#${i}`]]);
    if (pairs.some(([a, b]) => a === undefined || b === undefined)) return null;
    // Differs on ANY probe => the face really loaded. See the PROBES docblock.
    return pairs.some(([a, b]) => Math.abs((a as number) - (b as number)) > 0.5);
  };

  const monoIsMono = () => {
    const n = widths.__mono_narrow__;
    const w = widths.__mono_wide__;
    if (n === undefined || w === undefined) return null;
    return Math.abs(n - w) < 0.5;
  };

  const families = Object.values(fontFamily);
  const results = families.map(f => loaded(f));
  const allKnown = results.every(r => r !== null) && monoIsMono() !== null;
  const allPass = results.every(r => r === true) && monoIsMono() === true;

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View
        style={[
          styles.banner,
          { backgroundColor: !allKnown ? palette.sunbeam : allPass ? palette.limeade : palette.redAlert },
        ]}>
        <Text style={styles.bannerText}>
          {!allKnown
            ? 'MEASURING…'
            : allPass
              ? 'ALL FACES LOADED'
              : 'FALLBACK DETECTED — a face did not load'}
        </Text>
      </View>

      <Text style={styles.h2}>Probes</Text>
      <Text style={styles.caption}>
        The same string in each face and in the platform default. These are
        rendered visibly and left in the normal layout flow on purpose: an
        earlier version hid them in a zero-height clipped container, every probe
        measured 0pt wide, all four faces compared equal to the system font, and
        the banner reported a fallback on a build whose fonts were rendering
        perfectly. A measurement instrument you cannot see is one you cannot
        debug.
      </Text>
      <View style={styles.probes}>
        {['__system__', ...families].map(f => (
          <View key={f} style={styles.probeRow}>
            <Text style={styles.probeName}>
              {f === '__system__' ? '(system default)' : f}
            </Text>
            <View style={styles.probeStrings}>
              {PROBES.map((s, i) => (
                <View key={i} style={styles.probeLine}>
                  <Text
                    style={[
                      styles.probe,
                      f === '__system__' ? null : { fontFamily: f },
                    ]}
                    onLayout={measure(`${f}#${i}`)}>
                    {s}
                  </Text>
                  <Text style={styles.probeWidth}>
                    {widths[`${f}#${i}`] !== undefined
                      ? `${Math.round(widths[`${f}#${i}`] as number)}pt`
                      : '…'}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ))}
        <View style={styles.probeRow}>
          <Text style={styles.probeName}>monospace check</Text>
          <View style={styles.probeStrings}>
            <View style={styles.probeLine}>
              <Text
                style={[styles.probe, { fontFamily: fontFamily.monoRegular }]}
                onLayout={measure('__mono_narrow__')}>
                {NARROW}
              </Text>
              <Text
                style={[styles.probe, { fontFamily: fontFamily.monoRegular }]}
                onLayout={measure('__mono_wide__')}>
                {WIDE}
              </Text>
              <Text style={styles.probeWidth}>
                {widths.__mono_narrow__ ? `${Math.round(widths.__mono_narrow__)}` : '…'}
                {' vs '}
                {widths.__mono_wide__ ? `${Math.round(widths.__mono_wide__)}` : '…'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <Text style={styles.h2}>Face loading</Text>
      {families.map(f => {
        const ok = loaded(f);
        return (
          <View key={f} style={styles.row}>
            <Text style={styles.rowLabel}>{f}</Text>
            <Text style={styles.rowValue}>
              {ok === null ? '…' : ok ? 'distinct from system ✓' : 'IDENTICAL TO SYSTEM ✗'}
            </Text>
          </View>
        );
      })}
      <View style={styles.row}>
        <Text style={styles.rowLabel}>JetBrainsMono is monospaced</Text>
        <Text style={styles.rowValue}>
          {monoIsMono() === null ? '…' : monoIsMono() ? 'equal widths ✓' : 'UNEQUAL ✗'}
        </Text>
      </View>

      <Text style={styles.h2}>Type scale (Design System §2)</Text>
      {(Object.keys(typeScale) as (keyof typeof typeScale)[]).map(role => {
        const style = typeScale[role];
        return (
          <View key={role} style={styles.specimen}>
            <Text style={styles.caption}>
              {role} · {style.fontSize}px · {style.fontFamily}
            </Text>
            <Text style={style as object}>
              {role === 'requiredLetter' ? 'E' : 'Chain the word'}
            </Text>
          </View>
        );
      })}

      <Text style={styles.h2}>Smallest / largest, side by side</Text>
      <Text style={styles.caption}>
        64px display and 12px mono are the two the task calls out explicitly.
      </Text>
      <View style={styles.extremes}>
        <Text style={typeScale.requiredLetter as object}>Q</Text>
        <View style={styles.extremesRight}>
          <Text style={typeScale.caption as object}>SCORE 128 · STREAK 6</Text>
          <Text style={typeScale.caption as object}>abcdefghijklmnop 0123456789</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: palette.paper },
  content: { padding: 16, paddingBottom: 48 },
  banner: {
    borderWidth: 3,
    borderColor: palette.ink,
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
  },
  bannerText: {
    fontFamily: fontFamily.monoBold,
    fontSize: 15,
    color: palette.ink,
    textAlign: 'center',
  },
  probes: { gap: 12, marginBottom: 8 },
  probeRow: { gap: 2 },
  probeName: { fontFamily: fontFamily.monoBold, fontSize: 11, color: palette.ink },
  probeStrings: { gap: 2 },
  // `alignSelf: 'flex-start'` matters: a Text stretched to its container's
  // width measures the *container*, not the glyphs, which would make every
  // face report an identical width and defeat the comparison entirely.
  probeLine: { flexDirection: 'row', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' },
  probe: { fontSize: 18, color: palette.ink, alignSelf: 'flex-start' },
  probeWidth: { fontFamily: fontFamily.monoRegular, fontSize: 10, color: palette.ink },
  h2: {
    fontFamily: fontFamily.displayBold,
    fontSize: 28,
    color: palette.ink,
    marginTop: 24,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    gap: 8,
  },
  rowLabel: { fontFamily: fontFamily.monoRegular, fontSize: 12, color: palette.ink, flexShrink: 1 },
  rowValue: { fontFamily: fontFamily.monoBold, fontSize: 12, color: palette.ink },
  specimen: {
    borderTopWidth: 2,
    borderTopColor: palette.ink,
    paddingTop: 8,
    marginBottom: 12,
  },
  caption: { fontFamily: fontFamily.monoRegular, fontSize: 12, color: palette.ink, marginBottom: 4 },
  extremes: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  extremesRight: { flexShrink: 1, gap: 4 },
});

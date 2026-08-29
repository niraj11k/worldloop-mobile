import React from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { ornamentScale, palette, rotate, typeScale } from '@theme/theme';

/**
 * The letters behind Home.
 *
 * ## Why this exists
 *
 * Home is paper on paper: one saturated button and, until a game is finished,
 * a paper card. Below the last row is a large empty band on every device. The
 * screen read as unfinished rather than calm.
 *
 * Design System §7 rules out photographic imagery, and §1's greys exclusion
 * rules out fading anything (`ink` below full opacity composites to grey over
 * `paper`), so the usual answers — a photo, a soft wash — are both off the
 * table. What is left, and what suits a word game, is the game's own
 * material: oversized display letters in palette colours, rotated and running
 * off the edges, which is §0's "sticker-covered notebook" applied to the one
 * subject this app actually has.
 *
 * The three letters are not arbitrary. They are the teaching chain from
 * Wireframe §7 and the How to Play screen — **apple → elephant → table** —
 * as the letters that chain hands over: the A it starts from, the E apple
 * passes to elephant, and the T elephant passes on.
 *
 * ## What keeps it decoration
 *
 * - **Hidden from assistive tech**, on the layer *and* on each letter. A
 *   screen reader must not read out "A, T, E" between the tagline and the
 *   primary button. The props are applied at both levels deliberately:
 *   `Icon` sets them only on its container and gets away with it because its
 *   glyphs are `View`s with no text to announce, and these are `Text`.
 *
 *   **This is asserted, not measured.** `uiautomator dump` still lists the
 *   three nodes — but it lists the inner label of every labelled button too,
 *   which TalkBack certainly does not announce twice, because UiAutomator
 *   deliberately includes views marked unimportant so tests can find them.
 *   The dump cannot distinguish "in the hierarchy" from "spoken", so this
 *   rests on the API contract until someone runs TalkBack — the same gap
 *   WL-408 already holds open.
 * - **`pointerEvents="none"`**, so nothing here can swallow a tap meant for
 *   the controls above it.
 * - **`allowFontScaling={false}`**, the one place in the app that opts out of
 *   text scaling. These letters carry no information — they are hidden from
 *   assistive tech precisely because they say nothing — so scaling them at the
 *   largest accessibility size would push ornament across the controls
 *   without making anything more readable. Every letter a player must
 *   actually read still scales.
 * - **Positioned from the bottom in percentages**, not fixed offsets from the
 *   top: the gap being filled is the bottom third, and it is a bottom third on
 *   a 667pt phone and a 1180pt tablet alike.
 *
 * Cards and buttons all carry their own fill and a 3px `ink` border, so they
 * sit on top of this cleanly — which is also what satisfies §1's rule that two
 * accents never touch without an outline or a paper gap between them.
 *
 * Word of the day will eventually occupy roughly this space. That is three
 * positioned elements to move or drop when it does.
 */
/**
 * Above this OS text scale the screen has no empty band left, so the backdrop
 * hides rather than competing with the content that now fills it.
 */
const MAX_ORNAMENT_FONT_SCALE = 1.3;

/**
 * What every letter carries: out of the accessibility tree, and out of text
 * scaling. Spread onto each `Text` rather than relied on from the parent —
 * see the docblock for why the container props alone did not hold.
 */
const hidden = {
  accessible: false,
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
  allowFontScaling: false,
} as const;

export function HomeBackdrop(): React.JSX.Element {
  // Sized from the screen's shorter side, so the letters hold the same
  // proportion of the band on a 375pt phone and an 820pt tablet. See
  // `ornamentScale` for why this is a fraction rather than a point size.
  const { width, height, fontScale } = useWindowDimensions();

  /*
    Nothing to decorate. Past roughly 1.3x the OS text setting the content
    fills the smallest supported phone on its own, and the letters stop being
    a backdrop and start being fragments of colour poking out between the
    cards — the "reads as a rendering fault" failure again, arriving from the
    other direction. The band this exists to fill is gone, so it goes too.
  */
  if (fontScale > MAX_ORNAMENT_FONT_SCALE) return <View />;

  const base = Math.min(width, height);
  const size = (ratio: number) => ({ fontSize: Math.round(base * ratio) });

  return (
    <View
      style={styles.layer}
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden>
      <Text {...hidden} style={[styles.letter, styles.a, size(ornamentScale.lg)]}>
        A
      </Text>
      <Text {...hidden} style={[styles.letter, styles.e, size(ornamentScale.md)]}>
        E
      </Text>
      <Text {...hidden} style={[styles.letter, styles.t, size(ornamentScale.sm)]}>
        T
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  // Sizes come from `ornamentScale`, not `typeScale` — see that token for why
  // decorative lettering is kept out of the reading scale.
  letter: {
    position: 'absolute',
    fontFamily: typeScale.requiredLetter.fontFamily,
    includeFontPadding: false,
  },
  /*
    All three sit in the band below the content and bleed off the edges. Two
    rules came out of looking at the first attempt on a device:

    - **No slivers.** A letter mostly covered by a card reads as a rendering
      fault rather than as decoration, so each one is either substantially in
      the open or clearly running off an edge.
    - **Never the fill of whatever it sits under.** The first pass put a
      `sunbeam` A behind the `sunbeam` empty-state card, and the two merged
      into one shape with a border through it.
  */
  a: {
    color: palette.tangerine,
    bottom: -48,
    left: -44,
    transform: rotate(-8),
  },
  e: {
    color: palette.bubblegum,
    bottom: -8,
    right: -24,
    transform: rotate(11),
  },
  t: {
    color: palette.sunbeam,
    bottom: '14%',
    left: '44%',
    transform: rotate(4),
  },
});

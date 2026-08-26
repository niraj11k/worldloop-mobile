/**
 * WordLoop typography — the bundled faces and the section 2 type scale.
 *
 * Spec: Design System doc section 2. Task: WL-201 (D-06 selected the faces;
 * this bundles them). Same split as `palette.ts`: this file owns one axis of
 * the design system, and WL-203's `theme.ts` composes the axes together
 * rather than restating them.
 *
 * ## Referencing a face
 *
 * Each weight ships as its own static TTF whose **filename matches its
 * PostScript name exactly**. That is not incidental — it is what lets a single
 * `fontFamily` string work on both platforms:
 *
 *   - iOS resolves `fontFamily` against the font's PostScript name (the file
 *     is registered via `UIAppFonts` in Info.plist).
 *   - Android resolves it against the filename in
 *     `android/app/src/main/assets/fonts/`.
 *
 * **Never pair these with `fontWeight`.** The face already carries its weight.
 * Adding `fontWeight` on top asks Android to synthesise a second layer of
 * boldness over an already-heavy face, and on iOS causes the system to resolve
 * to a different member of the family than the one named. Set `fontFamily`
 * alone.
 *
 * ## Why static cuts and not the variable fonts
 *
 * Both faces are published upstream as variable fonts (`Baloo2[wght].ttf`,
 * `JetBrainsMono[wght].ttf`). React Native exposes no way to select a point on
 * a variable axis — there is no `fontVariationSettings` equivalent — so a
 * bundled variable font renders only at its default instance (400) and every
 * heavier role would silently come out Regular. Static instances are the only
 * option that actually renders the specified weights.
 */

/**
 * Bundled faces, by PostScript name. These four strings are the *only* legal
 * values for `fontFamily` in this app.
 *
 * Sources and versions, for the licence record (see `licenses/fonts/`):
 *   - Baloo 2 — yanone/Baloo2-Variable @ da523dfa, the commit Google Fonts
 *     itself pins. OFL, no Reserved Font Name.
 *   - JetBrains Mono — JetBrains/JetBrainsMono release v2.304. OFL, no
 *     Reserved Font Name.
 */
export const fontFamily = {
  /** Display, ExtraBold/800 — the heaviest cut Baloo 2 has. Wordmark, required letter. */
  displayExtraBold: 'Baloo2-ExtraBold',
  /** Display, Bold/700 — screen titles, chain words. */
  displayBold: 'Baloo2-Bold',
  /** Monospace, Regular/400 — body copy, captions. */
  monoRegular: 'JetBrainsMono-Regular',
  /** Monospace, Bold/700 — button labels. */
  monoBold: 'JetBrainsMono-Bold',
} as const;

export type FontFamily = (typeof fontFamily)[keyof typeof fontFamily];

/**
 * The section 2 type scale, one entry per role. Sizes are transcribed from the
 * doc; nothing here is invented.
 *
 * Section 2's two hard rules, encoded by construction rather than left to
 * reviewers: no role uses the display face below 20px, and no role uses the
 * monospace face for the required letter. `__tests__/typography.test.ts`
 * asserts both, so a future edit that breaks one fails the suite.
 */
export const typeScale = {
  wordmark: { fontFamily: fontFamily.displayExtraBold, fontSize: 40 },
  requiredLetter: { fontFamily: fontFamily.displayExtraBold, fontSize: 64 },
  screenTitle: { fontFamily: fontFamily.displayBold, fontSize: 28 },
  chainWord: { fontFamily: fontFamily.displayBold, fontSize: 26 },
  body: { fontFamily: fontFamily.monoRegular, fontSize: 15 },
  buttonLabel: {
    fontFamily: fontFamily.monoBold,
    fontSize: 15,
    textTransform: 'uppercase',
    // Section 2 gives +0.02em; RN's letterSpacing is in points, so this is
    // 15 * 0.02 rather than a unit the platform would reject.
    letterSpacing: 15 * 0.02,
  },
  caption: { fontFamily: fontFamily.monoRegular, fontSize: 12 },
} as const;

export type TypeRole = keyof typeof typeScale;

/** The display faces, for the "never below 20px" rule. */
export const DISPLAY_FACES: readonly FontFamily[] = [
  fontFamily.displayExtraBold,
  fontFamily.displayBold,
];

/** Section 2: the display face loses its character below this size. */
export const MIN_DISPLAY_SIZE = 20;

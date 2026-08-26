/**
 * WordLoop colour palette — the verified hex values and the rules governing
 * which text colour may sit on which fill.
 *
 * Spec: Design System doc section 1. Verified under WL-202 against WCAG 2.1
 * AA; `npm run contrast:verify` recomputes every pairing from *this* file and
 * regenerates `proj-docs/WordLoop_Contrast_Matrix.md`. That is the reason the
 * hexes live here rather than only in the doc: a palette that is prose in one
 * place and code in another drifts, and the drift is invisible until a
 * contrast regression ships.
 *
 * This file deliberately covers *only* colour. The full token layer — type
 * scale, spacing, radii, border weights, shadow specs — is WL-203, which will
 * build on this file rather than restate it. `theme.ts` is still the
 * grayscale placeholder until then.
 *
 * No dark variant: dark mode is cut from v1 (Delivery Plan D-05, closed
 * 2026-08-26).
 */

/** Raw palette. Design System section 1. */
export const palette = {
  /** Base background — warm off-white, not clinical white. */
  paper: '#FFF6E9',
  /** Primary text, and every outline/border in the system. */
  ink: '#161311',
  /** Primary brand accent — headers, primary CTA fill. */
  grape: '#7C3AED',
  /** Secondary accent — score, streaks, energy states. */
  tangerine: '#FF6B1A',
  /** Tertiary accent — required-letter callout, hint sheet. */
  bubblegum: '#FF3D8A',
  /** Success / valid move / win state. Reserved — never decorative. */
  limeade: '#B4E600',
  /** Error / invalid move. Reserved — never decorative. */
  redAlert: '#FF3131',
  /** Highlight / badge fills, level-up moments. */
  sunbeam: '#FFD400',
} as const;

export type PaletteToken = keyof typeof palette;

/**
 * Offset drop shadows only — never a fill, never behind text. Excluded from
 * contrast verification for that reason: nothing is ever read against it.
 * The exact opacity is a WL-203 decision; Design System section 4 fixes only
 * the offset distances (4-8px components, 10-12px modals) and "no blur".
 */
export const SHADOW_INK = palette.ink;

/**
 * Disabled controls drop to 40% fill opacity and lose their offset shadow
 * (Design System section 4, Buttons). The fill composites over `paper`, which
 * is what makes the disabled label a distinct contrast case from the enabled
 * one — see the matrix, and `TEXT_ON.disabled`.
 */
export const DISABLED_FILL_OPACITY = 0.4;

/**
 * Text colours are never grey and never an accent — only `ink` or `paper`
 * (Design System section 1, pairing rules). Which of the two is legal depends
 * on the fill, and on the size of the text.
 *
 * `normal` — the ≥4.5:1 list, for anything in the monospace scale: body and
 * instructions (15px), button labels (15px bold), captions and score
 * metadata (12px).
 *
 * `large` — the ≥3:1 list, for the display scale at 24px and above: the
 * required letter (64px), wordmark (40px), screen titles (28px), and the
 * computer/player word (26px).
 *
 * Every entry here is *derived from measurement*, not asserted — the
 * verifier recomputes each list from the hexes above and fails if this table
 * disagrees with it, so the table cannot quietly rot.
 */
export const TEXT_ON: Record<
  PaletteToken | 'disabledGrape' | 'disabledTangerine',
  { normal: readonly PaletteToken[]; large: readonly PaletteToken[] }
> = {
  paper: { normal: ['ink'], large: ['ink'] },
  ink: { normal: ['paper'], large: ['paper'] },
  // Note `ink` is legal on grape only at display sizes (3.18:1) — a 15px
  // button label on the primary CTA must be `paper`.
  grape: { normal: ['paper'], large: ['paper', 'ink'] },
  tangerine: { normal: ['ink'], large: ['ink'] },
  bubblegum: { normal: ['ink'], large: ['ink', 'paper'] },
  limeade: { normal: ['ink'], large: ['ink'] },
  redAlert: { normal: ['ink'], large: ['ink', 'paper'] },
  sunbeam: { normal: ['ink'], large: ['ink'] },
  disabledGrape: { normal: ['ink'], large: ['ink'] },
  disabledTangerine: { normal: ['ink'], large: ['ink'] },
} as const;

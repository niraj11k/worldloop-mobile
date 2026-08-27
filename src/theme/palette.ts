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
 *
 * Fully opaque (Design System section 1, resolved by WL-203): `ink` at any
 * lower opacity composites over `paper` to a grey, and section 1 excludes greys
 * from the palette entirely. Kept as its own token so shadow colour can be
 * retuned without touching every border in the app.
 */
export const SHADOW_INK = palette.ink;

/**
 * Disabled controls drop to 40% fill opacity and lose their offset shadow
 * (Design System section 4, Buttons).
 */
export const DISABLED_FILL_OPACITY = 0.4;

/**
 * Composite `fg` at `alpha` over an opaque `bg`, in sRGB — how a partially
 * transparent fill actually renders against the page.
 */
export const composite = (fg: string, bg: string, alpha: number): string => {
  const rgb = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  const [fr, fg_, fb] = rgb(fg) as [number, number, number];
  const [br, bg_, bb] = rgb(bg) as [number, number, number];
  const mix = (a: number, b: number) => Math.round(a * alpha + b * (1 - alpha));
  return (
    '#' +
    [mix(fr, br), mix(fg_, bg_), mix(fb, bb)]
      .map(c => c.toString(16).padStart(2, '0').toUpperCase())
      .join('')
  );
};

/**
 * Pre-composited disabled fills.
 *
 * **Use these instead of putting `opacity` on the control.** A container
 * `opacity` fades everything inside it — the `ink` border section 4 says a
 * disabled button must *keep*, and the label along with it. WL-202 measured the
 * disabled label at 9.30:1 assuming a full-strength `ink` label over a
 * composited fill; fading the label too lands nowhere near that, and nothing
 * would have caught it, because a washed-out button still looks like a
 * plausible disabled button.
 *
 * That is exactly what happened while WL-203 was being built: the token layer
 * reached for `opacity` because no composited fill existed to reach for, so the
 * contrast matrix had verified a colour the app could not actually produce.
 * These exports close that loop — `scripts/verify-contrast.js` measures *these*
 * values rather than recomputing its own copy.
 */
export const disabledFill = {
  grape: composite(palette.grape, palette.paper, DISABLED_FILL_OPACITY),
  tangerine: composite(palette.tangerine, palette.paper, DISABLED_FILL_OPACITY),
} as const;

/**
 * Placeholder text — `ink` muted toward `paper`.
 *
 * Added by WL-204, because section 1 defines no placeholder colour and the
 * conventional answer (grey) reads as banned: "Grays are excluded from this
 * palette entirely."
 *
 * Two things reconcile that. First, section 1's stated objection is to "cool
 * gray-scale neutrals **as a base**" — a hue introduced into the palette.
 * This is not a new hue: it is `ink` composited over `paper`, so it inherits
 * the palette's own warmth (`#736E67`, brown-leaning, not a cool grey) and
 * moves automatically if either parent colour is ever retuned.
 *
 * Second, the alternative is worse for accessibility, not better. Rendering
 * placeholders in full `ink` makes them indistinguishable from a real value,
 * so nobody can tell at a glance whether a field has been filled in.
 *
 * 0.6 is the lowest alpha that still clears 4.5:1 against `paper` (it measures
 * 4.72:1, verified in the contrast matrix) — i.e. the most visual separation
 * from entered text that is still legible as text.
 */
export const INK_MUTED_ALPHA = 0.6;
export const inkMuted = composite(palette.ink, palette.paper, INK_MUTED_ALPHA);

/** `hex` as an `rgba()` string — for the few places real transparency is needed. */
const rgba = (hex: string, alpha: number): string => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/**
 * Modal scrim — `ink` at 45%.
 *
 * Added by WL-204. Section 4 specifies a heavier shadow to make a sheet read as
 * elevated but says nothing about the surface behind it, and a modal with no
 * scrim at all leaves the page beneath looking live and tappable. This is one
 * of the few places genuine transparency is required rather than a composite:
 * the point is to see the dimmed screen through it.
 *
 * **Flagged for design review** — the exact alpha is this implementation's
 * choice, not the doc's. It is excluded from the contrast matrix because
 * nothing is read against it; the sheet sits on opaque `paper`.
 */
export const SCRIM_ALPHA = 0.45;
export const scrim = rgba(palette.ink, SCRIM_ALPHA);

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
 *
 * **Order is significant: highest contrast first.** `textOn()` below takes the
 * head of the list, so the first entry is what components actually render.
 * The verifier compares these lists *in order*, not as sets, so the preference
 * cannot be silently reshuffled — that would change what ships without
 * changing any ratio.
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

/** Any surface a component can put text on, including the disabled fills. */
export type FillToken = keyof typeof TEXT_ON;

/**
 * The text colour to use on a given fill — the highest-contrast legal option.
 *
 * Components take a *fill* and call this rather than accepting a text colour,
 * so the WL-202 contrast matrix is enforced by construction instead of by
 * anyone remembering that `grape` is the only fill dark enough for `paper`
 * text. There is no component API that can express a failing pairing.
 *
 * `size` follows the matrix's own split: `normal` for the monospace scale
 * (body, button labels, captions), `large` for display roles at 24px+.
 */
export const textOn = (fill: FillToken, size: 'normal' | 'large' = 'normal'): string => {
  const legal = TEXT_ON[fill][size];
  const token = legal[0];
  // Unreachable against the current table — every fill has at least one legal
  // text colour, and the verifier fails if that stops being true. Falling back
  // to `ink` rather than throwing keeps a rendering bug from becoming a crash.
  return token ? palette[token] : palette.ink;
};

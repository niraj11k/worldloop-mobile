/**
 * WordLoop design tokens — the single object screens and components style from.
 *
 * Spec: Design System doc sections 1-4. Task: WL-203.
 *
 * This file *composes*; it does not restate. Colour lives in `palette.ts`
 * (WL-202, contrast-verified) and type in `typography.ts` (WL-201, the bundled
 * faces). Both are re-exported here so a component needs one import, but they
 * remain the source of truth for their own axis — the alternative is the
 * `MIN_WORD_LENGTH`-declared-four-times problem WL-108 had to clean up.
 *
 * Light mode only: dark mode is cut from v1 (Delivery Plan D-05).
 *
 * ## The rule this file exists to enforce
 *
 * No screen or component may contain a raw hex, a raw font size, or a raw
 * shadow value. That is enforced by `no-restricted-syntax` in
 * `eslint.config.js`, not by review. If a value is missing here, add it here —
 * do not inline it at the call site.
 */
import {
  palette,
  SHADOW_INK,
  disabledFill,
  inkMuted,
  scrim,
  composite,
  textOn,
  TEXT_ON,
} from './palette';
import {
  fontFamily,
  typeScale,
  ornamentScale,
  displayTextProps,
  MAX_DISPLAY_FONT_SCALE,
} from './typography';
import type { FillToken } from './palette';

export {
  palette,
  TEXT_ON,
  fontFamily,
  typeScale,
  ornamentScale,
  displayTextProps,
  MAX_DISPLAY_FONT_SCALE,
  disabledFill,
  inkMuted,
  scrim,
  composite,
  textOn,
};
export type { FillToken };

/**
 * Spacing — Design System section 3: base unit 4px, used in multiples.
 *
 * Named rather than numeric (`spacing.md`, not `spacing[4]`) so the scale can
 * be retuned without a find-and-replace across every screen.
 */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

/**
 * Corner radius — Design System section 3. These three values are exhaustive;
 * the doc calls the scale "generous and consistent", so a fourth radius is a
 * doc change, not a local decision.
 */
export const radius = {
  /** Cards and modals. */
  card: 20,
  /** Buttons and inputs. */
  control: 16,
  /** Badges, tags, stickers. */
  pill: 999,
} as const;

/**
 * Border weights — Design System section 4: "3-4px solid `ink`, always",
 * with badges permitted 2-3px.
 *
 * WL-202 found this rule is load-bearing for accessibility, not just for the
 * look: `sunbeam` (1.34:1) and `tangerine` (2.66:1) are too close to `paper`
 * to form a visible boundary on their own, and never have to be, because every
 * component carries an `ink` outline. Dropping a border for visual reasons
 * creates a real WCAG 1.4.11 failure.
 */
export const borderWidth = {
  /** Badges and stickers. */
  thin: 2,
  /** The default for buttons, cards, inputs. */
  base: 3,
  /** Modals and bottom sheets — section 4 sets a 4px floor for these. */
  thick: 4,
} as const;

/**
 * Rotation range — Design System section 3: `-2deg` to `3deg` for cards and
 * stickers, `3-6deg` for badges.
 *
 * Interactive controls are never rotated, and neither is the required-letter
 * callout (section 6). That is a rule about *where* rotation may be applied,
 * which tokens cannot enforce on their own — see `rotate()` below.
 */
export const rotation = {
  cardMin: -2,
  cardMax: 3,
  badgeMin: 3,
  badgeMax: 6,
} as const;

/**
 * A rotation transform, in the units RN expects.
 *
 * Deliberately not applied to anything automatically: section 3 forbids
 * rotating buttons, inputs, and the required-letter callout, because rotation
 * interferes with tap targets and predictable focus states. Call this only on
 * decorative and informational elements.
 */
export const rotate = (degrees: number) => [{ rotate: `${degrees}deg` }] as const;

// --- Shadows ----------------------------------------------------------------

/**
 * Hard offset shadows — Design System section 4: "hard offset shadow, no blur",
 * colour `shadow-ink`, offset varying by component type.
 *
 * ## Why `boxShadow` and not `shadowOffset`/`elevation`
 *
 * This is the one place the design system and React Native genuinely collide.
 * The legacy shadow props cannot express this aesthetic on Android at all:
 * `shadowColor`/`shadowOffset`/`shadowRadius` are iOS-only, and Android's
 * `elevation` draws a Material blurred ambient shadow whose offset and colour
 * are not controllable. A design whose signature move is "thick outline + hard
 * offset shadow, no blur" is simply unimplementable on Android through them.
 *
 * `boxShadow` (React Native 0.86, New Architecture) takes an explicit
 * `offsetX`/`offsetY`/`blurRadius`/`color` and has real native implementations
 * on both platforms — `OutsetBoxShadowDrawable` on Android, `RCTBoxShadow` on
 * iOS. `blurRadius: 0` is what makes the shadow hard.
 *
 * **This means the design system depends on New Architecture being enabled**
 * (`newArchEnabled=true` in `android/gradle.properties`). Turning it off would
 * silently drop every shadow in the app rather than failing loudly.
 */
const hardShadow = (offset: number) =>
  [{ offsetX: offset, offsetY: offset, blurRadius: 0, color: SHADOW_INK }] as const;

/**
 * Offsets are all bottom-right for v1. Section 0 mentions "staggered shadow
 * directions" as part of the intended character, but section 4 requires the
 * direction be "consistent per component type" — so staggering is a per-type
 * choice WL-204 can make deliberately, not something to scatter randomly here.
 */
export const shadow = {
  /** Badges and stickers — section 4 says 2-4px. */
  badge: hardShadow(3),
  /** Secondary buttons — section 4 says 4px. */
  control: hardShadow(4),
  /** Primary buttons — section 4 says 6px. */
  controlPrimary: hardShadow(6),
  /** Cards — section 4 says 6-8px. */
  card: hardShadow(7),
  /** Modals and bottom sheets — section 4 says 10-12px, "heavier than cards". */
  modal: hardShadow(11),
  /**
   * The pressed state. Section 4: the control shifts toward its shadow and the
   * shadow "shrinks or disappears", so the component reads as pressed into the
   * page. Disabled controls use this too — they "lose the offset shadow
   * entirely", which is the same visual result.
   */
  none: [] as const,
} as const;

/**
 * How far a control moves on press — section 4 says 4-6px toward the shadow.
 * Paired with `shadow.none` so the control lands exactly where its shadow was.
 */
export const pressTranslate = 4;

/**
 * The widest a column of content is allowed to get (WL-409).
 *
 * Wireframe section 19 asks for tablets to be considered, and the failure
 * there is not that anything breaks — it is that a phone layout stretched to
 * 820pt or 1180pt reads as a mistake: a one-line sentence in a card as wide
 * as a laptop, buttons a foot long, and a measure far past what anyone reads
 * comfortably.
 *
 * 560 is chosen so **no phone is affected**: the widest device in the WL-005
 * matrix is the iPhone 17 Pro Max at 440pt, so every phone stays exactly as
 * it was, and only tablets see the column centre itself. It also keeps text
 * lines near the 45-75 character measure that typography convention treats as
 * readable.
 *
 * Applied to each screen's content container rather than at the navigator, so
 * a screen that genuinely wants full bleed (a future board, a splash) can
 * simply not use it.
 */
export const CONTENT_MAX_WIDTH = 560;

/**
 * Minimum tap target — Wireframe section 18, "large tap targets".
 *
 * 48 rather than 44: iOS HIG asks for 44pt and WCAG 2.5.5 for 44×44, but
 * Android's Material guidance asks for 48dp, and one number that satisfies
 * both platforms is worth more than two that each satisfy one. The chunky,
 * puffy geometry this design system calls for absorbs the extra 4pt easily.
 */
export const MIN_TAP_TARGET = 48;

export const theme = {
  colors: palette,
  disabledFill,
  spacing,
  radius,
  borderWidth,
  rotation,
  shadow,
  type: typeScale,
  fontFamily,
} as const;

export type Theme = typeof theme;

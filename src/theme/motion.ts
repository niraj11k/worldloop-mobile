/**
 * Motion tokens — Design System §5. Task: WL-205.
 *
 * Same relationship to §5 that `theme.ts` has to §3-§4: the numbers live here,
 * not at the call site, so they can be tuned in one place.
 *
 * > **These are explicitly untuned.** Design System §9 open item 4 records that
 * > "motion timing values (200ms, spring parameters, etc.) are first-pass
 * > suggestions, not tuned against an actual build". Only the values §5 states
 * > outright — the 1.15 punch scale, ~200ms, the 100ms reduced-motion flash —
 * > come from the doc; the rest are this implementation's, and are flagged
 * > below. Tuning them is a job for someone watching the app on a device, and
 * > belongs with WL-605's tuning pass or a design review, not with a guess made
 * > while writing the primitives.
 */

export const motion = {
  /**
   * Scale-punch — §5, streak counter: "1.0 → 1.15 → 1.0, ~200ms".
   * `milestoneScale` is §5's "slightly bigger version" for milestone streaks;
   * the exact figure is this implementation's.
   */
  punch: {
    scale: 1.15,
    milestoneScale: 1.3,
    durationMs: 200,
  },

  /**
   * Colour flash — §5 uses this for the valid-move fill and the streak's
   * flash to `sunbeam` and back. Durations are this implementation's; §5 says
   * only "briefly".
   */
  flash: {
    inMs: 120,
    holdMs: 90,
    outMs: 220,
  },

  /**
   * Horizontal shake — §5, invalid word: "a short horizontal shake".
   * Distance and cycle count are this implementation's.
   *
   * Kept deliberately small: a large-amplitude shake on an input the player is
   * about to retype in is disorienting, and §5 is explicit that the shake
   * "must never be the only signal" — the error text and border already carry
   * the meaning, so this only needs to draw the eye.
   */
  shake: {
    distance: 6,
    cycles: 3,
    durationMs: 60,
  },

  /**
   * Spring entry — §5, level-up modal: "enter with a spring scale-in", and the
   * "small scale-in" a valid word uses to stamp onto the chain.
   *
   * Tuned only to the extent of avoiding a visible second bounce, which reads
   * as sloppy at this size rather than playful. Real tuning is open (§9 item 4).
   */
  spring: {
    fromScale: 0.9,
    damping: 18,
    stiffness: 260,
    mass: 1,
  },

  /**
   * Computer "thinking" dots — §5: "a simple 3-dot pulse in the monospace
   * face, not a spinner".
   *
   * `staggerMs` is what makes it read as a travelling pulse rather than three
   * dots blinking in unison.
   */
  thinking: {
    dotDurationMs: 420,
    staggerMs: 140,
    minOpacity: 0.25,
  },

  /**
   * The reduced-motion substitute. §5 specifies it for the streak counter —
   * "brief 100ms opacity flash only (no scale)" — and the same value is reused
   * anywhere an effect needs a non-animated equivalent that still marks the
   * state change.
   */
  reduced: {
    flashMs: 100,
  },
} as const;

export type Motion = typeof motion;

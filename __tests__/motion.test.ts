/**
 * WL-205 — motion token invariants.
 *
 * These cover the values Design System §5 states outright, so a "tuning" pass
 * cannot quietly drift away from the spec while believing it is only adjusting
 * feel. Everything §5 leaves open is deliberately *not* pinned here — §9 open
 * item 4 records that those numbers are untuned, and a test asserting an
 * arbitrary duration would make tuning look like a regression.
 *
 * The primitives themselves and the `useReducedMotion` hook are verified
 * on-device rather than here: the suite has no component renderer by design
 * (see WL-204), and the thing that actually needed proving — that the OS
 * setting is picked up *live*, in both directions, on both platforms — is only
 * observable on a device.
 */
import { motion } from '@theme/motion';

describe('values §5 states outright', () => {
  it('punches to 1.15 over ~200ms', () => {
    expect(motion.punch.scale).toBe(1.15);
    expect(motion.punch.durationMs).toBe(200);
  });

  it('gives milestones a bigger punch than an ordinary increment', () => {
    // §5: "a slightly bigger version of the same punch".
    expect(motion.punch.milestoneScale).toBeGreaterThan(motion.punch.scale);
  });

  it('uses a 100ms flash as the reduced-motion substitute', () => {
    // §5, streak counter: "brief 100ms opacity flash only (no scale)".
    expect(motion.reduced.flashMs).toBe(100);
  });

  it('springs in from smaller, never larger', () => {
    // §5 calls for a scale-*in*. Starting above 1 would be a shrink, and would
    // briefly overflow whatever contains it.
    expect(motion.spring.fromScale).toBeLessThan(1);
    expect(motion.spring.fromScale).toBeGreaterThan(0);
  });
});

describe('values that must stay sane however they are tuned', () => {
  it('has a positive duration everywhere a duration is used', () => {
    const durations = [
      motion.punch.durationMs,
      motion.flash.inMs,
      motion.flash.holdMs,
      motion.flash.outMs,
      motion.shake.durationMs,
      motion.thinking.dotDurationMs,
      motion.thinking.staggerMs,
      motion.reduced.flashMs,
    ];
    for (const d of durations) expect(d).toBeGreaterThan(0);
  });

  it('keeps the shake small and finite', () => {
    // A large-amplitude shake on an input the player is about to retype in is
    // disorienting, and §5 makes the shake a secondary signal at most.
    expect(motion.shake.distance).toBeGreaterThan(0);
    expect(motion.shake.distance).toBeLessThanOrEqual(12);
    expect(motion.shake.cycles).toBeGreaterThanOrEqual(1);
    expect(Number.isInteger(motion.shake.cycles)).toBe(true);
  });

  it('never fades the thinking dots to fully invisible', () => {
    // A dot that reaches 0 reads as disappearing rather than pulsing, and at
    // three staggered dots that looks like a rendering fault.
    expect(motion.thinking.minOpacity).toBeGreaterThan(0);
    expect(motion.thinking.minOpacity).toBeLessThan(1);
  });

  it('staggers the dots by less than one dot cycle', () => {
    // Otherwise the "travelling pulse" degenerates into dots that are simply
    // out of phase, which reads as three unrelated blinks.
    expect(motion.thinking.staggerMs).toBeLessThan(motion.thinking.dotDurationMs);
  });

  it('keeps the reduced-motion substitute shorter than what it replaces', () => {
    // The point of the fallback is to mark the change without dwelling on it.
    expect(motion.reduced.flashMs).toBeLessThan(motion.punch.durationMs);
  });
});

/**
 * WL-201 — the section 2 typography rules, asserted rather than trusted to review.
 *
 * These are cheap tests guarding rules that are easy to break by eye: a new
 * role added at 18px in the display face, or the monospace face creeping onto
 * the required-letter callout, both look reasonable in a diff.
 *
 * The *filesystem* side of WL-201 — that the declared families have matching
 * font files, that each file's internal PostScript name is what this app
 * references, and that both native projects are linked — lives in
 * `scripts/verify-fonts.js` instead, because the RN TypeScript config
 * deliberately restricts ambient types to `jest` so that app code cannot reach
 * for Node APIs. Widening that to let a test read the filesystem would also let
 * a screen component import `fs` and typecheck clean.
 */
import {
  fontFamily,
  typeScale,
  DISPLAY_FACES,
  MIN_DISPLAY_SIZE,
} from '@theme/typography';

describe('Design System §2 rules', () => {
  it('never uses the display face below 20px', () => {
    const offenders = Object.entries(typeScale)
      .filter(([, s]) => (DISPLAY_FACES as readonly string[]).includes(s.fontFamily))
      .filter(([, s]) => s.fontSize < MIN_DISPLAY_SIZE)
      .map(([role, s]) => `${role} @ ${s.fontSize}px`);

    expect(offenders).toEqual([]);
  });

  it('never uses the monospace face for the required letter', () => {
    expect(DISPLAY_FACES as readonly string[]).toContain(
      typeScale.requiredLetter.fontFamily,
    );
  });

  it('makes the required letter the largest role in the scale', () => {
    // Design System §6 / Wireframe §8: this is the one non-negotiable rule on
    // the game screen, so it is asserted at the token level too — long before
    // WL-301 has to prove it on a rendered screen.
    const sizes = Object.values(typeScale).map(s => s.fontSize);
    expect(typeScale.requiredLetter.fontSize).toBe(Math.max(...sizes));
    expect(sizes.filter(s => s === typeScale.requiredLetter.fontSize)).toHaveLength(1);
  });

  it('sets no fontWeight anywhere — the face carries its own weight', () => {
    // Pairing fontWeight with an already-weighted face makes Android
    // synthesise a second layer of boldness and makes iOS resolve to a
    // different family member. See the typography.ts docblock.
    for (const style of Object.values(typeScale)) {
      expect(style).not.toHaveProperty('fontWeight');
    }
  });

  it('uses only the four bundled faces', () => {
    const bundled = new Set<string>(Object.values(fontFamily));
    for (const style of Object.values(typeScale)) {
      expect(bundled.has(style.fontFamily)).toBe(true);
    }
  });
});

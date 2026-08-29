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
  MAX_DISPLAY_FONT_SCALE,
  displayTextProps,
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

describe('display text scaling (WL-408)', () => {
  /**
   * The narrowest screen in the WL-005 matrix is the iPhone SE (3rd gen) at
   * 375pt, minus the screen's own `spacing.lg` padding on each side and the
   * required-letter card's, which is what the glyph actually has to live in.
   */
  const SMALLEST_CARD_WIDTH = 375 - 16 * 2 - 16 * 2;

  it('keeps the required letter inside the card it sits in, at the cap', () => {
    // The Delivery Plan calls this task's highest risk by name: "a 64px
    // display glyph at the largest OS text setting will overflow". Uncapped,
    // iOS's largest accessibility size multiplies by roughly 3.1 — about
    // 200px, which does not fit anything. This is the guard on the number
    // that prevents it.
    const cappedSize = typeScale.requiredLetter.fontSize * MAX_DISPLAY_FONT_SCALE;

    expect(cappedSize).toBeLessThan(SMALLEST_CARD_WIDTH);
    // And it must still be the dominant element, not merely a safe one.
    expect(cappedSize).toBeGreaterThan(typeScale.chainWord.fontSize * 2);
  });

  it('still lets the display face grow by at least half again', () => {
    // A cap that barely moves would satisfy the line above while making the
    // OS text setting useless on exactly the text that most needs it.
    expect(MAX_DISPLAY_FONT_SCALE).toBeGreaterThanOrEqual(1.5);
  });

  it('exposes the cap as props, since it is a prop and not a style', () => {
    expect(displayTextProps).toEqual({ maxFontSizeMultiplier: MAX_DISPLAY_FONT_SCALE });
  });

  it('caps only the display face — body and UI copy scale freely', () => {
    // Wireframe §18 asks for "large, readable text", and capping the roles a
    // player actually reads at length would defeat the setting entirely.
    const capped = new Set<string>(DISPLAY_FACES);
    const mono = Object.entries(typeScale).filter(
      ([, style]) => !capped.has(style.fontFamily),
    );

    expect(mono.map(([role]) => role).sort()).toEqual(['body', 'buttonLabel', 'caption']);
  });
});

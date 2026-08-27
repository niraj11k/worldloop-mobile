/**
 * WL-203 — the design-token rules that are cheap to assert and expensive to
 * notice breaking.
 *
 * Everything here restates a rule from Design System §1-§4 in a form that
 * fails a build rather than a review. The shadow tests are the load-bearing
 * ones: a blurred shadow is the single most likely way this design system
 * drifts, because it still *looks* like a shadow.
 */
import {
  spacing,
  radius,
  borderWidth,
  rotation,
  shadow,
  rotate,
  palette,
  disabledFill,
  composite,
} from '@theme/theme';

describe('shadows (§4)', () => {
  const named = Object.entries(shadow).filter(([name]) => name !== 'none');

  it('are all hard — blurRadius 0, no exceptions', () => {
    // §8 lists "soft blurred drop shadows" as an explicit Don't, and §4 says
    // "hard offset shadow, no blur". Verified on both platforms under WL-203
    // against a deliberately blurred control.
    const blurred = named
      .flatMap(([name, value]) => value.map(s => ({ name, blur: s.blurRadius })))
      .filter(s => s.blur !== 0);

    expect(blurred).toEqual([]);
  });

  it('use shadow-ink, never a palette accent', () => {
    for (const [, value] of named) {
      for (const s of value) expect(s.color).toBe(palette.ink);
    }
  });

  it('offset down-right, equally on both axes', () => {
    for (const [, value] of named) {
      for (const s of value) {
        expect(s.offsetX).toBeGreaterThan(0);
        expect(s.offsetX).toBe(s.offsetY);
      }
    }
  });

  it('sit inside the ranges §4 specifies per component type', () => {
    const within = (v: readonly { offsetX: number }[], lo: number, hi: number) =>
      v.every(s => s.offsetX >= lo && s.offsetX <= hi);

    expect(within(shadow.badge, 2, 4)).toBe(true);
    expect(within(shadow.control, 4, 4)).toBe(true);
    expect(within(shadow.controlPrimary, 6, 6)).toBe(true);
    expect(within(shadow.card, 6, 8)).toBe(true);
    expect(within(shadow.modal, 10, 12)).toBe(true);
  });

  it('escalate: badge < control < primary < card < modal', () => {
    // §4 requires the modal shadow be "heavier than cards"; the rest follows
    // the same logic of offset encoding elevation.
    const depth = (v: readonly { offsetX: number }[]) => v[0]?.offsetX ?? 0;
    const order = [
      depth(shadow.badge),
      depth(shadow.control),
      depth(shadow.controlPrimary),
      depth(shadow.card),
      depth(shadow.modal),
    ];
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(new Set(order).size).toBe(order.length);
  });

  it('has an empty "none" for pressed and disabled controls', () => {
    expect(shadow.none).toEqual([]);
  });
});

describe('spacing (§3)', () => {
  it('is entirely multiples of the 4px base unit', () => {
    const offenders = Object.entries(spacing).filter(([, v]) => v % 4 !== 0);
    expect(offenders).toEqual([]);
  });

  it('increases monotonically', () => {
    const values = Object.values(spacing);
    expect(values).toEqual([...values].sort((a, b) => a - b));
  });
});

describe('radii and borders (§3, §4)', () => {
  it('uses exactly the three radii the doc names', () => {
    expect(radius.card).toBe(20);
    expect(radius.control).toBe(16);
    expect(radius.pill).toBe(999);
  });

  it('keeps every border weight within the 2-4px the doc allows', () => {
    for (const w of Object.values(borderWidth)) {
      expect(w).toBeGreaterThanOrEqual(2);
      expect(w).toBeLessThanOrEqual(4);
    }
    // §4 sets a 4px floor specifically for modals and bottom sheets.
    expect(borderWidth.thick).toBe(4);
  });
});

describe('rotation (§3)', () => {
  it('stays inside the declared ranges', () => {
    expect(rotation.cardMin).toBeGreaterThanOrEqual(-2);
    expect(rotation.cardMax).toBeLessThanOrEqual(3);
    expect(rotation.badgeMin).toBeGreaterThanOrEqual(3);
    expect(rotation.badgeMax).toBeLessThanOrEqual(6);
  });

  it('emits a transform React Native accepts', () => {
    expect(rotate(-2)).toEqual([{ rotate: '-2deg' }]);
  });
});

describe('disabled fills (§4, WL-202)', () => {
  it('are pre-composited colours, not the raw accent', () => {
    // The whole point: a disabled control sets this as its background instead
    // of putting `opacity` on the container, which would fade the ink border
    // §4 requires it to keep — and the label with it.
    expect(disabledFill.grape).not.toBe(palette.grape);
    expect(disabledFill.grape).toMatch(/^#[0-9A-F]{6}$/);
  });

  it('composite toward paper, landing lighter than the accent', () => {
    expect(disabledFill.grape).toBe(composite(palette.grape, palette.paper, 0.4));
  });
});

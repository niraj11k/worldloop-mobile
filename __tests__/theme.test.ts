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
  inkMuted,
  composite,
  textOn,
  TEXT_ON,
  MIN_TAP_TARGET,
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

/**
 * WL-204. `textOn` is what makes a failing colour pairing unrepresentable in
 * the component API — callers pass a *fill* and never a text colour. These
 * assert the derivation rather than the ratios; the ratios themselves are
 * gated by `npm run contrast:verify`, which measures the same table.
 */
describe('textOn (WL-204)', () => {
  const fills = Object.keys(TEXT_ON) as (keyof typeof TEXT_ON)[];

  it('returns only ink or paper — never an accent, never a grey', () => {
    for (const fill of fills) {
      expect([palette.ink, palette.paper]).toContain(textOn(fill));
    }
  });

  it('returns the highest-contrast option, i.e. the head of the verified list', () => {
    for (const fill of fills) {
      const expected = TEXT_ON[fill].normal[0];
      if (expected) expect(textOn(fill)).toBe(palette[expected]);
    }
  });

  it('puts paper on grape and ink on every other accent', () => {
    // The single rule worth memorising, from the WL-202 matrix. If this ever
    // flips, a palette hex moved and the whole system needs re-reading.
    expect(textOn('grape')).toBe(palette.paper);
    for (const fill of ['tangerine', 'bubblegum', 'limeade', 'sunbeam', 'redAlert'] as const) {
      expect(textOn(fill)).toBe(palette.ink);
    }
  });

  it('keeps an ink label on disabled fills', () => {
    // WL-202: a paper label on a 40% grape fill measures 1.86:1.
    expect(textOn('disabledGrape')).toBe(palette.ink);
    expect(textOn('disabledTangerine')).toBe(palette.ink);
  });

  it('distinguishes large-text allowances from normal text', () => {
    // ink on grape is 3.25:1 — legal for display sizes, not for a 15px label.
    expect(TEXT_ON.grape.normal).not.toContain('ink');
    expect(TEXT_ON.grape.large).toContain('ink');
  });
});

describe('placeholder and tap target (WL-204)', () => {
  it('mutes the placeholder without introducing a new hue', () => {
    expect(inkMuted).toBe(composite(palette.ink, palette.paper, 0.6));
    expect(inkMuted).not.toBe(palette.ink);
  });

  it('meets both platforms’ minimum tap target', () => {
    // iOS HIG 44, Android Material 48 — one number satisfying both.
    expect(MIN_TAP_TARGET).toBeGreaterThanOrEqual(48);
  });
});

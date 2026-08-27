/**
 * WL-207 — the icon set's two structural guarantees.
 *
 * The glyphs themselves are geometry, and geometry is verified by looking at
 * it: the gallery's Components tab renders the whole set, iterated from
 * `ICON_NAMES` so a new one cannot be added without appearing there. What is
 * worth asserting in code is the part that would otherwise rot silently.
 */
import { ICON_NAMES } from '@components/common/icons/Icon';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const pkg = require('../package.json');

describe('no stock icon library (§7)', () => {
  it('ships no icon-set dependency', () => {
    // §7: "No stock icon sets that read as generic (standard Material/Feather-
    // style line icons will fight this aesthetic)." The Delivery Plan's own
    // acceptance criterion is "no stock icon library is a dependency", so this
    // is that criterion, enforced rather than remembered.
    const deps = Object.keys({
      ...pkg.dependencies,
      ...pkg.devDependencies,
    });

    const iconLibraries = deps.filter(name =>
      /(^|[-/])(icons?|vector-icons|feather|material-icons|font-awesome|ionicons)($|[-/])/i.test(
        name,
      ),
    );

    expect(iconLibraries).toEqual([]);
  });

  it('ships no SVG renderer either — the glyphs are Views', () => {
    // Not forbidden by §7, and explicitly the documented escape hatch if the
    // set ever needs organic shapes. This asserts the *current* decision so
    // that adding it becomes a deliberate change with a reason attached,
    // rather than something that arrives with an unrelated package.
    const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    expect(deps.filter(n => /svg/i.test(n))).toEqual([]);
  });
});

describe('the set itself', () => {
  it('covers every icon the app needs', () => {
    // The seven §7 names, plus `alert` for §4's Input error state.
    expect([...ICON_NAMES].sort()).toEqual(
      ['alert', 'back', 'close', 'haptics', 'hint', 'pause', 'settings', 'sound'].sort(),
    );
  });

  it('has no duplicate names', () => {
    expect(new Set(ICON_NAMES).size).toBe(ICON_NAMES.length);
  });
});

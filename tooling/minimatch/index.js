/**
 * Callable facade over minimatch@11, for GHSA-g3hv-75wg-m249.
 *
 * The advisory (DoS via globparts amplification) covers every minimatch
 * release below 11.0.1. The copies in this tree were 3.1.5 (eslint,
 * @eslint/config-array, @eslint/eslintrc, eslint-plugin-react, test-exclude),
 * 8.0.7 (glob@9) and 10.2.6 (@typescript-eslint/typescript-estree), and none
 * of those consumers accept 11.x, so `package.json` installs this directory
 * as the root `minimatch` devDependency (`file:./tooling/minimatch`) and the
 * `minimatch` override points every nested consumer at it (`$minimatch`).
 *
 * It exists because the override alone would break the build: minimatch@11's
 * CommonJS entry is a namespace object (`{ minimatch, Minimatch, filter,
 * ... }`), while minimatch@3 exported the matcher function itself with the
 * same members hung off it. eslint-plugin-react (five rules, including
 * `react/no-unstable-nested-components`, which @react-native/eslint-config
 * enables) and test-exclude@6 still call `minimatch(path, pattern)` directly
 * and would throw "minimatch is not a function". ESLint core, @eslint/* and
 * typescript-estree only use `.Minimatch` / `.minimatch`, which both shapes
 * provide.
 *
 * The real package is installed under the alias `minimatch-upstream`
 * (a root devDependency, `npm:minimatch@^11`) rather than as `minimatch`,
 * because npm applies overrides by package name: a dependency on `minimatch`
 * from in here would resolve to this file again.
 *
 * This package is named `minimatch` and wired through a root `file:`
 * dependency plus a `$minimatch` override, rather than a `file:` override
 * directly, because npm 10 writes `file:` overrides into package-lock.json
 * with paths that do not exist and then installs broken symlinks from it;
 * npm 11 recomputes them. The root-dependency form is the ordinary linked-
 * package shape and round-trips through `npm ci` on both.
 *
 * Remove this facade, the alias, the root dependency and the override once
 * every consumer listed above declares `minimatch@^11` on its own.
 */
const upstream = require('minimatch-upstream');

function minimatch(path, pattern, options) {
  return upstream.minimatch(path, pattern, options);
}

module.exports = Object.assign(minimatch, upstream);

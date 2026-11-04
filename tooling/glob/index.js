/**
 * Default-export facade over glob@14, for GHSA-3g3m-2fjr-6pw4.
 *
 * The advisory (AbortSignal cancellation bypass) covers glob >=9.0.0 <=14.0.1.
 * babel-plugin-module-resolver declares `glob@^9.3.3`, and jest-runtime,
 * @jest/reporters, jest-config and test-exclude@6 declare `^7.1.3`, so none
 * of them reach the 14.0.2 fix on their own, so `package.json` installs this
 * directory as the root `glob` devDependency (`file:./tooling/glob`) and the
 * `glob` override points every nested consumer at it (`$glob`).
 *
 * It exists because the override alone would break every Babel transform:
 * those consumers are compiled with `_interopRequireDefault(require('glob'))`
 * and then call `.default.sync(...)` / `.default.hasMagic(...)`. glob@7 and
 * glob@9 exported a callable function (so interop wrapped it as `default`),
 * but glob@14's CommonJS entry is an `__esModule` namespace with *no*
 * `default` member, so `.default` is `undefined` and `.default.sync` throws.
 * This facade is a callable function with glob@14's API copied onto it and
 * `default` pointing back at itself, which satisfies both calling styles.
 *
 * glob@14 is installed under the alias `glob-upstream` (a root devDependency,
 * `npm:glob@^14`) rather than as `glob`, because npm applies overrides by
 * package name: a dependency on `glob` from in here would resolve to this
 * file again. glob@14 itself depends on `minimatch@^11`, which the
 * `minimatch` override routes through ../minimatch; that facade exposes the
 * full minimatch@11 API, so glob is unaffected.
 *
 * The root-dependency-plus-`$glob`-override wiring (rather than a `file:`
 * override) is for npm 10 compatibility; see ../minimatch/index.js.
 *
 * Remove this facade, the alias, the root dependency and the override once
 * babel-plugin-module-resolver and the Jest 29 packages above declare
 * `glob@^14`, or once the project moves to Jest 30 (which depends on
 * glob@13+ with the same shape problem solved upstream in its own code).
 */
const upstream = require('glob-upstream');

function glob(...args) {
  return upstream.glob(...args);
}

Object.assign(glob, upstream);
glob.default = glob;

module.exports = glob;

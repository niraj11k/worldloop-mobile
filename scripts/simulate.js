#!/usr/bin/env node
/**
 * CLI entry point for WL-113's headless round simulator.
 *
 * All the simulation logic lives in `src/features/game/roundSimulator.ts`,
 * where it is typechecked and unit-tested like any other domain module —
 * this file is pure argv/stdout glue, matching `scripts/audit-gate.mjs`'s
 * plain-JS, unchecked role for tooling rather than shipped app code.
 *
 * Registered through the project's own `babel.config.js` (via
 * `@babel/register`) rather than a second alias configuration, so
 * `@features/*` etc. resolve exactly as they do for Metro and Jest — one
 * source of truth for the alias map, not a third copy to drift.
 */
require('@babel/register')({
  extensions: ['.ts', '.tsx', '.js'],
  ignore: [/\/node_modules\//],
});

require('./simulateCli.ts').main(process.argv.slice(2));

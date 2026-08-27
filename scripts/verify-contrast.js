#!/usr/bin/env node
/**
 * WL-202 — WCAG 2.1 AA contrast verification for the WordLoop palette.
 *
 * Design System section 9, open item 2 asks for every *actual* text-on-fill
 * pairing to be checked, "not just the ones listed in section 1". That is what
 * this does: it enumerates the pairings the design system really specifies —
 * including the ones section 1 never mentions, like a disabled button's 40%
 * fill and the border-colour state changes in section 5 — recomputes each from
 * `src/theme/palette.ts`, and regenerates the committed matrix.
 *
 * Two things it checks beyond raw ratios:
 *
 *   1. `TEXT_ON` in palette.ts is *derived* here from the measured ratios and
 *      compared against what that file declares. The table is the thing
 *      component code reads, so an incorrect table is a shipped bug; deriving
 *      it means the hexes and the rules cannot disagree.
 *   2. Non-text contrast (WCAG 1.4.11, 3:1) for borders and state indicators.
 *      A focus ring or an error border that is invisible against its
 *      background fails AA just as a low-contrast label does, and the design
 *      system changes border *colour* to signal three separate states.
 *
 * Usage:
 *   npm run contrast:verify           regenerate the matrix, fail on any miss
 *   npm run contrast:verify -- --check   verify only, fail if the file is stale (CI)
 *
 * Registered through the project's own babel.config.js so `@theme/*` resolves
 * exactly as it does for Metro and Jest — same reasoning as scripts/simulate.js.
 */
require('@babel/register')({
  extensions: ['.ts', '.tsx', '.js'],
  ignore: [/\/node_modules\//],
});

const fs = require('node:fs');
const path = require('node:path');

const { palette, TEXT_ON, disabledFill } = require('../src/theme/palette.ts');

const ROOT = path.resolve(__dirname, '..');
const MATRIX_PATH = path.join(ROOT, 'proj-docs', 'WordLoop_Contrast_Matrix.md');

const bold = s => `\x1b[1m${s}\x1b[0m`;
const red = s => `\x1b[31m${s}\x1b[0m`;
const green = s => `\x1b[32m${s}\x1b[0m`;
const yellow = s => `\x1b[33m${s}\x1b[0m`;
const dim = s => `\x1b[2m${s}\x1b[0m`;

// --- WCAG 2.1 contrast math -------------------------------------------------

const toRgb = hex => {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
};

/** WCAG 2.1 relative luminance (sRGB). */
const luminance = hex => {
  const [r, g, b] = toRgb(hex).map(c => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const round = n => Math.round(n * 100) / 100;

// --- What counts as "large text" -------------------------------------------
//
// WCAG defines large scale as >=18pt, or >=14pt bold, and anchors that to CSS
// where 1pt = 1.333px — i.e. 24px, or 18.66px bold.
//
// React Native's `fontSize` is neither CSS px nor unambiguously typographic
// points: on iOS it maps to UIFont pointSize, on Android to sp. Read as
// points, a 15px *bold* button label would clear the 14pt-bold bar and only
// need 3:1. This script deliberately takes the STRICTER reading and treats
// every number in the section 2 type scale as CSS px, so 15px bold is normal
// text at 4.5:1. If a pairing passes here it passes under either reading;
// the reverse would not be true, and the type scale is not worth relitigating
// to win back a few tenths of a ratio.
const LARGE_PX = 24;
const threshold = sizePx => (sizePx >= LARGE_PX ? 3 : 4.5);

// Roles from Design System section 2, with the component context each is used in.
const ROLES = {
  requiredLetter: { px: 64, label: 'Required letter (64px display)' },
  wordmark: { px: 40, label: 'Wordmark / hero (40px display)' },
  screenTitle: { px: 28, label: 'Screen title (28px display)' },
  chainWord: { px: 26, label: 'Computer/player word (26px display)' },
  body: { px: 15, label: 'Body / instructions (15px mono)' },
  button: { px: 15, label: 'Button label (15px mono bold)' },
  caption: { px: 12, label: 'Caption / metadata (12px mono)' },
};

// --- The pairings the design system actually specifies ----------------------
//
// Sourced line by line from the Design System doc; the `where` column is the
// section that puts this combination on screen.
// The disabled fills come from `palette.ts` rather than being recomputed here.
// WL-203 found the reason the hard way: this script used to composite its own
// private copy, so it verified a colour that existed nowhere in the app, and
// the token layer reached for a container `opacity` instead — which fades the
// border and the label too, landing nowhere near the 9.30:1 measured below.
// Measuring the exported value is what keeps "verified" and "shipped" the same
// thing.
const FILLS = {
  ...palette,
  disabledGrape: disabledFill.grape,
  disabledTangerine: disabledFill.tangerine,
};

// `probe: true` marks a combination the design system does NOT prescribe, tested
// to establish which of `ink`/`paper` is *mandatory* on that fill. Section 1
// says text is only ever ink or paper but never says which, per fill — so a
// probe that fails is not a defect, it is the rule earning its teeth. Probes are
// reported as REJECTED and do not fail the run; prescribed pairings must pass.
const TEXT_PAIRINGS = [
  ['paper', 'ink', 'body', 'Base screen copy, instructions (§1)'],
  ['paper', 'ink', 'caption', 'Score labels, timestamps (§2)'],
  ['paper', 'ink', 'button', 'Secondary button label (§4)'],
  ['paper', 'ink', 'chainWord', 'Word chain history (§4 Cards)'],
  ['paper', 'ink', 'screenTitle', 'Screen titles (§2)'],
  ['paper', 'ink', 'wordmark', 'Home / Welcome wordmark (§2)'],
  ['ink', 'paper', 'body', 'Inverted surfaces (§1)'],
  ['grape', 'paper', 'button', 'Primary CTA label (§4 Buttons)'],
  ['grape', 'ink', 'button', 'Primary CTA label, ink variant (§4)', true],
  ['grape', 'paper', 'screenTitle', 'Level-up modal headline (§5)'],
  ['grape', 'ink', 'screenTitle', 'Level-up modal headline, ink variant (§5)', true],
  ['tangerine', 'ink', 'button', 'Primary CTA, tangerine fill (§4)'],
  ['tangerine', 'ink', 'caption', 'Streak counter numerals (§5)'],
  ['tangerine', 'paper', 'caption', 'Streak counter, paper variant (§5)', true],
  ['bubblegum', 'ink', 'requiredLetter', 'Required-letter callout (§6)'],
  ['bubblegum', 'paper', 'requiredLetter', 'Required-letter callout, paper variant (§6)', true],
  ['bubblegum', 'ink', 'body', 'Hint sheet copy (§4 Modals)'],
  ['bubblegum', 'ink', 'caption', 'Sticker / badge label (§4 Badges)'],
  ['limeade', 'ink', 'caption', 'Valid-move / win state label (§5)'],
  ['limeade', 'paper', 'caption', 'Valid-move label, paper variant (§5)', true],
  ['redAlert', 'ink', 'body', 'Invalid-word message (§4 Input fields)'],
  ['redAlert', 'paper', 'body', 'Invalid-word message, paper variant (§4)', true],
  ['sunbeam', 'ink', 'caption', 'Badge / sticker fill (§4 Badges)'],
  ['sunbeam', 'paper', 'caption', 'Badge fill, paper variant (§4)', true],
  ['disabledGrape', 'paper', 'button', 'Disabled primary button label (§4)'],
  ['disabledGrape', 'ink', 'button', 'Disabled primary button, ink label (§4)'],
  ['disabledTangerine', 'ink', 'button', 'Disabled tangerine button, ink label (§4)'],
];

// WCAG 1.4.11 Non-text Contrast: 3:1 for UI component boundaries and for
// graphical objects needed to understand content.
const NONTEXT_PAIRINGS = [
  ['ink', 'paper', 'Default component border against the page (§4)'],
  ['grape', 'paper', 'Input FOCUS border — hard a11y requirement (§4 Input fields)'],
  ['redAlert', 'paper', 'Input ERROR border + error icon (§4 Input fields)'],
  ['limeade', 'paper', 'Input VALID-move fill flash, inside ink border (§5)'],
  ['sunbeam', 'paper', 'Badge fill against page, unbordered (§4 Badges)'],
  ['tangerine', 'paper', 'Streak badge fill against page, unbordered (§5)'],
  ['bubblegum', 'paper', 'Callout fill against page, unbordered (§6)'],
];

// Non-text pairings that are permitted to fail *because* the design system
// guarantees an `ink` border between the two colours, which supplies the
// boundary contrast on its own (§1 pairing rules, §4 construction).
//
// `limeade-paper` is on this list only as of WL-202. Section 5 previously
// flashed the input *border* to limeade, which put this pairing on the
// boundary itself at 1.38:1 — a real 1.4.11 failure, since the field lost its
// outline exactly when confirming success. Section 5 now flashes the fill and
// keeps the ink border, which is what moves this row here.
const BORDER_RESCUED = new Set([
  'sunbeam-paper',
  'tangerine-paper',
  'bubblegum-paper',
  'limeade-paper',
]);

// --- Run --------------------------------------------------------------------

const failures = [];
const warnings = [];

const textRows = TEXT_PAIRINGS.map(([fill, text, role, where, probe = false]) => {
  const ratio = contrast(FILLS[fill], palette[text]);
  const { px, label } = ROLES[role];
  const min = threshold(px);
  const pass = ratio >= min;

  // WCAG 1.4.3 exempts text in an *inactive* control from contrast minimums.
  // Reported, never fatal — but see the note in the generated matrix: the
  // Submit button is disabled at the start of every single turn, so this is
  // one of the most-seen states in the app, not a rare edge.
  const exempt = fill.startsWith('disabled');

  if (!pass && !exempt && !probe) {
    failures.push({ fill, text, label, ratio, min, where });
  } else if (!pass && exempt) {
    warnings.push({ fill, text, label, ratio, min, where });
  }
  return { fill, text, role, label, where, ratio, min, pass, exempt, probe };
});

const nonTextRows = NONTEXT_PAIRINGS.map(([a, b, where]) => {
  const ratio = contrast(palette[a], palette[b]);
  const pass = ratio >= 3;
  const rescued = BORDER_RESCUED.has(`${a}-${b}`);
  if (!pass && !rescued) {
    failures.push({ fill: a, text: b, label: 'Non-text (1.4.11)', ratio, min: 3, where });
  }
  return { a, b, where, ratio, pass, rescued };
});

// Derive TEXT_ON from measurement and compare against what palette.ts declares.
const derived = {};
for (const fill of Object.keys(FILLS)) {
  derived[fill] = { normal: [], large: [] };
  for (const text of ['ink', 'paper']) {
    const ratio = contrast(FILLS[fill], palette[text]);
    if (fill === text) continue;
    if (ratio >= 4.5) derived[fill].normal.push(text);
    if (ratio >= 3) derived[fill].large.push(text);
  }
}

const tableMismatches = [];
for (const fill of Object.keys(derived)) {
  for (const size of ['normal', 'large']) {
    const want = [...derived[fill][size]].sort().join(',');
    const got = [...(TEXT_ON[fill]?.[size] ?? [])].sort().join(',');
    if (want !== got) {
      tableMismatches.push({ fill, size, want: want || '(none)', got: got || '(none)' });
    }
  }
}

// --- Report -----------------------------------------------------------------

console.log(bold('\nWL-202 · WCAG 2.1 AA contrast verification\n'));

console.log(bold('Text on fill'));
for (const r of textRows) {
  const mark = r.pass
    ? green('PASS  ')
    : r.exempt
      ? yellow('EXEMPT')
      : r.probe
        ? dim('REJECT')
        : red('FAIL  ');
  const ratio = `${round(r.ratio).toFixed(2)}:1`.padStart(7);
  console.log(
    `  ${mark}  ${ratio} (min ${r.min})  ${r.text} on ${r.fill}  ${dim(r.label)}`,
  );
}

console.log(bold('\nNon-text contrast (WCAG 1.4.11, 3:1)'));
for (const r of nonTextRows) {
  const mark = r.pass ? green('PASS') : r.rescued ? yellow('BORDER') : red('FAIL');
  const ratio = `${round(r.ratio).toFixed(2)}:1`.padStart(7);
  console.log(`  ${mark}  ${ratio}  ${r.a} vs ${r.b}  ${dim(r.where)}`);
}

if (tableMismatches.length) {
  console.log(red(bold('\nTEXT_ON in palette.ts disagrees with the measured ratios:')));
  for (const m of tableMismatches) {
    console.log(`  ${m.fill}.${m.size}: declares [${m.got}], measurement says [${m.want}]`);
  }
}

// --- Matrix file ------------------------------------------------------------

const fmt = n => `${round(n).toFixed(2)}:1`;

const matrix = `# WordLoop Contrast Matrix

**Generated by \`npm run contrast:verify\` — do not edit by hand.**
Source of truth for the hex values is \`src/theme/palette.ts\`; this file is
regenerated from it. Task: WL-202. Standard: WCAG 2.1 AA.

Thresholds: **4.5:1** for normal text, **3:1** for large text (>=24px) and for
non-text UI boundaries (1.4.11).

> **On "large text":** WCAG anchors large scale to 18pt / 14pt-bold, i.e. 24px /
> 18.66px-bold in CSS. React Native's \`fontSize\` is not unambiguously CSS px —
> read as points, the 15px bold button label would clear the 14pt-bold bar and
> need only 3:1. This matrix takes the **stricter** reading and treats every
> number in the Design System section 2 type scale as CSS px. Anything passing
> here passes under either reading.

## Text on fill

Rows marked **REJECTED** are combinations the design system does not prescribe,
tested here to settle which text colour is *mandatory* on that fill. Section 1
says text is only ever \`ink\` or \`paper\`, but never says which one goes on which
accent — these rows are how that gap gets closed. A rejected row is the rule
earning its teeth, not a defect.

| Result | Ratio | Min | Text | Fill | Role | Where |
|---|---|---|---|---|---|---|
${textRows
  .map(
    r =>
      `| ${r.pass ? 'PASS' : r.exempt ? 'EXEMPT' : r.probe ? 'REJECTED' : '**FAIL**'} | ${fmt(r.ratio)} | ${r.min}:1 | \`${r.text}\` | \`${r.fill}\` | ${r.label} | ${r.where} |`,
  )
  .join('\n')}

## Non-text contrast (WCAG 1.4.11)

Borders, focus rings, and state indicators. A boundary that vanishes against
its background fails AA just as a low-contrast label does.

| Result | Ratio | Pair | Where |
|---|---|---|---|
${nonTextRows
  .map(
    r =>
      `| ${r.pass ? 'PASS' : r.rescued ? 'N/A — ink border' : '**FAIL**'} | ${fmt(r.ratio)} | \`${r.a}\` vs \`${r.b}\` | ${r.where} |`,
  )
  .join('\n')}

Rows marked *N/A — ink border* are fills that would be too close to \`paper\` to
form a boundary on their own, but never appear without the 2-4px \`ink\` border
the component language mandates (Design System sections 1 and 4). The border
supplies the boundary contrast. **This is the "always an ink outline" rule doing
real accessibility work, not just carrying the aesthetic** — dropping it on a
badge or callout for visual reasons would create a genuine AA failure.

## Legal text colours per fill

Derived from the measurements above, and asserted against \`TEXT_ON\` in
\`src/theme/palette.ts\` — the table component code reads. If they disagree, this
script fails.

| Fill | Normal text (>=4.5:1) | Large text (>=3:1) |
|---|---|---|
${Object.keys(derived)
  .map(
    f =>
      `| \`${f}\` | ${derived[f].normal.map(t => `\`${t}\``).join(', ') || '—'} | ${derived[f].large.map(t => `\`${t}\``).join(', ') || '—'} |`,
  )
  .join('\n')}

## Disabled controls

WCAG 1.4.3 exempts text in an *inactive* user interface component from contrast
minimums, so the \`disabled*\` rows above are reported as EXEMPT rather than
failing. That exemption is a poor fit here: Wireframe section 8 disables Submit
whenever the input is empty, which is the state every single turn *opens* in, so
the disabled button is among the most-viewed elements in the product. Keeping a
\`paper\` label on a 40%-opacity fill would render it at roughly 1.9:1 — legal,
and effectively unreadable. \`TEXT_ON.disabledGrape\` therefore permits \`ink\` only.
`;

const stale = !fs.existsSync(MATRIX_PATH) || fs.readFileSync(MATRIX_PATH, 'utf8') !== matrix;
const checkOnly = process.argv.includes('--check');

if (checkOnly) {
  if (stale) {
    console.log(
      red(bold('\nMatrix file is stale.')) + ' Run `npm run contrast:verify` and commit.',
    );
  }
} else if (stale) {
  fs.writeFileSync(MATRIX_PATH, matrix);
  console.log(dim(`\nWrote ${path.relative(ROOT, MATRIX_PATH)}`));
} else {
  console.log(dim(`\n${path.relative(ROOT, MATRIX_PATH)} up to date`));
}

const bad = failures.length + tableMismatches.length + (checkOnly && stale ? 1 : 0);

if (failures.length) {
  console.log(red(bold(`\n${failures.length} contrast failure(s):`)));
  for (const f of failures) {
    console.log(
      `  ${f.text} on ${f.fill} — ${fmt(f.ratio)}, needs ${f.min}:1  ${dim(f.where)}`,
    );
  }
}
if (warnings.length) {
  console.log(
    yellow(`\n${warnings.length} exempt-but-poor pairing(s) — see the matrix's disabled note.`),
  );
}

console.log(bad ? red(bold('\nFAILED\n')) : green(bold('\nAll pairings pass.\n')));
process.exit(bad ? 1 : 0);

#!/usr/bin/env node
/**
 * WL-407 — attribution notice integrity.
 *
 * The notices shipped in Settings → Attributions are licence obligations, and
 * their source of truth lives outside the app: the ESDB and WordNet text in
 * `WordLoop_Word_List_Licence_Review.md` section 7 (the text WL-101
 * established as "required attribution text, to ship"), and the SIL OFL 1.1
 * body in `licenses/fonts/`. Nothing stops a well-meaning edit to
 * `src/constants/attributions.ts` from paraphrasing a notice into something
 * that no longer satisfies the licence, and nothing about that failure is
 * visible on screen.
 *
 * So this re-reads the sources and compares. It is a script rather than a
 * Jest test for the same reason `verify-fonts` and `verify-contrast` are:
 * this reads repository files that the app itself never sees, and the
 * TypeScript project has no Node types — the check belongs beside the other
 * artifact verifiers, gated in CI.
 *
 * Run: `npm run attributions:verify`
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = relativePath => readFileSync(join(repoRoot, relativePath), 'utf8');

const failures = [];
const check = (label, condition) => {
  if (!condition) failures.push(label);
};

// --- Sources -----------------------------------------------------------------

const licenceReview = read('proj-docs/WordLoop_Word_List_Licence_Review.md');
const oflText = read('licenses/fonts/Baloo2-OFL.txt').replace(/^﻿/, '');
const jetBrainsOfl = read('licenses/fonts/JetBrainsMono-OFL.txt').replace(/^﻿/, '');
const shipped = read('src/constants/attributions.ts');

/** The two verbatim notices the review publishes in section 7. */
const requiredNotices = [
  ...licenceReview
    .split('## 7. Required attribution text')[1]
    .split('\n## 8.')[0]
    .matchAll(/```text\n([\s\S]*?)```/g),
].map(match => match[1].trimEnd());

check(
  `licence review section 7 should publish 2 notices, found ${requiredNotices.length}`,
  requiredNotices.length === 2,
);

// --- The notices themselves --------------------------------------------------

const [esdb, wordnet] = requiredNotices;

check('ESDB notice is missing or altered', shipped.includes(esdb));
check('WordNet notice is missing or altered', shipped.includes(wordnet));

// OFL 1.1 requires the licence text to travel with the software. Compare the
// body from the divider onward — the part both font files share verbatim.
const DIVIDER = '-----------------------------------------------------------';
const oflBody = oflText.slice(oflText.indexOf(DIVIDER)).trimEnd();
check('SIL OFL 1.1 body is missing or altered', shipped.includes(oflBody));

// Both fonts ship the same licence body; if that ever stops being true, the
// single shared entry in the app is no longer honest.
check(
  'the two bundled OFL files no longer share one licence body — the app ships them as one notice',
  jetBrainsOfl.slice(jetBrainsOfl.indexOf(DIVIDER)).trimEnd() === oflBody,
);

for (const holder of [
  'Copyright 2019 The Baloo 2 Project Authors',
  'Copyright 2020 The JetBrains Mono Project Authors',
]) {
  check(`font copyright line missing: ${holder}`, shipped.includes(holder));
}

// WL-501 bundles the WordNet 3.1 database itself for definitions, and that
// licence requires its notice on "ALL copies of the software, database and
// documentation". This is a stricter check than the WordNet entry above: that
// one is ESDB's abbreviated 1.6 excerpt carried as insurance, while this is
// the full 3.1 text for data the app actually ships, saved verbatim from the
// header WordNet carries inside its own data files.
const wordnet31 = read('licenses/wordnet/WordNet-3.1-LICENSE.txt').trimEnd();
check('WordNet 3.1 database licence is missing or altered', shipped.includes(wordnet31));
check(
  'WordNet 3.1 copyright line missing — the app would ship the 3.1 database under the 1.6 notice',
  shipped.includes('WordNet 3.1 Copyright 2011 by Princeton University.'),
);

// CC-BY-4.0 supplies no notice text; it requires the work, the source, and
// the licence to be named, and modifications to be indicated (WL-104 cut the
// list down by hand).
for (const fragment of [
  'CC BY 4.0',
  'github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words',
  'modified',
]) {
  check(`LDNOOBW attribution is missing: ${fragment}`, shipped.includes(fragment));
}

// --- Result ------------------------------------------------------------------

if (failures.length > 0) {
  console.error('FAIL  attribution notices have drifted from their sources:\n');
  failures.forEach(failure => console.error(`  - ${failure}`));
  console.error(
    '\nThese are licence obligations. Re-copy from the source rather than editing the app copy.',
  );
  process.exit(1);
}

console.log('PASS  all attribution notices match their sources');

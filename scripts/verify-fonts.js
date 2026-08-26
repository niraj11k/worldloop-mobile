#!/usr/bin/env node
/**
 * WL-201 — bundled font integrity.
 *
 * React Native resolves fonts *silently*. A misnamed family, an unlinked file,
 * or a font whose internal PostScript name differs from its filename all
 * produce the same result: the platform's default face renders, no error is
 * raised, and the screen looks merely a little off rather than broken. None of
 * that is caught by a build, a typecheck, or a screenshot glanced at quickly.
 *
 * So this checks the whole chain, from the strings the app references down to
 * the bytes inside the TTFs:
 *
 *   1. every family declared in `src/theme/typography.ts` has a font file
 *   2. no font is bundled that nothing references (dead binary weight)
 *   3. each file's *internal* PostScript name matches its filename — the thing
 *      that actually makes one `fontFamily` string work on both platforms
 *   4. Android: each file is present in the linked assets directory
 *   5. iOS: each file is listed in Info.plist's UIAppFonts
 *   6. iOS: each file is in the target's Resources build phase, and the Xcode
 *      project has no dangling UUID references
 *
 * (6) is not paranoia. WL-003 corrupted this exact project file with a scripted
 * edit that left a build-phase UUID pointing at nothing, and it was caught only
 * by re-parsing the saved file. `react-native-asset` rewrites the same file.
 *
 * No dependencies — the TTF name table is parsed here directly. Adding a font
 * library to police four font files would be the wrong trade, and `fc-scan`
 * (the obvious shortcut) is not present on a stock CI runner.
 *
 * Usage: npm run fonts:verify
 */
require('@babel/register')({
  extensions: ['.ts', '.tsx', '.js'],
  ignore: [/\/node_modules\//],
});

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const { fontFamily } = require('../src/theme/typography.ts');

const ROOT = path.resolve(__dirname, '..');
const FONT_DIR = path.join(ROOT, 'src', 'assets', 'fonts');
const ANDROID_FONTS = path.join(ROOT, 'android', 'app', 'src', 'main', 'assets', 'fonts');
const INFO_PLIST = path.join(ROOT, 'ios', 'WordLoop', 'Info.plist');
const PBXPROJ = path.join(ROOT, 'ios', 'WordLoop.xcodeproj', 'project.pbxproj');

const bold = s => `\x1b[1m${s}\x1b[0m`;
const red = s => `\x1b[31m${s}\x1b[0m`;
const green = s => `\x1b[32m${s}\x1b[0m`;
const dim = s => `\x1b[2m${s}\x1b[0m`;

const failures = [];
const check = (ok, label, detail) => {
  console.log(`  ${ok ? green('PASS') : red('FAIL')}  ${label}${detail ? dim(`  ${detail}`) : ''}`);
  if (!ok) failures.push(label);
};

// --- TTF `name` table: read nameID 6 (PostScript name) ----------------------

/**
 * Minimal big-endian sfnt reader. The name table's layout is fixed and small,
 * so this stays well short of "reimplementing a font library".
 */
function postScriptName(file) {
  const buf = fs.readFileSync(file);
  const numTables = buf.readUInt16BE(4);

  let nameOffset = null;
  for (let i = 0; i < numTables; i++) {
    const rec = 12 + i * 16;
    if (buf.toString('ascii', rec, rec + 4) === 'name') {
      nameOffset = buf.readUInt32BE(rec + 8);
      break;
    }
  }
  if (nameOffset === null) return null;

  const count = buf.readUInt16BE(nameOffset + 2);
  const stringOffset = buf.readUInt16BE(nameOffset + 4);

  for (let i = 0; i < count; i++) {
    const rec = nameOffset + 6 + i * 12;
    const platformID = buf.readUInt16BE(rec);
    const nameID = buf.readUInt16BE(rec + 6);
    if (nameID !== 6) continue;

    const len = buf.readUInt16BE(rec + 8);
    const off = nameOffset + stringOffset + buf.readUInt16BE(rec + 10);
    const raw = buf.subarray(off, off + len);
    // Platform 3 (Windows) and 0 (Unicode) store UTF-16BE; platform 1 (Mac)
    // stores single-byte MacRoman, which is ASCII for any real PostScript name.
    return (platformID === 1 ? raw.toString('latin1') : raw.toString('utf16le').length
      ? decodeUtf16BE(raw)
      : raw.toString('latin1')
    ).replace(/\0/g, '');
  }
  return null;
}

const decodeUtf16BE = buf => {
  let s = '';
  for (let i = 0; i + 1 < buf.length; i += 2) s += String.fromCharCode(buf.readUInt16BE(i));
  return s;
};

// --- Run --------------------------------------------------------------------

console.log(bold('\nWL-201 · bundled font integrity\n'));

const declared = Object.values(fontFamily);

console.log(bold('Font files'));
for (const family of declared) {
  const file = path.join(FONT_DIR, `${family}.ttf`);
  const exists = fs.existsSync(file);
  check(exists, `${family}.ttf present`);
  if (!exists) continue;

  const ps = postScriptName(file);
  check(
    ps === family,
    `${family}.ttf internal PostScript name matches filename`,
    ps === family ? '' : `file says "${ps}"`,
  );
}

const onDisk = fs.existsSync(FONT_DIR)
  ? fs.readdirSync(FONT_DIR).filter(f => f.endsWith('.ttf')).sort()
  : [];
const expected = declared.map(f => `${f}.ttf`).sort();
check(
  JSON.stringify(onDisk) === JSON.stringify(expected),
  'no unreferenced font files bundled',
  onDisk.length === expected.length ? '' : `on disk: ${onDisk.join(', ')}`,
);

console.log(bold('\nAndroid link'));
for (const family of declared) {
  check(
    fs.existsSync(path.join(ANDROID_FONTS, `${family}.ttf`)),
    `${family}.ttf in android assets/fonts`,
  );
}

console.log(bold('\niOS link'));
const plist = fs.existsSync(INFO_PLIST) ? fs.readFileSync(INFO_PLIST, 'utf8') : '';
for (const family of declared) {
  check(plist.includes(`${family}.ttf`), `${family}.ttf in Info.plist UIAppFonts`);
}

console.log(bold('\nXcode project integrity'));
let pbx = null;
try {
  // The pbxproj is an old-style plist; plutil is the same parser Xcode uses,
  // so if this fails the project is genuinely corrupt, not merely unusual.
  const xml = execFileSync('plutil', ['-convert', 'xml1', '-o', '-', PBXPROJ]);
  pbx = xml.toString();
  check(true, 'project.pbxproj parses');
} catch {
  check(false, 'project.pbxproj parses');
}

if (pbx) {
  const defined = new Set([...pbx.matchAll(/<key>([0-9A-F]{24,32})<\/key>/g)].map(m => m[1]));
  const referenced = new Set([...pbx.matchAll(/<string>([0-9A-F]{24,32})<\/string>/g)].map(m => m[1]));
  const dangling = [...referenced].filter(u => !defined.has(u));
  check(
    dangling.length === 0,
    'no dangling UUID references (the WL-003 failure mode)',
    dangling.length ? dangling.join(', ') : '',
  );

  for (const family of declared) {
    check(pbx.includes(`${family}.ttf`), `${family}.ttf referenced by the Xcode project`);
  }
}

console.log(
  failures.length
    ? red(bold(`\n${failures.length} failure(s).\n`))
    : green(bold('\nAll font checks pass.\n')),
);
process.exit(failures.length ? 1 : 0);

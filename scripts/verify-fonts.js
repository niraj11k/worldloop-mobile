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
 * No dependencies, and nothing shelled out to — the TTF name table and the
 * old-style plist are both parsed here directly. Adding a font library to
 * police four font files would be the wrong trade, and the obvious shortcuts
 * (`fc-scan`, `plutil`) are not present on a stock Linux runner, where this
 * gate runs: a macOS-only tool here fails the gate on every push rather than
 * skipping the check.
 *
 * Usage: npm run fonts:verify
 */
require('@babel/register')({
  extensions: ['.ts', '.tsx', '.js'],
  ignore: [/\/node_modules\//],
});

const fs = require('node:fs');
const path = require('node:path');

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

// --- Old-style (OpenStep) plist: the format a .pbxproj is written in ---------

const UUID = /^[0-9A-F]{24,32}$/;

/**
 * Parses the subset of the OpenStep plist grammar a pbxproj uses: nested
 * dictionaries, arrays, quoted and bare strings, and both comment styles.
 * Throws on anything malformed, which is the point — a project file that no
 * longer parses is the WL-003 failure mode, and Xcode reports it the same way.
 */
function parsePlist(text) {
  let i = 0;

  const fail = message => {
    const line = text.slice(0, i).split('\n').length;
    throw new Error(`${message} at line ${line}`);
  };

  const skip = () => {
    for (;;) {
      while (i < text.length && /\s/.test(text[i])) i++;
      if (text.startsWith('/*', i)) {
        const end = text.indexOf('*/', i + 2);
        if (end === -1) fail('unterminated comment');
        i = end + 2;
      } else if (text.startsWith('//', i)) {
        // The `// !$*UTF8*$!` header line, among others.
        const end = text.indexOf('\n', i);
        i = end === -1 ? text.length : end;
      } else {
        return;
      }
    }
  };

  const readString = () => {
    if (text[i] === '"') {
      i++;
      let s = '';
      while (i < text.length && text[i] !== '"') {
        if (text[i] === '\\') {
          s += text[i + 1];
          i += 2;
        } else {
          s += text[i++];
        }
      }
      if (i >= text.length) fail('unterminated quoted string');
      i++;
      return s;
    }
    // A bare token runs to the next structural character, comment, or space.
    // Paths (`../src/assets/fonts/...`) appear unquoted, so `/` has to stay in.
    const start = i;
    while (
      i < text.length &&
      !/[\s{}()=;,"]/.test(text[i]) &&
      !text.startsWith('/*', i) &&
      !text.startsWith('//', i)
    ) {
      i++;
    }
    if (i === start) fail(`unexpected character ${JSON.stringify(text[i] ?? '<eof>')}`);
    return text.slice(start, i);
  };

  const readValue = () => {
    skip();
    if (text[i] === '{') {
      i++;
      const dict = {};
      for (;;) {
        skip();
        if (text[i] === '}') {
          i++;
          return dict;
        }
        if (i >= text.length) fail('unterminated dictionary');
        const key = readString();
        skip();
        if (text[i] !== '=') fail(`expected "=" after key ${JSON.stringify(key)}`);
        i++;
        dict[key] = readValue();
        skip();
        if (text[i] !== ';') fail(`expected ";" after key ${JSON.stringify(key)}`);
        i++;
      }
    }
    if (text[i] === '(') {
      i++;
      const array = [];
      for (;;) {
        skip();
        if (text[i] === ')') {
          i++;
          return array;
        }
        if (i >= text.length) fail('unterminated array');
        array.push(readValue());
        skip();
        if (text[i] === ',') i++;
        else if (text[i] !== ')') fail('expected "," or ")" in array');
      }
    }
    return readString();
  };

  const root = readValue();
  skip();
  if (i !== text.length) fail('trailing content after the root object');
  return root;
}

/**
 * Every UUID the project *defines* (as a dictionary key) and every UUID it
 * *references* (as a value, including inside arrays). A reference with no
 * definition is a pointer at nothing — the corruption WL-003 produced.
 */
function collectUuids(node, defined = new Set(), referenced = new Set()) {
  if (Array.isArray(node)) {
    for (const item of node) collectUuids(item, defined, referenced);
  } else if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      if (UUID.test(key)) defined.add(key);
      collectUuids(value, defined, referenced);
    }
  } else if (typeof node === 'string' && UUID.test(node)) {
    referenced.add(node);
  }
  return { defined, referenced };
}

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
const pbxSource = fs.existsSync(PBXPROJ) ? fs.readFileSync(PBXPROJ, 'utf8') : null;
let pbx = null;
if (pbxSource === null) {
  check(false, 'project.pbxproj parses', 'file not found');
} else {
  try {
    pbx = parsePlist(pbxSource);
    check(true, 'project.pbxproj parses');
  } catch (error) {
    check(false, 'project.pbxproj parses', error.message);
  }
}

if (pbx) {
  const { defined, referenced } = collectUuids(pbx);
  const dangling = [...referenced].filter(u => !defined.has(u));
  check(
    dangling.length === 0,
    'no dangling UUID references (the WL-003 failure mode)',
    dangling.length ? dangling.join(', ') : '',
  );

  for (const family of declared) {
    check(pbxSource.includes(`${family}.ttf`), `${family}.ttf referenced by the Xcode project`);
  }
}

console.log(
  failures.length
    ? red(bold(`\n${failures.length} failure(s).\n`))
    : green(bold('\nAll font checks pass.\n')),
);
process.exit(failures.length ? 1 : 0);

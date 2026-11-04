/**
 * File-path-accepting facade over image-size@2, for GHSA-w3rx-r6r6-pgpr and
 * GHSA-5p2g-fcmc-qvqq.
 *
 * Both advisories (DoS via infinite loops in the ICNS, JXL and HEIF parsers)
 * cover image-size <=2.0.2. Metro 0.84 declares `image-size@^1.0.2`, and the
 * 1.x line has no patched release, so `package.json` `overrides` forces the
 * name `image-size` to this package instead.
 *
 * It exists because the override alone breaks bundling. Metro's
 * `getAssetData()` (`metro/src/Assets.js`) calls `imageSize(filePath)` with a
 * *string path* for every image asset outside a `.zip/`, and `getAssetSize()`
 * calls it with a `Buffer`. image-size@1's default export accepted both,
 * reading the file synchronously for a string. image-size@2's `imageSize()`
 * accepts only a `Uint8Array` and moved file input to the async
 * `imageSizeFromFile()`, so with a bare pin the first PNG Metro meets
 * (e.g. @react-navigation/elements' header icons) throws
 * 'The "list" argument must be an instance of ... ArrayBufferView'.
 *
 * This facade restores the string form with image-size@1's exact semantics:
 * open, stat, read at most the first 512 KiB (every supported format keeps
 * its dimensions in the header), and run image-size@2's detector over that.
 * `Uint8Array`/`Buffer` input is passed straight through. `disableTypes` and
 * `types` are re-exported unchanged.
 *
 * image-size@2 is installed under the alias `image-size-upstream` (a root
 * devDependency, `npm:image-size@^2`) rather than as `image-size`, because
 * npm applies overrides by package name: a dependency on `image-size` from in
 * here would resolve to this file again.
 *
 * Remove this facade, the alias and the override once React Native moves to
 * a Metro that depends on `image-size@^2` or not at all (Metro 0.87.1
 * already dropped it).
 */
const fs = require('fs');
const path = require('path');
const upstream = require('image-size-upstream');

// image-size@1 read at most this much of a file before parsing (MaxInputSize).
const MAX_INPUT_SIZE = 512 * 1024;

function readHeadSync(filePath) {
  const fd = fs.openSync(path.resolve(filePath), 'r');
  try {
    const { size } = fs.fstatSync(fd);
    if (size <= 0) {
      throw new Error('Empty file');
    }
    const inputSize = Math.min(size, MAX_INPUT_SIZE);
    const input = new Uint8Array(inputSize);
    fs.readSync(fd, input, 0, inputSize, 0);
    return input;
  } finally {
    fs.closeSync(fd);
  }
}

function imageSize(input) {
  if (input instanceof Uint8Array) {
    return upstream.imageSize(input);
  }
  if (typeof input === 'string') {
    return upstream.imageSize(readHeadSync(input));
  }
  throw new TypeError(
    'image-size-compat: input must be a Uint8Array/Buffer or a file path string',
  );
}

Object.defineProperty(exports, '__esModule', { value: true });
exports.default = imageSize;
exports.imageSize = imageSize;
exports.disableTypes = upstream.disableTypes;
exports.types = upstream.types;

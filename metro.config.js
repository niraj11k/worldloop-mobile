const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Mitigation for GHSA-w3rx-r6r6-pgpr and GHSA-5p2g-fcmc-qvqq.
 *
 * Metro reads image asset dimensions via `image-size`, whose ICNS, JXL and
 * HEIF parsers can be driven into an infinite loop by a malformed file.
 * Every published version of `image-size` (<= 2.0.2) is affected, so there
 * is nothing to upgrade to; see the "Dependency audit state" section in
 * README.md.
 *
 * Metro passes a Buffer, so `image-size` picks a parser from the file's
 * magic bytes and ignores the extension — a hostile ICNS payload named
 * `logo.png` still reaches the ICNS parser and hangs the bundler.
 *
 * Metro only ever asks for dimensions of types on its own allowlist
 * (png, jpg, jpeg, bmp, gif, webp, psd, svg, tiff, ktx — see
 * `metro/src/Assets.js`, `isAssetTypeAnImage`), and none of the three
 * vulnerable formats are on it. Turning those parsers off therefore costs
 * nothing and removes the reachable path: such a payload is now rejected
 * with "disabled file type" instead of looping.
 *
 * `image-size` is required from exactly one module (`metro/src/Assets.js`)
 * and that module is loaded in this process, so we resolve Metro's own
 * copy rather than a hoisted one to be sure we mutate the same instance.
 *
 * Remove this once a patched `image-size` ships and Metro depends on it.
 */
function hardenImageSize() {
  try {
    const imageSize = require(require.resolve('image-size', {
      paths: [require('path').dirname(require.resolve('metro'))],
    }));
    if (typeof imageSize.disableTypes !== 'function') {
      throw new Error('image-size no longer exposes disableTypes()');
    }
    imageSize.disableTypes(['icns', 'jxl', 'jxl-stream', 'heif']);
  } catch (err) {
    // Never fail the build over the mitigation itself — warn loudly instead,
    // so an upstream change surfaces rather than silently dropping cover.
    console.warn(
      '[metro.config] could not harden image-size, see README ' +
        '"Dependency audit state": ' +
        err.message,
    );
  }
}

hardenImageSize();

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 */
const config = {};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);

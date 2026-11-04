const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * Metro reads image asset dimensions through `image-size`. `package.json`
 * `overrides` routes that name to `tooling/image-size`, a facade over
 * the patched image-size@2 (GHSA-w3rx-r6r6-pgpr, GHSA-5p2g-fcmc-qvqq) that
 * keeps the file-path call form Metro uses. See the "Dependency audit state"
 * section of README.md.
 */
const config = {};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);

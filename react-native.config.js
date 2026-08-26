/**
 * React Native CLI configuration.
 *
 * `assets` is consumed by `npx react-native-asset`, which copies the fonts to
 * `android/app/src/main/assets/fonts/` and registers them in the iOS Xcode
 * project's Copy Bundle Resources phase plus `Info.plist`'s `UIAppFonts`.
 *
 * WL-201. The font files are committed; the *linked* copies this generates are
 * committed too, because the alternative is a fresh checkout building without
 * fonts until someone remembers to re-run the linker — the same class of
 * failure the WL-003 note describes for the Firebase config files.
 */
module.exports = {
  project: {
    ios: {},
    android: {},
  },
  assets: ['./src/assets/fonts/'],
};

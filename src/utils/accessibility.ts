import { AccessibilityInfo, Platform } from 'react-native';

/**
 * Speaks a message to the screen reader, for state changes it would otherwise
 * miss (WL-408).
 *
 * Wireframe §18 asks for "accessible error announcements", and the same
 * problem covers any change the player did not cause by focusing something:
 * a rejected word, the computer's turn ending. Sighted players see these;
 * without an announcement a screen-reader user submits a word, hears nothing,
 * and has no way to tell whether anything happened.
 *
 * ## Why this is iOS-only
 *
 * React Native has two mechanisms and they do not overlap:
 * `accessibilityLiveRegion` is **Android-only** — TalkBack watches the node
 * and reads it when its contents change, which is the better behaviour
 * because it follows the text actually on screen. iOS has no equivalent, so
 * VoiceOver stays silent unless something explicitly announces.
 *
 * Calling this on Android as well would produce the announcement *twice*, so
 * callers pair the two: a live region for Android on the node that changes,
 * and this for iOS. Both are needed; neither is sufficient.
 *
 * Never throws — an announcement failing must not take down the turn that
 * triggered it.
 */
export function announceForAccessibility(message: string): void {
  if (Platform.OS !== 'ios' || message.length === 0) return;

  try {
    AccessibilityInfo.announceForAccessibility(message);
  } catch {
    // Deliberately swallowed: this is a courtesy on top of the visible UI.
  }
}

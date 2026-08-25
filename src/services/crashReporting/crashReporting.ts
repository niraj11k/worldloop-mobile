/**
 * Crash and error reporting (WL-003).
 *
 * Provider: Firebase Crashlytics. This module is the seam the SDK plugs into
 * — nothing else in the app imports `@react-native-firebase/*` directly, so
 * the provider stays a one-file decision, the same way `StorageAdapter`
 * keeps the MMKV choice (D-07) cheap to reverse.
 *
 * ## Status: seam only, no provider attached yet
 *
 * The Crashlytics SDK is deliberately NOT installed yet. It requires
 * `android/app/google-services.json` and `ios/WordLoop/GoogleService-Info.plist`,
 * and the google-services Gradle plugin fails the Android build outright when
 * the former is missing — which would also break the native CI jobs added in
 * WL-004. Installing before those files exist would leave `main` unbuildable.
 *
 * Until then `reportError` routes to a no-op in release and to the console in
 * dev, so call sites can be written now and start reporting the moment the
 * real reporter is set. **WL-003 is not complete until a deliberately thrown
 * error appears in the Crashlytics dashboard with a symbolicated stack from a
 * release build.**
 */

/** Contextual key/values attached to a report. Must never carry PII (PRD section 22). */
export type CrashContext = Record<string, string | number | boolean>;

export interface CrashReporter {
  recordError(error: Error, context?: CrashContext): void;
  /** Breadcrumb attached to the next crash, not an error in itself. */
  log(message: string): void;
}

/**
 * Reporting is off in dev so local stack traces stay in the terminal rather
 * than filling a shared dashboard with noise from work-in-progress — the
 * "inert in dev" requirement in WL-003.
 */
export const CRASH_REPORTING_ENABLED = !__DEV__;

const consoleReporter: CrashReporter = {
  recordError(error, context) {
    console.warn('[crash] would report:', error.message, context ?? {});
  },
  log(message) {
    console.warn('[crash] breadcrumb:', message);
  },
};

const noopReporter: CrashReporter = {
  recordError() {},
  log() {},
};

let reporter: CrashReporter = CRASH_REPORTING_ENABLED ? noopReporter : consoleReporter;

/**
 * Installs the real reporter. Called once at startup from the app entry point
 * once the Crashlytics SDK is wired; tests use it to assert reporting without
 * a provider.
 */
export function setCrashReporter(next: CrashReporter): void {
  reporter = next;
}

/**
 * Reports a non-fatal error.
 *
 * Never throws: a failure inside error reporting must not become a second
 * error on a path that is already handling one.
 */
export function reportError(error: unknown, context?: CrashContext): void {
  try {
    reporter.recordError(error instanceof Error ? error : new Error(String(error)), context);
  } catch {
    // Deliberately swallowed — see above.
  }
}

/** Adds a breadcrumb to attach to the next crash. Never throws. */
export function logBreadcrumb(message: string): void {
  try {
    reporter.log(message);
  } catch {
    // Deliberately swallowed — see above.
  }
}

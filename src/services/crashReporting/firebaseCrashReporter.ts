/**
 * Firebase Crashlytics adapter (WL-003).
 *
 * The only file that imports `@react-native-firebase/*`. Everything else in
 * the app goes through `crashReporting.ts`'s `CrashReporter` interface, so
 * swapping providers later touches this file alone.
 */
import { getApp } from '@react-native-firebase/app';
import {
  getCrashlytics,
  log as crashlyticsLog,
  recordError as crashlyticsRecordError,
  setAttribute as crashlyticsSetAttribute,
  setCrashlyticsCollectionEnabled,
  crash as crashlyticsForceCrash,
} from '@react-native-firebase/crashlytics';
import { CRASH_REPORTING_ENABLED, setCrashReporter } from './crashReporting';

const crashlytics = getCrashlytics(getApp());

/**
 * Explicit on/off at the SDK level, not just "we don't call it" from JS —
 * the config-flag requirement should hold even if some other code path in
 * the SDK's own automatic native-crash capture would otherwise report.
 */
setCrashlyticsCollectionEnabled(crashlytics, CRASH_REPORTING_ENABLED);

/**
 * Installs Crashlytics as the app's crash reporter. Call once at startup,
 * before rendering, so early errors are still caught.
 */
export function installFirebaseCrashReporter(): void {
  setCrashReporter({
    recordError(error, context) {
      if (context !== undefined) {
        // Crashlytics reads custom keys off the instance, not per-call, so
        // context has to be set immediately before the error it describes.
        // Fire-and-forget: setAttribute returns a Promise, but recordError
        // must not wait on it — a slow attribute write must not delay or
        // drop the error report it is meant to annotate. The catch is only
        // to stop an attribute-write failure from becoming an unhandled
        // rejection; it deliberately does nothing else.
        for (const [key, value] of Object.entries(context)) {
          crashlyticsSetAttribute(crashlytics, key, String(value)).catch(() => {});
        }
      }
      crashlyticsRecordError(crashlytics, error);
    },
    log(message) {
      crashlyticsLog(crashlytics, message);
    },
  });
}

/**
 * Forces a real native crash for verifying end-to-end delivery.
 *
 * This is WL-003's actual "Done when" check: build a release configuration,
 * call this once, relaunch the app (a crash cannot report itself — Crashlytics
 * sends the previous run's report on next launch), and confirm it appears in
 * the dashboard with a symbolicated stack. Not wired to any UI; call it
 * manually when verifying, then remove the call site.
 */
export function forceCrashForVerification(): void {
  crashlyticsForceCrash(crashlytics);
}

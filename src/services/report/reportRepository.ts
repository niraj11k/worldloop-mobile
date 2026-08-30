/**
 * Word-report persistence (WL-505).
 *
 * The I/O boundary between the pure queue logic in `features/report` and the
 * storage service — it owns the key, the serialization, and nothing else,
 * matching `profileRepository`.
 *
 * Local-only, and that is the whole design under D-03: there is no server to
 * send a report to, so the queue lives here until the player exports it from
 * Settings.
 */
import { storage, STORAGE_KEYS } from '@services/storage/storage';
import { reportError } from '@services/crashReporting/crashReporting';
import { parseReports, serializeReports } from '@features/report/wordReports';
import type { WordReport } from '@app-types/report';

/**
 * The stored queue, or an empty one.
 *
 * A read failure is deliberately indistinguishable from "nothing reported yet"
 * to the caller — both mean there is nothing to show — but it is reported,
 * because a silently unreadable queue looks exactly like a feature nobody uses.
 */
export async function loadWordReports(): Promise<WordReport[]> {
  try {
    return parseReports(await storage.getItem(STORAGE_KEYS.WORD_REPORTS));
  } catch (error) {
    reportError(error, { scope: 'reportRepository.load' });
    return [];
  }
}

export async function saveWordReports(reports: readonly WordReport[]): Promise<void> {
  await storage.setItem(STORAGE_KEYS.WORD_REPORTS, serializeReports(reports));
}

/**
 * Erases the queue.
 *
 * Two callers, deliberately: the player clearing it after an export, and the
 * Guest Deletion doc's "delete my data" path — a report carries free text the
 * player wrote, so it is their data and must go with the rest of it.
 */
export async function clearWordReports(): Promise<void> {
  await storage.removeItem(STORAGE_KEYS.WORD_REPORTS);
}

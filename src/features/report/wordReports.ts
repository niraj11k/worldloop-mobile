/**
 * Word reports (WL-505, PRD §26, Data Model §8).
 *
 * The feedback loop for improving the local dictionary: the player says a word
 * should or should not be playable, and the report is queued on device.
 *
 * ## Why the queue never leaves the device
 *
 * D-03 is closed — v1 ships no backend — so these are stored locally and
 * exported from Settings by the player. A "lightweight endpoint just for this"
 * is exactly the scoped exception the Delivery Plan says is not warranted for
 * one feature: it would need a host, a data store, a privacy-policy disclosure
 * and a moderation path, all before knowing whether anyone reports anything.
 * WL-604's metrics are where that question gets answered.
 *
 * That is not a dead end today. `dictionaryService.setRuntimeExclusions` (WL-104)
 * already accepts overrides on top of the baked flags, which is the hook a
 * future review pass writes back into.
 *
 * Pure module: no storage, no clock of its own. `reportRepository` owns I/O,
 * `useReportStore` owns the in-memory copy, exactly as the profile layer does.
 */
import type { WordReport, WordReportType } from '@app-types/report';

/**
 * The five report types, in the order PRD §26 lists them and the order the
 * sheet shows them. Exported as data rather than restated in the UI so the
 * screen cannot drift from the spec.
 */
export const WORD_REPORT_TYPES: readonly { type: WordReportType; label: string }[] = [
  { type: 'should_be_allowed', label: 'This word should be allowed.' },
  { type: 'should_not_be_allowed', label: 'This word should not be allowed.' },
  { type: 'offensive', label: 'This word is offensive.' },
  { type: 'too_obscure', label: 'This word is too obscure.' },
  { type: 'definition_incorrect', label: 'This definition appears incorrect.' },
];

/**
 * How many reports the queue keeps.
 *
 * Capped for the same reason `localScores` is: this is rewritten in full on
 * every add, and nothing prunes it otherwise. Unlike `discoveredWords` — which
 * is the player's own vocabulary and must never be trimmed — a report is a
 * message to the developers, and 200 unexported ones already means the export
 * path is not being used. Oldest go first, so the newest complaint survives.
 */
export const MAX_RETAINED_REPORTS = 200;

/** The longest free-text comment accepted. */
export const MAX_COMMENT_LENGTH = 500;

export function createWordReport(params: {
  word: string;
  reportType: WordReportType;
  playerComment: string;
  gameId: string | null;
  dictionarySource: string;
  now: Date;
}): WordReport {
  return {
    word: params.word.trim().toLowerCase(),
    // Data Model §8 calls this `game_id`. Null when the report came from
    // Settings rather than from a round — the player can report a word they
    // remember, and inventing a session id for that would make the field lie.
    gameId: params.gameId,
    reportType: params.reportType,
    playerComment: params.playerComment.trim().slice(0, MAX_COMMENT_LENGTH),
    dictionarySource: params.dictionarySource,
    createdAt: params.now.toISOString(),
    // Data Model §8's `review_status`. Always `pending` on device: nothing
    // here can review anything, and the field exists so an exported report
    // carries the same shape a reviewed one will.
    reviewStatus: 'pending',
  };
}

/**
 * Adds a report to the queue, newest first.
 *
 * Deliberately allows duplicates of the same word: two reports of the same
 * word with different types are different information, and even two identical
 * ones are a signal about strength of feeling. Deduplicating would silently
 * discard the player's second attempt and look like the button was broken.
 */
export function addWordReport(
  reports: readonly WordReport[],
  report: WordReport,
): WordReport[] {
  return [report, ...reports].slice(0, MAX_RETAINED_REPORTS);
}

/**
 * The queue as the text the player exports from Settings.
 *
 * JSON rather than prose: the recipient of this is whoever curates
 * `data/excluded-words.txt` and the dictionary pipeline, and they want to
 * paste it into a script, not read it. Pretty-printed because it may well
 * travel through a mail client that does not preserve long lines.
 */
export function serializeReportsForExport(reports: readonly WordReport[]): string {
  return JSON.stringify({ reports }, null, 2);
}

export function serializeReports(reports: readonly WordReport[]): string {
  return JSON.stringify(reports);
}

const REPORT_TYPES = new Set<string>(WORD_REPORT_TYPES.map(entry => entry.type));

/**
 * Reads the stored queue, dropping anything that is not a usable report.
 *
 * Repairs rather than discards, matching `parseProfile`: one malformed entry
 * must not lose the other 199, and a queue that cannot be read at all is an
 * empty queue rather than a crash on the Settings screen.
 */
export function parseReports(raw: string | null): WordReport[] {
  if (raw === null) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  return parsed.filter(isWordReport).slice(0, MAX_RETAINED_REPORTS);
}

function isWordReport(value: unknown): value is WordReport {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.word === 'string' &&
    entry.word.length > 0 &&
    typeof entry.reportType === 'string' &&
    REPORT_TYPES.has(entry.reportType) &&
    typeof entry.createdAt === 'string'
  );
}

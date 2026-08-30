import { create } from 'zustand';

import { addWordReport, createWordReport } from '@features/report/wordReports';
import { dictionarySource } from '@features/dictionary/dictionaryService';
import {
  clearWordReports,
  loadWordReports,
  saveWordReports,
} from '@services/report/reportRepository';
import { reportError } from '@services/crashReporting/crashReporting';
import type { WordReport, WordReportType } from '@app-types/report';

interface ReportState {
  reports: WordReport[];
  loaded: boolean;
  load: () => Promise<void>;
  submit: (params: {
    word: string;
    reportType: WordReportType;
    playerComment?: string;
    gameId?: string | null;
  }) => Promise<void>;
  clear: () => Promise<void>;
}

/**
 * The locally-queued word reports (WL-505).
 *
 * Mirrors `useProfileStore`: the only writer to storage, applying a pure
 * function from `features/report` and persisting the result, so the in-memory
 * copy and the stored one cannot drift.
 *
 * Loaded lazily by whichever screen needs it rather than at launch — reporting
 * a word is rare, and the queue has no bearing on a round. `loaded` exists so
 * Settings can tell "no reports yet" from "not read yet" and avoid offering an
 * export of a queue it has not seen.
 */
export const useReportStore = create<ReportState>((set, get) => ({
  reports: [],
  loaded: false,

  load: async () => {
    set({ reports: await loadWordReports(), loaded: true });
  },

  submit: async ({ word, reportType, playerComment = '', gameId = null }) => {
    // Read through, not around, an unloaded queue: submitting before a load
    // would otherwise write a one-entry array over everything already stored.
    const existing = get().loaded ? get().reports : await loadWordReports();

    const next = addWordReport(
      existing,
      createWordReport({
        word,
        reportType,
        playerComment,
        gameId,
        // Recorded per report rather than assumed at review time: the word
        // list is versioned and regenerated (WL-102), so "was this still
        // rejected under the list they played?" is only answerable if the
        // report says which list that was.
        dictionarySource: `${dictionarySource().name} ${dictionarySource().version}`,
        now: new Date(),
      }),
    );

    set({ reports: next, loaded: true });
    await persist(next);
  },

  clear: async () => {
    set({ reports: [], loaded: true });
    try {
      await clearWordReports();
    } catch (error) {
      reportError(error, { scope: 'useReportStore.clear' });
    }
  },
}));

/**
 * Writes the queue, reporting rather than throwing — the same rule
 * `useProfileStore` follows, for the same reason: every caller is an event
 * handler that can do nothing useful with a rejection, and an unhandled one
 * out of a button press is a crash. Losing a report is a far better outcome
 * than losing the round the player was in the middle of.
 */
async function persist(reports: readonly WordReport[]): Promise<void> {
  try {
    await saveWordReports(reports);
  } catch (error) {
    reportError(error, { scope: 'useReportStore.persist' });
  }
}

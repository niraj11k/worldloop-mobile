import {
  MAX_COMMENT_LENGTH,
  MAX_RETAINED_REPORTS,
  WORD_REPORT_TYPES,
  addWordReport,
  createWordReport,
  parseReports,
  serializeReports,
  serializeReportsForExport,
} from '@features/report/wordReports';
import type { WordReport } from '@app-types/report';

const NOW = new Date('2026-08-30T12:00:00.000Z');

const report = (overrides: Partial<Parameters<typeof createWordReport>[0]> = {}) =>
  createWordReport({
    word: 'eagle',
    reportType: 'should_be_allowed',
    playerComment: '',
    gameId: 'session-1',
    dictionarySource: 'ESDB rel-2026.02.25',
    now: NOW,
    ...overrides,
  });

describe('word reports (PRD §26, Data Model §8)', () => {
  it('offers exactly the five report types PRD §26 lists', () => {
    // Read by the sheet rather than restated there, so this is the one place
    // the list can drift from the spec.
    expect(WORD_REPORT_TYPES.map(entry => entry.type)).toEqual([
      'should_be_allowed',
      'should_not_be_allowed',
      'offensive',
      'too_obscure',
      'definition_incorrect',
    ]);
  });

  it('records every Data Model §8 field', () => {
    expect(report({ playerComment: '  it is a bird  ' })).toEqual({
      word: 'eagle',
      gameId: 'session-1',
      reportType: 'should_be_allowed',
      playerComment: 'it is a bird',
      dictionarySource: 'ESDB rel-2026.02.25',
      createdAt: NOW.toISOString(),
      reviewStatus: 'pending',
    });
  });

  it('normalizes the word the way the rule engine does', () => {
    expect(report({ word: '  EAGLE ' }).word).toBe('eagle');
  });

  it('keeps a null game id for a report made outside a round', () => {
    // The Settings entry point. Inventing a session id here would make the
    // field lie about which round the word came up in.
    expect(report({ gameId: null }).gameId).toBeNull();
  });

  it('caps an over-long comment rather than rejecting it', () => {
    const long = 'x'.repeat(MAX_COMMENT_LENGTH + 50);
    expect(report({ playerComment: long }).playerComment).toHaveLength(MAX_COMMENT_LENGTH);
  });

  describe('the queue', () => {
    it('puts the newest report first', () => {
      const queue = addWordReport(
        addWordReport([], report({ word: 'first' })),
        report({ word: 'second' }),
      );
      expect(queue.map(entry => entry.word)).toEqual(['second', 'first']);
    });

    it('keeps duplicate reports of the same word', () => {
      // Two reports of one word with different types are different
      // information, and two identical ones say something about how strongly
      // the player feels. Deduplicating would look like a broken button.
      const queue = addWordReport(
        addWordReport([], report({ reportType: 'should_be_allowed' })),
        report({ reportType: 'offensive' }),
      );
      expect(queue).toHaveLength(2);
    });

    it('drops the oldest once the cap is reached', () => {
      let queue: WordReport[] = [];
      for (let i = 0; i < MAX_RETAINED_REPORTS + 5; i++) {
        queue = addWordReport(queue, report({ word: `word${i}` }));
      }
      expect(queue).toHaveLength(MAX_RETAINED_REPORTS);
      expect(queue[0]?.word).toBe(`word${MAX_RETAINED_REPORTS + 4}`);
    });
  });

  describe('storage round-trip', () => {
    it('reads back what it wrote', () => {
      const queue = addWordReport([], report());
      expect(parseReports(serializeReports(queue))).toEqual(queue);
    });

    it('returns an empty queue for nothing stored or unreadable junk', () => {
      // A queue that cannot be read must not crash the Settings screen.
      expect(parseReports(null)).toEqual([]);
      expect(parseReports('not json')).toEqual([]);
      expect(parseReports('{"not":"an array"}')).toEqual([]);
    });

    it('drops only the malformed entries, keeping the rest', () => {
      const good = report();
      const raw = JSON.stringify([good, { word: 'x' }, null, { ...good, reportType: 'nope' }]);
      expect(parseReports(raw)).toEqual([good]);
    });
  });

  it('exports as pretty-printed JSON under a reports key', () => {
    // The recipient curates the word list and pastes this into a script; it
    // may also travel through a mail client that mangles long lines.
    const exported = serializeReportsForExport(addWordReport([], report()));
    expect(JSON.parse(exported)).toEqual({ reports: [report()] });
    expect(exported).toContain('\n');
  });
});

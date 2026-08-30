/**
 * Word-report domain types.
 *
 * Mirrors Data Model §8 (`WordReport`) and PRD §26's five report types, with
 * the doc's snake_case fields in this codebase's camelCase — the same
 * translation `profile.ts` already applies to §2/§6/§7.
 *
 * `reviewStatus` is carried even though nothing on device can review anything
 * (D-03: no backend), so an exported report has the same shape as a reviewed
 * one and the field does not have to be invented later.
 */
export type WordReportType =
  | 'should_be_allowed'
  | 'should_not_be_allowed'
  | 'offensive'
  | 'too_obscure'
  | 'definition_incorrect';

export type WordReportStatus = 'pending' | 'reviewed' | 'actioned' | 'rejected';

export interface WordReport {
  word: string;
  /** Data Model §8's `game_id`; null when reported from Settings. */
  gameId: string | null;
  reportType: WordReportType;
  playerComment: string;
  /** Which word list the word was judged against, for reproducibility. */
  dictionarySource: string;
  createdAt: string;
  reviewStatus: WordReportStatus;
}

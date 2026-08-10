import type { InvalidReason } from '@types/game';

/**
 * Local (client-side) rule engine.
 *
 * Per Architecture doc section 5: this is the offline fallback mirror of the
 * server-side rule engine, which remains the authoritative source of truth
 * (Architecture doc section 3). Reconciliation behaviour between this and
 * the server result is an open item — not implemented yet.
 *
 * Validation rules per PRD section 8:
 * - Letter chaining (first letter matches previous word's last letter)
 * - Normalization (trim, lowercase, reject empty/numeric/symbols)
 * - Minimum length: 3 letters
 * - No exact duplicates within a round
 * - No proper nouns (via dictionary classification, not a name blocklist)
 * - Accept valid inflected forms
 * - Respect configurable exclusion list (offensive/inappropriate terms)
 */

const MIN_WORD_LENGTH = 3;
const VALID_WORD_PATTERN = /^[a-z]+$/;

export interface ValidationResult {
  isValid: boolean;
  normalizedWord: string;
  reason: InvalidReason | null;
}

/**
 * Normalizes raw input per PRD section 8.2.
 */
export function normalizeWord(rawInput: string): string {
  return rawInput.trim().toLowerCase();
}

/**
 * Validates a submitted word against the local dictionary and game state.
 *
 * NOTE: This is a structural stub. It does not yet call into the
 * DictionaryService (src/features/dictionary) for word-list lookups or
 * proper-noun / obscurity / exclusion classification — those depend on the
 * bundled SCOWL-based dataset, which is not yet integrated (see Architecture
 * doc section 4, open items).
 */
export function validateMove(params: {
  rawInput: string;
  requiredLetter: string;
  usedWords: Set<string>;
}): ValidationResult {
  const normalizedWord = normalizeWord(params.rawInput);

  if (normalizedWord.length === 0) {
    return { isValid: false, normalizedWord, reason: null }; // empty state, not an error state
  }

  if (!VALID_WORD_PATTERN.test(normalizedWord)) {
    return { isValid: false, normalizedWord, reason: 'unsupported_symbols' };
  }

  if (normalizedWord.length < MIN_WORD_LENGTH) {
    return { isValid: false, normalizedWord, reason: 'too_short' };
  }

  if (normalizedWord[0] !== params.requiredLetter.toLowerCase()) {
    return { isValid: false, normalizedWord, reason: 'wrong_letter' };
  }

  if (params.usedWords.has(normalizedWord)) {
    return { isValid: false, normalizedWord, reason: 'duplicate' };
  }

  // TODO: dictionary lookup (unknown_word), proper-noun check (proper_noun),
  // exclusion list check (offensive_excluded) — depends on DictionaryService.

  return { isValid: true, normalizedWord, reason: null };
}

/**
 * Derives the required letter for the next move from the previous word.
 */
export function getRequiredLetter(previousWord: string): string {
  const normalized = normalizeWord(previousWord);
  return normalized[normalized.length - 1] ?? '';
}

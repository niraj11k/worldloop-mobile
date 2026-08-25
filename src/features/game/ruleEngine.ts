import type { InvalidReason } from '@app-types/game';
import { MIN_WORD_LENGTH } from '@constants/gameConstants';
import {
  lookupWord,
  type DictionaryLookupResult,
  type DictionaryWord,
} from '@features/dictionary/dictionaryService';

/**
 * Local (client-side) rule engine.
 *
 * Per Architecture doc section 5 and Delivery Plan D-03 (closed): this is the
 * sole authoritative validator for v1 — there is no server to defer to, and
 * per Phase 7's scope note that stays true even once an accounts backend
 * exists.
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

const VALID_WORD_PATTERN = /^[a-z]+$/;

export interface ValidationResult {
  isValid: boolean;
  normalizedWord: string;
  reason: InvalidReason | null;
  /**
   * The matched entry, non-null only on a valid word. Carried out of
   * validation so scoring can read the commonness tier (WL-111) from the
   * lookup that already happened, rather than repeating it every turn.
   */
  entry: DictionaryWord | null;
}

/** Injectable so the engine stays unit-testable without a bundled dictionary. */
export type WordLookup = (normalizedWord: string) => Promise<DictionaryLookupResult>;

/**
 * Normalizes raw input per PRD section 8.2.
 */
export function normalizeWord(rawInput: string): string {
  return rawInput.trim().toLowerCase();
}

/**
 * Structural checks — everything decidable without a dictionary.
 *
 * Split out and run first so a typo never costs a dictionary lookup, and so
 * the check ordering is explicit rather than incidental: PRD section 24
 * requires each rejection to explain itself, and a word can fail several
 * rules at once (`to` submitted twice is both too_short and duplicate), so
 * which reason surfaces is a real product decision, not an implementation
 * detail. Cheapest and most-obvious-to-the-player first.
 *
 * Returns null when nothing structural is wrong.
 */
function validateStructure(params: {
  normalizedWord: string;
  requiredLetter: string;
  usedWords: Set<string>;
}): ValidationResult | null {
  const { normalizedWord } = params;

  if (normalizedWord.length === 0) {
    // Empty state, not an error state — Wireframe doc section 9 ("input empty")
    // treats this as a distinct, non-error phase with Submit disabled.
    return { isValid: false, normalizedWord, reason: null, entry: null };
  }

  if (!VALID_WORD_PATTERN.test(normalizedWord)) {
    return { isValid: false, normalizedWord, reason: 'unsupported_symbols', entry: null };
  }

  if (normalizedWord.length < MIN_WORD_LENGTH) {
    return { isValid: false, normalizedWord, reason: 'too_short', entry: null };
  }

  if (normalizedWord[0] !== params.requiredLetter.toLowerCase()) {
    return { isValid: false, normalizedWord, reason: 'wrong_letter', entry: null };
  }

  if (params.usedWords.has(normalizedWord)) {
    return { isValid: false, normalizedWord, reason: 'duplicate', entry: null };
  }

  return null;
}

/**
 * Validates a submitted word against the local dictionary and game state.
 *
 * Async because the dictionary lookup is — Wireframe doc section 9 already
 * anticipates this with its "validating" turn phase.
 */
export async function validateMove(
  params: {
    rawInput: string;
    requiredLetter: string;
    usedWords: Set<string>;
  },
  lookup: WordLookup = lookupWord,
): Promise<ValidationResult> {
  const normalizedWord = normalizeWord(params.rawInput);

  const structuralFailure = validateStructure({
    normalizedWord,
    requiredLetter: params.requiredLetter,
    usedWords: params.usedWords,
  });
  if (structuralFailure !== null) {
    return structuralFailure;
  }

  const { found, entry } = await lookup(normalizedWord);

  if (!found || entry === null) {
    return { isValid: false, normalizedWord, reason: 'unknown_word', entry: null };
  }

  // Offensive before proper-noun: a word classified as both should surface the
  // stronger exclusion, and "cannot be used in WordLoop" reveals less than
  // naming the category (Wireframe doc section 10 — avoid exposing internal
  // dictionary detail).
  if (entry.isOffensive) {
    return { isValid: false, normalizedWord, reason: 'offensive_excluded', entry: null };
  }

  if (entry.isProperNoun) {
    return { isValid: false, normalizedWord, reason: 'proper_noun', entry: null };
  }

  if (!entry.isAllowed) {
    // Disallowed for a reason with no dedicated InvalidReason value. Today
    // isAllowed is derived purely from the two flags above so this is
    // unreachable; it exists so a future pipeline change can't silently
    // make disallowed words playable. unknown_word is the safe fallback —
    // it leaks nothing and the suggested action ("try another word") is
    // still correct.
    return { isValid: false, normalizedWord, reason: 'unknown_word', entry: null };
  }

  // Deliberately NOT rejected here: isObscure. Per PRD section 8.7 the player
  // may submit a wider vocabulary than the computer draws from — obscurity
  // constrains computer selection (isComputerPlayable, used by the difficulty
  // engine), not player submissions.
  return { isValid: true, normalizedWord, reason: null, entry };
}

/**
 * Derives the required letter for the next move from the previous word.
 */
export function getRequiredLetter(previousWord: string): string {
  const normalized = normalizeWord(previousWord);
  return normalized[normalized.length - 1] ?? '';
}

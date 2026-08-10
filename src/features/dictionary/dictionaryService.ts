/**
 * Dictionary service.
 * Per Architecture doc section 4:
 * - Gameplay validation uses a bundled SCOWL-based local word list only.
 * - Commercial dictionary APIs (provider TBD) are used ONLY for optional
 *   definitions/pronunciation and must never block a round if unavailable
 *   (PRD section 12).
 *
 * Open items (Architecture doc section 11):
 * - SCOWL licence review not yet complete.
 * - Bundled word list is not yet integrated into this codebase.
 * - Commercial provider not yet selected.
 */

export interface DictionaryWord {
  word: string;
  normalizedWord: string;
  baseWord: string | null;
  partOfSpeech: string | null;
  isProperNoun: boolean;
  isCommonWord: boolean;
  isObscure: boolean;
  isOffensive: boolean;
  isAllowed: boolean;
  frequencyScore: number;
}

export interface DictionaryLookupResult {
  found: boolean;
  entry: DictionaryWord | null;
}

/**
 * Looks up a normalized word in the local (bundled) dictionary.
 * STUB: always returns not-found until the SCOWL-based dataset is bundled.
 */
export async function lookupWord(_normalizedWord: string): Promise<DictionaryLookupResult> {
  return { found: false, entry: null };
}

export interface DefinitionResult {
  word: string;
  partOfSpeech: string;
  definition: string;
}

/**
 * Fetches an optional definition from the enrichment API.
 * STUB: no provider wired up yet. Must fail gracefully — callers should
 * treat a null result as "definition unavailable, continue playing"
 * (Wireframe doc section 12).
 */
export async function fetchDefinition(_word: string): Promise<DefinitionResult | null> {
  return null;
}

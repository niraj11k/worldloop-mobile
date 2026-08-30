/**
 * Definition lookup (WL-501, closing D-08).
 *
 * D-08 selects no commercial enrichment provider for v1, so definitions come
 * from a bundled asset built by `scripts/generate-definitions.py` out of
 * Princeton WordNet 3.1 — already an attributed dependency, since ESDB uses
 * WordNet for the part-of-speech work that tells a name from an ordinary word
 * (`src/constants/attributions.ts`).
 *
 * ## Coverage is partial on purpose
 *
 * About 70% of playable words resolve. The rest return `null`, which callers
 * must render as Wireframe §12's "Definition unavailable for this word. You
 * can continue playing." — a **first-class outcome, not an error**. PRD §12
 * and Wireframe §12 both forbid a definition blocking a round, so nothing
 * here throws and nothing here is awaited by the turn loop.
 *
 * ## On-device representation
 *
 * Three pieces, mirroring WL-105's approach:
 * - `glosses` — every distinct definition, newline-separated, indexed by an
 *   offset table built in one pass at init.
 * - `partsOfSpeech` — one character per gloss, parallel to it.
 * - `ids` — a fixed-width base-90 id per *dictionary* record, in
 *   `dictionary.pack.json`'s order.
 *
 * Deduplicating by sense matters more than it looks: 98,963 covered words
 * share only 43,667 distinct glosses, because every inflected form resolves
 * to its lemma's sense. Storing the text per word instead would roughly
 * double the asset.
 *
 * Aligning to the dictionary's record order — rather than shipping a second
 * copy of the word list — saves ~0.9MB but couples the two assets. That
 * coupling is checked rather than assumed: see `verifyAlignment`.
 */
import packedAsset from '@assets/dictionary/definitions.pack.json';
import { MIN_WORD_LENGTH } from '@constants/gameConstants';

import {
  computerPlayableEntriesStartingWith,
  dictionarySize,
  isAllowedWord,
  recordIndexOf,
  wordAtRecord,
} from './dictionaryService';

export interface DefinitionResult {
  word: string;
  partOfSpeech: string;
  definition: string;
}

/** WordNet's four open classes, as the overlay shows them (Wireframe §12). */
const PART_OF_SPEECH_LABELS: Record<string, string> = {
  n: 'Noun',
  v: 'Verb',
  a: 'Adjective',
  r: 'Adverb',
};

const GLOSS_SEPARATOR = '\n';

// Must stay in step with `ID_ALPHABET` / `ID_WIDTH` in
// scripts/generate-definitions.py. __tests__/definitionService.test.ts pins
// this side against real bundled words so the two cannot drift silently.
const ID_ALPHABET_START = 35; // '#'
const ID_ALPHABET_SKIPPED = 92; // '\', omitted so JSON never escapes an id
const ID_BASE = 90;
const ID_WIDTH = 3;

interface DefinitionIndex {
  glosses: string;
  /** Start offset of each gloss, ascending. */
  offsets: Int32Array;
  partsOfSpeech: string;
  ids: string;
  count: number;
}

/**
 * `null` until `initDefinitions` runs; `false` once it has run and decided the
 * asset cannot be trusted. The two are distinguished so a failed verification
 * is not retried on every lookup.
 */
let index: DefinitionIndex | null | false = null;

/**
 * Confirms the definitions asset still lines up with the dictionary it was
 * generated against.
 *
 * The failure this guards is silent and total: regenerate
 * `dictionary.pack.json` without regenerating this file and every gloss after
 * the first inserted word shifts onto the wrong word — the app would
 * confidently define "eagle" as something else. A word-count check alone
 * misses it, since a list can change without changing length, so the pack
 * carries (position, word) probes spread across the alphabet.
 */
function verifyAlignment(): boolean {
  if (dictionarySize() !== packedAsset.dictionaryWordCount) {
    return false;
  }
  for (const probe of packedAsset.dictionaryProbes) {
    const [at, word] = probe as [number, string];
    if (wordAtRecord(at) !== word) {
      return false;
    }
  }
  return true;
}

function buildIndex(): DefinitionIndex | false {
  if (!verifyAlignment()) {
    return false;
  }

  const { glosses, partsOfSpeech, ids, glossCount } = packedAsset;
  const offsets = new Int32Array(glossCount);
  let pos = 0;
  for (let i = 0; i < glossCount; i++) {
    offsets[i] = pos;
    pos = glosses.indexOf(GLOSS_SEPARATOR, pos) + 1;
  }

  return { glosses, offsets, partsOfSpeech, ids, count: glossCount };
}

/**
 * Builds the gloss offset table. Idempotent, and safe to skip —
 * `lookupDefinition` calls it on demand — but worth calling alongside
 * `initDictionary` so the cost lands before the first turn rather than inside
 * one.
 */
export function initDefinitions(): void {
  if (index === null) {
    index = buildIndex();
  }
}

/**
 * Whether the bundled source is usable at all.
 *
 * False only when the asset failed its alignment check — the "disable the
 * source" path WL-501's acceptance criterion asks to verify, and the switch
 * WL-506 renders its dictionary-unavailable notice from.
 */
export function isDefinitionSourceAvailable(): boolean {
  initDefinitions();
  return index !== false;
}

function decodeId(idx: DefinitionIndex, record: number): number {
  const start = record * ID_WIDTH;
  let value = 0;
  for (let i = 0; i < ID_WIDTH; i++) {
    const code = idx.ids.charCodeAt(start + i);
    // The alphabet is printable ASCII with one character removed, so decoding
    // is the encode step in reverse: shift down to zero, then close the gap.
    const digit = code - ID_ALPHABET_START - (code > ID_ALPHABET_SKIPPED ? 1 : 0);
    value = value * ID_BASE + digit;
  }
  return value;
}

function glossAt(idx: DefinitionIndex, i: number): string {
  const start = idx.offsets[i] ?? 0;
  const end = i + 1 < idx.count ? (idx.offsets[i + 1] ?? 0) - 1 : idx.glosses.length;
  return idx.glosses.slice(start, end);
}

/**
 * The definition of `word`, or `null` when there is none.
 *
 * `null` covers every miss identically — word not in the dictionary, no
 * WordNet sense for it, or the asset failed verification. Callers show the
 * same unavailable state for all three (Wireframe §12), and distinguishing
 * them would invite a caller to treat one as an error.
 *
 * Synchronous: the data is bundled, so there is nothing to await, and an
 * async signature would imply a latency the overlay does not have. The
 * async `fetchDefinition` wrapper below is kept for the enrichment-API seam
 * Architecture §4 describes.
 */
export function lookupDefinition(word: string): DefinitionResult | null {
  initDefinitions();
  if (index === false || index === null) {
    return null;
  }
  const idx = index;

  const normalizedWord = word.trim().toLowerCase();
  const record = recordIndexOf(normalizedWord);
  if (record === -1) {
    return null;
  }

  // 0 means "no gloss for this record"; stored ids are 1-based.
  const id = decodeId(idx, record);
  if (id <= 0 || id > idx.count) {
    return null;
  }

  const definition = glossAt(idx, id - 1);
  if (definition.length === 0) {
    return null;
  }

  return {
    word: normalizedWord,
    partOfSpeech: PART_OF_SPEECH_LABELS[idx.partsOfSpeech.charAt(id - 1)] ?? '',
    definition,
  };
}

/**
 * How many candidates `definitionClueForHint` will look at before giving up.
 *
 * The scan is a decode plus a binary search per candidate and runs when the
 * player opens the hint sheet — not inside the computer's turn, so WL-106's
 * 50ms budget does not apply — but the worst letter offers ~10,000 candidates
 * and walking all of them to find a clue that is no better than the 20th is
 * work nobody asked for.
 */
const CLUE_CANDIDATE_LIMIT = 60;

/**
 * The shortest prefix a definition may not contain (see `leaksClue`).
 */
const STEM_LENGTH = 5;

/**
 * Whether `definition` gives away a word the player could play right now.
 *
 * Two separate leaks, both real and found the hard way:
 *
 * 1. **Its own word, including inflections.** WordNet glosses an inflected
 *    form's lemma, so a candidate can be described in terms of itself. A plain
 *    substring test misses that (`runs` does not appear in "the act of
 *    running"), so a leading stem is compared instead.
 * 2. **Any *other* playable word starting with the required letter.** This is
 *    the one a per-candidate check cannot see: words share synsets, so the
 *    clue chosen for `w` was `wadded`'s gloss — "compress into a wad" — which
 *    passes every test about `wadded` and hands the player `wad`, a perfectly
 *    playable word, in plain text. The clue is checked as a whole against what
 *    the player could submit, not against the one candidate that produced it.
 *
 * Tokenising and testing membership costs a binary search per word starting
 * with the letter, of which a one-line gloss has at most a couple.
 * Over-rejecting is free — there is always another candidate — while
 * under-rejecting spends the player's hint on the answer.
 */
function leaksClue(definition: string, word: string, letter: string): boolean {
  const haystack = definition.toLowerCase();
  if (haystack.includes(word) || haystack.includes(word.slice(0, STEM_LENGTH))) {
    return true;
  }

  const target = letter.toLowerCase();
  return haystack
    .split(/[^a-z]+/)
    .some(token => token.startsWith(target) && isAllowedWord(token));
}

/**
 * Hint level 4 (WL-504): what *some* playable word means, without saying which
 * (Wireframe §11, PRD §13 "a definition without revealing the word").
 *
 * The word is deliberately not returned — not even privately — so no caller
 * can render it by accident. `excludeWord` takes level 3's example, because a
 * clue describing the word already printed two lines above is not a fourth
 * level of help.
 *
 * **Excluding that word is not enough, and this was caught on a device.** For
 * `r` the sheet showed "Example: RABBI" and then clued "spiritual leader of a
 * Jewish congregation…" — the gloss of a *synonym* of rabbi (WordNet puts
 * `rabbi`, `rabbin` and `rabboni` in one synset, so they share a definition
 * verbatim). Excluding the word let its synonym through carrying the identical
 * meaning, and level 4 collapsed into a restatement of level 3. So the
 * example's *definition* is excluded too, which is what "a different word"
 * actually means when words share senses.
 *
 * Returns `null` when the letter has no usable candidate: none left unused,
 * none with a bundled gloss, or every gloss gives its own word away. The sheet
 * omits the line in that case, exactly as it already does for level 3.
 */
export function definitionClueForHint(
  letter: string,
  usedWords: Iterable<string>,
  excludeWord: string | null,
): { partOfSpeech: string; definition: string } | null {
  const used = usedWords instanceof Set ? usedWords : new Set(usedWords);
  const candidates = computerPlayableEntriesStartingWith(letter)
    .filter(
      entry =>
        !used.has(entry.normalizedWord) &&
        entry.normalizedWord !== excludeWord &&
        // Same floor as `exampleWordForHint`, for the same reason: a clue
        // describing a word the player cannot legally submit is worse than no
        // clue.
        entry.normalizedWord.length >= MIN_WORD_LENGTH,
    )
    // Most common first: a clue is only useful if the word behind it is one
    // the player could plausibly reach. Same ordering rule as
    // `exampleWordForHint`, which picks the single most common.
    .sort((a, b) => b.frequencyScore - a.frequencyScore)
    .slice(0, CLUE_CANDIDATE_LIMIT);

  // The example word's own sense, so a synonym of it cannot come back wearing
  // the same definition. Looked up once rather than per candidate.
  const excludedDefinition =
    excludeWord === null ? null : lookupDefinition(excludeWord)?.definition ?? null;

  for (const entry of candidates) {
    const result = lookupDefinition(entry.normalizedWord);
    if (
      result !== null &&
      result.definition !== excludedDefinition &&
      !leaksClue(result.definition, entry.normalizedWord, letter)
    ) {
      return { partOfSpeech: result.partOfSpeech, definition: result.definition };
    }
  }
  return null;
}

/** Provenance for the Attributions screen (WL-407) and diagnostics. */
export function definitionSource(): { name: string; version: string } {
  return { name: packedAsset.sourceName, version: packedAsset.sourceVersion };
}

/**
 * Async form of `lookupDefinition`, kept as the enrichment seam.
 *
 * Architecture §4 describes definitions as coming from an optional external
 * provider. D-08 declined to select one for v1, so this resolves from the
 * bundled asset — but the boundary stays async so that adding a provider
 * later (behind the same "never block a round" rule) is not a change to every
 * caller's signature.
 */
export async function fetchDefinition(word: string): Promise<DefinitionResult | null> {
  return lookupDefinition(word);
}

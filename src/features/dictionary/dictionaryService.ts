/**
 * Dictionary service.
 * Per Architecture doc section 4:
 * - Gameplay validation uses a bundled ESDB-based local word list only.
 * - Commercial dictionary APIs (provider TBD — Delivery Plan D-08 recommends
 *   selecting none for v1) are used ONLY for optional definitions and must
 *   never block a round if unavailable (PRD section 12).
 *
 * ## On-device representation (WL-105)
 *
 * The bundled asset is a single sorted, newline-separated string of records,
 * each `word` + one flag character encoding
 * `tier index | proper-noun bit | offensive bit`. Everything else the app
 * needs is derived from those three facts — the generated data has exactly
 * 12 distinct flag combinations, which is what makes the packing lossless.
 *
 * Rejected alternatives:
 * - **Shipping the generated JSON.** 36MB, and it would materialize ~148k
 *   JS objects at startup — over the size budget and nowhere near the
 *   cold-start budget.
 * - **SQLite.** Fast and lazy, but adds a native dependency (and its build
 *   surface on both platforms) to serve a read-only exact-match lookup that
 *   a binary search already answers well inside budget.
 *
 * Startup builds an `Int32Array` of record offsets — one pass of `indexOf`,
 * no JS string allocated per word — and lookups binary-search it, slicing
 * only the ~17 candidate words each search actually visits.
 */
import packedAsset from '@assets/dictionary/dictionary.pack.json';

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
  /** PRD section 8.7 — the computer only draws from this narrower tier. */
  isComputerPlayable: boolean;
  frequencyScore: number;
}

export interface DictionaryLookupResult {
  found: boolean;
  entry: DictionaryWord | null;
}

const RECORD_SEPARATOR = '\n';

// Record encoding — must stay in step with `pack_entries` in
// scripts/generate-dictionary.py. __tests__/dictionaryService.test.ts pins
// this side against real bundled words so the two cannot drift silently.
const FLAG_BASE = 65; // 'A'
const TIER_MASK = 0b111;
const PROPER_NOUN_BIT = 0b1000;
const OFFENSIVE_BIT = 0b10000;

// Tier thresholds, mirroring the pipeline's derivation.
const COMMON_MAX_TIER = 50;
const OBSCURE_MIN_TIER = 70;
const FREQUENCY_MIN_TIER = 35;
const FREQUENCY_MAX_TIER = 70;

interface DictionaryIndex {
  records: string;
  /** Start offset of each record, ascending. */
  offsets: Int32Array;
  count: number;
  sizeTiers: number[];
}

let index: DictionaryIndex | null = null;

/**
 * Extra exclusions applied on top of the ones baked into the asset (WL-104).
 *
 * The Delivery Plan requires the exclusion list to be overridable at runtime,
 * not only at pipeline time. That matters because v1 ships no backend
 * (D-03): without this, a word that slips through review could only be
 * removed by regenerating the dictionary and shipping a store update. This
 * is the hook a local override — or WL-505's report-a-word feedback loop —
 * writes into.
 */
let runtimeExclusions: Set<string> = new Set();

/** Replaces the runtime exclusion set. Words are normalized like input is. */
export function setRuntimeExclusions(words: Iterable<string>): void {
  runtimeExclusions = new Set(
    Array.from(words, word => word.trim().toLowerCase()).filter(word => word.length > 0),
  );
}

export function getRuntimeExclusions(): ReadonlySet<string> {
  return runtimeExclusions;
}

function isRuntimeExcluded(normalizedWord: string): boolean {
  // Size check first so the ordinary case (no overrides) costs nothing in
  // the candidate-enumeration loop, which decodes ~15k records for the
  // worst letter and has a 50ms budget (WL-106).
  return runtimeExclusions.size > 0 && runtimeExclusions.has(normalizedWord);
}

function buildIndex(): DictionaryIndex {
  const { records, wordCount, sizeTiers } = packedAsset;
  const offsets = new Int32Array(wordCount);

  let pos = 0;
  for (let i = 0; i < wordCount; i++) {
    offsets[i] = pos;
    // -1 on the final record (no trailing separator), making pos 0; the loop
    // ends there, so the value is never used.
    pos = records.indexOf(RECORD_SEPARATOR, pos) + 1;
  }

  const built = { records, offsets, count: wordCount, sizeTiers };

  // Integrity check against a corrupted or half-written asset: nothing may
  // follow the final record. A mismatched wordCount would otherwise surface
  // much later as random lookup misses.
  if (wordCount > 0 && records.indexOf(RECORD_SEPARATOR, recordStart(built, wordCount - 1)) !== -1) {
    throw new Error(
      `Dictionary asset is corrupt: wordCount (${wordCount}) does not match the packed records.`,
    );
  }

  return built;
}

function recordStart(idx: DictionaryIndex, i: number): number {
  return idx.offsets[i] ?? 0;
}

/** Exclusive end of record `i`, i.e. the position of its separator. */
function recordEnd(idx: DictionaryIndex, i: number): number {
  return i + 1 < idx.count ? recordStart(idx, i + 1) - 1 : idx.records.length;
}

function wordAt(idx: DictionaryIndex, i: number): string {
  // The final character of every record is its flag, never part of the word.
  return idx.records.slice(recordStart(idx, i), recordEnd(idx, i) - 1);
}

/* eslint-disable no-bitwise -- the on-device record format is bit-packed by
   design (see the module docblock and pack_entries in
   scripts/generate-dictionary.py); this is the one place that unpacks it. */
function decodeFlags(code: number): {
  tierIndex: number;
  isProperNoun: boolean;
  isOffensive: boolean;
} {
  return {
    tierIndex: code & TIER_MASK,
    isProperNoun: (code & PROPER_NOUN_BIT) !== 0,
    isOffensive: (code & OFFENSIVE_BIT) !== 0,
  };
}
/* eslint-enable no-bitwise */

function decodeAt(idx: DictionaryIndex, i: number): DictionaryWord {
  const end = recordEnd(idx, i);
  const normalizedWord = idx.records.slice(recordStart(idx, i), end - 1);
  const { tierIndex, isProperNoun, isOffensive: isBakedOffensive } = decodeFlags(
    idx.records.charCodeAt(end - 1) - FLAG_BASE,
  );

  const tier = idx.sizeTiers[tierIndex] ?? FREQUENCY_MAX_TIER;
  // Runtime overrides sit on top of the baked flag, and deliberately feed
  // isAllowed/isComputerPlayable too: PRD section 24 requires that the
  // computer never selects a forbidden word, not just that the player
  // cannot play one.
  const isOffensive = isBakedOffensive || isRuntimeExcluded(normalizedWord);
  const isAllowed = !isProperNoun && !isOffensive;
  const isObscure = tier >= OBSCURE_MIN_TIER;

  return {
    word: normalizedWord,
    normalizedWord,
    // Neither is carried on-device: baseWord is unpopulated upstream, and
    // partOfSpeech has no consumer in the game rules. Both would cost bundle
    // size now to serve a hypothetical later (hints, definitions).
    baseWord: null,
    partOfSpeech: null,
    isProperNoun,
    isCommonWord: tier <= COMMON_MAX_TIER,
    isObscure,
    isOffensive,
    isAllowed,
    isComputerPlayable: isAllowed && !isObscure,
    frequencyScore:
      Math.round(
        (1 - (tier - FREQUENCY_MIN_TIER) / (FREQUENCY_MAX_TIER - FREQUENCY_MIN_TIER)) * 1000,
      ) / 1000,
  };
}

/**
 * Builds the in-memory index. Idempotent, and safe to skip — `lookupWord`
 * calls it on demand — but worth calling behind a splash/loading state so
 * the cost lands before the first turn rather than inside it.
 */
export function initDictionary(): void {
  if (index === null) {
    index = buildIndex();
  }
}

export function isDictionaryReady(): boolean {
  return index !== null;
}

/** Total bundled words, for diagnostics and the WL-105 measurements. */
export function dictionarySize(): number {
  return packedAsset.wordCount;
}

/** Provenance for the Attributions screen (WL-407) and DictionaryWord fields. */
export function dictionarySource(): { name: string; version: string } {
  return { name: packedAsset.sourceName, version: packedAsset.sourceVersion };
}

/**
 * Looks up a normalized word in the local (bundled) dictionary.
 *
 * Stays async even though the lookup is synchronous: callers already await
 * it (the rule engine's `validating` phase), and keeping the boundary async
 * means moving to a different backing store later is not a signature change.
 */
export async function lookupWord(normalizedWord: string): Promise<DictionaryLookupResult> {
  if (index === null) {
    index = buildIndex();
  }
  const idx = index;

  let lo = 0;
  let hi = idx.count - 1;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const candidate = wordAt(idx, mid);
    if (candidate === normalizedWord) {
      return { found: true, entry: decodeAt(idx, mid) };
    }
    if (candidate < normalizedWord) {
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return { found: false, entry: null };
}

const LETTER_A = 97; // 'a'
const ALPHABET_SIZE = 26;

function letterIndex(letter: string): number {
  return letter.toLowerCase().charCodeAt(0) - LETTER_A;
}

/**
 * How many words the player could still play starting with `letter` (WL-106).
 *
 * This is the difficulty engine's `option_reduction_score` input — PRD
 * section 10 defines it, for both Medium and Hard, as the number of valid
 * replies available to *the player*, so it counts the player-submittable set
 * rather than the narrower tier the computer draws from.
 *
 * The per-letter totals are precomputed at pipeline time because doing this
 * per turn is O(candidates x dictionary) and would stall the computer's
 * turn. All that is left at runtime is subtracting the words already used
 * this round, which is O(chain length) — chains are tens of words, not
 * thousands.
 */
export function replyCountForLetter(letter: string, usedWords: Iterable<string>): number {
  const i = letterIndex(letter);
  if (i < 0 || i >= ALPHABET_SIZE) {
    return 0;
  }
  const total = packedAsset.replyCounts[i] ?? 0;

  // Every word in the chain passed validation, so each one that starts with
  // this letter is necessarily part of the precomputed allowed total.
  let used = 0;
  for (const word of usedWords) {
    if (word.length > 0 && letterIndex(word) === i) {
      used += 1;
    }
  }
  return Math.max(0, total - used);
}

/** Largest per-letter reply count, for normalizing option-reduction scores. */
export function maxReplyCount(): number {
  return Math.max(...packedAsset.replyCounts);
}

/**
 * Every entry starting with `letter` for which `predicate` holds.
 *
 * Records are sorted, so this is a binary search for the letter boundary
 * followed by a linear walk of that letter's block — no scan of the other
 * 25. Shared by `computerPlayableEntriesStartingWith` (WL-106/108) and
 * `allowedEntriesStartingWith` (WL-113) so the walk exists exactly once;
 * only the filter differs between "what the computer may play" and "what
 * the player may play".
 *
 * Returns decoded entries rather than bare words because the walk has to
 * decode each record anyway to test the predicate, and every caller so far
 * also needs `frequencyScore` and/or `isObscure` — handing back strings
 * would force a second binary search per candidate (~10k of them for the
 * worst letter).
 */
function entriesStartingWithMatching(
  letter: string,
  predicate: (entry: DictionaryWord) => boolean,
): DictionaryWord[] {
  if (index === null) {
    index = buildIndex();
  }
  const idx = index;

  const i = letterIndex(letter);
  if (i < 0 || i >= ALPHABET_SIZE) {
    return [];
  }
  const target = String.fromCharCode(LETTER_A + i);

  // Lower bound: first record whose first character is >= target.
  let lo = 0;
  let hi = idx.count - 1;
  let start = idx.count;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (idx.records.charAt(recordStart(idx, mid)) >= target) {
      start = mid;
      hi = mid - 1;
    } else {
      lo = mid + 1;
    }
  }

  const entries: DictionaryWord[] = [];
  for (let j = start; j < idx.count; j++) {
    if (idx.records.charAt(recordStart(idx, j)) !== target) {
      break;
    }
    const entry = decodeAt(idx, j);
    if (predicate(entry)) {
      entries.push(entry);
    }
  }
  return entries;
}

/**
 * Every computer-playable entry starting with `letter`.
 *
 * Per PRD section 8.7 the computer draws from the narrower tier while the
 * player may submit the wider accepted set.
 *
 * Full scored-candidate assembly is WL-108; this is the enumeration WL-106
 * needs to demonstrate its own scoring budget.
 */
export function computerPlayableEntriesStartingWith(letter: string): DictionaryWord[] {
  return entriesStartingWithMatching(letter, entry => entry.isComputerPlayable);
}

/**
 * Every entry starting with `letter` that a *player* may submit (WL-113).
 *
 * Wider than `computerPlayableEntriesStartingWith`: `isAllowed` admits the
 * obscure band the computer never draws from (PRD section 8.7). Built for
 * the round simulator, which has to pick a plausible player move from the
 * same set `validateMove` would accept — nothing in the shipped app needed
 * this enumeration before WL-113, since a real player's next word comes from
 * a human, not from walking the dictionary.
 */
export function allowedEntriesStartingWith(letter: string): DictionaryWord[] {
  return entriesStartingWithMatching(letter, entry => entry.isAllowed);
}

export interface DefinitionResult {
  word: string;
  partOfSpeech: string;
  definition: string;
}

/**
 * Fetches an optional definition from the enrichment API.
 * STUB: no provider wired up yet (Delivery Plan D-08). Must fail gracefully —
 * callers should treat a null result as "definition unavailable, continue
 * playing" (Wireframe doc section 12).
 */
export async function fetchDefinition(_word: string): Promise<DefinitionResult | null> {
  return null;
}

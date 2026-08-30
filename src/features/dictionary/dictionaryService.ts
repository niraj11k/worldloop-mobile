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
import { MIN_WORD_LENGTH } from '@constants/gameConstants';

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

/**
 * Whether the bundled word list can actually be used (WL-506).
 *
 * `initDictionary` throws on a corrupt or half-written asset — the integrity
 * check in `buildIndex` — and that throw is the only way Wireframe §17's
 * "dictionary unavailable" state becomes reachable, since the asset is bundled
 * rather than fetched. Callers need the question answered, not the exception:
 * a screen cannot render a reassuring notice from inside a crash.
 *
 * Deliberately not cached as `false`. The asset does not change at runtime, so
 * a genuine corruption stays corrupt — but a transient read failure would be
 * pinned permanently by caching, and the copy the player is shown says "try
 * again shortly", which must be true.
 */
export function isDictionaryAvailable(): boolean {
  try {
    initDictionary();
    return true;
  } catch {
    return false;
  }
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
 * Position of `normalizedWord` in the packed record order, or -1.
 *
 * Exported because the WL-501 definitions asset is *aligned* to this order —
 * it carries one gloss id per record rather than its own copy of the word
 * list, which is what keeps it near 3MB instead of 4MB. That makes the record
 * position, not the word, the key into it. See `definitionService.ts`, which
 * also verifies the alignment before trusting it.
 */
export function recordIndexOf(normalizedWord: string): number {
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
      return mid;
    }
    if (candidate < normalizedWord) {
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return -1;
}

/**
 * Whether the player could submit `normalizedWord` (PRD section 8.5/8.7).
 *
 * The synchronous counterpart to `lookupWord` for callers that only need the
 * yes/no — WL-504's hint guard checks a handful of words per candidate clue
 * and has nothing to do with the entry itself.
 */
export function isAllowedWord(normalizedWord: string): boolean {
  const at = recordIndexOf(normalizedWord);
  return at !== -1 && decodeAt(index as DictionaryIndex, at).isAllowed;
}

/** The word at a packed record position, or `null` if out of range. */
export function wordAtRecord(i: number): string | null {
  if (index === null) {
    index = buildIndex();
  }
  return i >= 0 && i < index.count ? wordAt(index, i) : null;
}

/**
 * Looks up a normalized word in the local (bundled) dictionary.
 *
 * Stays async even though the lookup is synchronous: callers already await
 * it (the rule engine's `validating` phase), and keeping the boundary async
 * means moving to a different backing store later is not a signature change.
 */
export async function lookupWord(normalizedWord: string): Promise<DictionaryLookupResult> {
  const at = recordIndexOf(normalizedWord);
  if (at === -1) {
    return { found: false, entry: null };
  }
  // `recordIndexOf` built the index if it was missing, so this is non-null.
  return { found: true, entry: decodeAt(index as DictionaryIndex, at) };
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

/**
 * One example word for the hint sheet's level 3 (WL-307) — a word the player
 * could actually submit right now, so it excludes anything already used this
 * round. Drawn from `computerPlayableEntriesStartingWith` rather than the
 * wider `allowedEntriesStartingWith`: a hint should be recognizable, and that
 * set already excludes the obscure tier for exactly this kind of reason (PRD
 * section 8.7).
 *
 * Prefers the common-word band, then the highest `frequencyScore` within
 * whatever pool remains — `frequencyScore` is `(1 - normalizedTier) * 1000`
 * (see `decodeAt`), so higher is more common, not rarer. Returns `null` only
 * when the letter has no remaining candidate at all — a near-dead-letter
 * edge case the caller (the hint sheet) handles by omitting the line rather
 * than showing an empty example.
 *
 * **`MIN_WORD_LENGTH` is filtered here, and has to be** (fixed at WL-504). The
 * dictionary holds 240 computer-playable words under three letters, and the
 * most *common* word starting with most letters is one of them — this hint
 * offered "Example: A" for the letter A, a word `validateMove` then rejects as
 * `too_short`. WL-108 hit the same gap from the other side and fixed it in
 * `generateCandidates`; the rule engine has always enforced the floor on the
 * player's input, so a suggestion that ignores it costs the player a hint to
 * be told to play something illegal.
 */
export function exampleWordForHint(
  letter: string,
  usedWords: Iterable<string>,
): string | null {
  const used = usedWords instanceof Set ? usedWords : new Set(usedWords);
  const candidates = computerPlayableEntriesStartingWith(letter).filter(
    entry => !used.has(entry.normalizedWord) && entry.normalizedWord.length >= MIN_WORD_LENGTH,
  );
  if (candidates.length === 0) {
    return null;
  }

  const common = candidates.filter(entry => entry.isCommonWord);
  const pool = common.length > 0 ? common : candidates;
  return pool.reduce((best, entry) =>
    entry.frequencyScore > best.frequencyScore ? entry : best,
  ).normalizedWord;
}

/*
 * Definitions used to stub out here. They now live in `definitionService.ts`,
 * which WL-501 built on a second bundled asset (WordNet glosses) once D-08
 * closed on "no commercial provider". The split is deliberate rather than
 * cosmetic: nothing in the rule engine, the difficulty engine or the round
 * simulator needs definitions, so keeping them out of this module means none
 * of those paths pull a 3MB asset into scope.
 */

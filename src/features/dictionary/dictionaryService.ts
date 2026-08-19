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
  const { tierIndex, isProperNoun, isOffensive } = decodeFlags(
    idx.records.charCodeAt(end - 1) - FLAG_BASE,
  );

  const tier = idx.sizeTiers[tierIndex] ?? FREQUENCY_MAX_TIER;
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

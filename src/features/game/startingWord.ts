/**
 * Starting-word selection (WL-112).
 *
 * The game provides the opening word (PRD section 7 step 1, section 24 "the
 * game assigns a valid starting word"). Two things make that non-trivial:
 * the word must not hand the player an immediately dead letter, and it must
 * vary between rounds so replays don't feel identical.
 *
 * The starting word is seeded into the chain as the computer's opening move
 * (WL-110), so it is drawn from the computer-playable set — the same
 * restriction every other computer move obeys (PRD section 8.7), including
 * the runtime exclusions PRD section 24 requires the computer to respect.
 *
 * Two filters beyond that are this module's own judgement, not the docs':
 * the top frequency tier and the length cap. Both are stated as tunable
 * constants below rather than inlined, because the opening word is the
 * player's first impression of the whole game and WL-605 is the pass that
 * gets to revisit that.
 */

import type { DictionaryWord } from '@features/dictionary/dictionaryService';
import {
  computerPlayableEntriesStartingWith,
  replyCountForLetter,
} from '@features/dictionary/dictionaryService';
import type { RandomSource } from '@features/difficulty/difficultyEngine';
import { MIN_WORD_LENGTH } from '@constants/gameConstants';

/**
 * The acceptance bar from the Delivery Plan: a starting word must leave the
 * player at least this many valid replies.
 *
 * Worth knowing that against the shipped dictionary this never rejects
 * anything — the thinnest letter (`x`) still offers 115 player replies, so
 * every candidate clears 20 by a wide margin. It is kept as a real guard
 * rather than dropped as dead code because it is the only thing standing
 * between a future dictionary change and a round that opens on a dead
 * letter, and because "verified to never fire" is a different and much
 * better position than "never checked".
 */
export const MIN_STARTING_REPLIES = 20;

/**
 * Starting words come from the most common ESDB size tier only
 * (`frequencyScore === 1`, tier 35), not the whole common band.
 *
 * Primarily a first-impression choice: this tier reads as `cabbage`,
 * `eagle`, `machine`, `zebra`, while the next one down carries the long
 * tail. It also, as a side effect rather than a fix, sidesteps most of the
 * proper-noun leak WL-103 documented — `robert`, `nike`, `pepsi`, `xerxes`,
 * `qaddafi`, `honda`, `toyota` and `amazon` all sit below this line and are
 * all currently computer-playable. See the note in the Delivery Plan: that
 * gap is real, it is upstream of this module, and this constant is a
 * mitigation for the single most visible word in the round, not a repair.
 *
 * Compared with `>=` so lowering it widens the pool in one edit.
 */
export const STARTING_WORD_MIN_FREQUENCY = 1;

/**
 * Length cap for the opening word. Wireframe section 7 teaches the rule with
 * `apple -> elephant -> table`; opening a first round on a fourteen-letter
 * word sets a different and worse expectation. `MIN_WORD_LENGTH` is the
 * floor, shared with the rule and scoring engines.
 */
export const STARTING_WORD_MAX_LENGTH = 8;

/**
 * A first letter whose pool is thinner than this is skipped.
 *
 * Selection picks a first letter and then a word within it, so a letter with
 * a two-word pool would make "varies between rounds" false for anyone who
 * drew it twice. Against the shipped dictionary this excludes exactly one
 * letter, `x` (pool: `xmas`, `xmases` — the second-worst opening word in the
 * dictionary and an abbreviated proper noun besides).
 */
export const MIN_LETTER_POOL = 25;

/** How many recent starting words `nextStartingWord` refuses to repeat. */
export const RECENT_STARTING_WORDS_WINDOW = 10;

/**
 * How many recent rounds' *required letters* selection also tries to avoid.
 *
 * Distinct starting words are not the same thing as distinct openings.
 * English inflection concentrates word endings hard: 28.5% of the eligible
 * pool ends in `s`, and `s`/`d`/`g`/`e` together cover 64% of it, because
 * `-s`, `-ed` and `-ing` forms are all in the most common tier. Selecting on
 * the word alone produced runs like `snmllsddeggdyssggsxs` over twenty
 * rounds — every word different, the same handful of required letters over
 * and over.
 *
 * That matters more than ordinary repetition because Design System section 6
 * makes the required letter the single largest element on the game screen,
 * so it is the part of an opening a player actually registers.
 *
 * Deliberately much shorter than the word window: repeating a *word* inside
 * ten rounds is a flaw, whereas repeating a letter is only monotonous if it
 * happens back to back, and there are just 26 to go round.
 */
export const RECENT_REQUIRED_LETTERS_WINDOW = 3;

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'.split('');

/**
 * The dictionary surface this module needs, injectable so the selection
 * rules can be tested against a small fixture rather than only against the
 * 148k-word bundle (the real dictionary cannot produce a letter with exactly
 * one eligible word on demand). Same pattern as WL-108's `CandidateSource`.
 */
export interface StartingWordSource {
  entriesStartingWith(letter: string): DictionaryWord[];
  replyCountForLetter(letter: string, usedWords: Iterable<string>): number;
}

const defaultSource: StartingWordSource = {
  entriesStartingWith: computerPlayableEntriesStartingWith,
  replyCountForLetter,
};

function lastLetter(word: string): string {
  return word.charAt(word.length - 1);
}

/**
 * Every word starting with `letter` that is fit to open a round.
 *
 * The reply count is measured with the candidate itself already used, since
 * WL-110 seeds the starting word into the chain — a word that both starts
 * and ends with the same letter spends one of its own replies.
 */
export function startingWordPool(
  letter: string,
  source: StartingWordSource = defaultSource,
): string[] {
  const pool: string[] = [];
  for (const entry of source.entriesStartingWith(letter)) {
    const word = entry.normalizedWord;
    if (word.length < MIN_WORD_LENGTH || word.length > STARTING_WORD_MAX_LENGTH) {
      continue;
    }
    if (entry.frequencyScore < STARTING_WORD_MIN_FREQUENCY) {
      continue;
    }
    if (source.replyCountForLetter(lastLetter(word), [word]) < MIN_STARTING_REPLIES) {
      continue;
    }
    pool.push(word);
  }
  return pool;
}

/**
 * Picks a starting word, avoiding `recentWords`.
 *
 * Draws a first letter before a word, rather than sampling uniformly across
 * the whole dictionary, for two reasons. It enumerates one letter's records
 * instead of all 26 — WL-106 measured a single worst-case letter at ~10ms,
 * so the alternative would put a visible stall on the round-start path for a
 * once-per-round decision. And it makes the opening letter itself vary,
 * which is the part a player actually notices; sampling by word would open
 * on `s`, `c` or `p` most of the time, since those three hold a quarter of
 * the pool between them.
 *
 * Returns `null` only if no letter yields a usable word. That is
 * unreachable with the bundled dictionary — it means the asset is missing or
 * corrupt — so the caller should treat it as the dictionary being
 * unavailable rather than as an ordinary empty result.
 */
export function selectStartingWord(params?: {
  /** Previous starting words, oldest first — the order decides which count as recent. */
  recentWords?: Iterable<string>;
  random?: RandomSource;
  source?: StartingWordSource;
}): string | null {
  const random = params?.random ?? Math.random;
  const source = params?.source ?? defaultSource;
  const recentWords = [...(params?.recentWords ?? [])];
  const recent = new Set(recentWords);
  const recentEndings = new Set(
    recentWords.slice(-RECENT_REQUIRED_LETTERS_WINDOW).map(lastLetter),
  );

  // Draw letters without replacement: a partial Fisher-Yates over a local
  // copy, so an exhausted alphabet terminates instead of re-rolling letters
  // it has already rejected.
  const letters = [...ALPHABET];
  for (let remaining = letters.length; remaining > 0; remaining--) {
    const pick = Math.floor(random() * remaining);
    const letter = letters[pick] as string;
    letters[pick] = letters[remaining - 1] as string;

    const pool = startingWordPool(letter, source);
    if (pool.length < MIN_LETTER_POOL) {
      continue;
    }

    // Exclusion happens after the pool-size gate on purpose: the gate asks
    // whether this letter can offer variety at all, which is a property of
    // the dictionary, not of what the player happened to see last week.
    const fresh = pool.filter(word => !recent.has(word));
    if (fresh.length === 0) {
      continue;
    }

    // Avoiding a recent required letter is a preference, not a rule: a thin
    // letter's whole pool can share one ending, and refusing to open at all
    // would be a worse outcome than an opening that rhymes with the last one.
    const varied = fresh.filter(word => !recentEndings.has(lastLetter(word)));
    const usable = varied.length > 0 ? varied : fresh;
    return usable[Math.floor(random() * usable.length)] as string;
  }
  return null;
}

let recentStartingWords: string[] = [];

/**
 * `selectStartingWord` plus the rolling window, for callers that just want a
 * word and expect rounds not to repeat.
 *
 * The history is module state and therefore per app launch. Persisting it
 * belongs with the guest profile (WL-402), which is also where a durable
 * `RECENT_STARTING_WORDS_WINDOW` would live; within-launch is where the
 * repetition is actually noticeable, since that is when a player replays.
 */
export function nextStartingWord(random: RandomSource = Math.random): string | null {
  const word = selectStartingWord({ recentWords: recentStartingWords, random });
  if (word !== null) {
    recentStartingWords.push(word);
    if (recentStartingWords.length > RECENT_STARTING_WORDS_WINDOW) {
      recentStartingWords.shift();
    }
  }
  return word;
}

/** Test seam, and the hook for restoring a persisted window at WL-402. */
export function resetStartingWordHistory(words: Iterable<string> = []): void {
  recentStartingWords = [...words].slice(-RECENT_STARTING_WORDS_WINDOW);
}

/** Current window, newest last. Exposed for WL-402 to persist. */
export function recentStartingWordHistory(): readonly string[] {
  return recentStartingWords;
}

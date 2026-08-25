/**
 * Difficulty / computer-move engine.
 * Implements the candidate scoring model agreed in Architecture doc section 6
 * (derived from PRD section 10). Status: first-pass draft, subject to tuning.
 *
 * ## Where the score components come from (WL-108)
 *
 * Architecture section 6 and PRD section 10 both give the *formula* and the
 * per-difficulty *weights*, but only ever name the five terms — of the five,
 * only `option_reduction_score` is defined anywhere (PRD section 10: "the
 * number of valid replies available to the player"). The definitions of
 * `commonness_score`, `difficulty_score`, `obscurity_penalty` and
 * `repetition_penalty` below are therefore this implementation's, not the
 * documents'. They are flagged rather than presented as spec, and WL-605 is
 * the pass that tunes them against real play.
 *
 * Two things worth knowing before tuning:
 *
 * 1. **`obscurity_penalty` needs a graded definition to do anything at all.**
 *    The computer only draws from the computer-playable tier, which already
 *    excludes obscure words outright, so a binary "is it obscure" penalty is
 *    always 0 and w4 multiplies nothing. It is defined here as a hinge on the
 *    commonness tier so it discriminates within the band that actually
 *    occurs (uncommon-but-allowed).
 * 2. **`commonness_score` and `obscurity_penalty` both derive from the same
 *    frequency tier**, so they are correlated by construction and cannot be
 *    tuned fully independently. `difficulty_score` deliberately uses word
 *    length instead, to avoid a third term collapsing onto the same signal —
 *    defining it as "rarity" would have made it a linear restatement of
 *    `commonness_score` and left the model with fewer real parameters than
 *    it appears to have.
 */
import type { Difficulty } from '@navigation/types';
import { MIN_WORD_LENGTH } from '@constants/gameConstants';
import type { DictionaryWord } from '@features/dictionary/dictionaryService';
import {
  computerPlayableEntriesStartingWith,
  replyCountForLetter,
  maxReplyCount,
} from '@features/dictionary/dictionaryService';

export interface CandidateWord {
  word: string;
  optionReductionScore: number;
  commonnessScore: number;
  difficultyScore: number;
  obscurityPenalty: number;
  repetitionPenalty: number;
}

interface DifficultyWeights {
  w1_optionReduction: number;
  w2_commonness: number;
  w3_difficulty: number;
  w4_obscurityPenalty: number;
  w5_repetitionPenalty: number;
}

export const DIFFICULTY_WEIGHTS: Record<Difficulty, DifficultyWeights> = {
  easy: {
    w1_optionReduction: 0,
    w2_commonness: 1.0,
    w3_difficulty: 0,
    w4_obscurityPenalty: 0.5,
    w5_repetitionPenalty: 0.2,
  },
  medium: {
    w1_optionReduction: 0.5,
    w2_commonness: 0.3,
    w3_difficulty: 0.1,
    w4_obscurityPenalty: 0.3,
    w5_repetitionPenalty: 0.2,
  },
  hard: {
    w1_optionReduction: 1.0,
    w2_commonness: 0.2,
    w3_difficulty: 0.3,
    w4_obscurityPenalty: 0.5,
    w5_repetitionPenalty: 0.1,
  },
};

/**
 * Turns "how many replies does this candidate leave the player?" into the
 * `option_reduction_score` term (WL-106).
 *
 * Inverted and normalized to 0..1: a candidate ending in a dead letter
 * scores 1 (maximum reduction of the player's options), one ending in the
 * most open letter scores ~0. PRD section 10 is explicit that Hard should
 * "rank candidates from fewest replies to most replies", which is what the
 * inversion encodes.
 *
 * Normalizing matters because Architecture section 6 sums this against
 * `commonness_score`, which is already 0..1 (`frequencyScore`) — an
 * unnormalized raw count in the thousands would swamp every other term and
 * make the weights meaningless before WL-605 ever gets to tune them.
 */
export function optionReductionScore(replyCount: number, maxReplies: number): number {
  if (maxReplies <= 0) {
    return 0;
  }
  const clamped = Math.min(Math.max(replyCount, 0), maxReplies);
  return 1 - clamped / maxReplies;
}

export function scoreCandidate(candidate: CandidateWord, difficulty: Difficulty): number {
  const w = DIFFICULTY_WEIGHTS[difficulty];
  return (
    w.w1_optionReduction * candidate.optionReductionScore +
    w.w2_commonness * candidate.commonnessScore +
    w.w3_difficulty * candidate.difficultyScore -
    w.w4_obscurityPenalty * candidate.obscurityPenalty -
    w.w5_repetitionPenalty * candidate.repetitionPenalty
  );
}

/** Returns a float in [0, 1). `Math.random` satisfies this. */
export type RandomSource = () => number;

/**
 * Deterministic PRNG (mulberry32) so selection distributions can be asserted.
 *
 * WL-109 requires a seedable source: the spec is about *distributions* over
 * many turns, which cannot be tested against `Math.random` without either
 * flaky thresholds or mocking the global.
 */
/* eslint-disable no-bitwise -- mulberry32 is defined in terms of 32-bit
   integer mixing; rewriting it without bitwise operators would not be the
   same generator. Confined to this function. */
export function createSeededRandom(seed: number): RandomSource {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/* eslint-enable no-bitwise */

/**
 * How many top-ranked candidates each difficulty draws from
 * (Architecture doc section 6).
 */
export const SELECTION_POOL_SIZE: Record<Difficulty, number> = {
  easy: 10, // "random pick from top candidates"
  medium: 5, // "weighted random from top 3-5 candidates"
  hard: 2, // "top-ranked, occasional 2nd-best"
};

/**
 * How often Hard takes the second-best rather than the best.
 *
 * Architecture section 6 says "occasional" without a number. Low enough that
 * Hard still reads as relentless, high enough to break exact predictability
 * across a round. A tuning input for WL-605, not a fixed truth.
 */
export const HARD_SECOND_BEST_CHANCE = 0.15;

interface RankedCandidate {
  candidate: CandidateWord;
  score: number;
  /** Random key, so equal scores resolve to a uniform sample rather than
   *  whichever word the dictionary happens to list first. */
  tiebreak: number;
}

function outranks(a: RankedCandidate, b: RankedCandidate): boolean {
  return a.score > b.score || (a.score === b.score && a.tiebreak > b.tiebreak);
}

/**
 * Top `size` candidates, best first, without sorting the full list.
 *
 * Keeps a bounded insertion-sorted buffer: one pass, each candidate scored
 * exactly once, and an allocation only for the few that make the cut. A full
 * sort here previously consumed more than half of WL-106's 50ms turn budget
 * on the worst-case letter, so this stays bounded deliberately — see that
 * task's entry in the Delivery Plan.
 *
 * Ties are broken by a random key rather than list order. Without that, Easy
 * would be badly affected: its weights make every common word score
 * identically, so the same handful of alphabetically-first words would be
 * returned every single turn.
 */
function rankTopCandidates(
  candidates: CandidateWord[],
  difficulty: Difficulty,
  random: RandomSource,
  size: number,
): RankedCandidate[] {
  const top: RankedCandidate[] = [];

  for (const candidate of candidates) {
    const score = scoreCandidate(candidate, difficulty);

    // Cheap reject before spending a random draw: anything strictly worse
    // than the current cut-off cannot make it, whatever key it would get.
    const worst = top[top.length - 1];
    if (top.length === size && worst !== undefined && score < worst.score) {
      continue;
    }

    const entry: RankedCandidate = { candidate, score, tiebreak: random() };
    if (top.length === size) {
      if (worst !== undefined && !outranks(entry, worst)) {
        continue;
      }
      top.pop();
    }

    let i = top.length;
    while (i > 0 && outranks(entry, top[i - 1]!)) {
      top[i] = top[i - 1]!;
      i -= 1;
    }
    top[i] = entry;
  }

  return top;
}

/**
 * Selects the computer's next word (WL-109).
 *
 * Per Architecture doc section 6:
 * - **easy**: uniform pick from the top candidates
 * - **medium**: rank-weighted random from the top 3-5
 * - **hard**: top-ranked, with an occasional second-best
 *
 * > **Doc contradiction, resolved in favour of the Architecture doc.** PRD
 * > section 10's Easy algorithm says to "choose one randomly" from *all*
 * > valid candidates, while Architecture section 6 says to pick randomly from
 * > the *top* candidates. Uniform selection over everything would make Easy's
 * > `w2_commonness = 1.0` weight meaningless, and — because 23% of
 * > computer-playable words sit in the uncommon tiers — would have Easy using
 * > *less* familiar vocabulary than Medium or Hard, inverting the difficulty
 * > it is named for. Flagged in the Delivery Plan rather than silently picked.
 *
 * Medium weights by rank rather than by score: scores are unbounded below
 * (the penalty terms can drive them negative), so score-proportional weights
 * are not well defined without an offset that would itself need tuning.
 */
export function selectComputerWord(
  candidates: CandidateWord[],
  difficulty: Difficulty,
  random: RandomSource = Math.random,
): CandidateWord | null {
  const top = rankTopCandidates(candidates, difficulty, random, SELECTION_POOL_SIZE[difficulty]);
  if (top.length === 0) {
    return null;
  }

  if (difficulty === 'hard') {
    const second = top[1];
    if (second !== undefined && random() < HARD_SECOND_BEST_CHANCE) {
      return second.candidate;
    }
    return top[0]!.candidate;
  }

  if (difficulty === 'easy') {
    return top[Math.floor(random() * top.length)]!.candidate;
  }

  // Medium: rank-weighted, so the best candidate is most likely but not
  // guaranteed — PRD section 10 asks for "controlled randomness so the result
  // is not always predictable".
  const weights = top.map((_, i) => top.length - i);
  const total = weights.reduce((sum, w) => sum + w, 0);
  let ticket = random() * total;
  for (let i = 0; i < top.length; i++) {
    ticket -= weights[i]!;
    if (ticket < 0) {
      return top[i]!.candidate;
    }
  }
  return top[top.length - 1]!.candidate;
}

// --- Candidate generation (WL-108) -----------------------------------------

const ALPHABET_SIZE = 26;
const LETTER_A = 97;

/**
 * Length at which `difficulty_score` saturates. Beyond this a word is simply
 * "long"; the dictionary runs to 45 characters, so scaling to the true
 * maximum would leave almost every real candidate bunched near zero.
 */
const LENGTH_SCORE_CEILING = 12;

/**
 * The dictionary facts candidate generation needs, injectable so the scoring
 * can be tested against synthetic word sets — the real bundle cannot produce
 * a letter with exactly two candidates on demand.
 */
export interface CandidateSource {
  entriesStartingWith(letter: string): DictionaryWord[];
  replyCountForLetter(letter: string, usedWords: Iterable<string>): number;
  maxReplyCount(): number;
}

const defaultCandidateSource: CandidateSource = {
  entriesStartingWith: computerPlayableEntriesStartingWith,
  replyCountForLetter,
  maxReplyCount,
};

function letterIndex(letter: string): number {
  return letter.toLowerCase().charCodeAt(0) - LETTER_A;
}

/**
 * `difficulty_score`: how demanding the word itself is, measured by length.
 *
 * Deliberately independent of the frequency tier — see the module docblock.
 */
export function lengthScore(word: string): number {
  const span = LENGTH_SCORE_CEILING - MIN_WORD_LENGTH;
  const over = word.length - MIN_WORD_LENGTH;
  return Math.min(Math.max(over, 0) / span, 1);
}

/**
 * `obscurity_penalty`: a hinge on the commonness tier.
 *
 * Zero for common words, rising across the uncommon-but-allowed band. Obscure
 * words score 1, which only matters if a caller supplies candidates the
 * computer would not normally be offered.
 */
export function obscurityPenalty(entry: DictionaryWord): number {
  if (entry.isObscure) {
    return 1;
  }
  return entry.isCommonWord ? 0 : 1 - entry.frequencyScore;
}

/**
 * `repetition_penalty`: how often this round has already sent the player to
 * the letter this candidate would leave them on.
 *
 * Derived from chain state rather than the dictionary, so it stays an
 * independent signal from the other four terms.
 */
export function repetitionPenalty(endingLetter: string, usedEndingCounts: Int32Array, usedTotal: number): number {
  if (usedTotal === 0) {
    return 0;
  }
  const i = letterIndex(endingLetter);
  if (i < 0 || i >= ALPHABET_SIZE) {
    return 0;
  }
  return (usedEndingCounts[i] ?? 0) / usedTotal;
}

/**
 * Builds the computer's scored candidate list for a required letter (WL-108).
 *
 * Filters to the computer-playable tier (PRD section 8.7 — the player may
 * submit from the wider accepted set) and drops words already used this
 * round, then scores each candidate on all five Architecture section 6 terms.
 * Selecting *from* this list is WL-109's job; this only ranks the options.
 *
 * Per-letter totals and the chain's letter histograms are computed once up
 * front rather than per candidate. Both `replyCountForLetter` and the
 * repetition term otherwise walk the used-word set on every candidate, which
 * is O(candidates x chain length) — invisible on an empty chain, and roughly
 * 300k operations by the time a 30-word round meets the worst letter's ~10k
 * candidates.
 */
export function generateCandidates(
  params: { requiredLetter: string; usedWords: ReadonlySet<string> },
  source: CandidateSource = defaultCandidateSource,
): CandidateWord[] {
  const { requiredLetter, usedWords } = params;

  const usedStartCounts = new Int32Array(ALPHABET_SIZE);
  const usedEndCounts = new Int32Array(ALPHABET_SIZE);
  for (const word of usedWords) {
    if (word.length === 0) {
      continue;
    }
    const start = letterIndex(word);
    const end = letterIndex(word.charAt(word.length - 1));
    if (start >= 0 && start < ALPHABET_SIZE) {
      usedStartCounts[start] = (usedStartCounts[start] ?? 0) + 1;
    }
    if (end >= 0 && end < ALPHABET_SIZE) {
      usedEndCounts[end] = (usedEndCounts[end] ?? 0) + 1;
    }
  }

  // Whole-dictionary reply totals, once. Subtracting the used-word histogram
  // reproduces exactly what replyCountForLetter(letter, usedWords) returns.
  const noWords: string[] = [];
  const rawReplies = new Int32Array(ALPHABET_SIZE);
  for (let i = 0; i < ALPHABET_SIZE; i++) {
    rawReplies[i] = source.replyCountForLetter(String.fromCharCode(LETTER_A + i), noWords);
  }

  const maxReplies = source.maxReplyCount();
  const usedTotal = usedWords.size;
  const candidates: CandidateWord[] = [];

  for (const entry of source.entriesStartingWith(requiredLetter)) {
    const word = entry.normalizedWord;
    // The computer may not replay a word already in the chain (PRD 8.4).
    if (usedWords.has(word)) {
      continue;
    }
    // Nor play below the minimum length (PRD 8.3). The rule engine enforces
    // this for the player, but nothing constrains the computer's own move —
    // and the dictionary carries 240 computer-playable words shorter than
    // the minimum, "a" and "ax" among them.
    if (word.length < MIN_WORD_LENGTH) {
      continue;
    }

    const endingLetter = word.charAt(word.length - 1);
    const endIndex = letterIndex(endingLetter);
    const replies =
      endIndex >= 0 && endIndex < ALPHABET_SIZE
        ? Math.max(0, (rawReplies[endIndex] ?? 0) - (usedStartCounts[endIndex] ?? 0))
        : 0;

    candidates.push({
      word,
      optionReductionScore: optionReductionScore(replies, maxReplies),
      commonnessScore: entry.frequencyScore,
      difficultyScore: lengthScore(word),
      obscurityPenalty: obscurityPenalty(entry),
      repetitionPenalty: repetitionPenalty(endingLetter, usedEndCounts, usedTotal),
    });
  }

  return candidates;
}

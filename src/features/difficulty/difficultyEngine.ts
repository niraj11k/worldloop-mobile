/**
 * Difficulty / computer-move engine.
 * Implements the candidate scoring model agreed in Architecture doc section 6
 * (derived from PRD section 10). Status: first-pass draft, subject to tuning.
 */
import type { Difficulty } from '@navigation/types';

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
export function optionReductionScore(replyCount: number, maxReplyCount: number): number {
  if (maxReplyCount <= 0) {
    return 0;
  }
  const clamped = Math.min(Math.max(replyCount, 0), maxReplyCount);
  return 1 - clamped / maxReplyCount;
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

/**
 * Selects the computer's next word from a candidate list.
 *
 * NOTE: Selection method per difficulty (Architecture doc section 6):
 * - easy: random pick from top candidates
 * - medium: weighted random from top 3-5 candidates
 * - hard: top-ranked candidate, occasional 2nd-best for unpredictability
 *
 * This stub ranks candidates but always returns the top-ranked one.
 * Random/weighted selection is not yet implemented (WL-109).
 *
 * Picks the maximum in a single linear pass rather than sorting the whole
 * list. The previous full sort scored every candidate afresh on each
 * comparison — for the worst-case letter (~10k candidates) that is ~266k
 * `scoreCandidate` calls to choose one word, and it measured as more than
 * half of WL-106's 50ms turn budget on its own. This scores each candidate
 * exactly once.
 *
 * Behaviour is unchanged, including ties: a strict `>` keeps the earliest
 * maximum, which is what a stable sort followed by `[0]` produced.
 *
 * WL-109 needs the top 3-5 rather than the top 1; that wants a bounded
 * partial selection, not a return to sorting the full list.
 */
export function selectComputerWord(
  candidates: CandidateWord[],
  difficulty: Difficulty,
): CandidateWord | null {
  let best: CandidateWord | null = null;
  let bestScore = -Infinity;

  for (const candidate of candidates) {
    const score = scoreCandidate(candidate, difficulty);
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  return best;
}

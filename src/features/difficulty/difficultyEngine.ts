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
 * Random/weighted selection is not yet implemented.
 */
export function selectComputerWord(
  candidates: CandidateWord[],
  difficulty: Difficulty,
): CandidateWord | null {
  if (candidates.length === 0) {
    return null;
  }
  const ranked = [...candidates].sort(
    (a, b) => scoreCandidate(b, difficulty) - scoreCandidate(a, difficulty),
  );
  return ranked[0] ?? null;
}

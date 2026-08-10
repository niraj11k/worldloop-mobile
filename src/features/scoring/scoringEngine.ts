/**
 * Scoring engine.
 * Implements the formula agreed in Architecture doc section 7.
 * Status: first-pass draft, subject to tuning once real gameplay data exists
 * (PRD section 16).
 */

export type RarityTier = 'common' | 'uncommon' | 'rare';

const BASE_POINTS = 10;
const LENGTH_BONUS_CAP = 20;
const LENGTH_BONUS_PER_LETTER = 2;
const MIN_WORD_LENGTH = 3;

const RARITY_BONUS: Record<RarityTier, number> = {
  common: 0,
  uncommon: 5,
  rare: 10,
};

export function scoreWord(params: {
  wordLength: number;
  rarity: RarityTier;
  hintUsed: boolean;
  hintRevealedWord: boolean;
}): number {
  const lengthBonus = Math.min(
    (params.wordLength - MIN_WORD_LENGTH) * LENGTH_BONUS_PER_LETTER,
    LENGTH_BONUS_CAP,
  );
  const rarityBonus = RARITY_BONUS[params.rarity];

  let hintPenalty = 0;
  if (params.hintRevealedWord) {
    hintPenalty = 10;
  } else if (params.hintUsed) {
    hintPenalty = 5;
  }

  return BASE_POINTS + lengthBonus + rarityBonus - hintPenalty;
}

/**
 * Round-level bonuses, proposed in Architecture doc section 7.
 */
export const ROUND_WIN_BONUS = 20;
export const PERSONAL_BEST_MILESTONE_BONUS = 5;

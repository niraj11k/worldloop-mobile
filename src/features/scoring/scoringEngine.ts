/**
 * Scoring engine.
 * Implements the formula agreed in Architecture doc section 7.
 * Status: first-pass draft, subject to tuning once real gameplay data exists
 * (PRD section 16).
 */

import { MIN_WORD_LENGTH } from '@constants/gameConstants';
import type { DictionaryWord } from '@features/dictionary/dictionaryService';
import type { GameStatus } from '@app-types/game';

export type RarityTier = 'common' | 'uncommon' | 'rare';

const BASE_POINTS = 10;
const LENGTH_BONUS_CAP = 20;
const LENGTH_BONUS_PER_LETTER = 2;

const RARITY_BONUS: Record<RarityTier, number> = {
  common: 0,
  uncommon: 5,
  rare: 10,
};

/**
 * Maps a dictionary entry's commonness tier onto the three rarity bands
 * Architecture doc section 7 prices (WL-111).
 *
 * Deliberately derived from `isCommonWord` / `isObscure` rather than from a
 * fourth set of tier thresholds: those two booleans already encode the
 * pipeline's tier cutoffs, and a private copy here would drift the moment
 * WL-605 retunes them.
 *
 * `rare` maps to `isObscure`, which reads oddly until you note that obscure
 * words are still *player*-submittable (PRD section 8.7 — only the computer
 * is held to the narrower tier). That is exactly the "rare but allowed" band
 * section 7 names, so the computer can never earn this bonus.
 */
export function rarityForEntry(
  entry: Pick<DictionaryWord, 'isCommonWord' | 'isObscure'>,
): RarityTier {
  if (entry.isCommonWord) {
    return 'common';
  }
  return entry.isObscure ? 'rare' : 'uncommon';
}

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

/**
 * The one-off bonus a finished round adds on top of its per-word scores.
 *
 * `previousBestChainLength` is `null` when no personal best is known — a
 * fresh install before WL-402 persists a profile, or a profile that failed
 * to load. That is distinct from a best of `0`: a genuine first round beats
 * zero and earns the milestone, whereas an unknown baseline must not invent
 * one.
 *
 * Only rounds that reached a real result are eligible. An abandoned round is
 * not an achievement, and a technical failure must not pay out — otherwise a
 * broken build reads as a generous one.
 */
export function roundEndBonus(params: {
  status: GameStatus;
  chainLength: number;
  previousBestChainLength: number | null;
}): number {
  const settled: GameStatus[] = ['player_win', 'computer_win', 'draw'];
  if (!settled.includes(params.status)) {
    return 0;
  }

  const winBonus = params.status === 'player_win' ? ROUND_WIN_BONUS : 0;
  const milestoneBonus =
    params.previousBestChainLength !== null &&
    params.chainLength > params.previousBestChainLength
      ? PERSONAL_BEST_MILESTONE_BONUS
      : 0;

  return winBonus + milestoneBonus;
}

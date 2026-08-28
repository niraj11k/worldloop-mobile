/**
 * Game constants.
 * Error copy sourced verbatim from Wireframe doc section 10 — do not alter
 * wording without updating that doc, since it's been reviewed for tone
 * ("avoid making casual players feel like they are taking an examination").
 */
import type { InvalidReason } from '@app-types/game';

export const INVALID_WORD_MESSAGES: Record<InvalidReason, string> = {
  wrong_letter: 'Your word must begin with {letter}.',
  unknown_word: 'That word is not in this game’s word list.',
  proper_noun: 'Names and proper nouns are not allowed.',
  duplicate: 'You already used that word.',
  too_short: 'Words must contain at least three letters.',
  unsupported_symbols: 'Use letters only.',
  offensive_excluded: 'That word cannot be used in WordLoop.',
};

/**
 * Wireframe doc section 9, "No computer move" state. Applies to both
 * `player_win` and `draw` — both are triggered by the computer having no
 * legal word (see `gameSession.ts`'s status mapping); the wireframe doesn't
 * distinguish copy between them, only WL-308's fuller game-over screen will.
 */
export const NO_COMPUTER_MOVE_MESSAGE = 'The computer has no valid word.';

export const MIN_WORD_LENGTH = 3;
export const HINT_LEVELS = ['required_letter', 'word_count', 'example_word', 'definition_clue'] as const;

/**
 * Delivery Plan D-04 (closed): v1 ships guest-only. Account creation, the
 * soft-prompt policy, and every hard-gated feature stay implemented and
 * tested but dormant behind this flag until the 1.1 accounts release.
 */
export const ACCOUNTS_ENABLED_V1 = false;

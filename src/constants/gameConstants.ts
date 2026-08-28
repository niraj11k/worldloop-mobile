/**
 * Game constants.
 * Error copy sourced verbatim from Wireframe doc section 10 — do not alter
 * wording without updating that doc, since it's been reviewed for tone
 * ("avoid making casual players feel like they are taking an examination").
 */
import type { GameStatus, HintLevel, InvalidReason } from '@app-types/game';

export const INVALID_WORD_MESSAGES: Record<InvalidReason, string> = {
  wrong_letter: 'Your word must begin with {letter}.',
  unknown_word: 'That word is not in this game’s word list.',
  proper_noun: 'Names and proper nouns are not allowed.',
  duplicate: 'You already used that word.',
  too_short: 'Words must contain at least three letters.',
  unsupported_symbols: 'Use letters only.',
  offensive_excluded: 'That word cannot be used in WordLoop.',
};

/** Wireframe doc section 17, "Computer response timeout" state. */
export const COMPUTER_TIMEOUT_MESSAGE = 'WordLoop is taking longer than expected.';

/**
 * Wireframe doc section 14's game-over content, one entry per `GameStatus`
 * result. Only "You Win!" is literal copy from the doc — the other four
 * headlines, and all five descriptions, are this task's own writing (WL-308),
 * kept inside section 14's "avoid overly competitive language" instruction:
 * no "You Lose", neutral framing for `computer_win`/`abandoned`/
 * `technical_failure`. Descriptions reuse the reviewed sentences the earlier
 * minimal round-over treatment (WL-301/302) already used, so the wording
 * itself isn't new, only its pairing with a headline and richer stats.
 *
 * `player_win` and `draw` share the same underlying cause — the computer
 * having no legal word (see `gameSession.ts`'s status-mapping table) — but
 * get distinct headlines here since which one occurred matters to the player
 * even though the mechanic is identical.
 */
export const GAME_OVER_CONTENT: Record<
  Exclude<GameStatus, 'active'>,
  { headline: string; description: string }
> = {
  player_win: {
    headline: 'You Win!',
    description: 'WordLoop ran out of valid words.',
  },
  computer_win: {
    headline: 'WordLoop Wins!',
    description: 'No words were left beginning with that letter.',
  },
  draw: {
    headline: "It's a Draw!",
    description: 'The dictionary ran out for both of you.',
  },
  abandoned: {
    headline: 'Round Ended',
    description: 'You left before the round finished.',
  },
  technical_failure: {
    headline: 'Something Went Wrong',
    description: 'This round had to stop unexpectedly.',
  },
};

/**
 * WL-401's confirm-before-discard copy (Wireframe section 13, "confirm before
 * restarting or exiting"). The doc states the rule but gives no wording, so
 * this is written to section 10's reviewed tone — states the consequence
 * plainly, no scolding, no "are you sure".
 *
 * The labels name the outcome rather than answering a question ("Discard
 * Round" / "Keep Playing", not "Yes" / "No"), so the destructive one is still
 * unambiguous when a screen reader reads the buttons apart from the message.
 * Reused by WL-404's Pause screen, whose Exit and Restart discard the same
 * round in the same way.
 */
export const DISCARD_ROUND_CONFIRM = {
  title: 'Leave this round?',
  message: 'Your chain and score for this round will be lost.',
  confirmLabel: 'Discard Round',
  cancelLabel: 'Keep Playing',
} as const;

export const MIN_WORD_LENGTH = 3;
export const HINT_LEVELS: readonly HintLevel[] = [
  'required_letter',
  'word_count',
  'example_word',
  'definition_clue',
];

/**
 * PRD section 13 / Wireframe section 11: "hints may be limited per round to
 * preserve challenge," but no doc gives a number. Explicit inference, same
 * posture as `GameScreen.tsx`'s `COMPUTER_TURN_TIMEOUT_MS` — flat across
 * difficulties, since nothing ties hint economy to difficulty (that governs
 * the computer's play strength, a different axis).
 */
export const HINT_LIMIT_PER_ROUND = 3;

/**
 * Delivery Plan D-04 (closed): v1 ships guest-only. Account creation, the
 * soft-prompt policy, and every hard-gated feature stay implemented and
 * tested but dormant behind this flag until the 1.1 accounts release.
 */
export const ACCOUNTS_ENABLED_V1 = false;

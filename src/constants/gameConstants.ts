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
 * Wireframe doc section 12's unavailable state, copied exactly — including
 * the line break, which the doc's own block sets between the two sentences.
 *
 * Deliberately not phrased or styled as an error (WL-501). About 30% of the
 * playable word list has no bundled gloss, so this is an ordinary outcome a
 * player will meet in normal play, not a failure — the second sentence is
 * what makes that clear, and is why it is copy rather than an `Error:` line.
 */
export const DEFINITION_UNAVAILABLE_MESSAGE =
  'Definition unavailable for this word.\nYou can continue playing.';

/**
 * Wireframe doc section 17's "Network unavailable" state (WL-506).
 *
 * **Not the doc's copy verbatim, and deliberately so** — the doc's third line
 * ("Definitions and statistics sync later") became false and would promise the
 * player something v1 does not do. Definitions are bundled on the device
 * (WL-501, closing D-08), and statistics never sync because there is no
 * backend (D-03) and no account to sync them to (D-04). Wireframe section 17
 * has been updated to match; this is recorded here as well because a
 * divergence from a spec'd string is exactly the thing WL-304 established
 * should never be silent.
 *
 * The first two lines survive intact, because they are the point: an
 * offline-native word game that keeps working is reassurance the player has no
 * other way to discover.
 */
export const OFFLINE_NOTICE =
  'You are offline.\nYou can keep playing — the word list and definitions are already on your device.';

/** Wireframe doc section 17's "Dictionary unavailable" state, verbatim. */
export const DICTIONARY_UNAVAILABLE_MESSAGE =
  'Word checking is temporarily unavailable.\nPlease try again shortly.';

/** Wireframe doc section 17's "Word review empty state", both lines. */
export const WORD_REVIEW_EMPTY_STATE =
  'No reviewed words yet.\nPlay a game to discover new vocabulary.';

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

/**
 * WL-403: shown when the player starts a new round while one is saved.
 *
 * Same rule as `DISCARD_ROUND_CONFIRM` — nothing discards a round without
 * being asked (Wireframe section 13) — but a different situation, so a
 * different message: the round at risk is not the one on screen, and the way
 * to keep it is the Resume entry the player just walked past. The message
 * says so, since a dialog that only offers "lose it" or "cancel" leaves the
 * player to work out the third option themselves.
 */
export const START_NEW_ROUND_CONFIRM = {
  title: 'Start a new round?',
  message: 'Your saved round will be lost. Resume Game keeps it.',
  confirmLabel: 'Start New',
  cancelLabel: 'Cancel',
} as const;

/**
 * WL-404: Pause's Restart, the third place a round can be given up
 * (Wireframe section 13, "confirm before restarting or exiting").
 *
 * Restart gets its own copy rather than reusing `DISCARD_ROUND_CONFIRM`
 * because the two answer different questions: leaving asks whether to give up
 * the round, restarting asks whether to trade it for another one. Exit to
 * Home has no copy of its own at all — it is a navigation, so WL-401's
 * "Leave this round?" already covers it.
 */
export const RESTART_ROUND_CONFIRM = {
  title: 'Restart this round?',
  message: 'Your chain and score for this round will be lost, and a new word dealt.',
  confirmLabel: 'Restart',
  cancelLabel: 'Keep Playing',
} as const;

/**
 * Wireframe section 17's "Home without statistics", verbatim — the only copy
 * in this file the doc supplies word for word alongside the invalid-word
 * messages. Shown on a fresh install and after Reset Statistics (WL-405).
 *
 * Split into two lines because they do different jobs: the first states the
 * fact, the second is the invitation. The screen sizes them differently for
 * exactly that reason.
 */
export const HOME_EMPTY_STATE = {
  headline: 'No games completed yet.',
  body: 'Start your first chain to build your score.',
} as const;

/**
 * Wireframe section 7's worked example (WL-406).
 *
 * The doc is emphatic that this screen "should include a real example rather
 * than only abstract instructions", and its own mockup runs
 * apple → elephant → table. Kept as data rather than three hardcoded rows
 * because the whole point is the *pattern*: each entry names who played, the
 * word, and the letter that word hands to the other side.
 *
 * `handoff` is the last letter of `word` — the screen renders it rather than
 * deriving it, so the example reads identically to a player who is looking at
 * the required-letter callout in a real round.
 */
export const HOW_TO_PLAY_EXAMPLE = [
  { actor: 'WordLoop', word: 'apple', handoff: 'e' },
  { actor: 'You', word: 'elephant', handoff: 't' },
  { actor: 'WordLoop', word: 'table', handoff: 'e' },
] as const;

/**
 * The six v1 rules, exactly as Wireframe section 7's "Requirements" list
 * gives them — no more (the screen must not teach rules v1 doesn't enforce)
 * and no fewer (the Delivery Plan's WL-406 criterion is "covers exactly the
 * six v1 rules").
 *
 * The three the old skeleton screen showed were rules 3, 4 and 5; rules 1, 2
 * and 6 were missing entirely, including the one the whole game turns on.
 *
 * `{hints}` is substituted with `HINT_LIMIT_PER_ROUND` at render, the same
 * placeholder convention `INVALID_WORD_MESSAGES` uses for `{letter}` — the
 * limit is a tunable (WL-605), and a rules screen that quietly disagrees with
 * the game is worse than one that says nothing.
 */
export const HOW_TO_PLAY_RULES = [
  'Start your word with the required letter.',
  'Use a word from the game’s word list.',
  'Names are not allowed.',
  'You cannot repeat a word already played.',
  'Words must be at least three letters.',
  'Stuck? Use a hint — {hints} per round.',
] as const;

/**
 * Wireframe section 16's two destructive settings (WL-407). Both confirm
 * first, like every other way a player can lose something (WL-401's rule).
 *
 * They are separate actions with separate warnings because they destroy
 * different things: a reset clears the scoreboard, a deletion ends the guest.
 * The deletion message itemises what goes, as the Guest Deletion doc's own
 * wireframe does — "explain what will be deleted and require confirmation" —
 * and says plainly that the words go too, since `resetStatistics`
 * deliberately keeps those and a player who has done both should be able to
 * tell them apart.
 */
export const RESET_STATISTICS_CONFIRM = {
  title: 'Reset statistics?',
  message:
    'Your scores, streak, and game history will be cleared. Words you have discovered are kept.',
  confirmLabel: 'Reset',
  cancelLabel: 'Cancel',
} as const;

export const DELETE_GUEST_DATA_CONFIRM = {
  title: 'Delete your data?',
  message:
    // WL-505 added word reports to the list. They carry free text the player
    // wrote, so leaving them behind after "delete my data" would be the one
    // kind of data this dialog should least be wrong about.
    'This deletes your scores, game history, discovered words, word reports, and settings from this device, and starts a new guest. It cannot be undone.',
  confirmLabel: 'Delete',
  cancelLabel: 'Cancel',
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

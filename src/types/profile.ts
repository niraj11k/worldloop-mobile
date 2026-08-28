/**
 * Domain types for the on-device guest profile.
 *
 * Mirrors Data Model doc sections 2 (`GuestProfile`), 6 (`RoundSummary`) and
 * 7 (`DiscoveredWord`), as realized for a guest-only, local-first v1
 * (Architecture doc section 8.1, Guest Deletion doc "Best v1 approach").
 * The doc's field-by-field reconciliation with this shape is Data Model
 * section 2.1, added by WL-402 — the same treatment section 4.1 already gives
 * `GameSessionState`.
 */
import type { GameStatus } from '@app-types/game';

/** Every round result except `active` — a round that has actually finished. */
export type RoundResult = Exclude<GameStatus, 'active'>;

/**
 * Data Model section 6. `result` reuses `GameStatus` rather than inventing a
 * parallel win/loss vocabulary, exactly as that section instructs.
 */
export interface RoundSummary {
  sessionId: string;
  finalScore: number;
  wordsPlayed: number;
  longestChain: number;
  hintsUsed: number;
  result: RoundResult;
  isPersonalBest: boolean;
  createdAt: string;
}

/**
 * Data Model section 7.
 *
 * `ownerType` is always `guest` in v1 — accounts are dormant behind
 * `ACCOUNTS_ENABLED_V1` (D-04) — but the field is kept because it is what
 * makes these records transferable at conversion rather than needing a
 * migration then.
 *
 * `definitionViewed` / `pronunciationViewed` are written by the definition
 * overlay (Phase 5), so every record this task writes starts `false`.
 */
export interface DiscoveredWord {
  ownerType: 'guest' | 'account';
  ownerId: string;
  word: string;
  sessionId: string;
  definitionViewed: boolean;
  pronunciationViewed: boolean;
  firstSeenAt: string;
}

/**
 * The `settings` field of `GuestProfile`.
 *
 * Wireframe section 16's v1 list is longer than this (text size, privacy
 * policy, terms, report a word, and so on), but most of those entries are
 * links or actions rather than stored preferences, and text size is an OS
 * setting the app honours rather than one it stores (WL-408). WL-407 adds any
 * genuine toggle this list is missing when it builds the real screen.
 */
export interface GuestSettings {
  soundEnabled: boolean;
  hapticsEnabled: boolean;
}

/** Best-ever figures, kept outside the capped history — see `localScores`. */
export interface GuestBests {
  score: number;
  chainLength: number;
}

/**
 * Consecutive-win streak (`local_streak` in Data Model section 2).
 *
 * **No doc defines what a WordLoop streak counts, so this is WL-402's
 * decision, flagged rather than assumed silently.** Consecutive *wins* is the
 * reading the docs narrow to: Wireframe section 5 offers "best streak **or**
 * longest chain" as alternatives, which rules out longest chain, and
 * Architecture section 8.2 lists "returning on a new day" as a milestone
 * separate from "streak milestone", which rules out consecutive days. WL-405
 * displays this and may overrule it — see the WL-402 note in the Delivery
 * Plan.
 */
export interface GuestStreak {
  current: number;
  best: number;
}

export interface GuestProfile {
  /** Bumped whenever this shape changes incompatibly; see `parseProfile`. */
  schemaVersion: number;
  guestId: string;
  createdAt: string;
  /** Last round played — activity, not mere presence. */
  lastActiveAt: string;
  /** Last app launch. Distinct from `lastActiveAt`: opening is not playing. */
  lastSeenAt: string;
  /** Completed rounds only — see `recordRoundCompleted`. */
  gamesPlayed: number;
  /** Newest first, capped at `MAX_RETAINED_ROUNDS`. */
  localScores: RoundSummary[];
  /**
   * Best-ever score and chain, held separately from `localScores` precisely
   * because that list is capped — a record beyond the cap must not silently
   * lower the player's personal best when it ages out.
   */
  bests: GuestBests;
  localStreak: GuestStreak;
  discoveredWords: DiscoveredWord[];
  settings: GuestSettings;
  /** Guest-to-account conversion (Data Model section 2); dormant under D-04. */
  isLinked: boolean;
  linkedUserId: string | null;
}

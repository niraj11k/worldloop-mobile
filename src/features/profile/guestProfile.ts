/**
 * Guest profile domain logic (WL-402).
 *
 * Spec: Data Model doc section 2 (`GuestProfile`) and 2.1 (the v1 runtime
 * shape this implements), Architecture doc section 8.1 ("guest profile
 * created locally and immediately on first use, no server account required"),
 * and the Guest Deletion doc's "Best v1 approach" — everything on-device,
 * nothing sent anywhere.
 *
 * ## Pure by design
 *
 * Same posture as `gameSession.ts` and `promptPolicy.ts`: every function here
 * takes the facts it needs — including `now` — and returns a new profile. It
 * never touches storage. Reading and writing is `profileRepository`'s job and
 * the store's; keeping them apart is what makes the update rules (which
 * results count as a game played, when a streak breaks, what a reset clears)
 * exhaustively testable without a device.
 */
import { isSettledResult } from '@features/scoring/scoringEngine';
import type { GameSessionState } from '@app-types/game';
import type {
  DiscoveredWord,
  GuestProfile,
  GuestSettings,
  RoundSummary,
} from '@app-types/profile';

/**
 * Bumped only when a change to `GuestProfile` cannot be read by the tolerant
 * repair in `parseProfile` — a renamed or re-typed field, not an added one.
 * A stored profile carrying a *lower* version is migrated forward; one
 * carrying a higher version was written by a newer build and is left alone
 * (see `parseProfile`).
 *
 * This is what makes "survives an app update" a property of the code rather
 * than a hope: any future shape change has to state, here, how the profiles
 * already on players' phones become readable.
 */
export const CURRENT_SCHEMA_VERSION = 1;

/**
 * How many `RoundSummary` records the profile keeps.
 *
 * The history exists to show recent rounds, not to be a permanent ledger, and
 * an uncapped array grows for the life of the install inside a value that is
 * rewritten after every round. Personal bests are held outside it (`bests`)
 * precisely so trimming can never lower one.
 */
export const MAX_RETAINED_ROUNDS = 100;

/**
 * How many discovered words count as "several" for the trigger policy's
 * repeated-engagement prompt (WL-503). See `newWordsMilestoneReached`.
 *
 * Note the contrast with `localScores` above: discovered words are **not**
 * capped. They are the one thing `resetStatistics` deliberately keeps, and
 * WL-502's review screen and the 1.1 vocabulary-history feature both read the
 * whole list — a cap here would silently delete the player's vocabulary. The
 * list grows by at most a handful of *new* words per round and stores a short
 * record each, so it stays small in practice.
 */
const NEW_WORDS_MILESTONE = 25;

const DEFAULT_SETTINGS: GuestSettings = {
  soundEnabled: true,
  hapticsEnabled: true,
};

/**
 * A local-only identifier for a guest.
 *
 * `Math.random` is deliberate, not an oversight: this id names a profile in
 * this app's own storage, is never sent anywhere (D-03: there is no backend),
 * and guards nothing — so it needs to be unique on one device, which
 * timestamp-plus-entropy is. If server-side guest records ever appear (Data
 * Model section 2's `data_expiry_at` branch), that is the point to replace
 * this with a real UUID, because collisions would then be across all
 * installs rather than within one.
 */
export function newGuestId(now: Date): string {
  const entropy = Math.random().toString(36).slice(2, 10);
  return `guest-${now.getTime().toString(36)}-${entropy}`;
}

export function createGuestProfile(params: { now: Date; guestId?: string }): GuestProfile {
  const timestamp = params.now.toISOString();
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    guestId: params.guestId ?? newGuestId(params.now),
    createdAt: timestamp,
    lastActiveAt: timestamp,
    lastSeenAt: timestamp,
    gamesPlayed: 0,
    localScores: [],
    bests: { score: 0, chainLength: 0 },
    localStreak: { current: 0, best: 0 },
    discoveredWords: [],
    settings: { ...DEFAULT_SETTINGS },
    isLinked: false,
    linkedUserId: null,
  };
}

/** The app was opened. Presence, not activity — see the two field docs. */
export function markSeen(profile: GuestProfile, now: Date): GuestProfile {
  return { ...profile, lastSeenAt: now.toISOString() };
}

export function updateSettings(
  profile: GuestProfile,
  patch: Partial<GuestSettings>,
): GuestProfile {
  return { ...profile, settings: { ...profile.settings, ...patch } };
}

/**
 * Condenses a finished round into the record the profile keeps (Data Model
 * section 6).
 *
 * `isPersonalBest` is decided against `previousBestChainLength` — the
 * baseline copied into the session when it was created (WL-111) — and not
 * against the live profile, so this agrees exactly with the bonus the round
 * already paid out and with what `GameOverPanel` already told the player.
 * Reading the live profile here could disagree with both if another round had
 * been recorded in between.
 *
 * "Words played" and "longest chain" are both the chain length, as the
 * Wireframe section 14 mockup itself shows them (18/18) — a chain only grows
 * until the round ends.
 */
export function summarizeRound(session: GameSessionState, now: Date): RoundSummary | null {
  if (session.status === 'active') return null;

  return {
    sessionId: session.sessionId,
    finalScore: session.score,
    wordsPlayed: session.chain.length,
    longestChain: session.chain.length,
    hintsUsed: session.hintsUsed,
    result: session.status,
    isPersonalBest:
      isSettledResult(session.status) &&
      session.previousBestChainLength !== null &&
      session.chain.length > session.previousBestChainLength,
    createdAt: now.toISOString(),
  };
}

/**
 * The player's own words from a round, as `DiscoveredWord` records (Data
 * Model section 7).
 *
 * The computer's words are excluded: "discovered" means the player found it.
 * A word already on the profile is not re-recorded — `firstSeenAt` means
 * first, and the round that first surfaced it is the one worth keeping.
 */
function newDiscoveredWords(
  profile: GuestProfile,
  session: GameSessionState,
  now: Date,
): DiscoveredWord[] {
  const known = new Set(profile.discoveredWords.map(entry => entry.word));
  const seenThisRound = new Set<string>();

  return session.chain
    .filter(move => move.actor === 'player' && move.isValid)
    .filter(move => {
      if (known.has(move.normalizedWord) || seenThisRound.has(move.normalizedWord)) {
        return false;
      }
      seenThisRound.add(move.normalizedWord);
      return true;
    })
    .map(move => ({
      ownerType: 'guest' as const,
      ownerId: profile.guestId,
      word: move.normalizedWord,
      sessionId: session.sessionId,
      definitionViewed: false,
      pronunciationViewed: false,
      firstSeenAt: now.toISOString(),
    }));
}

/**
 * The words this round was the first to surface (WL-503).
 *
 * Read back off the profile by `sessionId` rather than recomputed from the
 * session, and that is what makes it trustworthy: `newDiscoveredWords` has
 * already applied the "genuinely new" rule against the whole profile, so
 * anything carrying this round's id is by construction a word the player had
 * never played before. Recomputing it at the call site would be a second
 * implementation of that rule, free to disagree with the stored one.
 *
 * Feeds Wireframe §14's "new words discovered" line and WL-502's review
 * screen, which needs the same list rather than a count of it.
 */
export function discoveredWordsForSession(
  profile: GuestProfile,
  sessionId: string,
): DiscoveredWord[] {
  return profile.discoveredWords.filter(entry => entry.sessionId === sessionId);
}

/**
 * Records that the player opened a definition for `word` (WL-501/WL-502).
 *
 * `definitionViewed` is a Data Model §7 field that every record has written as
 * `false` since WL-402, whose own comment reserved it for "the definition
 * overlay (Phase 5)" — this is that. It exists so PRD §12's learning features
 * can tell a word the player merely played from one they stopped to look up,
 * and so WL-602's `definition opened` event has a durable counterpart that
 * survives a reinstall of the analytics layer.
 *
 * Returns the profile unchanged when the word is not on it or was already
 * viewed, so callers can fire this on every open without checking — a word
 * played but never *discovered* (because an earlier round found it) still has
 * a record to mark, and a word the player has never played has nothing to say.
 */
export function markDefinitionViewed(profile: GuestProfile, word: string): GuestProfile {
  const normalizedWord = word.trim().toLowerCase();
  const needsUpdate = profile.discoveredWords.some(
    entry => entry.word === normalizedWord && !entry.definitionViewed,
  );
  if (!needsUpdate) return profile;

  return {
    ...profile,
    discoveredWords: profile.discoveredWords.map(entry =>
      entry.word === normalizedWord ? { ...entry, definitionViewed: true } : entry,
    ),
  };
}

/**
 * Trigger-policy doc, "After repeated engagement": "discovering several new
 * words." Dormant under D-04 like the rest of the account surface — this is
 * the predicate `promptPolicy`'s existing `new_words_milestone` trigger needs,
 * not a prompt.
 *
 * "Several" is left as one explicit number here rather than scattered through
 * callers; no doc gives one, the same posture `HINT_LIMIT_PER_ROUND` takes.
 * Every multiple counts, so a player who keeps finding words keeps qualifying
 * — the 30-day cooldown and per-cycle cap in `promptPolicy` are what stop that
 * becoming nagging, which is the layer that already owns that job.
 */
export function newWordsMilestoneReached(
  profile: GuestProfile,
  wordsBefore: number,
): boolean {
  const before = Math.floor(wordsBefore / NEW_WORDS_MILESTONE);
  const after = Math.floor(profile.discoveredWords.length / NEW_WORDS_MILESTONE);
  return after > before;
}

/**
 * Folds a finished round into the profile.
 *
 * Three different rules apply to the same round, which is why this isn't one
 * blanket "update everything":
 *
 * - **History and discovered words** record every finished round, abandoned
 *   ones included. Leaving them out would make the history quietly disagree
 *   with what the player actually did, and a word the player found is found
 *   whether or not they stayed to the end.
 * - **`gamesPlayed`, `bests` and the streak** count only *settled* results
 *   (`isSettledResult`). `gamesPlayed` in particular drives the trigger doc's
 *   "after first completed game" / "after three more completed games"
 *   prompts, which are explicitly about completed games — and using the same
 *   gate as `roundEndBonus` means the profile can never refuse to record a
 *   milestone the round already paid a bonus for.
 * - **The streak** advances on a win, breaks on a loss, and is left alone by
 *   a draw — nobody won, so nothing was broken either.
 *
 * An `active` session is ignored rather than throwing: a round still in play
 * has nothing to record, and WL-403's restore path can legitimately hand one
 * back.
 */
export function recordRoundCompleted(
  profile: GuestProfile,
  session: GameSessionState,
  now: Date,
): GuestProfile {
  const summary = summarizeRound(session, now);
  if (summary === null) return profile;

  const settled = isSettledResult(summary.result);
  const streak = nextStreak(profile, summary.result);

  return {
    ...profile,
    lastActiveAt: now.toISOString(),
    gamesPlayed: settled ? profile.gamesPlayed + 1 : profile.gamesPlayed,
    localScores: [summary, ...profile.localScores].slice(0, MAX_RETAINED_ROUNDS),
    bests: settled
      ? {
          score: Math.max(profile.bests.score, summary.finalScore),
          chainLength: Math.max(profile.bests.chainLength, summary.longestChain),
        }
      : profile.bests,
    localStreak: streak,
    discoveredWords: [
      ...profile.discoveredWords,
      ...newDiscoveredWords(profile, session, now),
    ],
  };
}

function nextStreak(profile: GuestProfile, result: RoundSummary['result']) {
  if (result === 'player_win') {
    const current = profile.localStreak.current + 1;
    return { current, best: Math.max(profile.localStreak.best, current) };
  }
  if (result === 'computer_win') {
    return { ...profile.localStreak, current: 0 };
  }
  // draw, abandoned, technical_failure — neither won, so nothing broke.
  return profile.localStreak;
}

/**
 * Wireframe section 16's "Reset statistics".
 *
 * Clears what the player would call their statistics — games played, history,
 * bests, streak — and deliberately keeps `discoveredWords`: the vocabulary
 * list is the point of Word Review (PRD section 12), not a statistic, and
 * someone clearing their scores has not asked to forget every word they ever
 * learned. Settings and identity are untouched; wiping those is
 * `deleteGuestData`, a different control with its own confirmation.
 */
export function resetStatistics(profile: GuestProfile, now: Date): GuestProfile {
  return {
    ...profile,
    lastActiveAt: now.toISOString(),
    gamesPlayed: 0,
    localScores: [],
    bests: { score: 0, chainLength: 0 },
    localStreak: { current: 0, best: 0 },
  };
}

export function serializeProfile(profile: GuestProfile): string {
  return JSON.stringify(profile);
}

/**
 * Reads a stored profile back, repairing what it safely can.
 *
 * Tolerant on purpose. The alternative — reject anything not exactly right
 * and start fresh — means one unreadable field costs the player every score
 * they have. So a missing or wrong-typed *collection* or *counter* is
 * replaced with its empty value, and only an unusable **identity**
 * (`guestId`) makes the profile unreadable, since without it the records
 * can't be attributed to anyone.
 *
 * Returns `null` for "there is no usable profile here" — the caller's cue to
 * create one, which is also the fresh-install path.
 *
 * A profile from a *newer* build is left alone rather than repaired: this
 * build cannot know what its fields mean, and quietly rewriting it in the old
 * shape would destroy data if the player downgrades or the newer build runs
 * again.
 */
export function parseProfile(raw: string | null): GuestProfile | null {
  if (raw === null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return null;
  }

  const stored = parsed as Partial<GuestProfile>;
  if (typeof stored.guestId !== 'string' || stored.guestId.length === 0) {
    return null;
  }
  if (typeof stored.schemaVersion === 'number' && stored.schemaVersion > CURRENT_SCHEMA_VERSION) {
    return null;
  }

  const createdAt = isoOr(stored.createdAt, null);
  const fallbackTimestamp = createdAt ?? new Date(0).toISOString();

  return {
    // Migrations from older versions would run here. There is only one
    // version so far, so a stored profile is either current or predates the
    // field entirely (treated as version 1, since the repairs below cover
    // exactly what such a profile could be missing).
    schemaVersion: CURRENT_SCHEMA_VERSION,
    guestId: stored.guestId,
    createdAt: createdAt ?? fallbackTimestamp,
    lastActiveAt: isoOr(stored.lastActiveAt, fallbackTimestamp),
    lastSeenAt: isoOr(stored.lastSeenAt, fallbackTimestamp),
    gamesPlayed: countOr(stored.gamesPlayed),
    localScores: Array.isArray(stored.localScores)
      ? stored.localScores.slice(0, MAX_RETAINED_ROUNDS)
      : [],
    bests: {
      score: countOr(stored.bests?.score),
      chainLength: countOr(stored.bests?.chainLength),
    },
    localStreak: {
      current: countOr(stored.localStreak?.current),
      best: countOr(stored.localStreak?.best),
    },
    discoveredWords: Array.isArray(stored.discoveredWords) ? stored.discoveredWords : [],
    settings: {
      soundEnabled: boolOr(stored.settings?.soundEnabled, DEFAULT_SETTINGS.soundEnabled),
      hapticsEnabled: boolOr(stored.settings?.hapticsEnabled, DEFAULT_SETTINGS.hapticsEnabled),
    },
    isLinked: boolOr(stored.isLinked, false),
    linkedUserId: typeof stored.linkedUserId === 'string' ? stored.linkedUserId : null,
  };
}

function isoOr<T extends string | null>(value: unknown, fallback: T): string | T {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : fallback;
}

/** Counters can only be finite and non-negative; anything else reads as 0. */
function countOr(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
}

function boolOr(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

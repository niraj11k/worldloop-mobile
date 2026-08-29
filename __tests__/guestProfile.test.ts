import {
  CURRENT_SCHEMA_VERSION,
  MAX_RETAINED_ROUNDS,
  createGuestProfile,
  markSeen,
  newGuestId,
  parseProfile,
  recordRoundCompleted,
  resetStatistics,
  serializeProfile,
  summarizeRound,
  updateSettings,
} from '@features/profile/guestProfile';
import {
  abandonSession,
  applyComputerCannotMove,
  applyComputerMove,
  applyValidation,
  beginValidation,
  chargeHint,
  createSession,
  failSession,
  setInput,
} from '@features/game/gameSession';
import type { GameSessionState } from '@app-types/game';
import type { GuestProfile } from '@app-types/profile';
import type { ValidationResult } from '@features/game/ruleEngine';

const NOW = new Date('2026-08-29T10:00:00.000Z');
const LATER = new Date('2026-08-29T11:30:00.000Z');

const valid = (word: string): ValidationResult => ({
  isValid: true,
  normalizedWord: word,
  reason: null,
  entry: null,
});

const newProfile = (): GuestProfile => createGuestProfile({ now: NOW, guestId: 'guest-test' });

/** A round with `words.length` player moves, before any ending is applied. */
const playedSession = (words: string[], previousBest: number | null = null): GameSessionState =>
  words.reduce(
    (state, word) =>
      applyValidation(beginValidation(setInput(state, word)), {
        submittedWord: word,
        result: valid(word),
        scoreAwarded: 10,
      }),
    createSession({
      sessionId: 'session-1',
      difficulty: 'easy',
      startingWord: 'apple',
      previousBestChainLength: previousBest,
    }),
  );

const playerWin = (words: string[], previousBest: number | null = null): GameSessionState =>
  applyComputerCannotMove(playedSession(words, previousBest), { playerRepliesRemaining: 5 });

const computerWin = (words: string[]): GameSessionState =>
  applyComputerMove(playedSession(words), { word: 'zebra', playerRepliesRemaining: 0 });

describe('createGuestProfile', () => {
  it('creates a playable profile with no history (Architecture §8.1)', () => {
    const profile = newProfile();
    expect(profile).toMatchObject({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      guestId: 'guest-test',
      gamesPlayed: 0,
      localScores: [],
      bests: { score: 0, chainLength: 0 },
      localStreak: { current: 0, best: 0 },
      discoveredWords: [],
      isLinked: false,
      linkedUserId: null,
    });
    expect(profile.createdAt).toBe(NOW.toISOString());
  });

  it('defaults sound and haptics on', () => {
    expect(newProfile().settings).toEqual({ soundEnabled: true, hapticsEnabled: true });
  });

  it('mints a distinct id per guest when none is supplied', () => {
    // A fresh install must not reuse the previous install's identity — there
    // is nothing off-device to reclaim (Guest Deletion doc).
    const ids = new Set(Array.from({ length: 50 }, () => newGuestId(NOW)));
    expect(ids.size).toBe(50);
  });
});

describe('markSeen and updateSettings', () => {
  it('records a launch without claiming activity', () => {
    const seen = markSeen(newProfile(), LATER);
    expect(seen.lastSeenAt).toBe(LATER.toISOString());
    expect(seen.lastActiveAt).toBe(NOW.toISOString());
  });

  it('patches one setting without disturbing the other', () => {
    const updated = updateSettings(newProfile(), { soundEnabled: false });
    expect(updated.settings).toEqual({ soundEnabled: false, hapticsEnabled: true });
  });
});

describe('summarizeRound', () => {
  it('returns null for a round still in play', () => {
    expect(summarizeRound(playedSession(['eagle']), NOW)).toBeNull();
  });

  it('condenses a finished round (Data Model §6)', () => {
    const summary = summarizeRound(playerWin(['eagle', 'echo']), NOW);
    expect(summary).toMatchObject({
      sessionId: 'session-1',
      wordsPlayed: 3,
      longestChain: 3,
      hintsUsed: 0,
      result: 'player_win',
      createdAt: NOW.toISOString(),
    });
  });

  it('judges a personal best against the session baseline, not the live profile', () => {
    // The baseline is copied in at creation (WL-111), so the summary agrees
    // with the bonus the round already paid and with what the player was told.
    expect(summarizeRound(playerWin(['eagle', 'echo'], 2), NOW)?.isPersonalBest).toBe(true);
    expect(summarizeRound(playerWin(['eagle', 'echo'], 9), NOW)?.isPersonalBest).toBe(false);
  });

  it('never claims a personal best with no baseline known', () => {
    expect(summarizeRound(playerWin(['eagle'], null), NOW)?.isPersonalBest).toBe(false);
  });

  it('never claims a personal best on an unsettled result', () => {
    const abandoned = abandonSession(playedSession(['eagle', 'echo'], 0));
    expect(summarizeRound(abandoned, NOW)?.isPersonalBest).toBe(false);
  });
});

describe('recordRoundCompleted', () => {
  it('ignores a round that is still active', () => {
    const profile = newProfile();
    expect(recordRoundCompleted(profile, playedSession(['eagle']), LATER)).toBe(profile);
  });

  it('counts a settled round as a game played and updates the bests', () => {
    const profile = recordRoundCompleted(newProfile(), playerWin(['eagle', 'echo']), LATER);
    expect(profile.gamesPlayed).toBe(1);
    expect(profile.bests.chainLength).toBe(3);
    // 2 words x 10, plus the win bonus applied when the round ended.
    expect(profile.bests.score).toBe(playerWin(['eagle', 'echo']).score);
    expect(profile.lastActiveAt).toBe(LATER.toISOString());
  });

  it('keeps the higher best when a later round scores lower', () => {
    const first = recordRoundCompleted(newProfile(), playerWin(['eagle', 'echo']), LATER);
    const second = recordRoundCompleted(first, playerWin(['eagle']), LATER);
    expect(second.bests.chainLength).toBe(3);
  });

  it('records an abandoned round in the history without counting it as played', () => {
    const abandoned = abandonSession(playedSession(['eagle', 'echo']));
    const profile = recordRoundCompleted(newProfile(), abandoned, LATER);
    expect(profile.gamesPlayed).toBe(0);
    expect(profile.localScores).toHaveLength(1);
    expect(profile.localScores[0]?.result).toBe('abandoned');
    expect(profile.bests).toEqual({ score: 0, chainLength: 0 });
  });

  it('does not let a technical failure pay into the statistics', () => {
    const broken = failSession(playedSession(['eagle', 'echo']));
    const profile = recordRoundCompleted(newProfile(), broken, LATER);
    expect(profile.gamesPlayed).toBe(0);
    expect(profile.bests).toEqual({ score: 0, chainLength: 0 });
  });

  it('advances the streak on a win and remembers the best run', () => {
    const profile = [playerWin(['eagle']), playerWin(['eagle']), playerWin(['eagle'])].reduce(
      (acc, session) => recordRoundCompleted(acc, session, LATER),
      newProfile(),
    );
    expect(profile.localStreak).toEqual({ current: 3, best: 3 });
  });

  it('breaks the streak on a loss but keeps the best', () => {
    const won = recordRoundCompleted(newProfile(), playerWin(['eagle']), LATER);
    const lost = recordRoundCompleted(won, computerWin(['eagle']), LATER);
    expect(lost.localStreak).toEqual({ current: 0, best: 1 });
  });

  it('leaves the streak alone on a draw — nobody won, so nothing broke', () => {
    const won = recordRoundCompleted(newProfile(), playerWin(['eagle']), LATER);
    const drawn = applyComputerCannotMove(playedSession(['eagle']), {
      playerRepliesRemaining: 0,
    });
    expect(drawn.status).toBe('draw');
    expect(recordRoundCompleted(won, drawn, LATER).localStreak).toEqual({ current: 1, best: 1 });
  });

  it('records the round hints against the summary', () => {
    const withHint = applyComputerCannotMove(chargeHint(playedSession(['eagle'])), {
      playerRepliesRemaining: 5,
    });
    expect(recordRoundCompleted(newProfile(), withHint, LATER).localScores[0]?.hintsUsed).toBe(1);
  });

  it('keeps the newest rounds and caps the history', () => {
    const profile = Array.from({ length: MAX_RETAINED_ROUNDS + 5 }).reduce<GuestProfile>(
      acc => recordRoundCompleted(acc, playerWin(['eagle']), LATER),
      newProfile(),
    );
    expect(profile.localScores).toHaveLength(MAX_RETAINED_ROUNDS);
    // Every round still counted, even the ones aged out of the history.
    expect(profile.gamesPlayed).toBe(MAX_RETAINED_ROUNDS + 5);
  });

  it('keeps a best that has aged out of the capped history', () => {
    // The reason `bests` is stored rather than derived from `localScores`.
    const big = recordRoundCompleted(newProfile(), playerWin(['eagle', 'echo', 'oxen']), LATER);
    const profile = Array.from({ length: MAX_RETAINED_ROUNDS }).reduce<GuestProfile>(
      acc => recordRoundCompleted(acc, playerWin(['eagle']), LATER),
      big,
    );
    expect(profile.localScores.some(round => round.longestChain === 4)).toBe(false);
    expect(profile.bests.chainLength).toBe(4);
  });

  describe('discovered words (Data Model §7)', () => {
    it('records the player’s own words, not the computer’s', () => {
      const profile = recordRoundCompleted(newProfile(), playerWin(['eagle', 'echo']), LATER);
      expect(profile.discoveredWords.map(entry => entry.word)).toEqual(['eagle', 'echo']);
      // 'apple' is the computer's opening word, seeded into the chain.
      expect(profile.discoveredWords.some(entry => entry.word === 'apple')).toBe(false);
    });

    it('starts every word unviewed and owned by this guest', () => {
      const profile = recordRoundCompleted(newProfile(), playerWin(['eagle']), LATER);
      expect(profile.discoveredWords[0]).toEqual({
        ownerType: 'guest',
        ownerId: 'guest-test',
        word: 'eagle',
        sessionId: 'session-1',
        definitionViewed: false,
        pronunciationViewed: false,
        firstSeenAt: LATER.toISOString(),
      });
    });

    it('does not re-record a word found in an earlier round', () => {
      const first = recordRoundCompleted(newProfile(), playerWin(['eagle']), LATER);
      const second = recordRoundCompleted(first, playerWin(['eagle']), LATER);
      expect(second.discoveredWords).toHaveLength(1);
      expect(second.discoveredWords[0]?.firstSeenAt).toBe(LATER.toISOString());
    });

    it('keeps words from a round the player abandoned', () => {
      const abandoned = abandonSession(playedSession(['eagle']));
      expect(recordRoundCompleted(newProfile(), abandoned, LATER).discoveredWords).toHaveLength(1);
    });
  });
});

describe('resetStatistics (Wireframe §16)', () => {
  it('clears the statistics', () => {
    const played = recordRoundCompleted(newProfile(), playerWin(['eagle', 'echo']), LATER);
    const reset = resetStatistics(played, LATER);
    expect(reset).toMatchObject({
      gamesPlayed: 0,
      localScores: [],
      bests: { score: 0, chainLength: 0 },
      localStreak: { current: 0, best: 0 },
    });
  });

  it('keeps discovered words, settings, and identity', () => {
    const played = updateSettings(
      recordRoundCompleted(newProfile(), playerWin(['eagle']), LATER),
      { soundEnabled: false },
    );
    const reset = resetStatistics(played, LATER);
    expect(reset.discoveredWords).toHaveLength(1);
    expect(reset.settings.soundEnabled).toBe(false);
    expect(reset.guestId).toBe('guest-test');
    expect(reset.createdAt).toBe(NOW.toISOString());
  });
});

describe('parseProfile', () => {
  it('round-trips a profile through storage', () => {
    const profile = recordRoundCompleted(newProfile(), playerWin(['eagle']), LATER);
    expect(parseProfile(serializeProfile(profile))).toEqual(profile);
  });

  it('returns null for nothing stored, junk, or a non-object', () => {
    expect(parseProfile(null)).toBeNull();
    expect(parseProfile('not json')).toBeNull();
    expect(parseProfile('[]')).toBeNull();
    expect(parseProfile('"a string"')).toBeNull();
  });

  it('returns null without a usable identity', () => {
    expect(parseProfile('{"gamesPlayed":4}')).toBeNull();
    expect(parseProfile('{"guestId":""}')).toBeNull();
  });

  it('refuses a profile written by a newer build rather than rewriting it', () => {
    const future = JSON.stringify({ ...newProfile(), schemaVersion: CURRENT_SCHEMA_VERSION + 1 });
    expect(parseProfile(future)).toBeNull();
  });

  it('repairs missing collections and counters instead of discarding the profile', () => {
    // One unreadable field must not cost the player everything else.
    const partial = JSON.stringify({
      guestId: 'guest-test',
      createdAt: NOW.toISOString(),
      gamesPlayed: 7,
      bests: { score: 120 },
    });
    const parsed = parseProfile(partial);
    expect(parsed).toMatchObject({
      guestId: 'guest-test',
      gamesPlayed: 7,
      bests: { score: 120, chainLength: 0 },
      localScores: [],
      discoveredWords: [],
      localStreak: { current: 0, best: 0 },
      settings: { soundEnabled: true, hapticsEnabled: true },
    });
  });

  it('rejects impossible counters', () => {
    const bad = JSON.stringify({
      guestId: 'guest-test',
      gamesPlayed: -3,
      bests: { score: 'lots', chainLength: Number.POSITIVE_INFINITY },
    });
    expect(parseProfile(bad)).toMatchObject({
      gamesPlayed: 0,
      bests: { score: 0, chainLength: 0 },
    });
  });

  it('replaces an unparseable timestamp rather than storing it', () => {
    const bad = JSON.stringify({ guestId: 'guest-test', createdAt: 'yesterday' });
    const parsed = parseProfile(bad);
    expect(Number.isNaN(Date.parse(parsed!.createdAt))).toBe(false);
  });

  it('reads a profile that predates the schema version field', () => {
    // The app-update path: a profile written before a field existed still
    // loads, which is what "survives an app update" has to mean.
    const withoutVersion: Record<string, unknown> = { ...newProfile() };
    delete withoutVersion.schemaVersion;
    const parsed = parseProfile(JSON.stringify(withoutVersion));
    expect(parsed?.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(parsed?.guestId).toBe('guest-test');
  });
});

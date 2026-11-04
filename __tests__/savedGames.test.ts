import { applyPlayerCannotMove, createSession } from '@features/game/gameSession';
import { summarizeRound } from '@features/profile/guestProfile';
import {
  canPause,
  daysSincePlayed,
  difficultyStartFor,
  reconcileSavedGames,
  withCurrentBest,
} from '@features/game/savedGames';
import { resumeGameLabel } from '@constants/gameConstants';

const game = (sessionId: string, difficulty: 'easy' | 'medium' | 'hard') =>
  createSession({ sessionId, difficulty, startingWord: 'apple' });

describe('savedGames (D-13)', () => {
  describe('canPause', () => {
    it('allows pausing while the pause slot is free', () => {
      expect(canPause(null, game('a', 'easy'))).toBe(true);
    });

    it('refuses while another game holds the pause slot (rules 2 and 4)', () => {
      expect(canPause(game('a', 'easy'), game('b', 'medium'))).toBe(false);
    });

    it('allows the game already in the slot, between the two writes of a pause', () => {
      expect(canPause(game('a', 'easy'), game('a', 'easy'))).toBe(true);
    });
  });

  describe('difficultyStartFor', () => {
    it('is an ordinary new game when nothing is paused', () => {
      expect(difficultyStartFor('hard', null)).toBe('new');
    });

    it("offers Resume or End and Start New for the paused game's difficulty (rule 1)", () => {
      expect(difficultyStartFor('easy', game('a', 'easy'))).toBe('resume_or_restart');
    });

    it('starts a game that can only be ended, for any other difficulty (rule 4)', () => {
      expect(difficultyStartFor('medium', game('a', 'easy'))).toBe('new_unpausable');
      expect(difficultyStartFor('hard', game('a', 'easy'))).toBe('new_unpausable');
    });
  });

  describe('reconcileSavedGames', () => {
    it('treats a game found in both slots as the one in play', () => {
      const both = game('a', 'easy');
      expect(reconcileSavedGames({ current: both, paused: both })).toEqual({
        current: both,
        paused: null,
      });
    });

    it('leaves two different games alone', () => {
      const slots = { current: game('a', 'medium'), paused: game('b', 'easy') };
      expect(reconcileSavedGames(slots)).toEqual(slots);
    });

    it('leaves a single or empty slot alone', () => {
      const paused = game('b', 'easy');
      expect(reconcileSavedGames({ current: null, paused })).toEqual({ current: null, paused });
      expect(reconcileSavedGames({ current: null, paused: null })).toEqual({
        current: null,
        paused: null,
      });
    });
  });
});

describe('daysSincePlayed (D-14)', () => {
  // Local-time constructors, since the count is in the device's calendar days.
  const at = (day: number, hour: number) => new Date(2026, 9, day, hour, 0, 0).toISOString();
  const now = new Date(2026, 9, 30, 8, 0, 0);

  it('counts calendar days, not 24-hour periods', () => {
    expect(daysSincePlayed(at(30, 7), now)).toBe(0); // earlier today
    expect(daysSincePlayed(at(29, 23), now)).toBe(1); // late last night: yesterday
    expect(daysSincePlayed(at(27, 12), now)).toBe(3);
  });

  it('is unknown, not guessed, without a time', () => {
    expect(daysSincePlayed(null, now)).toBeNull();
    expect(daysSincePlayed('not a date', now)).toBeNull();
  });

  it('reads a time in the future (the clock moved back) as today', () => {
    expect(daysSincePlayed(at(31, 9), now)).toBe(0);
  });
});

describe('Resume label (Wireframe §5, D-14)', () => {
  it('names today, yesterday and older days', () => {
    expect(resumeGameLabel('easy', 12, 0)).toBe('Resume Easy game · 12 words · today');
    expect(resumeGameLabel('easy', 12, 1)).toBe('Resume Easy game · 12 words · yesterday');
    expect(resumeGameLabel('hard', 5, 3)).toBe('Resume Hard game · 5 words · 3 days ago');
  });

  it('leaves the age off when it is unknown', () => {
    expect(resumeGameLabel('medium', 4, null)).toBe('Resume Medium game · 4 words');
  });
});

describe('withCurrentBest (D-14)', () => {
  it('compares a resumed game against the best now, not the best it started with', () => {
    const paused = { ...game('a', 'easy'), previousBestChainLength: 10 };
    expect(withCurrentBest(paused, 30).previousBestChainLength).toBe(30);
  });

  it('a resumed game shorter than the newer best neither claims nor pays a new best', () => {
    // Paused when the best was 0; meanwhile another game set a best of 30.
    const paused = { ...game('a', 'easy'), previousBestChainLength: 0 };
    const withoutRefresh = applyPlayerCannotMove(paused);
    const withRefresh = applyPlayerCannotMove(withCurrentBest(paused, 30));

    // The bug D-14 fixes: the stale baseline claims a best and pays the +5.
    expect(summarizeRound(withoutRefresh, new Date())?.isPersonalBest).toBe(true);
    expect(summarizeRound(withRefresh, new Date())?.isPersonalBest).toBe(false);
    expect(withRefresh.score).toBeLessThan(withoutRefresh.score);
  });

  it('keeps the baseline it has while the profile is not loaded', () => {
    const paused = { ...game('a', 'easy'), previousBestChainLength: 10 };
    expect(withCurrentBest(paused, null).previousBestChainLength).toBe(10);
  });
});

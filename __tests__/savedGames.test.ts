import { createSession } from '@features/game/gameSession';
import {
  canPause,
  difficultyStartFor,
  reconcileSavedGames,
} from '@features/game/savedGames';

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

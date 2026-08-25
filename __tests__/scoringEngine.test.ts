import {
  scoreWord,
  rarityForEntry,
  roundEndBonus,
  ROUND_WIN_BONUS,
  PERSONAL_BEST_MILESTONE_BONUS,
} from '@features/scoring/scoringEngine';
import { lookupWord } from '@features/dictionary/dictionaryService';

describe('scoringEngine', () => {
  describe('scoreWord', () => {
    it('awards base points only for a minimum-length common word with no hints', () => {
      const score = scoreWord({ wordLength: 3, rarity: 'common', hintUsed: false, hintRevealedWord: false });
      expect(score).toBe(10);
    });

    it('adds 2 points per letter above the minimum length', () => {
      const score = scoreWord({ wordLength: 8, rarity: 'common', hintUsed: false, hintRevealedWord: false });
      expect(score).toBe(10 + (8 - 3) * 2);
    });

    it('caps the length bonus at 20 exactly at the boundary word length', () => {
      const score = scoreWord({ wordLength: 13, rarity: 'common', hintUsed: false, hintRevealedWord: false });
      expect(score).toBe(10 + 20);
    });

    it('does not let the length bonus exceed the cap for longer words', () => {
      const atCap = scoreWord({ wordLength: 13, rarity: 'common', hintUsed: false, hintRevealedWord: false });
      const pastCap = scoreWord({ wordLength: 14, rarity: 'common', hintUsed: false, hintRevealedWord: false });
      expect(pastCap).toBe(atCap);
    });

    it.each([
      ['common', 0],
      ['uncommon', 5],
      ['rare', 10],
    ] as const)('applies the %s rarity bonus of %i', (rarity, bonus) => {
      const score = scoreWord({ wordLength: 3, rarity, hintUsed: false, hintRevealedWord: false });
      expect(score).toBe(10 + bonus);
    });

    it('deducts 5 points when a hint was used without revealing the word', () => {
      const score = scoreWord({ wordLength: 3, rarity: 'common', hintUsed: true, hintRevealedWord: false });
      expect(score).toBe(10 - 5);
    });

    it('deducts 10 points when the hint revealed the word', () => {
      const score = scoreWord({ wordLength: 3, rarity: 'common', hintUsed: false, hintRevealedWord: true });
      expect(score).toBe(10 - 10);
    });

    it('does not stack the two hint penalties — a revealed word is -10, not -15', () => {
      const score = scoreWord({ wordLength: 3, rarity: 'common', hintUsed: true, hintRevealedWord: true });
      expect(score).toBe(10 - 10);
    });
  });

  describe('rarityForEntry', () => {
    it.each([
      ['common', { isCommonWord: true, isObscure: false }, 'common'],
      ['mid-tier', { isCommonWord: false, isObscure: false }, 'uncommon'],
      ['obscure', { isCommonWord: false, isObscure: true }, 'rare'],
    ] as const)('maps a %s entry to %s', (_label, entry, expected) => {
      expect(rarityForEntry(entry)).toBe(expected);
    });

    // The bonus is worthless if the real dictionary only ever produces one
    // band, so this pins all three against the actual bundle rather than
    // against synthetic flags.
    it.each([
      ['apple', 'common'],
      ['ratline', 'uncommon'],
      ['kwacha', 'rare'],
    ] as const)('scores the real bundled word %s as %s', async (word, expected) => {
      const { entry } = await lookupWord(word);
      expect(entry).not.toBeNull();
      expect(rarityForEntry(entry!)).toBe(expected);
    });
  });

  describe('roundEndBonus', () => {
    it('matches the Architecture doc section 7 values', () => {
      expect(ROUND_WIN_BONUS).toBe(20);
      expect(PERSONAL_BEST_MILESTONE_BONUS).toBe(5);
    });

    it('awards the win bonus on a player win', () => {
      const bonus = roundEndBonus({
        status: 'player_win',
        chainLength: 10,
        previousBestChainLength: 20,
      });
      expect(bonus).toBe(ROUND_WIN_BONUS);
    });

    it('awards no win bonus on a computer win or a draw', () => {
      for (const status of ['computer_win', 'draw'] as const) {
        expect(
          roundEndBonus({ status, chainLength: 10, previousBestChainLength: 20 }),
        ).toBe(0);
      }
    });

    it('awards the milestone bonus for beating the previous best, even in a loss', () => {
      const bonus = roundEndBonus({
        status: 'computer_win',
        chainLength: 21,
        previousBestChainLength: 20,
      });
      expect(bonus).toBe(PERSONAL_BEST_MILESTONE_BONUS);
    });

    it('does not award the milestone for merely equalling the previous best', () => {
      const bonus = roundEndBonus({
        status: 'computer_win',
        chainLength: 20,
        previousBestChainLength: 20,
      });
      expect(bonus).toBe(0);
    });

    it('awards the milestone on a first-ever round, whose best is a real 0', () => {
      const bonus = roundEndBonus({
        status: 'draw',
        chainLength: 4,
        previousBestChainLength: 0,
      });
      expect(bonus).toBe(PERSONAL_BEST_MILESTONE_BONUS);
    });

    it('invents no milestone when the previous best is unknown', () => {
      const bonus = roundEndBonus({
        status: 'player_win',
        chainLength: 30,
        previousBestChainLength: null,
      });
      expect(bonus).toBe(ROUND_WIN_BONUS);
    });

    it('stacks the win and milestone bonuses', () => {
      const bonus = roundEndBonus({
        status: 'player_win',
        chainLength: 21,
        previousBestChainLength: 20,
      });
      expect(bonus).toBe(ROUND_WIN_BONUS + PERSONAL_BEST_MILESTONE_BONUS);
    });

    it.each(['abandoned', 'technical_failure'] as const)(
      'pays out nothing for an unsettled round (%s)',
      status => {
        const bonus = roundEndBonus({
          status,
          chainLength: 40,
          previousBestChainLength: 0,
        });
        expect(bonus).toBe(0);
      },
    );
  });
});

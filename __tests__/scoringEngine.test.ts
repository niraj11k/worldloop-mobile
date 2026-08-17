import { scoreWord, ROUND_WIN_BONUS, PERSONAL_BEST_MILESTONE_BONUS } from '@features/scoring/scoringEngine';

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

  describe('round-level bonuses', () => {
    it('matches the Architecture doc section 7 values', () => {
      expect(ROUND_WIN_BONUS).toBe(20);
      expect(PERSONAL_BEST_MILESTONE_BONUS).toBe(5);
    });
  });
});

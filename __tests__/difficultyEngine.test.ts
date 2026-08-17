import { scoreCandidate, selectComputerWord, type CandidateWord } from '@features/difficulty/difficultyEngine';

describe('difficultyEngine', () => {
  describe('scoreCandidate', () => {
    // Component scores are all distinct so a transposed or mistyped weight in
    // DIFFICULTY_WEIGHTS (Architecture doc section 6) would change the result —
    // a same-value candidate wouldn't catch that kind of copy error.
    const candidate: CandidateWord = {
      word: 'sample',
      optionReductionScore: 10,
      commonnessScore: 20,
      difficultyScore: 30,
      obscurityPenalty: 5,
      repetitionPenalty: 2,
    };

    it('matches the easy weights (w1=0, w2=1.0, w3=0, w4=0.5, w5=0.2)', () => {
      expect(scoreCandidate(candidate, 'easy')).toBeCloseTo(17.1, 5);
    });

    it('matches the medium weights (w1=0.5, w2=0.3, w3=0.1, w4=0.3, w5=0.2)', () => {
      expect(scoreCandidate(candidate, 'medium')).toBeCloseTo(12.1, 5);
    });

    it('matches the hard weights (w1=1.0, w2=0.2, w3=0.3, w4=0.5, w5=0.1)', () => {
      expect(scoreCandidate(candidate, 'hard')).toBeCloseTo(20.3, 5);
    });
  });

  describe('selectComputerWord', () => {
    it('returns null when there are no candidates', () => {
      expect(selectComputerWord([], 'easy')).toBeNull();
    });

    it('returns the only candidate when there is exactly one', () => {
      const only: CandidateWord = {
        word: 'lonely',
        optionReductionScore: 0,
        commonnessScore: 0,
        difficultyScore: 0,
        obscurityPenalty: 0,
        repetitionPenalty: 0,
      };
      expect(selectComputerWord([only], 'hard')).toEqual(only);
    });

    it('ranks by difficulty-appropriate priorities: hard prefers the option-blocking word, easy prefers the common word', () => {
      const blocker: CandidateWord = {
        word: 'blocker',
        optionReductionScore: 10,
        commonnessScore: 1,
        difficultyScore: 0,
        obscurityPenalty: 0,
        repetitionPenalty: 0,
      };
      const common: CandidateWord = {
        word: 'common',
        optionReductionScore: 1,
        commonnessScore: 10,
        difficultyScore: 0,
        obscurityPenalty: 0,
        repetitionPenalty: 0,
      };

      expect(selectComputerWord([blocker, common], 'hard')).toEqual(blocker);
      expect(selectComputerWord([blocker, common], 'easy')).toEqual(common);
    });

    // NOTE: selection is currently always the single top-ranked candidate for
    // every difficulty. Architecture doc section 6 specifies random pick
    // (easy) / weighted random from top 3-5 (medium) / top-ranked with
    // occasional 2nd-best (hard) — that per-difficulty selection strategy is
    // not implemented yet (Delivery Plan WL-109, still open). This test locks
    // in the current deterministic stub behavior so a change is noticed, not
    // an assertion that difficulty selection matches the full spec.
    it('currently always returns the top-ranked candidate regardless of difficulty (WL-109 not yet implemented)', () => {
      const best: CandidateWord = {
        word: 'best',
        optionReductionScore: 100,
        commonnessScore: 100,
        difficultyScore: 100,
        obscurityPenalty: 0,
        repetitionPenalty: 0,
      };
      const worst: CandidateWord = {
        word: 'worst',
        optionReductionScore: 0,
        commonnessScore: 0,
        difficultyScore: 0,
        obscurityPenalty: 0,
        repetitionPenalty: 0,
      };

      expect(selectComputerWord([worst, best], 'easy')).toEqual(best);
      expect(selectComputerWord([worst, best], 'medium')).toEqual(best);
      expect(selectComputerWord([worst, best], 'hard')).toEqual(best);
    });
  });
});

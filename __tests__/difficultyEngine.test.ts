import {
  scoreCandidate,
  selectComputerWord,
  optionReductionScore,
  type CandidateWord,
} from '@features/difficulty/difficultyEngine';

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

describe('optionReductionScore (WL-106)', () => {
  it('scores a dead letter highest', () => {
    // No replies left for the player is maximum option reduction.
    expect(optionReductionScore(0, 15207)).toBe(1);
  });

  it('scores the most open letter lowest', () => {
    expect(optionReductionScore(15207, 15207)).toBe(0);
  });

  it('is monotonically decreasing in reply count', () => {
    // PRD section 10: Hard ranks "from fewest replies to most replies", so
    // more replies must never score higher.
    const scores = [0, 100, 1000, 5000, 15207].map(n => optionReductionScore(n, 15207));
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]!).toBeLessThan(scores[i - 1]!);
    }
  });

  it('stays within 0..1 so it cannot swamp the other weighted terms', () => {
    // Architecture section 6 sums this against commonnessScore, which is
    // already 0..1; a raw count in the thousands would dominate the formula.
    for (const n of [-50, 0, 7000, 15207, 99999]) {
      const score = optionReductionScore(n, 15207);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    }
  });

  it('returns 0 rather than dividing by zero on an empty dictionary', () => {
    expect(optionReductionScore(0, 0)).toBe(0);
  });
});

describe('selectComputerWord tie-breaking (WL-106 linear selection)', () => {
  it('returns the earliest candidate when scores tie', () => {
    // The full sort this replaced was stable, so [0] of equal-scoring
    // candidates was the earliest one. The linear scan uses a strict '>'
    // to preserve exactly that; a '>=' would silently return the last.
    const identical: CandidateWord[] = ['first', 'second', 'third'].map(word => ({
      word,
      optionReductionScore: 1,
      commonnessScore: 1,
      difficultyScore: 1,
      obscurityPenalty: 0,
      repetitionPenalty: 0,
    }));
    expect(selectComputerWord(identical, 'hard')?.word).toBe('first');
    expect(selectComputerWord(identical, 'easy')?.word).toBe('first');
  });

  it('scores each candidate exactly once', () => {
    // Guards the reason for the change: the previous comparator re-scored on
    // every comparison (~266k calls for the worst-case letter).
    const candidates: CandidateWord[] = Array.from({ length: 50 }, (_, i) => ({
      word: `w${i}`,
      optionReductionScore: i,
      commonnessScore: 0,
      difficultyScore: 0,
      obscurityPenalty: 0,
      repetitionPenalty: 0,
    }));
    const seen = candidates.map(c => c.word);
    const counts = new Map<string, number>();
    const proxied = candidates.map(c => ({
      ...c,
      get optionReductionScore() {
        counts.set(c.word, (counts.get(c.word) ?? 0) + 1);
        return c.optionReductionScore;
      },
    })) as CandidateWord[];

    selectComputerWord(proxied, 'hard');
    for (const word of seen) {
      expect(counts.get(word)).toBe(1);
    }
  });
});

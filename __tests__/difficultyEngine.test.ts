import {
  scoreCandidate,
  selectComputerWord,
  optionReductionScore,
  createSeededRandom,
  SELECTION_POOL_SIZE,
  HARD_SECOND_BEST_CHANCE,
  generateCandidates,
  lengthScore,
  obscurityPenalty,
  type CandidateWord,
  type CandidateSource,
} from '@features/difficulty/difficultyEngine';
import type { DictionaryWord } from '@features/dictionary/dictionaryService';

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

      // Asserted on the score directly rather than through
      // selectComputerWord: since WL-109 selection is stochastic, and with
      // only two candidates Easy picks uniformly between them, so it is no
      // longer a deterministic proxy for ranking.
      expect(scoreCandidate(blocker, 'hard')).toBeGreaterThan(scoreCandidate(common, 'hard'));
      expect(scoreCandidate(common, 'easy')).toBeGreaterThan(scoreCandidate(blocker, 'easy'));
    });

    it('honours difficulty ordering when the pool is a single obvious winner', () => {
      // With one clear best candidate, every difficulty must return it:
      // easy has nothing else to pick, and hard/medium weight it highest.
      const best: CandidateWord = {
        word: 'best',
        optionReductionScore: 1,
        commonnessScore: 1,
        difficultyScore: 1,
        obscurityPenalty: 0,
        repetitionPenalty: 0,
      };
      const rng = createSeededRandom(1);
      for (const difficulty of ['easy', 'medium', 'hard'] as const) {
        expect(selectComputerWord([best], difficulty, rng)?.word).toBe('best');
      }
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

describe('selectComputerWord tie-breaking (WL-109)', () => {
  const tied = (words: string[]): CandidateWord[] =>
    words.map(word => ({
      word,
      optionReductionScore: 1,
      commonnessScore: 1,
      difficultyScore: 1,
      obscurityPenalty: 0,
      repetitionPenalty: 0,
    }));

  it('breaks ties randomly rather than by list order', () => {
    // WL-106 deliberately kept the earliest candidate on a tie, which was
    // right while selection was "always top-ranked". WL-109 reverses that on
    // purpose: Easy's weights make every common word score identically, so
    // list-order tie-breaking would play the same alphabetically-first word
    // every single game.
    const candidates = tied(['alpha', 'bravo', 'charlie', 'delta', 'echo']);
    const seen = new Set<string>();
    for (let seed = 0; seed < 40; seed++) {
      seen.add(selectComputerWord(candidates, 'hard', createSeededRandom(seed))!.word);
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it('spreads tied candidates roughly evenly rather than favouring one', () => {
    const candidates = tied(['alpha', 'bravo', 'charlie', 'delta']);
    const rng = createSeededRandom(7);
    const counts = new Map<string, number>();
    for (let i = 0; i < 2000; i++) {
      const word = selectComputerWord(candidates, 'easy', rng)!.word;
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
    expect(counts.size).toBe(4);
    for (const n of counts.values()) {
      // Uniform would be 500 each; allow generous slack for 2000 draws.
      expect(n).toBeGreaterThan(350);
      expect(n).toBeLessThan(650);
    }
  });

  it('scores each candidate exactly once', () => {
    // Guards the reason for WL-106's change: the original comparator
    // re-scored on every comparison (~266k calls for the worst-case letter).
    const candidates: CandidateWord[] = Array.from({ length: 50 }, (_, i) => ({
      word: `w${i}`,
      optionReductionScore: i,
      commonnessScore: 0,
      difficultyScore: 0,
      obscurityPenalty: 0,
      repetitionPenalty: 0,
    }));
    const counts = new Map<string, number>();
    const proxied = candidates.map(c => ({
      ...c,
      get optionReductionScore() {
        counts.set(c.word, (counts.get(c.word) ?? 0) + 1);
        return c.optionReductionScore;
      },
    })) as CandidateWord[];

    selectComputerWord(proxied, 'hard', createSeededRandom(3));
    for (const c of candidates) {
      expect(counts.get(c.word)).toBe(1);
    }
  });
});

// --- WL-108 candidate generation -------------------------------------------

function entry(word: string, overrides: Partial<DictionaryWord> = {}): DictionaryWord {
  return {
    word,
    normalizedWord: word,
    baseWord: null,
    partOfSpeech: null,
    isProperNoun: false,
    isCommonWord: true,
    isObscure: false,
    isOffensive: false,
    isAllowed: true,
    isComputerPlayable: true,
    frequencyScore: 1,
    ...overrides,
  };
}

/** Synthetic dictionary: the real bundle can't produce a 2-candidate letter. */
function fakeSource(
  byLetter: Record<string, DictionaryWord[]>,
  replyTotals: Record<string, number> = {},
): CandidateSource {
  return {
    entriesStartingWith: letter => byLetter[letter.toLowerCase()] ?? [],
    replyCountForLetter: (letter, usedWords) => {
      const total = replyTotals[letter.toLowerCase()] ?? 0;
      let used = 0;
      for (const w of usedWords) {
        if (w.charAt(0) === letter.toLowerCase()) {
          used += 1;
        }
      }
      return Math.max(0, total - used);
    },
    maxReplyCount: () => Math.max(1, ...Object.values(replyTotals)),
  };
}

describe('lengthScore (WL-108 difficulty_score)', () => {
  it('scores the minimum word length at zero', () => {
    expect(lengthScore('cat')).toBe(0);
  });

  it('increases with length and saturates', () => {
    expect(lengthScore('cats')).toBeGreaterThan(lengthScore('cat'));
    expect(lengthScore('exceptional')).toBeGreaterThan(lengthScore('cats'));
    expect(lengthScore('a'.repeat(40))).toBe(1);
  });

  it('never leaves 0..1', () => {
    for (const w of ['a', 'ab', 'abc', 'abcdefghijkl', 'a'.repeat(45)]) {
      expect(lengthScore(w)).toBeGreaterThanOrEqual(0);
      expect(lengthScore(w)).toBeLessThanOrEqual(1);
    }
  });
});

describe('obscurityPenalty (WL-108)', () => {
  it('is zero for a common word', () => {
    expect(obscurityPenalty(entry('cat'))).toBe(0);
  });

  it('is non-zero across the uncommon-but-allowed band', () => {
    // The band that actually reaches the computer; a binary flag would be
    // dead here because isComputerPlayable already excludes obscure words.
    const uncommon = entry('zymurgy', { isCommonWord: false, frequencyScore: 0.286 });
    expect(obscurityPenalty(uncommon)).toBeCloseTo(0.714, 3);
  });

  it('is 1 for an obscure word if one is ever supplied', () => {
    expect(obscurityPenalty(entry('aalborg', { isObscure: true, isCommonWord: false }))).toBe(1);
  });
});

describe('generateCandidates (WL-108)', () => {
  it('excludes words already used this round', () => {
    const source = fakeSource({ e: [entry('east'), entry('echo'), entry('edge')] }, { t: 5, o: 5, e: 5 });
    const words = generateCandidates(
      { requiredLetter: 'e', usedWords: new Set(['echo']) },
      source,
    ).map(c => c.word);

    expect(words).toEqual(['east', 'edge']);
  });

  it('returns an empty list when the letter has no candidates', () => {
    const source = fakeSource({});
    expect(generateCandidates({ requiredLetter: 'q', usedWords: new Set() }, source)).toEqual([]);
  });

  it('scores every Architecture section 6 term into 0..1', () => {
    const source = fakeSource({ e: [entry('elephant')] }, { t: 100 });
    const [candidate] = generateCandidates({ requiredLetter: 'e', usedWords: new Set() }, source);

    for (const value of [
      candidate!.optionReductionScore,
      candidate!.commonnessScore,
      candidate!.difficultyScore,
      candidate!.obscurityPenalty,
      candidate!.repetitionPenalty,
    ]) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it('rates a candidate leaving fewer replies as reducing options more', () => {
    // 'ex' ends on a starved letter, 'ee' on a rich one.
    const source = fakeSource({ e: [entry('eex'), entry('eee')] }, { x: 1, e: 100 });
    const byWord = Object.fromEntries(
      generateCandidates({ requiredLetter: 'e', usedWords: new Set() }, source).map(c => [
        c.word,
        c,
      ]),
    );
    expect(byWord.eex!.optionReductionScore).toBeGreaterThan(byWord.eee!.optionReductionScore);
  });

  it('subtracts used words from the reply count of the letter they start with', () => {
    const open = fakeSource({ e: [entry('eet')] }, { t: 10, e: 10 });
    const withoutUsed = generateCandidates({ requiredLetter: 'e', usedWords: new Set() }, open);
    const withUsed = generateCandidates(
      { requiredLetter: 'e', usedWords: new Set(['tea', 'ten', 'toe']) },
      open,
    );
    // Fewer replies remain on 't', so option reduction goes up.
    expect(withUsed[0]!.optionReductionScore).toBeGreaterThan(
      withoutUsed[0]!.optionReductionScore,
    );
  });

  it('penalizes sending the player back to a letter the round keeps landing on', () => {
    const source = fakeSource({ e: [entry('eat')] }, { t: 10 });
    const fresh = generateCandidates({ requiredLetter: 'e', usedWords: new Set() }, source);
    const repetitive = generateCandidates(
      { requiredLetter: 'e', usedWords: new Set(['cat', 'hat', 'mat']) },
      source,
    );
    expect(fresh[0]!.repetitionPenalty).toBe(0);
    expect(repetitive[0]!.repetitionPenalty).toBe(1);
  });
});

describe('generateCandidates against the real dictionary (WL-108 "Done when")', () => {
  const LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('');

  it.each(LETTERS)('returns correctly filtered candidates for %s', letter => {
    const candidates = generateCandidates({ requiredLetter: letter, usedWords: new Set() });
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.every(c => c.word.startsWith(letter))).toBe(true);
    expect(candidates.every(c => c.word.length >= 3)).toBe(true);
  });

  it('scores the sparse letters within range, not just the dense ones', () => {
    // x/q/z are where a normalization bug would surface first.
    for (const letter of ['x', 'q', 'z', 'y', 'j']) {
      for (const c of generateCandidates({ requiredLetter: letter, usedWords: new Set() })) {
        expect(c.optionReductionScore).toBeGreaterThanOrEqual(0);
        expect(c.optionReductionScore).toBeLessThanOrEqual(1);
        expect(c.commonnessScore).toBeGreaterThanOrEqual(0);
        expect(c.obscurityPenalty).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('never offers an excluded or proper-noun word to the computer', () => {
    // PRD section 24 — the computer must not select forbidden words.
    const words = new Set(
      LETTERS.flatMap(l =>
        generateCandidates({ requiredLetter: l, usedWords: new Set() }).map(c => c.word),
      ),
    );
    for (const forbidden of ['bullshit', 'london', 'edward', 'aalborg']) {
      expect(words.has(forbidden)).toBe(false);
    }
  });

  it('never replays a used word even on the densest letter', () => {
    const used = new Set(['snake', 'stone', 'sugar']);
    const words = generateCandidates({ requiredLetter: 's', usedWords: used }).map(c => c.word);
    for (const w of used) {
      expect(words).not.toContain(w);
    }
  });
});

// --- WL-109 "Done when": 1000 simulated turns per difficulty ---------------

describe('selection distributions over 1000 turns (WL-109 "Done when")', () => {
  /** Distinct scores, so "rank" is unambiguous and ties cannot blur results. */
  const ranked = (n: number): CandidateWord[] =>
    Array.from({ length: n }, (_, i) => ({
      word: `rank${i}`,
      optionReductionScore: (n - i) / n,
      commonnessScore: (n - i) / n,
      difficultyScore: (n - i) / n,
      obscurityPenalty: 0,
      repetitionPenalty: 0,
    }));

  const runTurns = (difficulty: 'easy' | 'medium' | 'hard', candidates: CandidateWord[]) => {
    const rng = createSeededRandom(20260819);
    const picks = new Map<string, number>();
    for (let turn = 0; turn < 1000; turn++) {
      const chosen = selectComputerWord(candidates, difficulty, rng);
      picks.set(chosen!.word, (picks.get(chosen!.word) ?? 0) + 1);
    }
    return picks;
  };

  it('hard never picks outside the top 2', () => {
    // The explicit "Done when" clause.
    const picks = runTurns('hard', ranked(50));
    expect([...picks.keys()].sort()).toEqual(['rank0', 'rank1']);
  });

  it('hard prefers the best but takes second-best occasionally', () => {
    const picks = runTurns('hard', ranked(50));
    const second = picks.get('rank1') ?? 0;
    expect(picks.get('rank0')).toBeGreaterThan(second);
    // Around HARD_SECOND_BEST_CHANCE of 1000 turns, with slack for variance.
    expect(second).toBeGreaterThan(1000 * HARD_SECOND_BEST_CHANCE * 0.6);
    expect(second).toBeLessThan(1000 * HARD_SECOND_BEST_CHANCE * 1.6);
  });

  it('medium draws only from the top 5 and favours higher ranks', () => {
    const picks = runTurns('medium', ranked(50));
    const chosen = [...picks.keys()].sort();
    expect(chosen).toEqual(['rank0', 'rank1', 'rank2', 'rank3', 'rank4']);
    expect(picks.get('rank0')!).toBeGreaterThan(picks.get('rank4')!);
    // Rank weights are 5:4:3:2:1, so the best should land near 1/3 of turns.
    expect(picks.get('rank0')!).toBeGreaterThan(1000 * 0.25);
  });

  it('easy draws from a wider pool than medium', () => {
    // "Relaxed play. Computer chooses broadly" (Difficulty screen copy).
    const easy = runTurns('easy', ranked(50));
    const medium = runTurns('medium', ranked(50));
    expect(easy.size).toBe(SELECTION_POOL_SIZE.easy);
    expect(easy.size).toBeGreaterThan(medium.size);
  });

  it('easy spreads roughly uniformly across its pool', () => {
    const picks = runTurns('easy', ranked(50));
    const expected = 1000 / SELECTION_POOL_SIZE.easy;
    for (const count of picks.values()) {
      expect(count).toBeGreaterThan(expected * 0.5);
      expect(count).toBeLessThan(expected * 1.5);
    }
  });

  it('never selects outside its pool for any difficulty', () => {
    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      const picks = runTurns(difficulty, ranked(50));
      expect(picks.size).toBeLessThanOrEqual(SELECTION_POOL_SIZE[difficulty]);
      for (const word of picks.keys()) {
        const rank = Number(word.replace('rank', ''));
        expect(rank).toBeLessThan(SELECTION_POOL_SIZE[difficulty]);
      }
    }
  });

  it('copes with fewer candidates than the pool size', () => {
    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      const rng = createSeededRandom(5);
      expect(selectComputerWord(ranked(1), difficulty, rng)?.word).toBe('rank0');
      expect(selectComputerWord([], difficulty, rng)).toBeNull();
    }
  });

  it('is reproducible for a given seed', () => {
    // The whole point of a seedable source: distributions are testable.
    const a = runTurns('medium', ranked(50));
    const b = runTurns('medium', ranked(50));
    expect([...a.entries()].sort()).toEqual([...b.entries()].sort());
  });
});

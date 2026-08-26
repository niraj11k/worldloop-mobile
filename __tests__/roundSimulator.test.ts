/**
 * WL-113 headless round simulator.
 *
 * `pickPlayerWord` gets fast, thorough unit coverage against a tiny injected
 * fixture (the real dictionary can't produce a two-word pool on demand).
 * `simulateRound`/`runSimulation` are integration-tested against the real
 * bundled dictionary with deliberately small round counts — Hard and Medium
 * only. Real rounds run to hundreds of turns each (see roundSimulator.ts's
 * "Finding 1"); Easy rounds run to *thousands*, so exercising Easy here
 * would multiply this file's runtime for no extra coverage of the logic
 * under test. Easy is covered manually via `npm run simulate`.
 */
import {
  pickPlayerWord,
  simulateRound,
  runSimulation,
} from '@features/game/roundSimulator';
import { createSeededRandom } from '@features/difficulty/difficultyEngine';
import { resetStartingWordHistory } from '@features/game/startingWord';
import { MIN_WORD_LENGTH } from '@constants/gameConstants';
import type { DictionaryWord } from '@features/dictionary/dictionaryService';

function entry(word: string): DictionaryWord {
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
  };
}

describe('pickPlayerWord', () => {
  it('excludes words already used this round', () => {
    const source = () => [entry('sea'), entry('sun')];
    const random = createSeededRandom(1);
    for (let i = 0; i < 20; i++) {
      expect(pickPlayerWord('s', new Set(['sea']), random, source)).toBe('sun');
    }
  });

  it('excludes words below MIN_WORD_LENGTH', () => {
    const source = () => [entry('so'), entry('sun')];
    const random = createSeededRandom(1);
    for (let i = 0; i < 20; i++) {
      expect(pickPlayerWord('s', new Set(), random, source)).toBe('sun');
    }
    expect('so'.length).toBeLessThan(MIN_WORD_LENGTH);
  });

  it('returns null when every candidate is excluded', () => {
    const source = () => [entry('sun')];
    expect(pickPlayerWord('s', new Set(['sun']), createSeededRandom(1), source)).toBeNull();
  });

  it('returns null when the source has nothing for this letter', () => {
    const source = () => [];
    expect(pickPlayerWord('x', new Set(), createSeededRandom(1), source)).toBeNull();
  });

  it('samples close to uniformly over the eligible pool', () => {
    const words = ['sea', 'sun', 'sky', 'silk', 'sand'];
    const source = () => words.map(entry);
    const random = createSeededRandom(2024);
    const counts = new Map<string, number>();
    for (let i = 0; i < 2000; i++) {
      const word = pickPlayerWord('s', new Set(), random, source) as string;
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
    expect(counts.size).toBe(words.length);
    for (const word of words) {
      // Expected 400 each; a badly biased picker would fail this hard.
      expect(counts.get(word)).toBeGreaterThan(250);
      expect(counts.get(word)).toBeLessThan(550);
    }
  });
});

describe('simulateRound, against the real bundled dictionary', () => {
  beforeEach(() => resetStartingWordHistory());

  it('returns a well-formed outcome for hard', async () => {
    const outcome = await simulateRound({ difficulty: 'hard', random: createSeededRandom(1) });
    expect(['player_win', 'computer_win', 'draw']).toContain(outcome.status);
    expect(outcome.chainLength).toBeGreaterThan(1);
    expect(Number.isFinite(outcome.score)).toBe(true);
    expect(typeof outcome.phantomDeadEnd).toBe('boolean');
  }, 20_000);

  it('returns a well-formed outcome for medium', async () => {
    const outcome = await simulateRound({ difficulty: 'medium', random: createSeededRandom(1) });
    expect(['player_win', 'computer_win', 'draw']).toContain(outcome.status);
    expect(outcome.chainLength).toBeGreaterThan(1);
  }, 20_000);

  it('is deterministic for a given seed', async () => {
    resetStartingWordHistory();
    const a = await simulateRound({ difficulty: 'hard', random: createSeededRandom(777) });
    resetStartingWordHistory();
    const b = await simulateRound({ difficulty: 'hard', random: createSeededRandom(777) });
    expect(a).toEqual(b);
  }, 20_000);

  it('never returns a chain shorter than the seeded opener plus one move', async () => {
    // The starting word alone is chainLength 1; the round should not end
    // before the player gets a turn unless the opener itself is dead —
    // never true against the real dictionary (WL-112's own guarantee).
    const outcome = await simulateRound({ difficulty: 'hard', random: createSeededRandom(3) });
    expect(outcome.chainLength).toBeGreaterThanOrEqual(2);
  }, 20_000);
});

describe('runSimulation, against the real bundled dictionary', () => {
  // Kept to 2 rounds throughout: each real round runs to hundreds of turns
  // (roundSimulator.ts, "Finding 1"), so this is integration coverage that
  // the aggregation logic is wired correctly, not a statistically confident
  // sample — that's what `npm run simulate -- --rounds 500` is for.
  const ROUNDS = 2;

  it('aggregates outcomes into rates that sum to 1', async () => {
    const report = await runSimulation({ difficulty: 'hard', rounds: ROUNDS, seed: 11 });
    expect(report.playerWinRate + report.computerWinRate + report.drawRate).toBeCloseTo(1, 10);
    expect(report.rounds).toBe(ROUNDS);
    expect(report.meanChainLength).toBeGreaterThan(1);
    expect(report.phantomDeadEndCount).toBeGreaterThanOrEqual(0);
    expect(report.phantomDeadEndCount).toBeLessThanOrEqual(report.rounds);
  }, 20_000);

  it('is deterministic for a given seed and round count', async () => {
    const a = await runSimulation({ difficulty: 'medium', rounds: ROUNDS, seed: 55 });
    const b = await runSimulation({ difficulty: 'medium', rounds: ROUNDS, seed: 55 });
    expect(a).toEqual(b);
  }, 20_000);

  it('produces a different sequence for a different seed', async () => {
    const a = await runSimulation({ difficulty: 'medium', rounds: ROUNDS, seed: 1 });
    const b = await runSimulation({ difficulty: 'medium', rounds: ROUNDS, seed: 2 });
    // Not a strict inequality on any one field (rates could coincide by
    // chance with only 2 rounds) — chain-length totals are a continuous
    // enough signal that an identical value across different seeds would
    // indicate the seed isn't actually reaching the simulation.
    expect(a.meanChainLength).not.toBe(b.meanChainLength);
  }, 20_000);
});

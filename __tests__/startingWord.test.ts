/**
 * WL-112 starting-word selection.
 *
 * The two acceptance criteria are asserted against the real bundled
 * dictionary, not a fixture: "100 generated starting words all leave >= 20
 * valid player replies, with no repeat inside any 10-round window" is a
 * claim about the shipped data, and a fixture would only prove the filter
 * expression compiles. The fixture-driven tests below cover the branches the
 * real dictionary cannot produce on demand.
 */

import {
  MIN_LETTER_POOL,
  MIN_STARTING_REPLIES,
  RECENT_REQUIRED_LETTERS_WINDOW,
  RECENT_STARTING_WORDS_WINDOW,
  STARTING_WORD_MAX_LENGTH,
  STARTING_WORD_MIN_FREQUENCY,
  nextStartingWord,
  recentStartingWordHistory,
  resetStartingWordHistory,
  selectStartingWord,
  startingWordPool,
  type StartingWordSource,
} from '@features/game/startingWord';
import { createSeededRandom } from '@features/difficulty/difficultyEngine';
import { lookupWord, replyCountForLetter } from '@features/dictionary/dictionaryService';
import { MIN_WORD_LENGTH } from '@constants/gameConstants';
import { createSession } from '@features/game/gameSession';

function entry(word: string, frequencyScore: number) {
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
    frequencyScore,
  };
}

/** A source with `count` eligible words under `letter`, and nothing else. */
function sourceWithPool(letter: string, count: number, replies = 100): StartingWordSource {
  return {
    entriesStartingWith: l =>
      l === letter
        ? Array.from({ length: count }, (_, i) => entry(`${letter}word${i}`, 1))
        : [],
    replyCountForLetter: () => replies,
  };
}

/** `count` words under `letter`, every one of them ending in `ending`. */
function poolEndingIn(letter: string, ending: string, count: number): StartingWordSource {
  return {
    entriesStartingWith: l =>
      l === letter
        ? Array.from({ length: count }, (_, i) => entry(`${letter}q${i}${ending}`, 1))
        : [],
    replyCountForLetter: () => 100,
  };
}

describe('startingWordPool', () => {
  it('rejects words below the frequency floor', () => {
    const source: StartingWordSource = {
      entriesStartingWith: () => [entry('cabbage', 1), entry('qaddafi', 0.571)],
      replyCountForLetter: () => 100,
    };
    expect(startingWordPool('c', source)).toEqual(['cabbage']);
  });

  it('rejects words outside the length band', () => {
    const source: StartingWordSource = {
      entriesStartingWith: () => [
        entry('ox', 1),
        entry('eagle', 1),
        entry('cardiologist', 1),
      ],
      replyCountForLetter: () => 100,
    };
    expect(startingWordPool('e', source)).toEqual(['eagle']);
  });

  it('rejects a word whose ending letter is a dead end', () => {
    const source: StartingWordSource = {
      entriesStartingWith: () => [entry('table', 1), entry('taxi', 1)],
      replyCountForLetter: letter =>
        letter === 'i' ? MIN_STARTING_REPLIES - 1 : MIN_STARTING_REPLIES,
    };
    expect(startingWordPool('t', source)).toEqual(['table']);
  });

  it('counts the candidate itself as already used', () => {
    // WL-110 seeds the starting word into the chain, so a word that both
    // starts and ends with the same letter spends one of its own replies.
    const seen: Array<[string, string[]]> = [];
    const source: StartingWordSource = {
      entriesStartingWith: () => [entry('sees', 1)],
      replyCountForLetter: (letter, used) => {
        seen.push([letter, [...used]]);
        return 100;
      },
    };
    startingWordPool('s', source);
    expect(seen).toEqual([['s', ['sees']]]);
  });
});

describe('selectStartingWord', () => {
  it('skips a letter whose pool is too thin to offer variety', () => {
    const thin = sourceWithPool('x', MIN_LETTER_POOL - 1);
    expect(selectStartingWord({ source: thin, random: createSeededRandom(1) })).toBeNull();

    const fat = sourceWithPool('x', MIN_LETTER_POOL);
    expect(selectStartingWord({ source: fat, random: createSeededRandom(1) })).not.toBeNull();
  });

  it('returns null when no letter yields a usable word', () => {
    const empty: StartingWordSource = {
      entriesStartingWith: () => [],
      replyCountForLetter: () => 100,
    };
    expect(selectStartingWord({ source: empty })).toBeNull();
  });

  it('never returns a word in the recent window', () => {
    const source = sourceWithPool('a', MIN_LETTER_POOL);
    const pool = startingWordPool('a', source);
    // Exclude all but one, so the exclusion has to be doing the work.
    const recent = pool.slice(1);
    const random = createSeededRandom(7);
    for (let i = 0; i < 50; i++) {
      expect(selectStartingWord({ source, recentWords: recent, random })).toBe(pool[0]);
    }
  });

  it('gives up on a letter whose whole pool is excluded', () => {
    const source = sourceWithPool('a', MIN_LETTER_POOL);
    const pool = startingWordPool('a', source);
    expect(selectStartingWord({ source, recentWords: pool })).toBeNull();
  });

  it('avoids the recent rounds’ required letters', () => {
    // A full pool of 's' endings, plus one 'e'. 'cats' has just made 's' a
    // recent required letter, so the single 'e' should win every time.
    const sEndings = poolEndingIn('a', 's', MIN_LETTER_POOL);
    const source: StartingWordSource = {
      entriesStartingWith: l =>
        l === 'a' ? [...sEndings.entriesStartingWith(l), entry('agree', 1)] : [],
      replyCountForLetter: () => 100,
    };
    const random = createSeededRandom(11);
    for (let i = 0; i < 30; i++) {
      expect(selectStartingWord({ source, recentWords: ['cats'], random })).toBe('agree');
    }
  });

  it('falls back rather than failing when a pool shares one ending', () => {
    const source = poolEndingIn('a', 'x', MIN_LETTER_POOL);
    const pool = startingWordPool('a', source);
    // 'onyx' makes 'x' recent, and every candidate ends in 'x' — the
    // preference has to yield rather than leave the round without a word.
    const word = selectStartingWord({
      source,
      recentWords: ['onyx'],
      random: createSeededRandom(3),
    });
    expect(pool).toContain(word);
  });

  it('only counts the most recent rounds as recent letters', () => {
    const source = poolEndingIn('a', 's', MIN_LETTER_POOL);
    // 'cats' is pushed out of the letter window by the fillers that follow
    // it, so its 's' no longer blocks an 's' ending.
    const fillers = Array.from(
      { length: RECENT_REQUIRED_LETTERS_WINDOW },
      (_, i) => `fille${i}r`,
    );
    const word = selectStartingWord({
      source,
      recentWords: ['cats', ...fillers],
      random: createSeededRandom(4),
    });
    expect(word).not.toBeNull();
    expect((word as string).endsWith('s')).toBe(true);
  });

  it('varies both the word and the opening letter across rounds', () => {
    const random = createSeededRandom(99);
    const words = new Set<string>();
    const letters = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const word = selectStartingWord({ random });
      expect(word).not.toBeNull();
      words.add(word as string);
      letters.add((word as string).charAt(0));
    }
    // The failure this guards against is a selector that always returns the
    // alphabetically-first word, which WL-109 hit for the same reason.
    expect(words.size).toBeGreaterThan(150);
    expect(letters.size).toBeGreaterThan(15);
  });
});

describe('WL-112 acceptance criteria, against the bundled dictionary', () => {
  const GENERATED = 100;

  it('100 generated starting words all leave at least 20 valid player replies', async () => {
    resetStartingWordHistory();
    const random = createSeededRandom(2112);
    for (let i = 0; i < GENERATED; i++) {
      const word = nextStartingWord(random);
      expect(word).not.toBeNull();
      const chosen = word as string;

      const replies = replyCountForLetter(chosen.charAt(chosen.length - 1), [chosen]);
      expect(replies).toBeGreaterThanOrEqual(MIN_STARTING_REPLIES);
    }
  });

  it('100 generated starting words never repeat inside a 10-round window', () => {
    resetStartingWordHistory();
    const random = createSeededRandom(2112);
    const produced: string[] = [];
    for (let i = 0; i < GENERATED; i++) {
      produced.push(nextStartingWord(random) as string);
    }
    for (let i = 0; i < produced.length; i++) {
      const window = produced.slice(Math.max(0, i - RECENT_STARTING_WORDS_WINDOW), i);
      expect(window).not.toContain(produced[i]);
    }
  });

  it('does not repeat a required letter inside its own window', () => {
    // The regression this pins: distinct words with near-identical openings.
    // Before the letter window existed, 100 rounds produced runs like
    // `snmllsddeggdyssggsxs` — every word different, `s` six times.
    resetStartingWordHistory();
    const random = createSeededRandom(2112);
    const letters: string[] = [];
    for (let i = 0; i < GENERATED; i++) {
      const word = nextStartingWord(random) as string;
      letters.push(word.charAt(word.length - 1));
    }
    for (let i = 0; i < letters.length; i++) {
      const window = letters.slice(Math.max(0, i - RECENT_REQUIRED_LETTERS_WINDOW), i);
      expect(window).not.toContain(letters[i]);
    }
    // And the spread is genuinely wide, not just free of adjacent repeats.
    expect(new Set(letters).size).toBeGreaterThanOrEqual(12);
  });

  it('every generated starting word is legal for the computer to have played', async () => {
    resetStartingWordHistory();
    const random = createSeededRandom(404);
    for (let i = 0; i < GENERATED; i++) {
      const word = nextStartingWord(random) as string;
      const result = await lookupWord(word);

      expect(result.found).toBe(true);
      // The opening word is the computer's first move (WL-110), so every
      // constraint on a computer move applies to it: not a proper noun, not
      // excluded, not obscure, and not under the minimum length (the bug
      // WL-108 found).
      expect(result.entry?.isComputerPlayable).toBe(true);
      expect(result.entry?.isProperNoun).toBe(false);
      expect(result.entry?.isOffensive).toBe(false);
      expect(word.length).toBeGreaterThanOrEqual(MIN_WORD_LENGTH);
      expect(word.length).toBeLessThanOrEqual(STARTING_WORD_MAX_LENGTH);
      expect(result.entry?.frequencyScore).toBeGreaterThanOrEqual(STARTING_WORD_MIN_FREQUENCY);
    }
  });

  it('feeds a session whose required letter is playable', () => {
    resetStartingWordHistory();
    const random = createSeededRandom(31337);
    for (let i = 0; i < 20; i++) {
      const word = nextStartingWord(random) as string;
      const session = createSession({
        sessionId: `test-${i}`,
        difficulty: 'medium',
        startingWord: word,
      });
      expect(session.requiredLetter).toBe(word.charAt(word.length - 1));
      expect(replyCountForLetter(session.requiredLetter, [word])).toBeGreaterThanOrEqual(
        MIN_STARTING_REPLIES,
      );
    }
  });
});

describe('the rolling history', () => {
  beforeEach(() => resetStartingWordHistory());

  it('keeps only the most recent window', () => {
    const random = createSeededRandom(5);
    for (let i = 0; i < RECENT_STARTING_WORDS_WINDOW + 5; i++) {
      nextStartingWord(random);
    }
    expect(recentStartingWordHistory()).toHaveLength(RECENT_STARTING_WORDS_WINDOW);
  });

  it('can be seeded, so WL-402 can restore a persisted window', () => {
    resetStartingWordHistory(['eagle', 'table']);
    expect(recentStartingWordHistory()).toEqual(['eagle', 'table']);
  });

  it('truncates an over-long restored window to the most recent entries', () => {
    const tooMany = Array.from({ length: RECENT_STARTING_WORDS_WINDOW + 3 }, (_, i) => `w${i}`);
    resetStartingWordHistory(tooMany);
    expect(recentStartingWordHistory()).toEqual(tooMany.slice(-RECENT_STARTING_WORDS_WINDOW));
  });
});

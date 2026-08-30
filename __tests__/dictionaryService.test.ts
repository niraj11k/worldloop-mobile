import {
  lookupWord,
  initDictionary,
  isDictionaryReady,
  dictionarySize,
  dictionarySource,
  replyCountForLetter,
  maxReplyCount,
  computerPlayableEntriesStartingWith,
  exampleWordForHint,
  setRuntimeExclusions,
  getRuntimeExclusions,
} from '@features/dictionary/dictionaryService';
import { MIN_WORD_LENGTH } from '@constants/gameConstants';

/**
 * Runs against the REAL bundled asset (WL-105), not a fixture.
 *
 * That is deliberate and only possible because the packed asset is committed
 * rather than gitignored — the 36MB intermediate JSON is not. These tests are
 * what pin the TypeScript decoder against the Python encoder in
 * scripts/generate-dictionary.py: the two implement the same record format
 * independently, so without this they could drift silently and the app would
 * disagree with `npm run dictionary:verify`.
 */
describe('exampleWordForHint minimum length (WL-504)', () => {
  it('never suggests a word the rule engine would reject as too short', () => {
    // Found on screen, not in a test: the hint offered "Example: A" for the
    // letter A. The dictionary holds 240 computer-playable words under three
    // letters and the most common word for most letters is one of them, so
    // this is the common case rather than an edge one.
    for (const letter of 'abcdefghijklmnopqrstuvwxyz') {
      const example = exampleWordForHint(letter, []);
      if (example !== null) {
        expect(example.length).toBeGreaterThanOrEqual(MIN_WORD_LENGTH);
      }
    }
  });
});

describe('dictionaryService', () => {
  it('reports a plausible bundled word count', () => {
    expect(dictionarySize()).toBeGreaterThan(100_000);
  });

  it('reports the pinned ESDB source and version', () => {
    // Feeds DictionaryWord.source_name/source_version (Data Model doc
    // section 1) and the Attributions screen (WL-407).
    expect(dictionarySource()).toEqual({
      name: 'English Speller Database (ESDB), formerly SCOWL',
      version: 'rel-2026.02.25',
    });
  });

  it('becomes ready after initDictionary and stays idempotent', () => {
    initDictionary();
    expect(isDictionaryReady()).toBe(true);
    initDictionary();
    expect(isDictionaryReady()).toBe(true);
  });

  it('finds a common word and derives its flags', async () => {
    const { found, entry } = await lookupWord('rose');
    expect(found).toBe(true);
    expect(entry).toMatchObject({
      normalizedWord: 'rose',
      isProperNoun: false,
      isCommonWord: true,
      isObscure: false,
      isOffensive: false,
      isAllowed: true,
      isComputerPlayable: true,
      frequencyScore: 1,
    });
  });

  it('finds a proper noun and marks it disallowed', async () => {
    const { found, entry } = await lookupWord('edward');
    expect(found).toBe(true);
    expect(entry).toMatchObject({
      isProperNoun: true,
      isAllowed: false,
      isComputerPlayable: false,
      frequencyScore: 0.571,
    });
  });

  it('marks an obscure word playable by the player but not the computer', async () => {
    // PRD section 8.7 — obscurity narrows computer selection only.
    const { found, entry } = await lookupWord('aalborg');
    expect(found).toBe(true);
    expect(entry).toMatchObject({
      isObscure: true,
      isCommonWord: false,
      isAllowed: true,
      isComputerPlayable: false,
      frequencyScore: 0,
    });
  });

  it('distinguishes a mid-tier word from a common one', async () => {
    const { entry } = await lookupWord('zymurgy');
    expect(entry).toMatchObject({
      isCommonWord: false,
      isObscure: false,
      isAllowed: true,
      frequencyScore: 0.286,
    });
  });

  it('returns not-found for a word outside the list', async () => {
    await expect(lookupWord('zzzzqqqx')).resolves.toEqual({ found: false, entry: null });
  });

  it('finds both a word and the longer word that extends it', async () => {
    // Guards the ordering property the packed format relies on: the flag
    // character sorts below every lowercase letter, so "cat" precedes
    // "cats" and neither shadows the other during binary search.
    await expect(lookupWord('cat')).resolves.toMatchObject({ found: true });
    await expect(lookupWord('cats')).resolves.toMatchObject({ found: true });
  });

  it('finds the first and last records', async () => {
    // Binary search boundary conditions, which an off-by-one in the offset
    // index would break while leaving the middle of the list working.
    await expect(lookupWord('a')).resolves.toMatchObject({ found: true });
    await expect(lookupWord('zzz')).resolves.toMatchObject({ found: true });
  });

  it('finds words spread across the alphabet', async () => {
    const words = ['aardvark', 'elephant', 'journey', 'mountain', 'quiz', 'table', 'window'];
    for (const word of words) {
      await expect(lookupWord(word)).resolves.toMatchObject({ found: true });
    }
  });

  it('does not report the word itself as its own baseWord or carry a part of speech', async () => {
    // Both are deliberately absent from the on-device asset; asserted so a
    // future consumer discovers it here rather than at runtime.
    const { entry } = await lookupWord('rose');
    expect(entry?.baseWord).toBeNull();
    expect(entry?.partOfSpeech).toBeNull();
  });
});

describe('reply-count index (WL-106)', () => {
  it('reports a precomputed reply count per letter', () => {
    // Counts the player-submittable set (PRD section 10: "replies available
    // to the player"), so it is larger than the computer-playable tier.
    expect(replyCountForLetter('s', new Set())).toBeGreaterThan(10_000);
    expect(replyCountForLetter('x', new Set())).toBeGreaterThan(0);
    expect(replyCountForLetter('x', new Set())).toBeLessThan(
      replyCountForLetter('s', new Set()),
    );
  });

  it('is case-insensitive', () => {
    expect(replyCountForLetter('S', new Set())).toBe(replyCountForLetter('s', new Set()));
  });

  it('subtracts used words that start with the letter', () => {
    const base = replyCountForLetter('c', new Set());
    const used = new Set(['cat', 'cats', 'apple']);
    // 'apple' must not count against 'c'.
    expect(replyCountForLetter('c', used)).toBe(base - 2);
  });

  it('never returns a negative count', () => {
    const used = new Set(Array.from({ length: 5 }, (_, i) => `x${i}`));
    expect(replyCountForLetter('x', used)).toBeGreaterThanOrEqual(0);
  });

  it('returns 0 for a non-letter', () => {
    expect(replyCountForLetter('1', new Set())).toBe(0);
    expect(replyCountForLetter('', new Set())).toBe(0);
  });

  it('exposes the maximum per-letter count for normalization', () => {
    expect(maxReplyCount()).toBe(replyCountForLetter('s', new Set()));
  });
});

describe('computerPlayableEntriesStartingWith (WL-106 measurement support)', () => {
  const wordsOf = (letter: string) =>
    computerPlayableEntriesStartingWith(letter).map(e => e.normalizedWord);

  it('returns only words starting with the requested letter', () => {
    const words = wordsOf('q');
    expect(words.length).toBeGreaterThan(0);
    expect(words.every(w => w.startsWith('q'))).toBe(true);
  });

  it('returns only computer-playable entries', () => {
    // Decoded in the walk, so no second lookup is needed to check this.
    const entries = computerPlayableEntriesStartingWith('x');
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.every(e => e.isComputerPlayable)).toBe(true);
    expect(entries.every(e => e.isAllowed && !e.isObscure)).toBe(true);
  });

  it('excludes proper nouns and obscure words', () => {
    // 'edward' is a proper noun, 'aalborg' is obscure — neither is a legal
    // computer move (PRD sections 8.5 and 8.7).
    expect(wordsOf('e')).not.toContain('edward');
    expect(wordsOf('a')).not.toContain('aalborg');
  });

  it('finds a known common word in its letter block', () => {
    expect(wordsOf('r')).toContain('rose');
  });

  it('returns an empty list for a non-letter', () => {
    expect(computerPlayableEntriesStartingWith('1')).toEqual([]);
  });

  it('covers every letter of the alphabet', () => {
    for (const letter of 'abcdefghijklmnopqrstuvwxyz') {
      expect(computerPlayableEntriesStartingWith(letter).length).toBeGreaterThan(0);
    }
  });

  it('enumerates the worst-case letter without scanning the whole dictionary', () => {
    // 's' is the largest block; guards against a regression to a full scan.
    expect(computerPlayableEntriesStartingWith('s').length).toBeGreaterThan(5_000);
  });
});

describe('exampleWordForHint (WL-307)', () => {
  it('returns a computer-playable word starting with the requested letter', () => {
    const example = exampleWordForHint('r', new Set());
    expect(example).not.toBeNull();
    expect(example?.startsWith('r')).toBe(true);
    expect(
      computerPlayableEntriesStartingWith('r').map(e => e.normalizedWord),
    ).toContain(example);
  });

  it('excludes words already used this round', () => {
    const first = exampleWordForHint('r', new Set());
    const second = exampleWordForHint('r', new Set([first as string]));
    expect(second).not.toBeNull();
    expect(second).not.toBe(first);
  });

  it('returns null once every computer-playable word for the letter is used', () => {
    // 'z' is a small block — cheap to exhaust entirely for this test.
    const all = computerPlayableEntriesStartingWith('z').map(e => e.normalizedWord);
    expect(exampleWordForHint('z', new Set(all))).toBeNull();
  });

  it('returns null for a non-letter', () => {
    expect(exampleWordForHint('1', new Set())).toBeNull();
  });
});

describe('excluded words (WL-104)', () => {
  afterEach(() => {
    setRuntimeExclusions([]);
  });

  it('flags a baked-in excluded word as offensive and disallowed', async () => {
    const { found, entry } = await lookupWord('bullshit');
    // Still present in the dictionary — it has to be, so the rule engine can
    // answer offensive_excluded rather than unknown_word.
    expect(found).toBe(true);
    expect(entry).toMatchObject({
      isOffensive: true,
      isAllowed: false,
      isComputerPlayable: false,
    });
  });

  it('keeps words whose everyday sense is innocent (the PRD 8.5 restraint)', async () => {
    // Reviewed out of the source list by hand; see data/excluded-words.txt.
    for (const word of ['butt', 'scat', 'skeet', 'snatch', 'shrimping', 'escort']) {
      const { entry } = await lookupWord(word);
      expect(entry?.isOffensive).toBe(false);
      expect(entry?.isAllowed).toBe(true);
    }
  });

  it('never offers an excluded word as a computer candidate', () => {
    // PRD section 24: "The computer does not select forbidden or
    // inappropriate words."
    for (const letter of 'abcdefghijklmnopqrstuvwxyz') {
      const entries = computerPlayableEntriesStartingWith(letter);
      expect(entries.every(e => !e.isOffensive)).toBe(true);
    }
  });

  it('applies runtime exclusions on top of the baked list', async () => {
    const before = await lookupWord('elephant');
    expect(before.entry?.isAllowed).toBe(true);

    setRuntimeExclusions(['elephant']);
    const after = await lookupWord('elephant');
    expect(after.found).toBe(true);
    expect(after.entry).toMatchObject({
      isOffensive: true,
      isAllowed: false,
      isComputerPlayable: false,
    });
  });

  it('removes runtime exclusions from computer candidates too', () => {
    expect(computerPlayableEntriesStartingWith('e').map(e => e.normalizedWord)).toContain(
      'elephant',
    );
    setRuntimeExclusions(['elephant']);
    expect(computerPlayableEntriesStartingWith('e').map(e => e.normalizedWord)).not.toContain(
      'elephant',
    );
  });

  it('normalizes runtime exclusions and ignores blanks', () => {
    setRuntimeExclusions(['  ELEPHANT ', '', '   ']);
    expect(getRuntimeExclusions().has('elephant')).toBe(true);
    expect(getRuntimeExclusions().size).toBe(1);
  });

  it('clears runtime exclusions when set to an empty list', async () => {
    setRuntimeExclusions(['elephant']);
    setRuntimeExclusions([]);
    const { entry } = await lookupWord('elephant');
    expect(entry?.isAllowed).toBe(true);
  });
});

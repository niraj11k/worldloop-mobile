import {
  lookupWord,
  initDictionary,
  isDictionaryReady,
  dictionarySize,
  dictionarySource,
} from '@features/dictionary/dictionaryService';

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

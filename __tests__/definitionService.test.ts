import {
  lookupDefinition,
  definitionClueForHint,
  fetchDefinition,
  initDefinitions,
  isDefinitionSourceAvailable,
  definitionSource,
} from '@features/dictionary/definitionService';
import {
  allowedEntriesStartingWith,
  exampleWordForHint,
} from '@features/dictionary/dictionaryService';

/**
 * Runs against the REAL bundled asset (WL-501), like the dictionaryService
 * suite and for the same reason: `definitions.pack.json` is committed, so
 * these tests are what pin the TypeScript decoder against the Python encoder
 * in scripts/generate-definitions.py. The two implement the same base-90 id
 * format and the same gloss-offset layout independently — without this they
 * could drift silently, and the symptom would be *wrong* definitions rather
 * than missing ones.
 */
describe('definitionService', () => {
  it('reports the pinned WordNet source and version', () => {
    // Feeds the Attributions screen's WordNet entry (WL-407), which now
    // credits WordNet for definitions as well as part-of-speech work.
    expect(definitionSource()).toEqual({ name: 'Princeton WordNet', version: '3.1' });
  });

  it('passes its alignment check against the bundled dictionary', () => {
    // The guard that makes the two assets safe to ship coupled. If this ever
    // fails, `dictionary.pack.json` was regenerated without rerunning
    // `npm run definitions:generate`.
    expect(isDefinitionSourceAvailable()).toBe(true);
  });

  it('is idempotent across repeated initialisation', () => {
    initDefinitions();
    initDefinitions();
    expect(lookupDefinition('apple')?.definition).toContain('fruit');
  });

  it('defines a common word with a part of speech', () => {
    const result = lookupDefinition('eagle');
    expect(result).not.toBeNull();
    expect(result?.word).toBe('eagle');
    expect(result?.partOfSpeech).toBe('Noun');
    expect(result?.definition.length).toBeGreaterThan(0);
  });

  it('resolves inflected forms through their lemma', () => {
    // Coverage is 39% without this and 70% with it — inflected forms are most
    // of what a chain actually contains, so the Morphy pass in the generator
    // is load-bearing, not a nicety.
    expect(lookupDefinition('dragons')?.definition).toContain('mythology');
    expect(lookupDefinition('envied')?.partOfSpeech).toBe('Verb');
    expect(lookupDefinition('mice')?.definition).toContain('rodent');
    expect(lookupDefinition('happier')?.partOfSpeech).toBe('Adjective');
  });

  it('prefers the word itself over a lemma it merely inflects to', () => {
    // The regression this pins is visible and embarrassing: ranking senses on
    // WordNet's tag counts alone defines ROSE as "move upward", because the
    // count belongs to `rise` (tagged 26x) rather than to the flower (5x).
    // `rose` is PRD section 8.5's own worked example of a word that must stay
    // playable, so getting it wrong is the case a player would notice first.
    expect(lookupDefinition('rose')?.definition).toContain('shrubs');
    expect(lookupDefinition('rose')?.partOfSpeech).toBe('Noun');
    // Same rule, second case: SAW is the tool/verb, not the past tense of see.
    expect(lookupDefinition('saw')?.definition).toContain('saw');
  });

  it('normalizes input the way the rule engine does', () => {
    expect(lookupDefinition('  EAGLE  ')).toEqual(lookupDefinition('eagle'));
  });

  it('returns null rather than throwing for a word it cannot define', () => {
    // Wireframe section 12 makes "unavailable" a first-class outcome, so the
    // miss path must be quiet: no throw, no error object, just null.
    expect(lookupDefinition('qwertyuiop')).toBeNull();
    expect(lookupDefinition('')).toBeNull();
  });

  it('never returns an empty definition or an unlabelled part of speech', () => {
    // A blank string would render as a visually broken overlay rather than as
    // the unavailable state, which is worse than having no definition at all.
    const words = ['table', 'window', 'orange', 'running', 'subdivision', 'zymurgy'];
    for (const word of words) {
      const result = lookupDefinition(word);
      if (result !== null) {
        expect(result.definition.trim().length).toBeGreaterThan(0);
        expect(result.partOfSpeech.length).toBeGreaterThan(0);
      }
    }
  });

  describe('definitionClueForHint (WL-504, hint level 4)', () => {
    it('gives a clue without naming the word', () => {
      const clue = definitionClueForHint('e', [], null);
      expect(clue).not.toBeNull();
      expect(clue?.definition.length).toBeGreaterThan(0);
      expect(clue?.partOfSpeech.length).toBeGreaterThan(0);
      // The whole point of level 4: it describes a word it does not return,
      // so no caller can render one by accident.
      expect(Object.keys(clue!)).toEqual(['partOfSpeech', 'definition']);
    });

    it('never leaks the word it describes, across every letter', () => {
      // The task's acceptance criterion, checked exhaustively rather than on
      // one hand-picked letter — the guard has to hold for whatever letter the
      // player's round actually lands on.
      //
      // The service deliberately does not return the word, so the word is
      // recovered here: any playable word for the letter whose own definition
      // is this clue is a word the clue could be describing. Every one of them
      // must stay out of the text.
      for (const letter of 'abcdefghijklmnopqrstuvwxyz') {
        const clue = definitionClueForHint(letter, [], null);
        if (clue === null) continue;

        const definition = clue.definition.toLowerCase();
        const possibleSources = allowedEntriesStartingWith(letter).filter(
          entry => lookupDefinition(entry.normalizedWord)?.definition === clue.definition,
        );

        expect(possibleSources.length).toBeGreaterThan(0);
        for (const entry of possibleSources) {
          expect(definition).not.toContain(entry.normalizedWord);
        }
      }
    });

    it('rejects a gloss that names a word the player could play', () => {
      // The concrete defect this guard was written for: "compress into a wad"
      // is `wadded`'s gloss, so nothing about `wadded` looks wrong — but `wad`
      // shares that synset, is perfectly playable on `w`, and is sitting in
      // the text. A per-candidate check cannot see it; this asserts the clue
      // is checked as a whole.
      const clue = definitionClueForHint('w', [], null);
      expect(clue?.definition).not.toBe('compress into a wad');

      // And the self-describing case, where WordNet glosses the lemma an
      // inflected form resolves to.
      const selfDescribing = lookupDefinition('wadded');
      expect(selfDescribing?.definition).toBe('compress into a wad');
    });

    it('does not repeat level 3’s example word, or a synonym of it', () => {
      // Level 4 describing the word already printed above it is not a fourth
      // level of help. Caught on an Android device: excluding the example word
      // alone still let a *synonym* through carrying the identical gloss —
      // "Example: RABBI" followed by "Another word here means: spiritual
      // leader of a Jewish congregation…", which is `rabbin`/`rabboni`, same
      // synset, same text. Checked across every letter, since which letter a
      // round lands on is not something a test should hand-pick.
      for (const letter of 'abcdefghijklmnopqrstuvwxyz') {
        const example = exampleWordForHint(letter, []);
        const clue = definitionClueForHint(letter, [], example);
        if (clue === null || example === null) continue;

        expect(clue.definition.toLowerCase()).not.toContain(example);
        expect(clue.definition).not.toBe(lookupDefinition(example)?.definition);
      }
    });

    it('returns null rather than throwing when the letter has nothing left', () => {
      // A dead letter is a real state (WL-110's `no_computer_move` depends on
      // it); the sheet omits the line instead of showing an empty one.
      const everything = allowedEntriesStartingWith('x').map(e => e.normalizedWord);
      expect(definitionClueForHint('x', everything, null)).toBeNull();
      expect(definitionClueForHint('1', [], null)).toBeNull();
    });
  });

  it('exposes the same result through the async enrichment seam', async () => {
    await expect(fetchDefinition('eagle')).resolves.toEqual(lookupDefinition('eagle'));
  });
});

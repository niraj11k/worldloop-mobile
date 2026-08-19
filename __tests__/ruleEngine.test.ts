import {
  normalizeWord,
  validateMove,
  getRequiredLetter,
  type WordLookup,
} from '@features/game/ruleEngine';
import type { DictionaryWord } from '@features/dictionary/dictionaryService';
import type { InvalidReason } from '@app-types/game';

/**
 * Builds a fake dictionary lookup (WL-107).
 *
 * Injected rather than hitting the real bundle: the generated dictionary is
 * a gitignored build artifact (see src/assets/dictionary/README.md), so a
 * test depending on it would fail on a fresh checkout and in CI. Data-level
 * assertions about the real word list live in
 * scripts/verify-dictionary-fixtures.py instead; this file covers the
 * engine's decision logic.
 */
function fakeDictionary(entries: Record<string, Partial<DictionaryWord>>): WordLookup {
  return async (normalizedWord: string) => {
    const overrides = entries[normalizedWord];
    if (overrides === undefined) {
      return { found: false, entry: null };
    }
    return {
      found: true,
      entry: {
        word: normalizedWord,
        normalizedWord,
        baseWord: null,
        partOfSpeech: 'n',
        isProperNoun: false,
        isCommonWord: true,
        isObscure: false,
        isOffensive: false,
        isAllowed: true,
        isComputerPlayable: true,
        frequencyScore: 1,
        ...overrides,
      },
    };
  };
}

const dictionary = fakeDictionary({
  elephant: {},
  rose: {},
  // PRD section 8.6 — inflected forms are ordinary dictionary entries.
  cats: { baseWord: 'cat' },
  walked: { baseWord: 'walk', partOfSpeech: 'v' },
  playing: { baseWord: 'play', partOfSpeech: 'v' },
  faster: { baseWord: 'fast', partOfSpeech: 'aj' },
  // Classification cases.
  edward: { isProperNoun: true, isAllowed: false },
  epithet: { isOffensive: true, isAllowed: false },
  eigenvalue: { isObscure: true, isComputerPlayable: false },
  ersatz: { isAllowed: false },
});

describe('ruleEngine', () => {
  describe('normalizeWord', () => {
    it('trims and lowercases input', () => {
      expect(normalizeWord('  ELEPHANT  ')).toBe('elephant');
    });
  });

  describe('getRequiredLetter', () => {
    it('returns the last letter of the previous word', () => {
      expect(getRequiredLetter('apple')).toBe('e');
    });
  });

  describe('validateMove', () => {
    const usedWords = new Set(['apple']);

    const expectRejection = async (
      params: { rawInput: string; requiredLetter: string; usedWords?: Set<string> },
      reason: InvalidReason,
    ) => {
      const result = await validateMove(
        { usedWords, ...params },
        dictionary,
      );
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe(reason);
    };

    // PRD section 24 "Player move" acceptance criteria, plus the full
    // InvalidReason union — every one of the 7 values must be reachable
    // (Delivery Plan WL-107 "Done when").

    it('rejects a word with the wrong starting letter', async () => {
      await expectRejection({ rawInput: 'river', requiredLetter: 'e' }, 'wrong_letter');
    });

    it('rejects a duplicate word', async () => {
      await expectRejection({ rawInput: 'apple', requiredLetter: 'a' }, 'duplicate');
    });

    it('rejects a word shorter than the minimum length', async () => {
      await expectRejection({ rawInput: 'to', requiredLetter: 't' }, 'too_short');
    });

    it('rejects unsupported symbols', async () => {
      await expectRejection({ rawInput: 'elephant2', requiredLetter: 'e' }, 'unsupported_symbols');
    });

    it('rejects a word that is not in the dictionary', async () => {
      await expectRejection({ rawInput: 'eeeeeee', requiredLetter: 'e' }, 'unknown_word');
    });

    it('rejects a proper noun', async () => {
      await expectRejection({ rawInput: 'edward', requiredLetter: 'e' }, 'proper_noun');
    });

    it('rejects an excluded word', async () => {
      await expectRejection({ rawInput: 'epithet', requiredLetter: 'e' }, 'offensive_excluded');
    });

    it('accepts a valid, unused word matching the required letter', async () => {
      const result = await validateMove(
        { rawInput: 'elephant', requiredLetter: 'e', usedWords },
        dictionary,
      );
      expect(result.isValid).toBe(true);
      expect(result.reason).toBeNull();
      expect(result.normalizedWord).toBe('elephant');
    });

    it('accepts a word that is also a common personal name (PRD 8.5)', async () => {
      const result = await validateMove(
        { rawInput: 'rose', requiredLetter: 'r', usedWords },
        dictionary,
      );
      expect(result.isValid).toBe(true);
    });

    it.each(['cats', 'walked', 'playing', 'faster'])(
      'accepts the inflected form %s (PRD 8.6)',
      async word => {
        const result = await validateMove(
          { rawInput: word, requiredLetter: word.charAt(0), usedWords },
          dictionary,
        );
        expect(result.isValid).toBe(true);
      },
    );

    it('accepts an obscure word from the player (PRD 8.7)', async () => {
      // Obscurity limits what the computer plays, not what the player may submit.
      const result = await validateMove(
        { rawInput: 'eigenvalue', requiredLetter: 'e', usedWords },
        dictionary,
      );
      expect(result.isValid).toBe(true);
    });

    it('rejects a disallowed word even when no specific flag explains it', async () => {
      // Fallback path: isAllowed=false with neither isOffensive nor
      // isProperNoun set. Unreachable with today's pipeline, asserted so a
      // future data change cannot silently make such words playable.
      await expectRejection({ rawInput: 'ersatz', requiredLetter: 'e' }, 'unknown_word');
    });

    it('treats empty input as a non-error state, not a rejection', async () => {
      const result = await validateMove(
        { rawInput: '   ', requiredLetter: 'e', usedWords },
        dictionary,
      );
      expect(result.isValid).toBe(false);
      expect(result.reason).toBeNull();
    });

    it('reports duplicate rather than unknown_word when both apply', async () => {
      // Ordering guarantee: structural checks run before the dictionary, so a
      // repeated word gets the message the player can act on.
      await expectRejection(
        { rawInput: 'zzzzz', requiredLetter: 'z', usedWords: new Set(['zzzzz']) },
        'duplicate',
      );
    });

    it('does not consult the dictionary for structurally invalid input', async () => {
      const lookup = jest.fn(dictionary);
      await validateMove({ rawInput: 'to', requiredLetter: 't', usedWords }, lookup);
      expect(lookup).not.toHaveBeenCalled();
    });

    it('matches case-insensitively against used words', async () => {
      await expectRejection(
        { rawInput: '  APPLE ', requiredLetter: 'a' },
        'duplicate',
      );
    });
  });
});

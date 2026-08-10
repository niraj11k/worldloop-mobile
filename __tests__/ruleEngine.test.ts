import { normalizeWord, validateMove, getRequiredLetter } from '@features/game/ruleEngine';

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

    it('rejects a word with the wrong starting letter', () => {
      const result = validateMove({ rawInput: 'river', requiredLetter: 'e', usedWords });
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('wrong_letter');
    });

    it('rejects a duplicate word', () => {
      const result = validateMove({ rawInput: 'apple', requiredLetter: 'a', usedWords });
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('duplicate');
    });

    it('rejects a word shorter than the minimum length', () => {
      const result = validateMove({ rawInput: 'to', requiredLetter: 't', usedWords });
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('too_short');
    });

    it('rejects unsupported symbols', () => {
      const result = validateMove({ rawInput: 'elephant2', requiredLetter: 'e', usedWords });
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('unsupported_symbols');
    });

    it('accepts a valid, unused word matching the required letter', () => {
      const result = validateMove({ rawInput: 'elephant', requiredLetter: 'e', usedWords });
      expect(result.isValid).toBe(true);
      expect(result.normalizedWord).toBe('elephant');
    });
  });
});

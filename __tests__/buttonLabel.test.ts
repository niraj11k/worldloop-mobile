import { labelScaleCap } from '@components/common/Button';
import { MONO_ADVANCE_EM, typeScale } from '@theme/theme';

/**
 * Design System §4, "Text scaling": a button label grows with the OS text
 * setting until its longest word would no longer fit on one line, never below
 * 1x. The narrowest screen in the WL-005 matrix is the iPhone SE at 375pt.
 */
const SE_WIDTH = 375;
/** iOS's largest accessibility size scales body-sized text roughly 3.1x. */
const IOS_AX3 = 3.1;
/** The narrowest line a label sits on: see `NARROWEST_LABEL_INSET`. */
const NARROWEST_LINE = SE_WIDTH - (16 * 2 + 16 * 2 + 3 * 2 + 24 * 2 + 3 * 2);

const wordWidth = (word: string, scale: number) =>
  word.length *
  (typeScale.buttonLabel.fontSize * MONO_ADVANCE_EM + typeScale.buttonLabel.letterSpacing) *
  scale;

describe('labelScaleCap', () => {
  it.each(['Reset Statistics', 'Attributions', 'Delete My Data', 'End and Start New'])(
    'keeps the longest word of "%s" on one line at its cap',
    label => {
      const cap = labelScaleCap(label, SE_WIDTH)!;
      const longest = label.split(/\s+/).reduce((a, b) => (b.length > a.length ? b : a));
      expect(wordWidth(longest, cap)).toBeLessThanOrEqual(NARROWEST_LINE + 0.001);
    },
  );

  it('bites on the long words that broke at iOS AX3', () => {
    // Found on the simulator: "RESET STATISTI / CS", "ATTRIBUT / IONS".
    expect(labelScaleCap('Reset Statistics', SE_WIDTH)!).toBeLessThan(IOS_AX3);
    expect(labelScaleCap('Attributions', SE_WIDTH)!).toBeLessThan(IOS_AX3);
  });

  it('leaves short labels free to scale past the largest OS size', () => {
    expect(labelScaleCap('On', SE_WIDTH)!).toBeGreaterThan(IOS_AX3);
    expect(labelScaleCap('Play Again', SE_WIDTH)!).toBeGreaterThan(IOS_AX3);
  });

  it('never caps below normal size, however long the word', () => {
    expect(labelScaleCap('Supercalifragilisticexpialidocious', SE_WIDTH)).toBe(1);
  });

  it('gives a wider screen more room', () => {
    expect(labelScaleCap('Attributions', 430)!).toBeGreaterThan(
      labelScaleCap('Attributions', SE_WIDTH)!,
    );
  });
});

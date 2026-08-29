import { ATTRIBUTIONS } from '@constants/attributions';

/**
 * The *text* of these notices is verified against its sources by
 * `npm run attributions:verify` — that check reads the licence review and the
 * bundled OFL files, which this TypeScript project has no Node types to do.
 *
 * What is left here is the part that is about the app rather than the
 * documents: that every dependency WordLoop has taken on actually appears,
 * with something for a player to read, and that the CC-BY-4.0 entry carries
 * the four things that licence asks to be named.
 */
const noticeFor = (fragment: string) =>
  ATTRIBUTIONS.find(entry => entry.title.includes(fragment))?.notice ?? '';

describe('shipped attributions', () => {
  it('carries every notice the project has taken on', () => {
    // ESDB and WordNet (WL-101), LDNOOBW (WL-104), and the two OFL fonts
    // (Design System §2). A fifth dependency with a notice means a fifth
    // entry here, not a footnote somewhere else.
    expect(ATTRIBUTIONS.map(entry => entry.title)).toEqual([
      'English Speller Database (ESDB)',
      'WordNet',
      'List of Dirty, Naughty, Obscene, and Otherwise Bad Words',
      'Baloo 2 and JetBrains Mono',
    ]);
  });

  it('says what each dependency is used for, and carries its notice', () => {
    ATTRIBUTIONS.forEach(entry => {
      expect(entry.usage.length).toBeGreaterThan(0);
      expect(entry.notice.length).toBeGreaterThan(0);
    });
  });

  it('names both font copyright holders', () => {
    const fonts = noticeFor('Baloo 2');
    expect(fonts).toContain('Copyright 2019 The Baloo 2 Project Authors');
    expect(fonts).toContain('Copyright 2020 The JetBrains Mono Project Authors');
  });

  it('ships the OFL clauses that carry the obligation', () => {
    const fonts = noticeFor('Baloo 2');
    ['PERMISSION & CONDITIONS', 'TERMINATION', 'DISCLAIMER'].forEach(clause => {
      expect(fonts).toContain(clause);
    });
  });

  it('gives CC BY 4.0 what it asks for: work, source, licence, and changes', () => {
    const excluded = noticeFor('Dirty');
    expect(excluded).toContain('CC BY 4.0');
    expect(excluded).toContain(
      'github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words',
    );
    expect(excluded).toContain('modified');
  });
});

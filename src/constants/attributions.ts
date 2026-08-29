/**
 * Attribution notices shipped in Settings → Attributions (WL-407).
 *
 * Every one of these is a licence obligation, not a courtesy. Three of the
 * four notices are copied from a source file rather than retyped, so they can
 * be diffed against it:
 *
 * - **ESDB** and **WordNet** — `WordLoop_Word_List_Licence_Review.md`
 *   section 7, the text WL-101 established as "required attribution text, to
 *   ship", character for character.
 * - **Baloo 2 / JetBrains Mono** — the OFL 1.1 body is copied from
 *   `licenses/fonts/Baloo2-OFL.txt`. OFL 1.1 requires the licence text itself
 *   to travel with the software, and both fonts ship byte-identical licence
 *   bodies differing only in their copyright line — hence one entry carrying
 *   two copyright lines rather than two near-duplicate entries.
 * - **LDNOOBW** — the only block written here rather than copied, because
 *   CC-BY-4.0 supplies no notice text of its own: it requires naming the
 *   work, its creator, the source, and the licence. The work, source and
 *   licence are from WL-104's record; the *creator* line deliberately names
 *   the project rather than a company, because no project document states an
 *   author and inventing one would be worse than naming none. **Confirm
 *   against the upstream repository before submission**, alongside the two
 *   items the licence review already holds for legal sign-off.
 *
 * If any source changes, re-copy rather than hand-editing, and record it
 * against the task that changed the dependency.
 */

export interface Attribution {
  /** Section heading on the screen. */
  title: string;
  /** What this software or data is used for, in the app's own voice. */
  usage: string;
  /** The notice itself, reproduced exactly. */
  notice: string;
}

export const ATTRIBUTIONS: readonly Attribution[] = [
  {
    title: 'English Speller Database (ESDB)',
    usage: 'WordLoop’s word list is generated from ESDB, formerly SCOWL.',
    notice: `Copyright 2000-2026 by Kevin Atkinson

Permission to use, copy, modify, distribute, and sell any part of the English
Speller Database (ESDB, previously known as SCOWLv2), or word lists
created from it, is hereby granted without fee, provided that the above
copyright notice appears in all copies and that both the above copyright
notice and this notice appear in supporting documentation.  Kevin Atkinson
makes no representations about the suitability of this database for any
purpose.  It is provided "as is" without express or implied warranty.`,
  },
  {
    title: 'WordNet',
    usage:
      'Used by ESDB when assigning parts of speech, which is how WordLoop tells a name from an ordinary word.',
    notice: `WordNet was used to help with the initial POS assignment:

Permission to use, copy, modify and distribute this software and
database and its documentation for any purpose and without fee or
royalty is hereby granted, provided that you agree to comply with
the following copyright notice and statements, including the
disclaimer, and that the same appear on ALL copies of the software,
database and documentation, including modifications that you make
for internal use or for distribution.

WordNet 1.6 Copyright 1997 by Princeton University.  All rights
reserved.

THIS SOFTWARE AND DATABASE IS PROVIDED "AS IS" AND PRINCETON
UNIVERSITY MAKES NO REPRESENTATIONS OR WARRANTIES, EXPRESS OR
IMPLIED.

The name of Princeton University or Princeton may not be used in
advertising or publicity pertaining to distribution of the software
and/or database.`,
  },
  {
    title: 'List of Dirty, Naughty, Obscene, and Otherwise Bad Words',
    usage:
      'The starting point for WordLoop’s excluded-word list, reviewed and reduced by hand.',
    notice: `By the LDNOOBW project.
Source: github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words

Licensed under the Creative Commons Attribution 4.0 International
Licence (CC BY 4.0): creativecommons.org/licenses/by/4.0/

WordLoop uses a modified subset of this list.`,
  },
  {
    title: 'Baloo 2 and JetBrains Mono',
    usage: 'The two typefaces WordLoop is set in.',
    notice: `Copyright 2019 The Baloo 2 Project Authors
(https://github.com/EkType/Baloo2)

Copyright 2020 The JetBrains Mono Project Authors
(https://github.com/JetBrains/JetBrainsMono)

Both are licensed under the SIL Open Font License, Version 1.1,
reproduced below and also available with a FAQ at:
https://scripts.sil.org/OFL

` +
      `-----------------------------------------------------------
SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007
-----------------------------------------------------------

PREAMBLE
The goals of the Open Font License (OFL) are to stimulate worldwide
development of collaborative font projects, to support the font creation
efforts of academic and linguistic communities, and to provide a free and
open framework in which fonts may be shared and improved in partnership
with others.

The OFL allows the licensed fonts to be used, studied, modified and
redistributed freely as long as they are not sold by themselves. The
fonts, including any derivative works, can be bundled, embedded, 
redistributed and/or sold with any software provided that any reserved
names are not used by derivative works. The fonts and derivatives,
however, cannot be released under any other type of license. The
requirement for fonts to remain under this license does not apply
to any document created using the fonts or their derivatives.

DEFINITIONS
"Font Software" refers to the set of files released by the Copyright
Holder(s) under this license and clearly marked as such. This may
include source files, build scripts and documentation.

"Reserved Font Name" refers to any names specified as such after the
copyright statement(s).

"Original Version" refers to the collection of Font Software components as
distributed by the Copyright Holder(s).

"Modified Version" refers to any derivative made by adding to, deleting,
or substituting -- in part or in whole -- any of the components of the
Original Version, by changing formats or by porting the Font Software to a
new environment.

"Author" refers to any designer, engineer, programmer, technical
writer or other person who contributed to the Font Software.

PERMISSION & CONDITIONS
Permission is hereby granted, free of charge, to any person obtaining
a copy of the Font Software, to use, study, copy, merge, embed, modify,
redistribute, and sell modified and unmodified copies of the Font
Software, subject to the following conditions:

1) Neither the Font Software nor any of its individual components,
in Original or Modified Versions, may be sold by itself.

2) Original or Modified Versions of the Font Software may be bundled,
redistributed and/or sold with any software, provided that each copy
contains the above copyright notice and this license. These can be
included either as stand-alone text files, human-readable headers or
in the appropriate machine-readable metadata fields within text or
binary files as long as those fields can be easily viewed by the user.

3) No Modified Version of the Font Software may use the Reserved Font
Name(s) unless explicit written permission is granted by the corresponding
Copyright Holder. This restriction only applies to the primary font name as
presented to the users.

4) The name(s) of the Copyright Holder(s) or the Author(s) of the Font
Software shall not be used to promote, endorse or advertise any
Modified Version, except to acknowledge the contribution(s) of the
Copyright Holder(s) and the Author(s) or with their explicit written
permission.

5) The Font Software, modified or unmodified, in part or in whole,
must be distributed entirely under this license, and must not be
distributed under any other license. The requirement for fonts to
remain under this license does not apply to any document created
using the Font Software.

TERMINATION
This license becomes null and void if any of the above conditions are
not met.

DISCLAIMER
THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT
OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE
COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL
DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM
OTHER DEALINGS IN THE FONT SOFTWARE.`,
  },
];

# WordLoop Word List Licence Review

**Version:** 1.0
**Status:** Technical review complete — **recommend legal counsel confirm before public release** (see section 8)
**Decision this closes:** Delivery Plan D-01 (word-list source, licence, and scope)
**Reviewed:** 2026-08-17, against the live upstream source (not from memory — see section 9 for exact URLs and commit references)

---

## 1. Recommendation

**Adopt the English Speller Database (ESDB) — the actively maintained successor to SCOWL — pinned at release `rel-2026.02.25`, restricted to size ≤ 70.** This clears review under a permissive, low-friction licence with a single short attribution notice for the vast majority of what WordLoop needs, and the maintainer has already restructured the licence file specifically to make "tell me what I need to include for my use case" a solved problem, rather than requiring us to work it out ourselves.

No fallback source is needed. The fallback identified in the Delivery Plan (ENABLE word list / `dwyl/english-words`) was not evaluated because ESDB did not fail review — keeping the fallback identified but unresearched avoids wasted effort.

---

## 2. What ESDB actually is (and why it's not quite "SCOWL" anymore)

The PRD and Architecture doc both point at "SCOWL." That project has since renamed and restructured:

- **SCOWLv1** — the classic project, published as flat text files per size tier (10/20/35/40/50/55/60/70/80/95) and sub-category (`words` / `abbreviations` / `contractions` / `proper-names` / `upper`). This is what the PRD's cited sources (the `myint/scspell` mirror, `openhub.net`, Launchpad) describe, and it's frozen at its last real release.
- **ESDB (English Speller Database, formerly "SCOWLv2")** — the current, actively maintained project at [`github.com/en-wl/wordlist`](https://github.com/en-wl/wordlist), default branch `v2`. Latest tagged release: **`rel-2026.02.25`** (published 2026-02-25, per the repo's GitHub Releases page). It combines the same underlying word data into a richer single database (flat text file + SQLite3), adding part-of-speech, inflection relationships, and — significantly for us — a structured proper-noun classification that SCOWLv1 only had as a single flat `proper-names` bucket.

Recommendation: **use ESDB, not the legacy SCOWLv1 tree.** It's the actively maintained line (commits into 2026), it has a cleaner licence structure (section 3), and its schema gives us more of what the Data Model doc's `DictionaryWord` entity needs (part-of-speech, base-word/inflection linkage) without extra work.

---

## 3. Licence terms — read directly from the current `Copyright` file

Fetched directly from `https://raw.githubusercontent.com/en-wl/wordlist/v2/Copyright` (the file the v2 `README.md` points to). Reproduced in full below because the whole point of this review is to check the actual current text, not a summary of it.

```text
Copyright 2000-2026 by Kevin Atkinson

Permission to use, copy, modify, distribute, and sell any part of the English
Speller Database (ESDB, previously known as SCOWLv2), or word lists
created from it, is hereby granted without fee, provided that the above
copyright notice appears in all copies and that both the above copyright
notice and this notice appear in supporting documentation.  Kevin Atkinson
makes no representations about the suitability of this database for any
purpose.  It is provided "as is" without express or implied warranty.

ESDB is derived from many sources, most of which are in the Public Domain.
Data from the Corpus of Contemporary American English (COCA) was also used.

All data from COCA comes from 3-gram data that is not freely available;
however, the usage is within the rights given by the NDA that was signed when
purchasing the data.  More information on COCA is available at
https://www.english-corpora.org/coca/.

The primary source of words for ESDB comes from 12dicts and ENABLE2K.  Both
are in the Public Domain, but Alan Beale <biljir@pobox.com> deserves special
credit as he is the author of 12dicts and a major contributor to ENABLE2K.  In
addition, he gave me an incredible amount of feedback and created a number of
special lists in order to help improve the overall quality of ESDB.

===

If you are using an official speller dictionary created by ESDB that is not
Australian English, then no additional copyright applies and including the
notice before the === is sufficient.

If you are using the Australian English dictionary or a wordlist that uses the 'D'
SPELLING code and/or the 'AU' REGION code, the copyright after '=== AU' applies.

If you are using a generated word list larger than 80, the copyright
after '=== UKACD' applies.

If you are distributing the database or results from the
database that is not a speller dictionary or generated word list, then both
copyrights may apply depending on the parts you use.  In addition, the WordNet
copyright MIGHT apply as WordNet was one of many sources used for the initial
POS assignment.
```

**This is the key structural fact the whole recommendation rests on:** the maintainer has explicitly pre-answered "what do I need to include?" as a decision tree, conditioned on what you use. WordLoop's case:

| Condition | Applies to WordLoop? | Extra notice required? |
|---|---|---|
| Non-Australian word list | Yes — v1 ships US/UK English only | **No** — top notice alone is sufficient |
| Australian English / `AU` region / `D` spelling code | No, not planned for v1 | N/A — skip |
| Generated word list larger than size 80 | No, if we cap at size ≤ 70 (see section 4) | N/A — skip, and this is worth deliberately staying under |
| Distributing the raw database itself (not a generated word list) | No — we generate and bundle a derived word list, not the database | N/A — skip |

**Conclusion: for a size-capped-at-70, non-Australian, generated word list, the single top-of-file Kevin Atkinson notice is the entire attribution requirement.** No verbatim-document-reproduction obligation, no per-source notice stacking.

---

## 4. Why the size cap matters — the UKACD clause

The one clause in this licence that's meaningfully stricter than "keep the notice around" is UKACD (UK Advanced Cryptics Dictionary), which only enters the picture at size > 80:

```text
Copyright (c) J Ross Beresford 1993-1999. All Rights Reserved.

The following restriction is placed on the use of this publication:
if The UK Advanced Cryptics Dictionary is used in a software package
or redistributed in any form, the copyright notice must be
prominently displayed and the text of this document must be included
verbatim.
```

That's a real obligation — reproduce the entire UKACD copyright document verbatim, not just a short notice — and it's disproportionate to what UKACD actually contributes (obscure/cryptic-crossword-tier words we don't want the computer or most players using anyway, per PRD §8.7's "the computer should generally select common playable words"). **Recommendation: cap the generated word list at size ≤ 70 and never touch size 80+.** This sidesteps UKACD entirely as a matter of scope, not as a compliance workaround — WordLoop was never going to want size-95-tier obscurity in a casual game.

This also happens to line up with the size scale's own documented meaning (from `docs/policy.md` and the v2 README): **35 = small, 50 = medium, 60 = medium-large (the project's own default spellcheck size), 70 = large (their "large spellchecking dictionary" tier), 80 = "valid word in current usage."** 70 is already the edge of what a spellchecker considers reasonable; there's no product reason to reach past it.

---

## 5. Proper-noun classification — this solves PRD §8.5 largely for free

PRD §8.5 requires proper nouns to be rejected via **dictionary classification, not a blocklist** — `rose` must stay playable as a common noun even though it's also a name. ESDB's schema has a `POS-CLASS` field on entries, with documented values including:

```text
person, surname, place, name, demonym, trademark
```

This is more granular than SCOWLv1's single flat `proper-names` bucket, and maps directly onto PRD §8.5's list (personal names → `person`/`surname`; place names → `place`; brand/company/organisation names → `trademark`/`name`). **The `DictionaryWord.is_proper_noun` field in the Data Model doc (§1) can be derived directly from `POS-CLASS` membership in that set** — no separate proper-noun blocklist needs to be hand-built, which was flagged as a distinct task (WL-103) in the Delivery Plan. That task still needs a fixture test suite (the `rose`/`peter`/`newton` cases), but the classification data itself doesn't need to be sourced or curated separately — it already exists in ESDB.

The build also exposes a plain-text output (`make scowl.txt`) whose line format explicitly carries `SIZE [REGION] [CATEGORY]` per entry, and a SQLite3 database (`scowl.db`) with the fuller schema (`schema.sql` / `views.sql` in `libscowl/`) if a running query interface is preferred over flat-file parsing during the WL-102 pipeline build.

---

## 6. Coverage of the Data Model doc's `DictionaryWord` fields

| `DictionaryWord` field (Data Model §1) | Sourced from ESDB? |
|---|---|
| `word`, `normalized_word` | Yes — direct |
| `base_word` | Yes — ESDB carries inflection/lemma relationships |
| `part_of_speech` | Yes — ESDB includes basic POS |
| `is_proper_noun` | Yes — via `POS-CLASS` (section 5) |
| `is_common_word` / `is_obscure` | Yes — via size tier (section 4) |
| `is_offensive` | **No** — ESDB has no offensiveness signal. Confirms WL-104 (a separately curated, configurable exclusion list per PRD §8.8) is still required and is not something this source provides |
| `is_allowed` | Derived — computed by the WL-102 pipeline from the above, not sourced directly |
| `frequency_score` | Partial — size tier is a coarse proxy; not a continuous frequency score. Sufficient for Architecture §6/§7's commonness/rarity inputs per the D-02 recommendation to use tier-based scoring instead of a separate `wordfreq` dependency |
| `source_name` / `source_version` | `"English Speller Database (ESDB), formerly SCOWL"` / `"rel-2026.02.25"` |

No gap here changes the Phase 1 plan — the one real gap (`is_offensive`) was already scoped as its own task (WL-104) and was never expected to come from a spellchecker word list.

---

## 7. Required attribution text (verbatim, to ship)

Per section 3, the minimum required notice for WordLoop's usage (non-Australian, size ≤ 70, generated word list) is:

```text
Copyright 2000-2026 by Kevin Atkinson

Permission to use, copy, modify, distribute, and sell any part of the English
Speller Database (ESDB, previously known as SCOWLv2), or word lists
created from it, is hereby granted without fee, provided that the above
copyright notice appears in all copies and that both the above copyright
notice and this notice appear in supporting documentation.  Kevin Atkinson
makes no representations about the suitability of this database for any
purpose.  It is provided "as is" without express or implied warranty.
```

**Recommendation: also include the WordNet notice**, even though section 3's decision tree says it only "MIGHT" apply (WordNet was one of several sources used for ESDB's *internal* POS assignment, not something WordLoop redistributes directly as data). Including it costs one short paragraph in an Attributions screen nobody reads closely, and removes any argument about whether POS-derived data we bundle counts as "results from the database." Cheap insurance:

```text
WordNet was used to help with the initial POS assignment:

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
and/or database.
```

Both notices go in the Settings → Attributions screen (already scoped as part of WL-407 in the Delivery Plan).

**Do not** include the UKACD or Australian/Benjamin Titze notices — including them would be harmless but implies we used size 80+ or the Australian dialect data, which we're deliberately not doing. Keeping the attribution screen matched to actual usage is cleaner and avoids a false compliance signal if the size cap is ever revisited.

---

## 8. What this review is — and isn't

This is a good-faith **technical** reading of the current licence text, cross-checked against the actual repository structure rather than assumed from memory or the PRD's now-stale source links. It is not legal advice, and the PRD itself already says as much ("review all licences before public release," §11.3). Two things specifically worth a real legal read before public release, not because they look disqualifying but because they're the two places this review had to rely on the maintainer's own representation rather than verifiable-by-us facts:

1. **The COCA data provenance clause** (section 3, third paragraph): the maintainer states that COCA 3-gram data used inside ESDB is covered by an NDA *he* signed with COCA's data owner, and that ESDB's use/redistribution is within that NDA's terms. WordLoop isn't a party to that NDA and can't independently verify its terms — we'd be relying entirely on the maintainer's representation. Worth a sentence from counsel confirming this kind of pass-through reliance is acceptable for a commercial app, given it's the one clause in this whole review that isn't a self-contained permissive grant.
2. **General confirmation that "permission to use, copy, modify, distribute, and sell... without fee"** is read the way we're reading it — i.e., that it covers bundling a derived, processed subset inside a paid or ad-supported mobile app binary, not just standalone redistribution of the word list itself. The text doesn't distinguish, and nothing in it suggests it would, but a one-line confirmation is cheap relative to the risk of being wrong.

Neither of these blocks starting Phase 1 work. Both are the kind of thing to close out before an App Store / Play Store submission, not before writing the dictionary pipeline. Both are tracked in `WordLoop_Store_Submission_Checklist.md`, section A, alongside every other pre-submission item across the project — that's the canonical checklist; this section is where the two licence-specific items originate.

---

## 9. Sources (fetched directly, not from memory)

- Repository: [`github.com/en-wl/wordlist`](https://github.com/en-wl/wordlist), default branch `v2`
- Licence file: [`raw.githubusercontent.com/en-wl/wordlist/v2/Copyright`](https://raw.githubusercontent.com/en-wl/wordlist/v2/Copyright) — fetched and reproduced in full in section 3
- Project README: [`raw.githubusercontent.com/en-wl/wordlist/v2/README.md`](https://raw.githubusercontent.com/en-wl/wordlist/v2/README.md)
- Word inclusion policy: [`docs/policy.md`](https://github.com/en-wl/wordlist/blob/v2/docs/policy.md) on the `v2` branch (word-inclusion criteria only; no separate licensing content)
- Releases: [`github.com/en-wl/wordlist/releases`](https://github.com/en-wl/wordlist/releases) — pinned version `rel-2026.02.25`, published 2026-02-25
- Legacy SCOWLv1 licence (`master` branch `scowl/Copyright`), fetched for comparison only, not adopted — superseded by the v2 `Copyright` file quoted in section 3

---

## 10. Decision record

- **D-01 (Delivery Plan section 3): CLOSED.** Source: ESDB (`en-wl/wordlist`, formerly SCOWL), pinned at `rel-2026.02.25`. Scope: size ≤ 70, non-Australian, generated word list only.
- **Fallback (ENABLE / `dwyl/english-words`): not evaluated**, not needed — ESDB cleared review.
- **D-02 (frequency/commonness data): also effectively closed by this review** — ESDB's size tiers (35/50/60/70) serve as the commonness signal per the Delivery Plan's stated fallback position, so no separate `wordfreq` dependency or licence review is needed for v1.
- **Carries forward to Phase 1 (WL-102):** build the pipeline against `make scowl.txt` (or `scowl.db` if a query interface is preferred) at tag `rel-2026.02.25`, filtering to size ≤ 70 and excluding `POS-CLASS ∈ {person, surname, place, name, demonym, trademark}` for the proper-noun flag.
- **Carries forward to Phase 1 (WL-104):** the offensive-word exclusion list remains a separately curated, configurable dataset — confirmed not available from this source.
- **Carries forward to Phase 4 (WL-407):** ship the two attribution notices from section 7 in Settings → Attributions.

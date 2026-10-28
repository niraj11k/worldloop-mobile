#!/usr/bin/env python3
"""
WordLoop dictionary data fixtures.

Covers three Delivery Plan "Done when" clauses against the generated data:
  - WL-103: >=50 proper-noun classification cases
  - WL-107: PRD section 8.6 inflected forms are accepted
  - WL-104: every word in data/excluded-words.txt is flagged and unplayable,
    and nothing outside that file is flagged (the list stays the single
    source of the exclusion policy, per PRD section 8.8)

plus two completeness checks on that list, from Delivery Plan D-18, which
read ESDB itself (.cache/esdb/scowl.db, built by the generator):
  - every ESDB form of a listed headword ("nigger" -> "niggers") is either
    listed too or marked reviewed-and-kept with a '+' line
  - no playable word carries ESDB's own offensive-1, offensive-2 or vulgar-1
    usage note

Verifies scripts/generate-dictionary.py's output against real words with a
known-correct classification, so a future change to the pipeline's
proper-noun logic (PROPER_NOUN_POS_CLASSES / NON_COMMON_POS_CLASSES) can't
silently regress without this failing.

Every word below was individually checked against the generated dictionary
before being added here — see WordLoop_Delivery_Plan.md's WL-103 entry for
the "peter"/"newton" case this fixture list deliberately excludes (both are
genuinely dual-sense in ESDB, same as rose/mark/will, so they're accept-
cases, not reject-cases -- kept out of REJECT_WORDS below rather than
force-fit). "robert"/"nike"/"pepsi" used to be left out here as a supposed
blank-POS-CLASS source gap; they are actually tagged `name?`, and since
Delivery Plan D-17 the pipeline's capitalisation rule rejects them, so they
are reject cases below along with the capitalised proper adjectives
(jewish, muslim, latin) that prompted D-17.

Usage:
    npm run dictionary:generate   # if src/assets/dictionary/dictionary.json doesn't exist yet
    npm run dictionary:verify
"""

from __future__ import annotations

import importlib.util
import json
import sqlite3
import sys
from collections import defaultdict
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DICTIONARY_PATH = REPO_ROOT / "src" / "assets" / "dictionary" / "dictionary.json"
EXCLUSIONS_PATH = REPO_ROOT / "data" / "excluded-words.txt"

# ESDB usage notes that mark a word as unfit for this audience: the two
# racial-slur notes and "should generally not be said around children".
# vulgar-3 ("not nearly as strong", e.g. crap, fart, piss) is deliberately not
# here -- WL-104 never excluded that tier (Delivery Plan D-18).
MUST_EXCLUDE_USAGE_NOTES = ("offensive-1", "offensive-2", "vulgar-1")

# Proper nouns per PRD section 8.5 / licence review section 5: rejected via
# is_proper_noun, no independent common-word reading in ESDB.
REJECT_WORDS = [
    "james", "london", "paris", "thomas", "edward", "sarah", "emily", "texas",
    "california", "india", "canada", "france", "germany", "michael", "david",
    "jennifer", "jessica", "brooklyn", "denver", "chicago", "boston",
    "seattle", "austin", "disney",
    # Delivery Plan D-17: capitalised-only in ESDB, with a blank or `name?`/
    # `upper?` POS-CLASS that the POS-CLASS check alone let through.
    "robert", "nike", "pepsi", "toyota", "xerxes", "oscar",
    "monday", "january", "christmas",
    "jewish", "muslim", "hindu", "sikh", "islamic", "christians",
    "latin", "arab", "inuit", "hispanic", "spanish", "arabic", "hindi",
]

# Common words that must stay playable, including ones that are ALSO common
# names/places (rose, may, mark, will, frank, amber) per PRD section 8.5's
# explicit "rose must remain playable" requirement.
ACCEPT_WORDS = [
    "rose", "may", "mark", "will", "frank", "amber", "dog", "cat", "apple",
    "table", "house", "water", "music", "garden", "window", "pencil",
    "mountain", "river", "forest", "ocean", "computer", "keyboard",
    "elephant", "giraffe", "bicycle", "sunshine", "thunder", "whisper",
    "journey", "freedom",
    # D-17's capitalisation rule must keep a word whose ESDB entry also has
    # a genuine lowercase sense: catholic (universal), polish (to polish),
    # english (spin in billiards), pole. ("welsh" moved to the exclusion list
    # under D-18.)
    "catholic", "polish", "english", "pole",
    # D-18: words sharing an ESDB group or a spelling with an excluded word,
    # which must not be dragged out with it (finger/fingering, rim/rimming,
    # scissors/scissoring, spices/spic), and slurs' innocent homographs that
    # the rose rule keeps.
    "finger", "rim", "scissors", "came", "spices", "chink", "paddy", "spade",
]

# PRD section 8.6 / Delivery Plan WL-107: inflected forms must be accepted --
# plurals, verb forms, comparatives, superlatives, and irregulars. The
# play/plays/played/playing and fast/faster/fastest runs are here on purpose:
# section 8.6 explicitly does NOT restrict multiple forms from one word family
# in v1, so every member must be independently playable. The rule engine's
# side of this is covered in __tests__/ruleEngine.test.ts; this asserts the
# data actually carries them.
INFLECTED_FORMS = [
    "cats", "walked", "playing", "faster",          # the four PRD 8.6 names
    "cat", "walk", "play", "plays", "played",       # same-family, no restriction
    "fast", "fastest", "bigger", "biggest",         # comparative / superlative
    "running", "ran", "children", "mice", "geese",  # irregular forms
]


def load_exclusions() -> tuple[set[str], set[str]]:
    """Returns (excluded, kept): kept is the '+' lines, words reviewed and
    deliberately left playable (D-18)."""
    words: set[str] = set()
    kept: set[str] = set()
    for line in EXCLUSIONS_PATH.read_text(encoding="utf-8").splitlines():
        entry = line.strip().lower()
        if entry.startswith("+"):
            kept.add(entry[1:].strip())
        elif entry and not entry.startswith("#"):
            words.add(entry)
    return words, kept


def load_generator():
    """The generator module, so the ESDB checks below filter rows exactly as
    the pipeline does (size cap, spellings, regions, categories) instead of
    keeping a second copy of those constants that could drift."""
    spec = importlib.util.spec_from_file_location(
        "generate_dictionary", REPO_ROOT / "scripts" / "generate-dictionary.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def esdb_groups_and_notes(gen) -> tuple[dict[str, set[str]], dict[str, set[str]]]:
    """From ESDB: forms per headword (normalized lemma -> normalized forms in
    that lemma's groups), and usage notes per normalized word."""
    con = sqlite3.connect(f"file:{gen.CACHE_DIR / 'scowl.db'}?mode=ro", uri=True)
    lemma_text = dict(con.execute("select lemma_id, lemma from lemmas"))
    spelling_ph = ",".join("?" for _ in gen.ALLOWED_SPELLINGS)
    region_ph = ",".join("?" for _ in gen.EXCLUDED_REGIONS)
    category_ph = ",".join("?" for _ in gen.EXCLUDED_CATEGORIES)
    rows = con.execute(
        f"""
        select lemma_id, word, usage_note from scowl_
        where size <= ?
          and spelling in ({spelling_ph})
          and (region is null or region = '' or region not in ({region_ph}))
          and (category is null or category = '' or category not in ({category_ph}))
        """,
        [gen.SIZE_CAP, *gen.ALLOWED_SPELLINGS, *gen.EXCLUDED_REGIONS, *gen.EXCLUDED_CATEGORIES],
    ).fetchall()
    con.close()

    forms: dict[str, set[str]] = defaultdict(set)
    notes: dict[str, set[str]] = defaultdict(set)
    for lemma_id, raw_word, usage_note in rows:
        word = gen.deaccent_to_ascii_word(raw_word)
        lemma = gen.deaccent_to_ascii_word(lemma_text.get(lemma_id) or "")
        if word is None:
            continue
        if lemma is not None:
            forms[lemma].add(word)
        if usage_note:
            notes[word].add(usage_note)
    return forms, notes


def main() -> int:
    if not DICTIONARY_PATH.exists():
        print(f"error: {DICTIONARY_PATH} does not exist.")
        print("Run `npm run dictionary:generate` first.")
        return 1

    entries = json.load(DICTIONARY_PATH.open(encoding="utf-8"))
    by_word = {e["normalizedWord"]: e for e in entries}

    failures: list[str] = []

    for word in REJECT_WORDS:
        entry = by_word.get(word)
        if entry is None:
            failures.append(f"{word}: expected present+proper-noun, but missing entirely")
        elif not entry["isProperNoun"]:
            failures.append(f"{word}: expected isProperNoun=True, got False")
        elif entry["isAllowed"]:
            failures.append(f"{word}: expected isAllowed=False, got True")

    for word in ACCEPT_WORDS + INFLECTED_FORMS:
        entry = by_word.get(word)
        if entry is None:
            failures.append(f"{word}: expected present+allowed, but missing entirely")
        elif entry["isProperNoun"]:
            failures.append(f"{word}: expected isProperNoun=False, got True")
        elif not entry["isAllowed"]:
            failures.append(f"{word}: expected isAllowed=True, got False")

    # WL-104: every listed exclusion must actually be marked in the generated
    # data, and must still be PRESENT as an entry -- a word that vanished
    # entirely would be reported to the player as unknown_word rather than
    # offensive_excluded, losing the distinction Wireframe section 10 draws.
    exclusions, kept = load_exclusions()
    for word in sorted(exclusions):
        entry = by_word.get(word)
        if entry is None:
            failures.append(f"{word}: excluded but not present in the dictionary at all")
        elif not entry["isOffensive"]:
            failures.append(f"{word}: listed in excluded-words.txt but isOffensive=False")
        elif entry["isAllowed"] or entry["isComputerPlayable"]:
            failures.append(f"{word}: excluded but still playable")

    # And nothing outside the list may be flagged, so the file stays the single
    # source of the exclusion policy (PRD section 8.8).
    stray = sorted(e["normalizedWord"] for e in entries if e["isOffensive"])
    for word in stray:
        if word not in exclusions:
            failures.append(f"{word}: flagged offensive but absent from excluded-words.txt")

    # D-18: a '+' line says "reviewed, stays playable", so it can't also be
    # an exclusion.
    for word in sorted(kept & exclusions):
        failures.append(f"{word}: both excluded and marked '+' (kept) in excluded-words.txt")

    gen = load_generator()
    if not (gen.CACHE_DIR / "scowl.db").exists():
        print(f"error: {gen.CACHE_DIR / 'scowl.db'} does not exist.")
        print("Run `npm run dictionary:generate` first.")
        return 1
    forms, notes = esdb_groups_and_notes(gen)

    # D-18: every form of a listed headword is decided, not missed. A form
    # that is already a proper noun can't be played anyway, so it needs no
    # decision.
    form_cases = 0
    for headword in sorted(exclusions):
        for form in sorted(forms.get(headword, ())):
            entry = by_word.get(form)
            if form == headword or entry is None or entry["isProperNoun"]:
                continue
            form_cases += 1
            if form not in exclusions and form not in kept:
                failures.append(
                    f"{form}: ESDB form of excluded '{headword}' is neither listed "
                    "nor marked '+' in excluded-words.txt"
                )

    # D-18: ESDB's own worst-offender notes must never be playable.
    note_cases = 0
    for word, word_notes in sorted(notes.items()):
        flagged = sorted(word_notes & set(MUST_EXCLUDE_USAGE_NOTES))
        entry = by_word.get(word)
        if not flagged or entry is None:
            continue
        note_cases += 1
        if entry["isAllowed"]:
            failures.append(f"{word}: ESDB marks it {', '.join(flagged)} but it is playable")

    total_cases = (
        len(REJECT_WORDS) + len(ACCEPT_WORDS) + len(INFLECTED_FORMS) + len(exclusions)
        + form_cases + note_cases
    )
    print(
        f"Fixture cases: {total_cases} "
        f"({len(REJECT_WORDS)} reject, {len(ACCEPT_WORDS)} accept, "
        f"{len(INFLECTED_FORMS)} inflected, {len(exclusions)} excluded, "
        f"{form_cases} excluded-word forms, {note_cases} ESDB usage notes)"
    )

    if failures:
        print(f"\nFAIL ({len(failures)}/{total_cases}):")
        for f in failures:
            print(f"  - {f}")
        return 1

    print("PASS - all fixture cases match expected classification.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""
WordLoop dictionary data fixtures (Delivery Plan WL-103 "Done when": a
fixture test covering >=50 proper-noun cases; plus WL-107's PRD section 8.6
inflected-form confirmation).

Verifies scripts/generate-dictionary.py's output against real words with a
known-correct classification, so a future change to the pipeline's
proper-noun logic (PROPER_NOUN_POS_CLASSES / NON_COMMON_POS_CLASSES) can't
silently regress without this failing.

Every word below was individually checked against the generated dictionary
before being added here — see WordLoop_Delivery_Plan.md's WL-103 entry for
the "peter"/"newton" case this fixture list deliberately excludes (both are
genuinely dual-sense in ESDB, same as rose/mark/will, so they're accept-
cases, not reject-cases -- kept out of REJECT_WORDS below rather than
force-fit). "robert"/"nike"/"pepsi" are also excluded: ESDB left them with
a blank POS-CLASS (a real tagging gap in the source data, not a pipeline
bug) rather than person/trademark, so they come out accepted -- a known
data-coverage gap worth a future look, not a fixture regression to chase
here.

Usage:
    npm run dictionary:generate   # if src/assets/dictionary/dictionary.json doesn't exist yet
    npm run dictionary:verify
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DICTIONARY_PATH = REPO_ROOT / "src" / "assets" / "dictionary" / "dictionary.json"

# Proper nouns per PRD section 8.5 / licence review section 5: rejected via
# is_proper_noun, no independent common-word reading in ESDB.
REJECT_WORDS = [
    "james", "london", "paris", "thomas", "edward", "sarah", "emily", "texas",
    "california", "india", "canada", "france", "germany", "michael", "david",
    "jennifer", "jessica", "brooklyn", "denver", "chicago", "boston",
    "seattle", "austin", "disney",
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

    total_cases = len(REJECT_WORDS) + len(ACCEPT_WORDS) + len(INFLECTED_FORMS)
    print(
        f"Fixture cases: {total_cases} "
        f"({len(REJECT_WORDS)} reject, {len(ACCEPT_WORDS)} accept, "
        f"{len(INFLECTED_FORMS)} inflected)"
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

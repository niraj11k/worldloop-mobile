#!/usr/bin/env python3
"""
WordLoop dictionary generation pipeline (Delivery Plan WL-102).

Builds ESDB (github.com/en-wl/wordlist, formerly SCOWL) from source at the
pinned release and emits a normalized DictionaryWord bundle for local,
client-side gameplay validation (Architecture doc section 4 — v1 is
client-authoritative, no server-side mirror, per D-03).

Every filtering decision below traces to
proj-docs/WordLoop_Word_List_Licence_Review.md:
  - size cap 70            -> section 4 (avoids the UKACD size-80+ clause)
  - spelling scope A/B/Z/_ -> section 3 ("non-Australian... US/UK English only");
                              excludes Canadian (C) and Australian (D)
  - region exclusion AU    -> same, belt-and-suspenders against the region tag
  - proper-noun POS-CLASS  -> section 5 and section 10's decision record,
                              which names the exact set used below

Two judgment calls are NOT from the licence review (game-design scope, not a
legal constraint), and are called out here so they're easy to revisit:
  - EXCLUDED_CATEGORIES drops hacker-slang and roman-numeral entries — not a
    fit for a casual word-chain game.
  - Multi-word / hyphenated / diacritic-only-reducible entries are dropped
    entirely (not stored with is_allowed=false) because the rule engine
    rejects non-letter player input before ever reaching a dictionary
    lookup (Architecture doc section 5), so a dictionary entry for them
    would be unreachable dead weight.

is_offensive is always False here — WL-104 (a separately curated,
configurable exclusion list) is a distinct, not-yet-built task per the
licence review section 6 ("ESDB has no offensiveness signal").

base_word is always None for this pass: WL-102's explicit required-field
list (Delivery Plan Phase 1) is normalized form, allowed/proper-noun/
offensive/obscure flags, commonness tier, and computer-playable flag --
base_word is a DictionaryWord field but not in that list, and deriving it
cleanly needs a join against ESDB's `entries`/`lemmas` views this pass
doesn't do. Flagged here rather than silently left unexplained.

Usage:
    python3 scripts/generate-dictionary.py

Re-runnable: clones/builds ESDB into .cache/esdb once and reuses it after
(delete that directory to force a clean rebuild).
"""

from __future__ import annotations

import json
import re
import sqlite3
import subprocess
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
CACHE_DIR = REPO_ROOT / ".cache" / "esdb"
OUTPUT_DIR = REPO_ROOT / "src" / "assets" / "dictionary"

ESDB_REPO = "https://github.com/en-wl/wordlist.git"
ESDB_TAG = "rel-2026.02.25"
SOURCE_NAME = "English Speller Database (ESDB), formerly SCOWL"

SIZE_CAP = 70
ALLOWED_SPELLINGS = ("_", "A", "B", "Z")
EXCLUDED_REGIONS = ("AU",)
EXCLUDED_CATEGORIES = ("hacker", "roman-numerals")
# WL-105 packed-asset encoding. Every boolean the app needs is derivable from
# these three facts, so only these are stored on device -- the generated data
# has exactly 12 distinct flag combinations, all of them (tier, proper-noun,
# offensive) permutations, which is what makes the packing lossless.
SIZE_TIERS = [35, 40, 50, 60, 65, 70]
FLAG_BASE = 65  # 'A'
PROPER_NOUN_BIT = 8
OFFENSIVE_BIT = 16

PROPER_NOUN_POS_CLASSES = {"person", "surname", "place", "name", "demonym", "trademark"}
# 'upper' marks a form ESDB considers valid only capitalized (acronyms like
# "ABC"/"AAA", or a capitalization-only shadow row paired with a person/
# surname/place row for the same word, e.g. Peter's "person" and "upper"
# rows are separate entries). Neither case is a normal lowercase common
# word, so 'upper' is excluded from "does a common reading exist?" evidence
# alongside the direct proper-noun classes -- discovered via the WL-103
# fixture cases below (peter/james/newton/rose/mark/will/frank/amber),
# which is what the exact set here is tuned against.
NON_COMMON_POS_CLASSES = PROPER_NOUN_POS_CLASSES | {"upper"}

WORD_PATTERN = re.compile(r"^[a-z]+$")


def ensure_esdb_source() -> Path:
    if not (CACHE_DIR / "Makefile").exists():
        print(f"Cloning ESDB {ESDB_TAG} into {CACHE_DIR} ...")
        CACHE_DIR.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(
            ["git", "clone", "--branch", ESDB_TAG, "--depth", "1", ESDB_REPO, str(CACHE_DIR)],
            check=True,
        )
    else:
        print(f"Reusing cached ESDB checkout at {CACHE_DIR}")
    return CACHE_DIR


def ensure_scowl_db(esdb_dir: Path) -> Path:
    db_path = esdb_dir / "scowl.db"
    if not db_path.exists():
        print("Building scowl.db (make) ...")
        subprocess.run(["make"], cwd=esdb_dir, check=True)
    else:
        print("Reusing existing scowl.db")
    return db_path


def deaccent_to_ascii_word(raw_word: str) -> str | None:
    """Strip diacritics (café -> cafe), lowercase, and reject anything that
    still isn't plain a-z letters (multi-word, hyphenated, punctuated)."""
    decomposed = unicodedata.normalize("NFKD", raw_word)
    stripped = "".join(ch for ch in decomposed if not unicodedata.combining(ch))
    lowered = stripped.lower()
    return lowered if WORD_PATTERN.match(lowered) else None


def fetch_rows(db_path: Path) -> list[sqlite3.Row]:
    con = sqlite3.connect(str(db_path))
    con.row_factory = sqlite3.Row
    spelling_ph = ",".join("?" for _ in ALLOWED_SPELLINGS)
    region_ph = ",".join("?" for _ in EXCLUDED_REGIONS)
    category_ph = ",".join("?" for _ in EXCLUDED_CATEGORIES)
    query = f"""
        select word, size, pos, base_pos, pos_class
        from scowl_v0
        where size <= ?
          and spelling in ({spelling_ph})
          and (region is null or region = '' or region not in ({region_ph}))
          and (category is null or category = '' or category not in ({category_ph}))
    """
    params = [SIZE_CAP, *ALLOWED_SPELLINGS, *EXCLUDED_REGIONS, *EXCLUDED_CATEGORIES]
    rows = con.execute(query, params).fetchall()
    con.close()
    return rows


def build_dictionary(rows: list[sqlite3.Row]) -> tuple[list[dict], int]:
    groups: dict[str, list[dict]] = {}
    dropped_non_letters = 0

    for row in rows:
        normalized = deaccent_to_ascii_word(row["word"])
        if normalized is None:
            dropped_non_letters += 1
            continue
        groups.setdefault(normalized, []).append(
            {
                "size": row["size"],
                "base_pos": row["base_pos"],
                "pos_class": row["pos_class"] or "",
            }
        )

    entries: list[dict] = []
    for normalized_word, group_rows in groups.items():
        common_rows = [r for r in group_rows if r["pos_class"] not in NON_COMMON_POS_CLASSES]
        is_proper_noun = len(common_rows) == 0
        representative_rows = common_rows if common_rows else group_rows
        best = min(representative_rows, key=lambda r: r["size"])
        size = best["size"]

        is_offensive = False  # WL-104, not yet built
        is_allowed = (not is_proper_noun) and (not is_offensive)
        is_common_word = size <= 50
        is_obscure = size >= 70
        is_computer_playable = is_allowed and not is_obscure
        frequency_score = round(1 - (size - 35) / (70 - 35), 3)

        entries.append(
            {
                "word": normalized_word,
                "normalizedWord": normalized_word,
                "baseWord": None,
                "partOfSpeech": best["base_pos"] or None,
                "isProperNoun": is_proper_noun,
                "isCommonWord": is_common_word,
                "isObscure": is_obscure,
                "isOffensive": is_offensive,
                "isAllowed": is_allowed,
                "isComputerPlayable": is_computer_playable,
                "frequencyScore": frequency_score,
                "sizeTier": size,
            }
        )

    entries.sort(key=lambda e: e["normalizedWord"])
    return entries, dropped_non_letters


def pack_entries(entries: list[dict]) -> str:
    """Packs the dictionary into the on-device representation (WL-105).

    One record per word, newline-separated, sorted ascending: the word
    followed by a single flag character encoding
    (tier index | proper-noun bit | offensive bit).

    Chosen over shipping the JSON (34MB, and 148k JS objects to materialize
    at startup) and over SQLite (which would add a native dependency for a
    read-only lookup this can already serve). Sorted + newline-delimited
    means the runtime can binary-search an offset index without ever
    creating a JS string per word -- see dictionaryService.ts.

    The flag character is always in 'A'..'^' (65-94), which sorts below every
    lowercase letter, so raw record order equals word order even where one
    word is a prefix of another ("cat" before "cats").
    """
    lines: list[str] = []
    for entry in entries:
        tier_index = SIZE_TIERS.index(entry["sizeTier"])
        code = tier_index
        if entry["isProperNoun"]:
            code |= PROPER_NOUN_BIT
        if entry["isOffensive"]:
            code |= OFFENSIVE_BIT
        lines.append(entry["normalizedWord"] + chr(FLAG_BASE + code))
    return "\n".join(lines)


def reply_counts_by_letter(entries: list[dict]) -> list[int]:
    """Counts allowed words per first letter, a-z (WL-106).

    This is the difficulty engine's `option_reduction_score` input: PRD
    section 10 defines it for both Medium and Hard as "the number of valid
    replies available to *the player*", so it counts the player-submittable
    set (`isAllowed`) rather than the narrower computer-playable tier the
    computer draws its own move from (PRD section 8.7).

    Precomputed here because doing it per turn is O(candidates x dictionary)
    and would stall the computer's turn; at runtime the only work left is
    subtracting the handful of words already used this round.
    """
    counts = [0] * 26
    for entry in entries:
        if entry["isAllowed"]:
            counts[ord(entry["normalizedWord"][0]) - ord("a")] += 1
    return counts


def print_stats(entries: list[dict], dropped_non_letters: int) -> None:
    total = len(entries)
    allowed = sum(1 for e in entries if e["isAllowed"])
    proper_noun = sum(1 for e in entries if e["isProperNoun"])
    computer_playable = sum(1 for e in entries if e["isComputerPlayable"])
    common = sum(1 for e in entries if e["isCommonWord"])
    obscure = sum(1 for e in entries if e["isObscure"])

    print()
    print(f"Total unique normalized words:  {total}")
    print(f"  allowed (playable):           {allowed}")
    print(f"  proper-noun-only (rejected):  {proper_noun}")
    print(f"  computer-playable:            {computer_playable}")
    print(f"  common (size <= 50):          {common}")
    print(f"  obscure (size == 70):         {obscure}")
    print(f"Dropped non-letter forms (post-deaccent): {dropped_non_letters}")

    print()
    print("Per first letter (allowed words):")
    per_letter: dict[str, int] = {}
    for e in entries:
        if e["isAllowed"] and e["normalizedWord"]:
            first = e["normalizedWord"][0]
            per_letter[first] = per_letter.get(first, 0) + 1
    for letter in sorted(per_letter):
        print(f"  {letter}: {per_letter[letter]}")


def main() -> None:
    esdb_dir = ensure_esdb_source()
    db_path = ensure_scowl_db(esdb_dir)
    rows = fetch_rows(db_path)
    entries, dropped_non_letters = build_dictionary(rows)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    dict_path = OUTPUT_DIR / "dictionary.json"
    with dict_path.open("w", encoding="utf-8") as f:
        json.dump(entries, f, separators=(",", ":"))

    manifest = {
        "sourceName": SOURCE_NAME,
        "sourceVersion": ESDB_TAG,
        "sizeCap": SIZE_CAP,
        "wordCount": len(entries),
        "generatedAt": datetime.now(timezone.utc).isoformat(),
    }
    manifest_path = OUTPUT_DIR / "manifest.json"
    with manifest_path.open("w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)
        f.write("\n")

    # The packed asset is what actually ships, so unlike the two files above
    # it is committed rather than gitignored: Metro needs it to bundle, which
    # means a fresh checkout (and CI's native build jobs) must have it without
    # running this script, which needs Python, SQLite and a network fetch.
    # Deliberately carries no generatedAt -- a timestamp would produce a diff
    # on every regeneration of otherwise identical data.
    packed = {
        "sourceName": SOURCE_NAME,
        "sourceVersion": ESDB_TAG,
        "wordCount": len(entries),
        "sizeTiers": SIZE_TIERS,
        "replyCounts": reply_counts_by_letter(entries),
        "records": pack_entries(entries),
    }
    packed_path = OUTPUT_DIR / "dictionary.pack.json"
    with packed_path.open("w", encoding="utf-8") as f:
        json.dump(packed, f, separators=(",", ":"))

    print_stats(entries, dropped_non_letters)
    size_mb = dict_path.stat().st_size / 1_000_000
    packed_mb = packed_path.stat().st_size / 1_000_000
    print()
    print(f"Wrote {dict_path} ({size_mb:.2f} MB, intermediate, gitignored)")
    print(f"Wrote {manifest_path}")
    print(f"Wrote {packed_path} ({packed_mb:.2f} MB, shipped asset, committed)")


if __name__ == "__main__":
    main()

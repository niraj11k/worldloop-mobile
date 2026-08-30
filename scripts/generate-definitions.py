#!/usr/bin/env python3
"""
WordLoop definition-gloss pipeline (Delivery Plan WL-501, closing D-08).

D-08 says: select no commercial enrichment provider for v1, and ship the
definition overlay reading from bundled short glosses "if the chosen word list
carries them". ESDB does not carry any -- it stores a commonness tier and two
flags per word, nothing else -- so the glosses come from **Princeton WordNet
3.1** instead.

Why WordNet rather than a provider or nothing at all:
  - It is already a dependency in spirit and in law. ESDB uses WordNet for its
    part-of-speech assignment, so WordNet's notice is ALREADY shipped in
    Settings -> Attributions (src/constants/attributions.ts, WL-407). Using it
    for definitions too adds no new attribution, only a wider `usage` line.
  - It is offline. PRD section 12 and Wireframe section 12 both require that a
    definition never blocks a round; an asset that is simply present cannot
    fail in the way a network call can.
  - It unblocks WL-504 (hint level 4 is a definition-based clue), which cannot
    be built at all against an empty source.

Coverage is deliberately partial: ~70% of the playable word list resolves to a
gloss. The remainder take Wireframe section 12's "Definition unavailable for
this word. You can continue playing." state, which that document already
specifies as a first-class outcome rather than an error -- so a miss is a
designed path, not a gap to apologise for.

## Output

`src/assets/dictionary/definitions.pack.json`, **committed** for the same
reason `dictionary.pack.json` is: Metro needs it to bundle, so a fresh
checkout and the WL-004 native CI build jobs must have it without running this
script (which needs Python and a network fetch).

It is aligned to `dictionary.pack.json` record order -- one 3-character gloss
id per dictionary record, in the same order -- rather than carrying its own
copy of the words. That saves ~0.9MB, and the coupling it creates is made loud
rather than silent: the pack stores the dictionary's word count plus a spread
of (position, word) probes, and the runtime refuses to serve any definition at
all unless every probe still resolves to the same word (degrading to
"unavailable", never crashing). Probes rather than a digest because the check
runs on the device: hashing 1.6MB of records at startup would cost more than
the feature it protects, while 16 slices cost nothing. Regenerate both
together; `npm run dictionary:generate` does.

Usage:
    python3 scripts/generate-definitions.py

Re-runnable: downloads and unpacks WordNet into .cache/wordnet/ once (~16MB,
gitignored) and reuses it after.
"""

from __future__ import annotations

import json
import tarfile
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
CACHE_DIR = REPO_ROOT / ".cache" / "wordnet"
ASSET_DIR = REPO_ROOT / "src" / "assets" / "dictionary"
DICTIONARY_PACK = ASSET_DIR / "dictionary.pack.json"
OUTPUT_PATH = ASSET_DIR / "definitions.pack.json"

WORDNET_URL = "https://wordnetcode.princeton.edu/wn3.1.dict.tar.gz"
WORDNET_VERSION = "3.1"
SOURCE_NAME = "Princeton WordNet"

# WL-105's flag encoding, mirrored so this script can read the shipped pack
# without importing the generator. Kept in step by
# __tests__/definitionService.test.ts, which asserts real bundled words.
FLAG_BASE = 65  # 'A'
PROPER_NOUN_BIT = 8
OFFENSIVE_BIT = 16

# WordNet's four open-class parts of speech, in the order used to break ties
# between equally-untagged senses. Adjective satellites ('s' in sense keys)
# are folded into 'a', which is how WordNet itself presents them.
POS_ORDER = ("n", "v", "a", "r")
POS_DATA_FILES = {"n": "noun", "v": "verb", "a": "adj", "r": "adv"}
SENSE_KEY_POS = {"1": "n", "2": "v", "3": "a", "4": "r", "5": "a"}

# Morphy's suffix detachment rules (WordNet 3.1 manual, morphy(7WN)). Applied
# only after the exception lists, and only when the result is a real lemma.
DETACHMENT_RULES = {
    "n": (("s", ""), ("ses", "s"), ("xes", "x"), ("zes", "z"), ("ches", "ch"),
          ("shes", "sh"), ("men", "man"), ("ies", "y")),
    "v": (("s", ""), ("ies", "y"), ("es", "e"), ("es", ""), ("ed", "e"),
          ("ed", ""), ("ing", "e"), ("ing", "")),
    "a": (("er", ""), ("est", ""), ("er", "e"), ("est", "e")),
    "r": (),
}
# A detached stem shorter than this is never trusted -- "as" -> "a", "ties" ->
# "t". WordNet's own morphy applies the same kind of floor.
MIN_STEM_LENGTH = 2

# Gloss ids are fixed-width base-90 so the id column can be sliced by offset
# with no delimiter scan. The alphabet is printable ASCII with `"` and `\`
# removed -- both would be backslash-escaped by JSON and silently cost a
# second byte each across ~148k ids.
ID_ALPHABET = "".join(
    c for c in (chr(i) for i in range(35, 127)) if c != "\\"
)[:90]
ID_BASE = len(ID_ALPHABET)
ID_WIDTH = 3
# 0 is reserved for "no gloss", so a stored id is (gloss index + 1).
MAX_GLOSSES = ID_BASE**ID_WIDTH - 1


def ensure_wordnet() -> Path:
    """Downloads and unpacks the WordNet database files, once."""
    dict_dir = CACHE_DIR / "dict"
    if dict_dir.is_dir() and (dict_dir / "data.noun").exists():
        return dict_dir

    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    archive = CACHE_DIR / "wn3.1.dict.tar.gz"
    if not archive.exists():
        print(f"Downloading WordNet {WORDNET_VERSION} from {WORDNET_URL} ...")
        urllib.request.urlretrieve(WORDNET_URL, archive)

    print(f"Unpacking into {CACHE_DIR} ...")
    with tarfile.open(archive) as tar:
        # The archive contains a single `dict/` directory; refuse anything
        # that would escape the cache directory.
        for member in tar.getmembers():
            if member.name.startswith("/") or ".." in Path(member.name).parts:
                raise RuntimeError(f"Unsafe path in WordNet archive: {member.name}")
        tar.extractall(CACHE_DIR)

    if not (dict_dir / "data.noun").exists():
        raise RuntimeError(f"WordNet unpacked but {dict_dir}/data.noun is missing")
    return dict_dir


def read_glosses(dict_dir: Path, pos: str) -> dict[str, str]:
    """synset offset -> definition text, examples stripped.

    A WordNet data line ends `| definition; "an example"; "another"`. Only the
    definition is kept: an example sentence usually contains the word itself,
    which WL-504's hint level 4 must never reveal, and Wireframe section 12's
    overlay has room for a definition, not a corpus.
    """
    glosses: dict[str, str] = {}
    with (dict_dir / f"data.{POS_DATA_FILES[pos]}").open(encoding="latin-1") as f:
        for line in f:
            if line.startswith("  "):  # licence header
                continue
            head, _, raw = line.partition("|")
            segments = [s.strip() for s in raw.strip().split(";")]
            definition = []
            for segment in segments:
                if segment.startswith('"'):
                    break
                definition.append(segment)
            text = "; ".join(p for p in definition if p) or raw.strip()
            if text:
                glosses[head.split(" ", 1)[0]] = text
    return glosses


def read_index(dict_dir: Path, pos: str) -> dict[str, list[str]]:
    """lemma -> synset offsets, in WordNet's own sense order."""
    index: dict[str, list[str]] = {}
    with (dict_dir / f"index.{POS_DATA_FILES[pos]}").open(encoding="latin-1") as f:
        for line in f:
            if line.startswith("  "):
                continue
            fields = line.split()
            pointer_count = int(fields[3])
            at = 4 + pointer_count
            sense_count = int(fields[at])
            index[fields[0]] = fields[at + 2: at + 2 + sense_count]
    return index


def read_exceptions(dict_dir: Path, pos: str) -> dict[str, list[str]]:
    """Irregular inflections: `mice mouse`, `went go`, `best good`."""
    exceptions: dict[str, list[str]] = {}
    path = dict_dir / f"{POS_DATA_FILES[pos]}.exc"
    if not path.exists():
        return exceptions
    with path.open(encoding="latin-1") as f:
        for line in f:
            parts = line.split()
            if len(parts) >= 2:
                exceptions[parts[0]] = parts[1:]
    return exceptions


def read_tag_counts(dict_dir: Path) -> dict[tuple[str, str, int], int]:
    """(lemma, pos, sense number) -> semantic-concordance tag count.

    This is how a sense gets chosen. WordNet orders senses by frequency only
    where they were tagged, so "most tagged" is the closest thing it offers to
    "the meaning a player would expect".
    """
    counts: dict[tuple[str, str, int], int] = {}
    with (dict_dir / "cntlist.rev").open(encoding="latin-1") as f:
        for line in f:
            parts = line.split()
            if len(parts) < 3:
                continue
            sense_key, sense_number, tag_count = parts[0], parts[1], parts[2]
            lemma, _, rest = sense_key.partition("%")
            pos = SENSE_KEY_POS.get(rest.split(":", 1)[0])
            if pos:
                counts[(lemma, pos, int(sense_number))] = int(tag_count)
    return counts


class WordNet:
    def __init__(self, dict_dir: Path) -> None:
        self.glosses = {pos: read_glosses(dict_dir, pos) for pos in POS_ORDER}
        self.index = {pos: read_index(dict_dir, pos) for pos in POS_ORDER}
        self.exceptions = {pos: read_exceptions(dict_dir, pos) for pos in POS_ORDER}
        self.tag_counts = read_tag_counts(dict_dir)

    def lemmas(self, word: str, pos: str) -> list[str]:
        """Morphy: the lemmas `word` could be an inflected form of, best first.

        Without this, coverage is 39% -- `dragons`, `envied`, `mice` and every
        other inflected form in a real chain would miss, which is most of what
        a player actually plays.
        """
        found: list[str] = []
        if word in self.index[pos]:
            found.append(word)
        for base in self.exceptions[pos].get(word, ()):
            if base in self.index[pos] and base not in found:
                found.append(base)
        for suffix, replacement in DETACHMENT_RULES[pos]:
            if not word.endswith(suffix):
                continue
            stem = word[: len(word) - len(suffix)]
            if len(stem) < MIN_STEM_LENGTH:
                continue
            candidate = stem + replacement
            if candidate in self.index[pos] and candidate not in found:
                found.append(candidate)
        return found

    def best_sense(self, word: str) -> tuple[str, str] | None:
        """(pos, synset offset) for the sense most likely to be the expected one.

        Ranked by, in order:

        1. **An exact lemma over a morphed one.** This dominates deliberately.
           Tag counts describe a *lemma*, so comparing them across lemmas asks
           the wrong question: `rose` is tagged 5 times as the flower while
           `rise` — which `rose` also morphs to — is tagged 26 times as "move
           upward", and ranking on the count alone defines ROSE as a form of
           rise. The player is looking at the word in front of them, so the
           word in front of them wins whenever WordNet knows it at all.
        2. **Tag count**, within that. This is the only usage-frequency signal
           WordNet ships (from the semantic concordances), and it is what
           separates BANK-the-riverbank from BANK-the-aeroplane-manoeuvre.
        3. **Lower sense number**, then the POS_ORDER loop. Noun-first matters
           here: for an untagged word that is both a noun and a verb, the noun
           reads as the more concrete gloss.

        **What rule 1 costs, measured.** It changes 2,985 of the 98,963 covered
        words. Most are a participle resolving to its own adjective sense
        rather than its verb ("shredded" -> "prepared by cutting"), which is
        fine either way. The genuine losses are surface forms whose morphed
        reading is the commoner English: FOUND now gets "set up or found"
        rather than the past tense of "find". That is accepted rather than
        tuned away, because the alternative ranking got ROSE — the word PRD
        §8.5 uses as its own worked example — wrong in a much more visible
        way, and no threshold that splits the two cases follows from anything
        in WordNet's data. Both readings are real definitions of a real word;
        only the ordering is arguable.

        **Known limitation.** For a word whose senses are all untagged, rules 2
        and 3 give nothing but WordNet's own index order, which for untagged
        senses is effectively arbitrary — `replicate` comes out as "bend or
        turn backward" rather than "make an exact copy of". Fixing that needs
        a frequency source WordNet does not carry, so it is recorded rather
        than papered over; the definition is never *wrong*, only not the
        reading a player expected first.
        """
        best: tuple[tuple[int, int, int], str, str] | None = None
        for pos in POS_ORDER:
            for lemma in self.lemmas(word, pos):
                for sense_number, offset in enumerate(self.index[pos][lemma], start=1):
                    rank = (
                        1 if lemma == word else 0,
                        self.tag_counts.get((lemma, pos, sense_number), 0),
                        -sense_number,
                    )
                    if best is None or rank > best[0]:
                        best = (rank, pos, offset)
        if best is None:
            return None
        return best[1], best[2]


def read_dictionary_pack() -> tuple[list[tuple[str, bool]], dict]:
    """The shipped word list as (word, is playable) in record order."""
    if not DICTIONARY_PACK.exists():
        raise SystemExit(
            f"{DICTIONARY_PACK} is missing -- run `npm run dictionary:generate` first."
        )
    pack = json.loads(DICTIONARY_PACK.read_text(encoding="utf-8"))
    words: list[tuple[str, bool]] = []
    for record in pack["records"].split("\n"):
        if not record:
            continue
        flags = ord(record[-1]) - FLAG_BASE
        blocked = bool(flags & PROPER_NOUN_BIT) or bool(flags & OFFENSIVE_BIT)
        words.append((record[:-1], not blocked))
    if len(words) != pack["wordCount"]:
        raise SystemExit(
            f"dictionary.pack.json is inconsistent: wordCount {pack['wordCount']} "
            f"but {len(words)} records"
        )
    return words, pack


def encode_id(value: int) -> str:
    """Fixed-width base-90, most significant character first."""
    chars = []
    for _ in range(ID_WIDTH):
        value, remainder = divmod(value, ID_BASE)
        chars.append(ID_ALPHABET[remainder])
    return "".join(reversed(chars))


def build(words: list[tuple[str, bool]], wordnet: WordNet) -> tuple[list[str], list[str], str, dict]:
    """Returns (gloss texts, pos chars, id column, stats).

    Glosses are deduplicated by synset: 98,963 covered words share only 43,667
    distinct senses, because every inflected form resolves to its lemma's
    sense. Storing the text once and an id per word is what keeps the asset
    around 3MB instead of 6.5MB.
    """
    gloss_ids: dict[tuple[str, str], int] = {}
    texts: list[str] = []
    pos_chars: list[str] = []
    column: list[str] = []
    covered = 0

    for word, playable in words:
        # Proper nouns and excluded words can never be submitted or played by
        # the computer (PRD section 8.5/8.7), so nothing can ever open a
        # definition for one. They keep a slot in the column -- alignment is
        # the whole point -- but cost no gloss.
        sense = wordnet.best_sense(word) if playable else None
        if sense is None:
            column.append(encode_id(0))
            continue
        text = wordnet.glosses[sense[0]].get(sense[1])
        if not text:
            column.append(encode_id(0))
            continue

        gloss_id = gloss_ids.get(sense)
        if gloss_id is None:
            if len(texts) >= MAX_GLOSSES:
                raise SystemExit(
                    f"More than {MAX_GLOSSES} distinct glosses -- ID_WIDTH must grow."
                )
            texts.append(text)
            pos_chars.append(sense[0])
            gloss_id = len(texts)  # 1-based; 0 means "no gloss"
            gloss_ids[sense] = gloss_id
        column.append(encode_id(gloss_id))
        covered += 1

    if any("\n" in text for text in texts):
        raise SystemExit("A WordNet gloss contains a newline, which the pack format uses.")

    playable_total = sum(1 for _, playable in words if playable)
    stats = {
        "records": len(words),
        "playable": playable_total,
        "covered": covered,
        "distinctGlosses": len(texts),
    }
    return texts, pos_chars, "".join(column), stats


PROBE_COUNT = 16


def alignment_probes(words: list[tuple[str, bool]]) -> list[list]:
    """[position, word] pairs spread evenly across the record order.

    The runtime's guard against a `dictionary.pack.json` that was regenerated
    without this file. A word-count match alone would miss the dangerous case
    -- a list of the same length with words added and removed, which shifts
    every gloss after the first change onto the wrong word. Evenly spread so
    a change anywhere in the alphabet is caught, and cheap enough (16 string
    slices) to run unconditionally at startup.
    """
    if not words:
        return []
    step = max(1, len(words) // PROBE_COUNT)
    positions = list(range(0, len(words), step))[:PROBE_COUNT]
    if positions[-1] != len(words) - 1:
        positions[-1] = len(words) - 1  # always pin the final record
    return [[at, words[at][0]] for at in positions]


def main() -> None:
    dict_dir = ensure_wordnet()
    print("Reading WordNet ...")
    wordnet = WordNet(dict_dir)
    words, dictionary_pack = read_dictionary_pack()

    print(f"Resolving glosses for {len(words)} dictionary records ...")
    texts, pos_chars, column, stats = build(words, wordnet)

    packed = {
        "schemaVersion": 1,
        "sourceName": SOURCE_NAME,
        "sourceVersion": WORDNET_VERSION,
        # The alignment contract with dictionary.pack.json. The runtime checks
        # both and serves no definitions at all if either fails, so a
        # regenerated word list can never quietly shift every gloss by one.
        "dictionaryWordCount": dictionary_pack["wordCount"],
        "dictionaryProbes": alignment_probes(words),
        "glossCount": len(texts),
        "partsOfSpeech": "".join(pos_chars),
        "glosses": "\n".join(texts),
        "ids": column,
    }
    ASSET_DIR.mkdir(parents=True, exist_ok=True)
    with OUTPUT_PATH.open("w", encoding="utf-8") as f:
        json.dump(packed, f, separators=(",", ":"))

    size_mb = OUTPUT_PATH.stat().st_size / 1_000_000
    coverage = 100 * stats["covered"] / stats["playable"] if stats["playable"] else 0
    print()
    print(f"Dictionary records:      {stats['records']}")
    print(f"  playable:              {stats['playable']}")
    print(f"  with a definition:     {stats['covered']} ({coverage:.1f}%)")
    print(f"  distinct glosses:      {stats['distinctGlosses']}")
    print()
    print(f"Wrote {OUTPUT_PATH} ({size_mb:.2f} MB, shipped asset, committed)")


if __name__ == "__main__":
    main()

# Dictionary bundle (generated, not committed)

`dictionary.json` and `manifest.json` in this directory are build output from
`scripts/generate-dictionary.py` (Delivery Plan WL-102) — gitignored because
they're fully reproducible from that script, not hand-authored.

Generate them with:

```bash
npm run dictionary:generate
```

Requires Python 3.7+, SQLite 3.33+, and `git` (used to fetch ESDB itself).
First run clones and builds ESDB into `.cache/esdb/` (~150MB, also
gitignored); subsequent runs reuse that cache.

The output (~34MB as plain JSON) is well over WL-105's ≤8MB bundle-size
budget — that's expected. WL-105 is a separate, later task that decides the
final packed on-device representation (indexed binary or SQLite); this
script's output is the interim/source-of-truth bundle that WL-105 repacks,
not the shipped format.

See the script's own docstring for exactly which filtering decisions come
from `proj-docs/WordLoop_Word_List_Licence_Review.md` versus which are
game-design judgment calls made in the pipeline itself.

# Dictionary assets

Three files, produced by `scripts/generate-dictionary.py`
(Delivery Plan WL-102 / WL-105):

| File | Size | Committed? | Purpose |
|---|---|---|---|
| `dictionary.pack.json` | ~1.7MB | **Yes** | The asset the app imports. Metro needs it to bundle, so it must exist on a fresh checkout and in CI without running the generator. |
| `dictionary.json` | ~36MB | No | Human-readable intermediate. Read by `npm run dictionary:verify`. |
| `manifest.json` | tiny | No | Provenance + `generatedAt` for local inspection. |

Regenerate with:

```bash
npm run dictionary:generate
```

Requires Python 3.7+, SQLite 3.33+, and `git`. The first run clones and
builds ESDB into `.cache/esdb/` (~150MB, gitignored); later runs reuse it.
Output is deterministic for a given ESDB tag — `dictionary.pack.json`
carries no timestamp, so regenerating unchanged data produces no diff.

## Packed record format (WL-105)

`records` is one sorted, newline-separated string. Each record is the
normalized word followed by a single flag character:

```text
flag = 'A' + (tier index | proper-noun << 3 | offensive << 4)
```

`tier index` indexes `sizeTiers`. Everything else the app exposes
(`isCommonWord`, `isObscure`, `isAllowed`, `isComputerPlayable`,
`frequencyScore`) is derived from those three facts — the generated data has
exactly 12 distinct flag combinations, which is what makes this lossless.

The flag character always lands in `'A'`–`'^'` (65–94), below every lowercase
letter, so record order equals word order even when one word is a prefix of
another (`cat` sorts before `cats`).

The decoder lives in `src/features/dictionary/dictionaryService.ts` and is a
second, independent implementation of this format;
`__tests__/dictionaryService.test.ts` pins it against real bundled words so
the two cannot drift silently.

# WordLoop Mobile (React Native)

Scaffold only. No gameplay is fully wired up yet. This README explains the
structure and what's real vs. stubbed, so anyone picking this up (including
future-you) doesn't mistake a skeleton for a finished feature.

Dependency versions have been installed and verified against the npm
registry, and aligned with the official React Native 0.86.2 template
(React 19.2.3). `npm install`, `npm test`, and `npm run lint` all run
clean; see "Dependency audit state" below for the standing `npm audit`
output and why it is expected.

`ios/` and `android/` native project folders **are present and committed**
(`WL-001`). Bundle identifier / package name is **provisional**:
`com.wordloop.mobile`, pending D-10 (product name clearance) — expect this
to change before store submission. Verified: `npm run ios` and
`npm run android` both build and launch the Welcome screen, on iOS
Simulator and an Android emulator respectively.

## Setup

```bash
npm install
npx pod-install ios   # macOS only — regenerates ios/Pods (gitignored)

npm run ios      # or
npm run android
```

Android also needs `android/local.properties` with `sdk.dir=<path to your
Android SDK>` — gitignored, machine-specific, not committed.

## Device and OS support matrix (WL-005)

Per Wireframe doc §19 (small phones, large phones, tablets, landscape). Minimum OS
versions are the RN 0.86.2 template's own floor (`IPHONEOS_DEPLOYMENT_TARGET` /
`minSdkVersion` in the generated project) — going lower isn't a supported
configuration for this RN version, so there's no reason to target below it.

| Platform | Minimum OS | Target/compile OS | Representative test devices |
|---|---|---|---|
| iOS | iOS 15.1 | iOS 26 (current) | iPhone SE (3rd gen) — small phone; iPhone 17 — baseline; iPhone 17 Pro Max — large phone |
| Android | Android 7.0 (API 24) | API 36 (current) | A ~5.4" small-screen device (e.g. Pixel 4a class); a mid-size device (`Medium_Phone_API_36.1` covers this in the emulator); a large/tablet-class device |

Tablets and landscape are acknowledged in Wireframe §19 but not treated as a
first-class layout target for v1 — the design is portrait-phone-first. Revisit
once WL-409 (responsive/orientation pass, Phase 4) runs.

Physical-device coverage (as opposed to simulator/emulator) is a manual QA
step — see WL-310 (M1 device pass) and WL-805 (pre-submission QA) — not a CI
axis, since CI runners don't have physical hardware.

## Folder structure

```text
src/
  app/            Root App component. Providers + navigation only.
  navigation/      Route params (types.ts) and the stack navigator.
  screens/         One folder per screen, matches Wireframe doc naming.
  components/
    common/        Shared, feature-agnostic UI (buttons, inputs — not yet populated)
    game/           Game-specific overlays (HintSheet, etc.)
    account/        Account-flow specific UI (not yet populated)
  features/        Domain logic, framework-agnostic where possible:
    game/           Rule engine (local validation mirror)
    dictionary/      Word lookup + definition enrichment
    difficulty/       Computer move candidate scoring
    scoring/          Player score formula
    account/          Guest-to-account prompt policy
    analytics/        (not yet populated)
  services/
    api/            Backend HTTP client
    storage/         Local persistence adapter
    sync/            Offline/online reconciliation (not yet populated — open item)
  store/            Global app state (zustand)
  types/            Shared TypeScript domain types
  constants/        Copy strings, thresholds
  theme/            Design tokens (grayscale placeholder, per Wireframe doc section 3)
```

This is a **feature-based** structure layered on top of a conventional RN
`screens/navigation` split: screens stay thin (composition + user
interaction), `features/` holds testable logic, `services/` holds I/O
boundaries. This keeps the rule engine, scoring, and difficulty logic
unit-testable without a rendered component tree, which matters given how
central those algorithms are to the product (PRD sections 8-10).

## What's real vs. stubbed

**Implemented (matches agreed specs, has tests where noted):**

- `features/game/ruleEngine.ts` — letter chaining, normalization, min
  length, duplicate detection, unsupported-symbol rejection. Has unit
  tests in `__tests__/ruleEngine.test.ts`.
- `features/scoring/scoringEngine.ts` — the agreed scoring formula
  (Architecture doc section 7).
- `features/difficulty/difficultyEngine.ts` — the agreed candidate scoring
  weights per difficulty (Architecture doc section 6). Ranking works;
  random/weighted selection among top candidates does not yet.
- `features/account/promptPolicy.ts` — the soft-prompt cooldown/cycle
  logic (Architecture doc section 8.3).
- Navigation structure and every screen from the Wireframe doc's MVP list
  (section 22), as visual/interaction skeletons.

**Explicitly stubbed / not implemented:**

- Dictionary word-list lookup (`dictionaryService.lookupWord`) — returns
  not-found until the SCOWL-based dataset is bundled (open item).
- Definition enrichment API — no provider selected yet, returns null.
- All server communication (`services/api/client.ts`) — throws if called,
  since no backend URL/environment exists yet.
- Local persistence (`services/storage/storage.ts`) — no-op stub. Library
  decision closed (MMKV — see Delivery Plan D-07); the real implementation
  is Phase 0 (`WL-002`), gated on native projects existing so it can be
  verified on-device rather than just written and hoped for.
- Offline/online reconciliation (`services/sync/`) — empty, this is an
  open item in the Architecture doc, not a decision yet.
- Proper-noun / offensive-word classification in the rule engine — depends
  on the dictionary service above.
- Auth (Apple / Google / email) in `AccountCreationScreen` — button
  handlers are TODO placeholders.
- Word Definition overlay and Pause screen components — referenced in the
  Wireframe doc but not yet built (only HintSheet exists as an example).

## Testing

```bash
npm test          # Jest, path aliases resolved via jest.moduleNameMapper in package.json
npm run typecheck # tsc --noEmit
npm run lint      # ESLint 9 flat config (eslint.config.js), @react-native/eslint-config/flat
npm run audit:ci  # dependency audit gate (see below)
```

All four run in CI on push and PR to `main`/`dev`, plus weekly — see
`.github/workflows/ci.yml`.

`ruleEngine.ts`, `scoringEngine.ts`, `difficultyEngine.ts`, and `promptPolicy.ts`
all have unit tests. `dictionaryEngine`-dependent behavior (proper-noun and
offensive-word rejection in `ruleEngine.ts`, candidate generation in
`difficultyEngine.ts`) is still untested, since it's blocked on the
dictionary itself — see the Delivery Plan, Phase 1.

## Dependency audit state

`npm audit` reports 8 high-severity advisories. Every one of them is the
same root cause — `image-size`, reached only through `metro`, the bundler.
It does not ship in the app binary. A freshly generated RN 0.86.2 app
reports the same.

| Root | Severity | Path | Status |
| --- | --- | --- | --- |
| `image-size@1.2.1` | 8 × high | `metro` (bundler) | No fix exists |

**`image-size`** (GHSA-w3rx-r6r6-pgpr, GHSA-5p2g-fcmc-qvqq) — DoS via
infinite loops on malformed ICNS/JXL/HEIF files. The advisory covers
`<= 2.0.2`, which is every published version: **there is no patched
release to upgrade to**, so no override or version bump can clear it.
Metro (0.84 through 0.87) depends on `image-size@^1.0.2` and calls it at
bundle time to read the dimensions of assets in `src/assets/`.

It cannot be swapped for another package. It is required from exactly one
module in the whole tree — `metro/src/Assets.js` — as a synchronous
CommonJS default export taking a `Buffer` and returning `{width, height}`.
Nothing matches that shape: `image-dimensions` is ESM-only (Metro's
`require()` would throw), `probe-image-size` is async/stream-oriented, and
`buffer-image-size` is an unmaintained fork of the same code. Aliasing the
name via `overrides` to any of them breaks asset sizing, and a silently
wrong size ships images at the wrong dimensions — a worse production
outcome than a build-time hang.

**It is mitigated instead, in `metro.config.js`.** Metro passes a Buffer,
so `image-size` selects a parser from magic bytes and ignores the
extension — a hostile ICNS payload named `logo.png` reaches the ICNS
parser and hangs the bundler (verified: it loops indefinitely). But Metro
only requests dimensions for types on its own allowlist (png, jpg, jpeg,
bmp, gif, webp, psd, svg, tiff, ktx), and none of the three vulnerable
formats are on it. `metro.config.js` therefore calls `disableTypes()` on
Metro's own `image-size` instance at startup, which costs nothing and
makes the same payload fail instantly with "disabled file type" while
legitimate images resolve normally.

`npm audit` still reports these 8, because it matches installed versions
and cannot see reachability. The vulnerable code is present but no longer
reachable through Metro. Drop the mitigation once a patched `image-size`
ships and Metro depends on it.

### The audit gate

Because `npm audit` exits non-zero while any advisory is open, it is useless
as a CI gate on a project carrying one it cannot fix. `npm run audit:ci`
(`scripts/audit-gate.mjs`, no dependencies) replaces it: it collapses the
report to distinct upstream advisories — npm lists one entry per affected
package, which is why two `image-size` flaws show up as 8 — and checks each
against `audit-allowlist.json`.

It fails on:

| Condition | Why |
| --- | --- |
| Advisory not on the allowlist | New, unreviewed risk |
| Allowlisted entry past its `reviewBy` | Accepted risk must be re-argued, not inherited |
| Allowlisted advisory no longer reported | Exception is stale — delete it |
| Severity or package changed | The thing that was reviewed is not the thing now present |

The stale and expiry checks are the point: a permanent exception is how a
vulnerability gets forgotten. Every entry carries a reason, the mitigation
that makes it acceptable, and a review date.

Prefer this over `npm audit --omit=dev` or a blanket `--audit-level`, both
of which hide future advisories as well as today's.

### Do not run `npm audit fix --force`

It "resolves" the remaining advisories by *downgrading* to
`react-native@0.72.17` — a mid-2023, end-of-life release that receives no
security patches — while leaving React 19 and the `@react-native/*` 0.86.2
build tooling in place. The result is a tree npm itself marks invalid
(`react@19.2.3 invalid: "18.2.0" from node_modules/react-native`) and that
fails at bundle time. Unit tests still pass under it, because the only
suite is pure `ruleEngine` logic with no React rendering, so the breakage
is easy to miss. Pin deliberately instead.

### Previously flagged, now resolved

`fast-xml-parser` (GHSA-gh4j-gqv2-49f6) accounted for 7 moderate
advisories via `@react-native-community/cli-*`, which pinned `^4.4.1`.
Upstream migrated to `fast-xml-parser@^5.3.6` in CLI **20.2.0**, so the
three `@react-native-community/cli*` packages are pinned to `^20.2.0` here
and the tree now resolves 5.10.1. React Native 0.86.2 does not itself pin
the CLI, so this is safe to set independently.

### Remaining deprecation warnings

`npm install` prints two: `glob@7` and its `inflight` dependency. Both come
from Jest 29 (`jest-config`, `jest-runtime`, `@jest/reporters`,
`test-exclude`). RN 0.86's `@react-native/jest-preset` is built against the
Jest 29 line, so these clear when React Native moves to Jest 30. They are
deprecation notices, not advisories.

### `overrides`

`package.json` pins `eslint-plugin-ft-flow` to `^3.0.11`. The version
bundled with `@react-native/eslint-config@0.86.2` (2.0.3) calls
`context.getAllComments()`, removed in ESLint 9, which crashes the linter.
3.0.11 declares `eslint ^8.56.0 || ^9.0.0`. Remove this override if the RN
config ever bundles an ESLint 9-compatible ft-flow itself.

## Do not assume this compiles or runs yet

This has been authored file-by-file in a sandboxed environment without
network access, so it has **not** been installed, compiled, or run against
an actual Metro bundler or simulator. Treat it as a structural starting
point that encodes the decisions from the Architecture and Data Model
docs, not as a verified working build. Run `yarn install` and a typecheck
locally before trusting it further.

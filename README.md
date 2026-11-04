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

**Orientation (decided in WL-409, 2026-08-30): phones are portrait-only;
tablets are not restricted.**

Wireframe §19 makes portrait the primary target and sets a hard rule for the
game screen — "the input and Submit button should not be hidden below the
keyboard". On a phone in landscape they already are: the required-letter
callout fills the short axis by itself, the input lands on the bottom edge
before the keyboard opens, and Submit and Hint sit below the fold. Redrawing
the core screen for a viewport it was never designed for is not v1 work, so
the orientation is locked rather than half-supported.

- **iOS** — already portrait-only on iPhone and all four orientations on iPad
  (`Info.plist`: `UISupportedInterfaceOrientations` /
  `UISupportedInterfaceOrientations~ipad`). Unchanged.
- **Android** — was unrestricted on every device, which meant Android phones
  could rotate into a layout iPhones were never allowed to reach. Now
  `android:screenOrientation="@integer/screen_orientation"`, which resolves to
  `portrait` by default and `fullSensor` under `values-sw600dp` (Android's own
  tablet threshold).

Content is laid out in a column capped at `CONTENT_MAX_WIDTH` (560pt) and
centred, so tablets get a readable measure instead of a stretched phone
layout. No phone is affected: the widest device in the matrix is 440pt.

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
    common/        Shared UI: Button, Card, Input, Badge, BottomSheet (WL-204)
      icons/       The custom icon set — no stock icon library (WL-207)
      motion/      Reduced-motion-aware animation primitives (WL-205)
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
  hooks/            Cross-cutting hooks (useReducedMotion)
  theme/            Design tokens: palette, typography, motion, composed in theme.ts
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
npm run contrast:verify           # WCAG AA palette gate (WL-202); regenerates the matrix
npm run contrast:verify -- --check  # same, read-only — also fails if the matrix is stale
npm run fonts:verify              # bundled font integrity gate (WL-201)
```

All six run in CI on push and PR to `main`/`dev`, plus weekly — see
`.github/workflows/ci.yml`.

`contrast:verify` recomputes every text-on-fill and non-text (border, focus
ring, state indicator) pairing the design system specifies, from the hexes in
`src/theme/palette.ts`, and rewrites `proj-docs/WordLoop_Contrast_Matrix.md`.
It also *derives* the legal-text-colour-per-fill table and fails if `TEXT_ON`
in `palette.ts` disagrees with the measurements — so the rule component code
reads cannot drift from the colours it was derived from. CI runs the `--check`
form, which additionally fails when the committed matrix is stale, so a
palette change can't land without its verified matrix.

## Design tokens (WL-203)

`src/theme/theme.ts` is the only place a screen or component styles from. It
composes `palette.ts` (colour, WL-202) and `typography.ts` (type, WL-201) and
adds spacing, radii, border weights, shadows, and rotation.

**No screen or component may contain a raw hex, colour keyword, font size, font
family, or shadow value.** That is enforced by `no-restricted-syntax` selectors
in `eslint.config.js`, scoped to `src/screens/**` and `src/components/**`. If a
value is missing, add it to the theme — do not inline it at the call site.

Two things worth knowing before styling anything:

- **Shadows must use `boxShadow: shadow.*`, never `elevation` or `shadowOffset`.**
  Design System §4 requires a hard offset shadow with no blur. The legacy props
  cannot express that on Android — `elevation` draws a blurred Material shadow
  with uncontrollable offset — so `boxShadow` with `blurRadius: 0` is the only
  route. **This means the design depends on New Architecture being enabled**;
  disabling it would silently drop every shadow rather than failing loudly.
- **Disabled controls use `disabledFill.*`, never `opacity` on the container.**
  A container opacity fades the `ink` border §4 requires them to keep, and the
  label along with it, landing far below the contrast WL-202 verified.

The gallery's Tokens tab renders every token on-device, including each hard
shadow beside a deliberately blurred control, so a regression to blurred
shadows is visible rather than merely plausible.

## Shared components (WL-204)

`src/components/common/` — `Button`, `Card`, `Input`, `Badge`, `BottomSheet`.
Build screens from these rather than restyling views; `HintSheet` is the
worked example.

**Pass a `fill`, never a text colour.** Components derive their label colour
through `textOn()`, which reads the verified contrast matrix, so a failing
pairing cannot be expressed through the API. The one rule worth carrying in
your head: *`grape` is the only fill dark enough for `paper` text; every other
accent takes `ink`.*

Borders are not configurable — WL-202 found the `ink` outline is load-bearing
for WCAG 1.4.11, not decoration. Neither is shadow blur.

Every component in every state is in the component gallery — see below.

## Motion (WL-205)

`src/components/common/motion/` — `ScalePunch`, `ColorFlash`, `Shake`,
`SpringIn`, `ThinkingDots`. Built on RN's own `Animated`; timings live in
`src/theme/motion.ts`.

Every one has a reduced-motion fallback driven by `useReducedMotion()`, which
subscribes to the OS setting rather than reading it once — toggling **iOS
Accessibility → Motion → Reduce Motion** or **Android Accessibility → Remove
animations** takes effect immediately, without a relaunch. The gallery shows
the live state in a banner pinned above every tab.

Two fallbacks are not simply "off", and both are deliberate:

- **`ColorFlash` still flashes** — the colour is the signal, not decoration, so
  suppressing it would remove information. Only the eased transition is
  dropped.
- **`Shake` does nothing at all** — §5 says the shake must never be the only
  signal, and `Input` already carries four permanent ones (border, marker,
  message, live-region announcement). Do not wrap something whose error signal
  isn't independently carried.

Timings other than the ones §5 states outright are **untuned** (Design System
§9 open item 4) and intentionally not pinned by tests, so a real tuning pass
doesn't read as a regression.

## Fonts (WL-201)

Four static cuts in `src/assets/fonts/` (1.21MB total), referenced through
`src/theme/typography.ts`:

| Role | Face | Source, pinned |
| --- | --- | --- |
| Display 800 — wordmark, required letter | `Baloo2-ExtraBold` | `yanone/Baloo2-Variable` @ `da523dfa` |
| Display 700 — titles, chain words | `Baloo2-Bold` | same |
| Mono 400 — body, captions | `JetBrainsMono-Regular` | `JetBrains/JetBrainsMono` `v2.304` |
| Mono 700 — button labels | `JetBrainsMono-Bold` | same |

Both are SIL OFL and neither declares a Reserved Font Name; the full licence
texts are committed at `licenses/fonts/` and must also be surfaced in the app's
Attributions screen (WL-407), alongside the ESDB, WordNet, and LDNOOBW notices.

Three things to know before touching this:

- **Reference a face by `fontFamily` and never also set `fontWeight`.** Each
  weight is its own file; adding `fontWeight` makes Android synthesise a second
  layer of boldness and makes iOS resolve to a different family member.
- **Each filename matches its font's internal PostScript name on purpose** —
  iOS resolves by PostScript name, Android by asset filename, so identical
  names are what let one string work on both.
- **Static cuts, not the variable fonts.** RN cannot select a point on a
  variable weight axis, so a variable font would render every role at 400.

Because RN font resolution fails *silently* — the system face renders, with no
error — `npm run fonts:verify` checks the chain end to end: declared family →
file present → PostScript name parsed from inside the TTF → Android assets →
iOS `UIAppFonts` → Xcode Resources phase → no dangling `pbxproj` UUIDs. A
gallery's Type tab (dev builds only) renders every role
on-device and self-tests for fallback by measuring probe strings against the
platform default.

```bash
npm run simulate -- --difficulty easy|medium|hard|all [--rounds N] [--seed N]
```

Headless round simulator (WL-113) — plays complete rounds with no UI against
the real engines and dictionary, and reports win rate, mean chain length,
mean score, and dead-letter (draw) frequency. Not part of CI: a real tuning
pass (`--rounds 500`, matching the Delivery Plan's own example) takes several
minutes, longest on Easy. See `src/features/game/roundSimulator.ts` for what
each figure means and two findings building it turned up — natural rounds
run to hundreds or thousands of turns rather than the "tens of words" the
product docs assume, and Hard currently reads well outside PRD section 9.4's
20-40% player-win-rate target.

`ruleEngine.ts`, `scoringEngine.ts`, `difficultyEngine.ts`, and `promptPolicy.ts`
all have unit tests. `dictionaryEngine`-dependent behavior (proper-noun and
offensive-word rejection in `ruleEngine.ts`, candidate generation in
`difficultyEngine.ts`) is still untested, since it's blocked on the
dictionary itself — see the Delivery Plan, Phase 1.

## Dependency audit state

Last reviewed **2026-11-05**. `npm audit` reports 9 entries, which collapse
to **1 distinct advisory in 1 package**: `deepmerge` (low), the only
accepted, time-boxed exception in `audit-allowlist.json`. It does not run
in the shipped app. Every other advisory that used to stand here has been
fixed by forcing a patched version through `package.json` `overrides`.

### Fixed through `overrides`

| Package | Advisories | Reached via | Forced to | Why an override was needed |
| --- | --- | --- | --- | --- |
| `image-size` | GHSA-w3rx-r6r6-pgpr, GHSA-5p2g-fcmc-qvqq (2 × high) | `metro`, build time | `tooling/image-size-compat` → `image-size@2` | Fix is a new major; Metro 0.84 pins `^1.0.2`, and 2 dropped file-path input |
| `@grpc/grpc-js` | GHSA-m9gg-hp2v-232j (high), GHSA-f596-whhp-79r4 (low) | RNFB → Firebase JS SDK → Firestore | `^1.14.7` | Fix is 1.13.6; Firestore pins `~1.9.0` |
| `glob` | GHSA-3g3m-2fjr-6pw4 (moderate) | `babel-plugin-module-resolver`, Jest 29, `test-exclude` | `tooling/glob-compat` → `glob@14` | Fix is 14.0.2; consumers pin `^7` / `^9`, and 14 changed its CommonJS shape |
| `minimatch` | GHSA-g3hv-75wg-m249 (moderate) | ESLint, `@eslint/*`, `eslint-plugin-react`, `typescript-estree`, `glob`, `test-exclude` | `tooling/minimatch-callable` → `minimatch@11` | Fix is 11.0.1; consumers pin `^3` / `^8` / `^10`, and 11 changed its CommonJS shape |

`@grpc/grpc-js` is a plain version pin. It never loads in a React Native
app at all (RNFB uses the native Firebase SDKs on iOS and Android;
Firestore is not installed; and Firestore's RN build has no reference to
grpc-js), so the pin is purely to clear the advisory and carries no runtime
risk.

The other three needed more than a pin, because their patched majors
changed what `require()` returns or accepts:

- `image-size@2`'s `imageSize()` accepts only a `Uint8Array`; file-path
  input moved to the async `imageSizeFromFile()`. Metro's `getAssetData()`
  (`metro/src/Assets.js`) passes a **string path** for every image asset
  outside a `.zip/`, so a bare pin fails on the first PNG Metro meets
  (`@react-navigation/elements`' header icons) with 'The "list" argument
  must be an instance of ... ArrayBufferView'. An earlier review of this
  pin only checked the `Buffer` call in `getAssetSize()` and missed this.
  The facade restores image-size@1's string form exactly (open, stat, read
  at most the first 512 KiB, parse) and passes `Uint8Array` input through.
  With the parsers patched, the `disableTypes()` mitigation that used to
  live in `metro.config.js` is gone.
- `minimatch@11`'s CommonJS entry is a namespace object
  (`{ minimatch, Minimatch, filter, ... }`); `minimatch@3` exported the
  matcher function itself. `eslint-plugin-react` (five rules, including
  `react/no-unstable-nested-components`, which the RN ESLint config
  enables) and `test-exclude@6` still call `minimatch(path, pattern)`
  directly, so a bare override makes `npm run lint` throw
  "minimatch is not a function" on any component defined inside a prop.
- `glob@14`'s CommonJS entry is an `__esModule` namespace with **no**
  `default`; `glob@7`/`@9` exported a callable. `babel-plugin-module-resolver`,
  `jest-runtime`, `jest-config` and `@jest/reporters` are compiled to
  `_interopRequireDefault(require('glob')).default.sync(...)`, so a bare
  override makes every Babel transform throw.

Those three overrides therefore point at local facades under `tooling/`,
each a few lines that adapt the patched package back to the call form its
consumers were written against. The real packages are installed under the
root aliases `image-size-upstream` (`npm:image-size@^2`), `glob-upstream`
(`npm:glob@^14`) and `minimatch-upstream` (`npm:minimatch@^11`), because
npm applies overrides by package name and a dependency on the real name
from inside a facade would resolve to the facade again. Each facade's
header comment records the advisory, the consumers it exists for, and when
to delete it.

**Removing an override.** Each one is scaffolding around an upstream range,
and should go when the range catches up:

- `image-size`: when React Native moves to a Metro that depends on
  `image-size@^2` or not at all (Metro 0.87.1 already dropped it).
- `@grpc/grpc-js`: when `@firebase/firestore` moves off `~1.9.0`.
- `glob` / `minimatch`: when `babel-plugin-module-resolver`, the Jest 29
  packages and the ESLint packages above declare `glob@^14` and
  `minimatch@^11` themselves, or when RN's Jest preset moves to Jest 30.

Delete the facade directory, the `*-upstream` alias and the override
together, then run a bundle (`npx react-native bundle ...`) as well as the
usual gates: the facades' consumers are build tooling, and only a bundle
exercises the Metro one.

Check with `npm ls glob minimatch image-size @grpc/grpc-js` after any
dependency bump: every row should still resolve to the forced version, and
`npm ls` as a whole should report nothing `invalid`.

### The remaining exception

**`deepmerge`** (GHSA-gcqx-w48m-w2h4, low) — prototype poisoning in
`mergeObject()`. The advisory covers `>=4.2.0 <=4.3.1` and lists **no
patched version**; 4.3.1 is the latest release, so there is nothing to
override to, and npm's only suggested fix is a downgrade of
`@react-native-community/cli` to 11.4.1 (ruled out below). It is reached
via `@react-native-community/cli` (and its `cli-config`, `cli-doctor`) and
via `jest` → `jest-config`, and in both it only merges this project's own
CLI and Jest configuration objects on a developer machine or CI runner. No
user-, network- or device-supplied object ever reaches it, so there is no
attacker to supply a `__proto__` key. Vendoring a hardened copy was
considered and declined: maintaining a forked library is a worse trade than
one low-severity, unreachable, time-boxed exception. Re-review when the
allowlist entry expires or when deepmerge publishes a fix, whichever is
first.

### The audit gate

Because `npm audit` exits non-zero while any advisory is open, it is useless
as a CI gate on a project carrying one it cannot fix. `npm run audit:ci`
(`scripts/audit-gate.mjs`, no dependencies) replaces it: it collapses the
report to distinct upstream advisories — npm lists one entry per affected
package, which is why one `deepmerge` flaw shows up as 9 — and checks each
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

**October 2026 batch.** New advisories against `shell-quote` (critical),
`compression`, `qs`, `joi`, `js-yaml` and `brace-expansion` failed the gate
on 2026-10-19, with no change to `package.json`. Every one had a patched
release inside the range its parent already allowed, so a plain
`npm audit fix` (no `--force`) cleared them by updating only
`package-lock.json`: shell-quote 1.12.0, compression 1.8.2, qs 6.16.1,
joi 17.13.8, js-yaml 4.3.2 / 3.15.2, and brace-expansion 1.1.21 / 2.1.7 /
5.0.12. The same refresh moved `@react-navigation/core` to 7.24.0, which no
longer depends on `query-string`. That removed `decode-uri-component`
(GHSA-vcc3-ghjq-m6fr) from the tree entirely, so its allowlist exception
was deleted as stale.

`fast-xml-parser` (GHSA-gh4j-gqv2-49f6) accounted for 7 moderate
advisories via `@react-native-community/cli-*`, which pinned `^4.4.1`.
Upstream migrated to `fast-xml-parser@^5.3.6` in CLI **20.2.0**, so the
three `@react-native-community/cli*` packages are pinned to `^20.2.0` here
and the tree now resolves 5.10.1. React Native 0.86.2 does not itself pin
the CLI, so this is safe to set independently.

### Deprecation warnings

`npm install` used to print two, for `glob@7` and its `inflight`
dependency, both pulled in by Jest 29. The `glob` override above routes
every `glob` in the tree to `glob@14`, so `glob@7` and `inflight` are no
longer installed and the warnings are gone.

### `overrides`

Besides the four audit-driven pins described above, `package.json` pins
`eslint-plugin-ft-flow` to `^3.0.11`. The version bundled with
`@react-native/eslint-config@0.86.2` (2.0.3) calls
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

## Component gallery (WL-206)

Dev builds only. **Home → "Component gallery (dev)"** — the route is
`__DEV__`-gated in `RootNavigator`, so it does not exist in a release build.

Four tabs: **Tokens**, **Components**, **Motion**, **Type**. The header, with
the live reduced-motion banner, stays pinned above the scroll, so any
screenshot records which motion mode it was taken in.

This is the project's mechanism for catching visual regressions, and it is
styled *by* the system it displays — the tabs use the same palette, shadow and
`textOn` tokens as any other surface, so broken tokens break the gallery's own
furniture rather than hiding behind exempt chrome.

There is deliberately **no component-rendering test library**. The failure
modes that matter are already gated without rendering: a blurred shadow fails
`npm test`, a failing colour pairing fails `npm run contrast:verify`, a raw
value fails `npm run lint`, a missing font fails `npm run fonts:verify`.
What's left — does it *look* right — is what the gallery is for. Snapshot
tests over token-driven styles would mostly generate churn that trains people
to run `-u` without reading.

The one exception to token-only styling is the Type tab, which must render
text at arbitrary sizes and with *no* `fontFamily` to compare against the
platform default. It carries a narrow lint exemption scoped to that single
file.

## Icons (WL-207)

`src/components/common/icons/Icon.tsx` — eight glyphs: settings, back, pause,
hint, close, sound, haptics, alert. **There is no icon library and no SVG
renderer**; Design System §7 rejects stock icon sets, and the glyphs are drawn
from plain Views.

That's not dependency-avoidance for its own sake. §7 asks for strokes
"matching the border weight used on components", and View-drawn icons use
`borderWidth.base` and `palette` — the same tokens the components do — so the
match is enforced rather than eyeballed. An SVG would hard-code a stroke width
that silently stops matching when the border scale is retuned.

**If the set ever needs organic or illustrative shapes, that's the point to add
`react-native-svg`** — not to keep torturing Views. Callers only ever see
`<Icon name=… />`. `__tests__/icons.test.ts` asserts the current absence of
both an icon library and an SVG renderer, so adding either is a deliberate
change rather than a silent one.

Two rules when using them:

- **Icon-only controls carry their own `accessibilityLabel`.** The glyph is
  decorative and hidden from assistive tech — a gear is only "Settings" in
  context.
- **Never use an emoji as an icon.** Lint rejects pictographic emoji in screens
  and components (arrows are exempt, since they appear in real prose). Beyond
  §7, emoji render as tofu boxes wherever the platform lacks the glyph.

`ICON_NAMES` is a runtime value, so the gallery renders the whole set
automatically — a new glyph can't be added without appearing there for review.

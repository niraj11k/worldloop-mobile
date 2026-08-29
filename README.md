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

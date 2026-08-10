# WordLoop Mobile (React Native)

Scaffold only. No gameplay is fully wired up yet. This README explains the
structure and what's real vs. stubbed, so anyone picking this up (including
future-you) doesn't mistake a skeleton for a finished feature.

This scaffold was **not** built by running `npx react-native init` in a
networked environment (this sandbox has no network access), so:

- `node_modules/` has not been installed.
- `ios/` and `android/` native project folders are **not present** and must
  be generated locally (see Setup below).
- Dependency versions in `package.json` are current-as-of-authoring
  reasonable defaults, not verified against the npm registry from this
  environment. [Unverified] Pin/update versions when you actually run
  `npm install` or `yarn install` locally.

## Setup (run locally, not in this sandbox)

```bash
yarn install
npx react-native init WordLoopTemp --version 0.74.0   # only if you need fresh native folders
# then copy the generated ios/ and android/ folders into this project root,
# or run `npx react-native-community/cli` equivalent to regenerate them
# against this existing src/ and package.json.

npx pod-install ios   # macOS only, after ios/ exists

yarn ios      # or
yarn android
```

[Unverified] Exact native-folder bootstrapping steps depend on the React
Native version and CLI tooling current at the time you actually set this
up — the above is a general outline, not a tested sequence.

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
- Local persistence (`services/storage/storage.ts`) — no-op stub, pending
  the AsyncStorage vs. MMKV decision.
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
yarn test        # Jest, path aliases resolved via jest.moduleNameMapper in package.json
yarn typecheck    # tsc --noEmit
yarn lint          # ESLint, @react-native config
```

Only `ruleEngine.ts` has tests so far, as a pattern to follow for the rest
of `features/`.

## Do not assume this compiles or runs yet

This has been authored file-by-file in a sandboxed environment without
network access, so it has **not** been installed, compiled, or run against
an actual Metro bundler or simulator. Treat it as a structural starting
point that encodes the decisions from the Architecture and Data Model
docs, not as a verified working build. Run `yarn install` and a typecheck
locally before trusting it further.

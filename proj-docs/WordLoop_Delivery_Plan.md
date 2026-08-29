# WordLoop Delivery Plan

**Version:** 0.1
**Status:** Draft for review — not yet approved
**Owner:** Product
**Related docs:** all in `proj-docs/` — `WordLoop_Product_Requirements_Document.md`,
`WordLoop_User_Flows_and_Wireframe_Requirements.md`, `WordLoop_Architecture.md`,
`WordLoop_Data_Model.md`, `WordLoop_Design_System.md`,
`WordLoop_Guest_Account_Trigger_Policy.md`, `WordLoop_Guest_Data_Deletion_Policy.md`,
`WordLoop_Word_List_Licence_Review.md`, `WordLoop_Store_Submission_Checklist.md`

This document turns the planning docs into an executable build plan: phases, tasks,
dependencies, exit criteria, and the decisions that must be made before each phase can
start. It introduces **no new product scope**. Where it recommends a change to what the
existing docs say, that recommendation is called out explicitly in section 3 as a
decision requiring sign-off — per `CLAUDE.md`, contradictions between docs are flagged,
not silently resolved.

**How to read this:** section 3 (decisions) is the part that needs your attention first.
Six of those decisions block the start of a phase. Everything in sections 5 onward is
downstream of them.

---

## 1. Where we actually are

| Area | State |
|---|---|
| Reference docs | Complete and internally consistent enough to build from, with the exceptions in section 3 and the gaps in section 11 |
| RN project | Scaffolded; `npm install`, `test`, `lint`, `typecheck`, and CI all pass |
| `ios/` and `android/` | **Do not exist.** Never generated. Nothing has been compiled or run on a device or simulator |
| Rule engine | Chaining, normalization, min length, duplicates, symbol rejection — implemented + unit tested. Proper-noun and offensive-word rejection blocked on the dictionary |
| Scoring engine | Formula implemented and unit-tested. `rarity_bonus` is inert until word frequency data exists |
| Difficulty engine | **Complete as of 2026-08-19.** Ranking per Architecture §6 weights, candidate *generation* against the bundled dictionary (`WL-108`), and per-difficulty *selection* — easy random / medium weighted-random / hard top-pick with occasional second-best (`WL-109`), seedable and asserted over 1,000 turns each. Component score definitions beyond `option_reduction_score` are the implementation's own; see WL-108. Not yet wired into the game screen — that needs `WL-110` |
| Account prompt policy | Cooldown/cycle logic implemented and unit-tested per Architecture §8.3, including the 30-day cooldown-elapsed cycle-reset case |
| Dictionary service | Stub. Returns not-found for every word. **No word list is bundled** |
| Storage | No-op stub. Library decided — MMKV (D-07) — implementation is `WL-002`, gated on native projects |
| API client | Throws if called. No backend exists |
| Screens | All 8 MVP screens exist as grayscale skeletons. Design system is **not** implemented — `theme.ts` is a placeholder |
| Sync service | Empty directory |

**The honest summary:** the pure-logic core is further along than the product is. The app
cannot currently validate a single word, cannot persist anything, and has never been
compiled. The two things standing between "scaffold" and "playable" are the **dictionary
dataset** and the **native project**, in that order of difficulty.

---

## 2. What v1 is for, and how we'll know it worked

Per PRD §23 ("downloads alone should not be treated as product validation") and §29 Phase
5, v1 exists to answer one question:

> **Do casual players finish a round and immediately start another one?**

Everything in this plan is sequenced to answer that as early and as cheaply as possible.
The success bar for v1, to be confirmed as part of D-09:

| Metric | Target | Source |
|---|---|---|
| Game completion rate | ≥ 60% of started games reach a result | PRD §23 |
| Rematch rate | ≥ 35% of completed games are followed by another game in the same session | PRD §23, §25 |
| D1 / D7 return | ≥ 25% / ≥ 10% | PRD §23 |
| Player win rate, Hard | 20–40% (not 0%, not 80%) | PRD §9.4 |
| Invalid-word rate | ≤ 25% of player submissions, and no single reason above 40% of rejections | PRD §23, §25 |

Two of these — rematch rate and player win rate by difficulty — are the ones that decide
whether the difficulty weights in Architecture §6 need retuning. They must be
instrumented before the first external playtest, not after.

### Release milestones

| Milestone | Contents | Audience | Gate to pass |
|---|---|---|---|
| **M1 — Internal playable** | End of Phase 3 | Team only, dev build | A full round is playable start to finish on a real device |
| **M2 — Playtest build** | End of Phase 6 | 5–10 recruited players (Wireframe §24) | Core-loop comprehension + rematch behaviour observed |
| **M3 — Store release** | End of Phase 8 | Public, iOS + Play | Store compliance, privacy, crash-free rate |
| **M4 — Validation readout** | Phase 9 | Internal decision | Go / no-go on the school product (PRD §27) |

M2 is the real deadline. M3 is a packaging exercise; M2 is where the product question gets
answered.

---

## 3. Decisions required (blocking)

Each decision has a recommendation. Where I'm recommending something different from what a
reference doc currently says, that's marked **[changes a doc]**.

| ID | Decision | Blocks | Recommendation |
|---|---|---|---|
| **D-01** | Word list source, licence, and scope | Phase 1 | **CLOSED — see `WordLoop_Word_List_Licence_Review.md`.** Source is ESDB (`en-wl/wordlist`, the actively maintained successor to SCOWL — SCOWL itself is now a frozen legacy branch), pinned at `rel-2026.02.25`, capped at size ≤ 70 to avoid the UKACD verbatim-reproduction clause entirely. Required attribution is a single short notice (plus WordNet's, as cheap insurance) — both go in a Settings → Attributions screen. The ENABLE/`dwyl` fallback was identified but never needed; ESDB cleared review on the first pass |
| **D-02** | Frequency / commonness data source | Phase 1 | **CLOSED, as a side effect of D-01.** ESDB's size tiers (35/50/60/70) serve directly as the commonness/rarity signal — no separate `wordfreq` dependency or licence review needed for v1. See `WordLoop_Word_List_Licence_Review.md` section 6 |
| **D-03** | Server authority for v1 **[changes a doc]** | Phase 1 | **CLOSED 2026-08-17 — v1 is client-authoritative and local-first.** PRD §18 originally said the client must not be trusted to decide validity, and Architecture §3 made the server the source of truth with offline as fallback — but for a **single-player game with no leaderboards, no purchases, and no competitive integrity to protect in v1**, server authority bought nothing and cost a backend, a hosting decision, a data-store decision, and reconciliation logic nobody had designed. `WordLoop_Architecture.md` §2/§3 have been rewritten to reflect this as the actual v1 design, with the original server-authoritative model preserved in §3.1 as the target to return to post-v1. The PRD §20 API surface stays designed but unbuilt. This deletes Architecture §11 open items 1 and 2 for v1 (not merely defers them) and removes roughly three weeks from the critical path. **Revisit the moment leaderboards or purchases enter scope** — that's the actual trigger condition, not a date |
| **D-04** | Accounts in v1 **[changes a doc]** | Phase 7 sequencing | **CLOSED 2026-08-17 — M3 ships guest-only, adopted as recommended.** Architecture §8 originally put accounts in v1, but *every* hard gate it lists — vocabulary history, saved words, statistics, backup, cross-device — is itself a feature not in v1 scope, so the only live reason for v1 accounts would have been future monetization prep. Implemented: `SettingsScreen.tsx` shows "Continue as guest" with no Create Account row, gated behind the new `ACCOUNTS_ENABLED_V1` flag (`src/constants/gameConstants.ts`, currently `false`); the soft-prompt policy (`promptPolicy.ts`) stays implemented and unit-tested but isn't called from any live screen. `WordLoop_Architecture.md` §8 rewritten to match, with the original accounts design preserved as the 1.1 target, not deleted. Accounts + the hard-gated features ship together as 1.1. This removes account deletion, the web deletion page, and auth provider work from the v1 launch critical path |
| **D-05** | Dark mode in v1 **[changes a doc]** | Phase 2 | **CLOSED 2026-08-26 — cut from v1, option (b) adopted as recommended.** Wireframe §16 originally listed dark mode as a v1 setting; Design System §9 open item 3 flagged that no dark palette had been designed. Designing one in Phase 2 would have added ~3 days design + ~2 days implementation, with every one of the 8 accent colours needing re-contrast-checking. Both docs updated: Wireframe §16 strikes the toggle, Design System §9 item 3 marks it resolved. `WL-203`'s token layer only needs to produce light-mode values. Revisit as a post-v1 release once a real dark palette is designed |
| **D-06** | Display + monospace font selection and mobile licence | Phase 2 | **CLOSED 2026-08-26 — `Baloo 2` (display) + `JetBrains Mono` (monospace).** Both are Google Fonts; the SIL OFL text was checked directly and explicitly permits bundling/embedding inside app software at no cost, with only a requirement to ship the licence text (covered by the WL-407 Attributions screen). Baloo 2 chosen over Fredoka (too close to "kids app") and Lilita One (single weight only, no light cut for the 40px wordmark). JetBrains Mono chosen over IBM Plex Mono (more corporate) and Space Mono (weaker legibility at 12px captions). See Design System §2 |
| **D-07** | Local storage library | Phase 0 | **CLOSED — MMKV.** Corrected from the original framing: this decision only governs the small key-value `StorageAdapter` (`GUEST_PROFILE`, `SETTINGS`, `CURRENT_SESSION`, `ACCOUNT_PROMPT_STATE`), not the dictionary — that has its own format decision in WL-105, unrelated to this one. The real case: settings need synchronous reads to feel instant on toggle, not async-round-trip loading states; `zustand` (already the project's state library) has first-class MMKV persist-middleware support; and `react-native-nitro-modules` was already a dependency before this review, which only makes sense as MMKV v4 support — meaning `@react-native-async-storage/async-storage` was leftover template weight, not a live second candidate. Removed from `package.json`. Trade-off unchanged: MMKV needs native linking, so `WL-002` (the actual implementation) is gated on `WL-001` regardless |
| **D-08** | Definition/enrichment provider | Phase 5 | Do not select one for v1. Ship the definition overlay reading from bundled short glosses (if the chosen word list carries them) or showing "Definition unavailable — you can continue playing," which Wireframe §12 already specifies as a required state. A £5k/yr Oxford licence before knowing whether anyone taps "Definition" is the wrong order. **Phase 6 must instrument definition-open rate** so this decision has data behind it |
| **D-09** | v1 success metrics and targets | Phase 6 | Ratify or amend the table in section 2 before the playtest build, so M2 has a pass/fail bar rather than a vibe |
| **D-10** | Product name clearance | Phase 8 | PRD §30 requires App Store / Play name availability, domain, social handles, and trademark checks. Start this in Phase 3 — it has external lead time and a rename late in the project touches the wordmark, the bundle IDs, the store listings, and the design system |

---

## 4. Phase overview

Estimates assume **one senior React Native engineer full-time**, part-time design, and a
part-time data/tooling hand for Phase 1. Two engineers compresses the calendar by roughly
30%, not 50% — Phases 1→3 are largely serial.

| Phase | Goal | Est. | Exit criteria |
|---|---|---|---|
| **0** | Compilable, runnable, persistent app shell | 4–6d | App builds and launches on iOS + Android; a value written to storage survives a cold start |
| **1** | Dictionary + complete headless game engine | 8–12d | A full round can be played end-to-end in a Node test harness with no UI |
| **2** | Design system implemented as code | 7–9d | Every component in Design System §4 exists, contrast-verified, with a rendered component gallery |
| **3** | Playable core loop → **M1** | 8–10d | A round is playable on-device with all 7 game-screen states from Wireframe §9 |
| **4** | App shell, persistence, accessibility | 7–9d | All MVP screens navigable; game survives backgrounding; a11y audit passes |
| **5** | Learning layer | 6–8d | Hints, definition overlay, word review, and report-a-word all functional |
| **6** | Instrumentation + tuning → **M2** | 5–7d | Every PRD §23 event fires; playtest build distributed |
| **7** | Accounts + backend *(1.1 release — D-04 closed, out of the v1 critical path)* | 15–20d | Guest→account linking works; in-app deletion works |
| **8** | Store release readiness → **M3** | 7–9d | Both store submissions accepted |
| **9** | Market validation → **M4** | 3–4 wks | Go/no-go recommendation on the school product |

**Calendar, v1 (decided — guest-only, client-authoritative):** ~10–12 working weeks to M3,
plus buffer. Phase 7 runs after M3, on its own schedule, as the 1.1 release.
**The path not taken:** shipping accounts at M3 would have added ~14–16 weeks total; D-04
closed against that.

---

## 5. Phase detail

Format: `WL-nnn · Title` — size · estimate · dependencies. "Done when" is the acceptance
criterion; if it isn't demonstrable, the task isn't done.

### Phase 0 — Foundation unblock

Goal: stop guessing whether this compiles.

**WL-001 · Generate and commit iOS + Android native projects** — L · 2d · none
Generate against RN 0.86.2, reconcile with the existing `package.json` and `src/`, run
pods, confirm both platforms build and launch. Set bundle identifiers (provisional, per
D-10).
*Done when:* `npm run ios` and `npm run android` both launch the Welcome screen on a
simulator and one physical device each.

**WL-002 · Resolve and wire the storage adapter** — M · 1d · D-07, WL-001
Replace the `storage.ts` no-op with the chosen library behind the existing
`StorageAdapter` interface. Keep the interface — it is the reason this decision is cheap
to reverse.
*Done when:* a round-trip write/read/remove test passes on both platforms, and a written
value survives an app kill and relaunch.

**WL-003 · Crash and error reporting** — S · 0.5d · WL-001 — **DONE 2026-08-25**
Wire a crash reporter (Sentry or Crashlytics) with source maps for both platforms, behind
a config flag so it's inert in dev.
*Done when:* a deliberately thrown error appears in the dashboard with a symbolicated
stack from a release build. ✅

**Provider: Firebase Crashlytics** (decided 2026-08-19). `google-services.json` and
`GoogleService-Info.plist` landed from a real Firebase project (`wordloop-52618`,
`com.wordloop.mobile` on both platforms) on 2026-08-19 and are **committed to git** — a
deliberate call, not an oversight: neither file is a secret in the traditional sense
(Google's guidance is that access is controlled by Security Rules / App Check / API key
restrictions in Cloud Console, not file secrecy), and gitignoring them would break the
WL-004 native CI jobs on every fresh checkout, the same way the missing files broke local
builds before they existed. If that judgement is ever revisited, the CI jobs need a
secrets-injection step added at the same time — the two changes aren't independent.

**Done:**

- `src/services/crashReporting/crashReporting.ts` — the seam: `reportError` /
  `logBreadcrumb` / `setCrashReporter`, inert in dev via `!__DEV__`, never throws (a
  failure inside error reporting must not become a second error on a path already
  handling one). Unit-tested.
- `src/services/crashReporting/firebaseCrashReporter.ts` — the only file that imports
  `@react-native-firebase/*`, so the provider stays a one-file decision (same pattern as
  `StorageAdapter` keeping D-07 reversible). Installed at the top of `index.js`, before
  `AppRegistry.registerComponent`, so early-render errors are still caught.
- `@react-native-firebase/app` + `/crashlytics` installed; native wiring on both
  platforms; **verified with real builds and real launches on both**, not just a
  successful compile — a `tsc` pass would not have caught either bug below.

**Two real integration bugs found and fixed, both by actually building and launching
rather than trusting the edit:**

1. **iOS: `pod install` failed outright** — `@react-native-firebase` resolves Firebase via
   Swift Package Manager by default, whose static-library products collide at link time
   under this project's default (non-`use_frameworks!`) linkage. Fixed by setting
   `$RNFirebaseDisableSPM = true` in the Podfile, falling back to Firebase's traditional
   CocoaPods resolution — the surgical fix; switching to `use_frameworks! :linkage =>
   :dynamic` instead would have changed how every pod in the project links, not just
   Firebase's. That in turn needed `use_modular_headers!` globally, since several Firebase
   Swift pods depend on Objective-C pods that don't define Clang modules.
2. **iOS: a scripted `project.pbxproj` edit added a *dangling* build-phase reference** — a
   UUID present in the target's build-phase list with no corresponding object definition
   anywhere in the file, which would have corrupted the Xcode project. Caught by reopening
   the saved file fresh and checking every referenced UUID resolves, not by trusting the
   edit script's own success message. Root cause: the `WordLoop` group carries no `path`
   of its own (every sibling file — `AppDelegate.swift`, `Info.plist` — sets its own
   `path` to `WordLoop/<file>` instead), so a file reference created with just the bare
   filename resolved one directory too high; a real build failed with "Build input file
   cannot be found" before this was caught. Fixed, and separately: the manually-added
   Crashlytics dSYM-upload build phase this edit also added turned out to be **entirely
   redundant** — `pod install` already auto-injects a complete `[CP-User] [RNFB]
   Crashlytics Configuration` phase with CocoaPods/framework/SPM fallback logic. Removed.
3. **iOS: `FirebaseApp.configure()` is not auto-injected** — `getApp()` at JS module-load
   time threw `No Firebase App '[DEFAULT]' has been created`, confirmed by an actual
   simulator launch (a native-only build could not have caught this — the failure is at
   JS/native handoff). RNFB's CocoaPods integration handles `firebase.json` processing and
   Crashlytics symbol upload automatically, but the native init call itself is a documented
   manual step. Added to `AppDelegate.swift`, before `startReactNative`. **Android needed
   no equivalent fix** — confirmed by an actual launch, not assumed: its SDK
   auto-initializes via a manifest-merged `ContentProvider`.

**Release-build crash verified on-device, both platforms, 2026-08-25** — the engineering
side of this task is complete. `forceCrashForVerification()` was temporarily wired into
`App.tsx` (a 2-second post-mount timer, removed immediately after; the working tree is
clean of it), Release configurations were built on both platforms, and both crashed for
the deliberate reason rather than something incidental:

- **iOS:** the OS-level `.ips` crash report's crashed thread has
  `-[RNFBCrashlyticsModule crash]` as its top frame — the exact native method
  `forceCrashForVerification()` calls, reached through the TurboModule bridge. Not
  inferred from the app disappearing; read directly from
  `~/Library/Logs/DiagnosticReports/WordLoop-2026-08-25-225025.ips`.
- **Android:** `adb logcat` shows `FATAL EXCEPTION: mqt_v_native` /
  `java.lang.RuntimeException: Crash Test` at
  `io.invertase.firebase.crashlytics.NativeRNFBTurboCrashlytics$1.run`, with
  `libcrashlytics: Initializing native crash handling successful` logged immediately
  before it — the native crash handler was active and caught it.

Both apps were relaunched once afterward — required, not optional: Crashlytics uploads
the *previous* run's report on the next launch, not the one that's currently crashing.
Android's logcat then showed a real outbound request,
`Making request to: https://crashlyticsreports-pa.googleapis.com/v1/firelog/legacy/batchlog`
— confirming the report was actually sent, not merely queued. No equivalent request-level
log exists on iOS to quote, which is a real gap in what could be confirmed this way, not
assumed away.

**Confirmed in the Firebase console 2026-08-25 by the project owner** — both crash
reports (iOS and Android) render with symbolicated stacks. This closes the task.

**WL-004 · Extend CI to build both native platforms** — M · 1d · WL-001
Add iOS and Android compile jobs to `.github/workflows/ci.yml` alongside the existing
test/lint/typecheck/audit gates.
*Done when:* a PR that breaks the native build fails CI.

**WL-005 · Device and OS support matrix** — S · 0.5d · none
Fix minimum iOS and Android versions and the physical test devices, including one small
phone (Wireframe §19). Record in the README.
*Done when:* the matrix is committed and CI targets match it.

---

### Phase 1 — Dictionary and headless game engine

Goal: the whole game works with no UI. This is the highest-risk phase; treat slippage here
as slippage to M2, because everything downstream is blocked on it.

**WL-101 · Complete the word-list licence review** — M · 1.5d · D-01 — **DONE**
Reviewed against the live upstream source, not from memory. See
`WordLoop_Word_List_Licence_Review.md`. Source: ESDB (`en-wl/wordlist`), pinned
`rel-2026.02.25`, capped at size ≤ 70. `source_name` / `source_version` for
`DictionaryWord`: `"English Speller Database (ESDB), formerly SCOWL"` / `"rel-2026.02.25"`.
Attribution text for both required notices is in that doc's section 7, ready for WL-407.
*Done when:* a written licence conclusion exists in `proj-docs/`, with the verbatim notice
text to be bundled. ✅

**WL-102 · Build the dictionary generation pipeline** — L · 3d · WL-101, D-02
A committed, re-runnable script (`scripts/`) that takes ESDB's build output (`make
scowl.txt`, or `scowl.db` if a query interface is preferred — both documented in the
licence review, section 5) and emits the bundled asset. Must produce, per word: normalized
form, allowed flag, proper-noun flag, offensive flag, obscure flag, commonness tier
(derived from ESDB's size field), and computer-playable flag — the `DictionaryWord` shape
already declared in `dictionaryService.ts`. Filter to size ≤ 70 per the licence review.
*Done when:* the script runs from a clean checkout, output is deterministic, and the
generated stats (word count per tier, per first letter) are printed and reviewed.

**WL-103 · Proper-noun classification** — M · 1d · WL-102 — **pipeline logic done, formal fixture suite still open**
Per PRD §8.5, classification comes from dictionary metadata, **not** a global name
blocklist — `rose` must remain playable. Per the licence review (section 5), ESDB carries
this natively: flag `is_proper_noun = true` for any entry whose `POS-CLASS` is one of
`person`, `surname`, `place`, `demonym`, `trademark`, or `name`. This is more direct than
the original plan (capitalization heuristic + curated exception list) — no separate
classification logic needs to be built, only a fixture suite to confirm the source data
behaves as expected. Downgraded from M/2d to a straightforward filter-and-verify task.

**Implemented in `scripts/generate-dictionary.py` (WL-102), one refinement past the
paragraph above:** `upper` (ESDB's "valid only capitalized" tag — acronyms like `ABC`,
and a capitalization-only shadow row that rides alongside a `person`/`surname`/`place`
row for the same word) is excluded from "does a common reading exist?" evidence
alongside the six POS-CLASS values above. Without it, e.g. `james` was wrongly accepted
— its only sub-70 entries are `person` and `upper`, and `upper` isn't itself a
proper-noun POS-CLASS, so it was being counted as a common reading.

**2026-08-18 — fixture list corrected against real ESDB data, not re-derived from
memory:** the original reject examples `peter`/`newton` are wrong. Both have a genuine,
independent common-word entry in ESDB (`peter` = the verb "to peter out"; `newton` = the
SI force unit) at the same size tier (35, blank `POS-CLASS`) as the accept-examples
`rose`/`mark`/`will` — i.e. the *same* dual-sense structure this task's own opening
paragraph says must resolve to "stays playable." Forcing them to reject would mean
special-casing against the rule this task states. Replaced with `james`/`london`/
`paris`/`thomas`/`edward`/`sarah`, all verified proper-noun-only in the generated
dictionary. The original `ajay`/`ravi`/`ganesh` are also dropped from this list — ESDB
has no entry for them at all (a real coverage gap, not a classification failure: they
still end up rejected in gameplay, via `unknown_word` rather than `proper_noun`, so
lower priority, tracked here rather than silently dropped).

*Done when:* a fixture test covers ≥50 cases: `james`/`london`/`paris`/`thomas`/`edward`/
`sarah` and other place/brand names rejected; `rose`/`may`/`mark`/`will`/`frank`/`amber`
accepted. **DONE** — `scripts/verify-dictionary-fixtures.py` (`npm run
dictionary:verify`), 54 cases, all passing. Also surfaced a smaller version of the same
gap: `robert`/`nike`/`pepsi` come out accepted because ESDB left their `POS-CLASS` blank
instead of `person`/`trademark` — a source data-tagging gap, not a pipeline bug, excluded
from the fixture list rather than chased here.

> **2026-08-26, WL-112: this gap is wider than the three words above.** Enumerating the
> whole computer-playable set turned up `xerxes`, `qaddafi`, `aachen`, `zappa`, `xemacs`,
> `aaliyah`, `honda`, `toyota`, `amazon` and `oscar`, all `isAllowed` and
> `isComputerPlayable` — so the computer can play them as ordinary moves, not just as
> opening words. WL-112's starting-word pool sidesteps them as a side effect of its
> frequency filter, which protects only the opening word; the gap itself is untouched and
> needs a `scripts/generate-dictionary.py` pass plus a re-bundle, since capitalization
> evidence does not survive into the packed asset. See WL-112 for the full note.

**WL-104 · Offensive/excluded word list** — S · 1d · WL-102 — **DONE 2026-08-19**
Per PRD §8.8 this must be configurable data, not code. Sourced list plus a manual review
pass, applied at pipeline time and overridable at runtime.
*Done when:* the exclusion list is a standalone reviewable data file, and excluded words
reject with reason `offensive_excluded`. ✅

The list lives at **`data/excluded-words.txt`** — plain text, one word per line, comments
allowed, read by the pipeline and by `npm run dictionary:verify`. Editing that file and
regenerating is the entire change; no code moves, which is what PRD §8.8 asks for.
Excluded words stay *present* in the dictionary rather than being deleted, so the player
gets "That word cannot be used in WordLoop" (Wireframe §10) instead of the misleading
unknown-word message.

**Source:** seeded from LDNOOBW (`github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-
Otherwise-Bad-Words`). That list targets user-generated text, so most of it is irrelevant
here: of its 403 entries, 275 are single words and only **154 exist in WordLoop's
dictionary at all**. **136 are excluded** after the review pass; 141,217 words remain
playable (down 134 — `lolita` and `viagra` were already proper nouns).

> **New licence obligation:** LDNOOBW is **CC-BY-4.0**, which requires attribution. That
> notice must join ESDB's and WordNet's in Settings → Attributions (**WL-407**). This is a
> third attribution WordLoop did not previously carry — cheap, but it is a real
> obligation, so it is recorded here rather than assumed. If that is unwanted, the
> alternative is curating the list from scratch with no third-party lineage.

**Review pass — 18 words put back.** PRD §8.5 already forbids rejecting a common word just
because it has an objectionable reading ("rose" stays playable), and the same restraint
applies here: `butt`, `escort`, `scat`, `skeet`, `snatch`, `shrimping`, `snowballing`,
`pegging`, `bareback`, `hardcore`, `playboy`, `eunuch`, `fecal`, `domination`, `suck`,
`sucks`, `bastinado`, `strappado`. Each is listed in the data file with the sense that
keeps it in, so the judgement is auditable rather than implicit.

> **Open judgement, deliberately conservative.** The store age rating is still undecided
> (Store Submission Checklist §D), and the audience includes parents and a possible school
> version, so borderline words are left excluded — a false block is cheaper than a false
> allow. The most arguable are **`sex`/`sexual`/`sexuality`/`sexually`**, which are neutral
> and very common, and the clinical anatomy terms. All are called out in the data file's
> header for a product decision, not buried.

**Runtime override** (`setRuntimeExclusions`) sits on top of the baked flag and feeds
`isAllowed`/`isComputerPlayable` too, so PRD §24's "the computer does not select forbidden
words" holds for overrides as well. It matters because v1 ships no backend (D-03): without
it, a word slipping through review would need a full store update to remove. It is also
the hook WL-505's report-a-word loop writes into.

*Verification:* `npm run dictionary:verify` now checks all 136 exclusions are flagged and
unplayable **and** that nothing outside the file is flagged (208 fixture cases total); the
guard was negative-tested by adding a word and confirming it fails. `ruleEngine.test.ts`
additionally drives `validateMove` against the real bundled asset to confirm
`offensive_excluded` — not `unknown_word` — is what actually reaches the player.

**WL-105 · Bundle format and lookup performance** — L · 2d · WL-102
Decide the on-device representation. A parsed JSON blob of 50k+ entries will cost visible
cold-start time; expect to need a packed asset loaded into an in-memory index, or SQLite —
this is its own format decision, independent of D-07 (the small-state `StorageAdapter`
library), which this task doesn't depend on despite an earlier version of this plan
listing it as a dependency.
Budget: **cold-start dictionary ready ≤ 400ms; single-word lookup ≤ 5ms; bundle size
increase ≤ 8MB.**
*Done when:* the three budgets are measured on the slowest device in the WL-005 matrix and
recorded. **DONE 2026-08-19 — all three budgets met with large headroom.**

**Chosen format:** a single sorted, newline-separated string of `word` + one flag
character (`tier index | proper-noun bit | offensive bit`), committed as
`src/assets/dictionary/dictionary.pack.json`. Every other field the app exposes is derived
from those three facts — the generated data has exactly 12 distinct flag combinations,
which is what makes the packing lossless (verified entry-by-entry against all 148,111
rows of the intermediate JSON). Startup builds an `Int32Array` of record offsets in one
`indexOf` pass; lookups binary-search it, so no JS string is ever allocated per word.

*Rejected:* shipping the generated JSON (36MB, and ~148k objects to materialize), and
SQLite (fast, but adds a native dependency and its two-platform build surface to serve a
read-only exact-match lookup a binary search already answers ~780× inside budget).

| Measurement | Budget | iOS | Android |
|---|---|---|---|
| Dictionary ready (asset first-touch + index build) | ≤ 400ms | **17ms** (8 + 9) | **58ms** (32 + 26) |
| Single-word lookup (mean of 1,400) | ≤ 5ms | **0.0064ms** | **0.0064ms** |
| Bundle size increase | ≤ 8MB | **1.74MB** | **1.74MB** |

Bundle increase measured as a true A/B: release JS bundle built with the real asset
(2.97MB) minus the same bundle with the asset's records emptied (1.23MB). The
`assetMs` column is a deliberate check that the JSON import hides no deferred parse — it
does not on iOS (8ms) and is modest on Android (32ms).

> **Caveat on "slowest device in the WL-005 matrix":** these numbers come from an iPhone 17
> Pro **simulator** and a `Medium_Phone_API_36.1` **emulator**, both Debug builds on an
> Apple-silicon Mac — not the physical iPhone SE / small Android handset the WL-005 matrix
> names, which this project does not have on hand. Simulators run on host CPU and are
> optimistic. The conclusion survives the gap by a wide margin (a device 7× slower than the
> emulator would still meet the 400ms budget, and ~780× slower would still meet the 5ms
> lookup budget), but the matrix devices remain formally unmeasured — fold into the
> physical-device passes at WL-310 and WL-805 rather than treating this row as closed.

**WL-106 · Precompute the reply-count index** — M · 1.5d · WL-102
The difficulty engine's `option_reduction_score` needs "how many valid replies does this
candidate leave?" Computed naively that's O(candidates × dictionary) per turn and will
stall the turn. Precompute counts of playable words by first letter at pipeline time; at
runtime subtract used words.
*Done when:* candidate scoring for a worst-case letter completes in ≤ 50ms on the slowest
target device. **DONE 2026-08-19 — budget met, but only after fixing a real bottleneck the
first measurement exposed (below).**

The packed asset now carries `replyCounts`: 26 per-first-letter totals over the
**player-submittable** set (`isAllowed`, 141,351 words), not the narrower computer-playable
tier — PRD §10 defines this term, for both Medium and Hard, as "the number of valid replies
available to *the player*". At runtime `replyCountForLetter()` subtracts the words already
used this round, which is O(chain length). `optionReductionScore()` inverts and normalizes
it to 0..1, because Architecture §6 sums this term against `commonness_score` (already 0..1)
and a raw count in the thousands would swamp every other weight before WL-605 could tune
anything.

**The first measurement failed the budget**, at ~44ms on iOS and 42–59ms on Android for the
worst-case letter (`s`, 10,041 computer-playable candidates) — over budget on Android, on an
emulator *faster* than the physical targets. Phase breakdown found the cause was not the
reply-count index at all:

| Phase | Before | After |
|---|---|---|
| Enumerate candidates for the letter | ~10ms | ~10ms |
| Build scored candidates (reply counts included) | ~8ms | ~8ms |
| **Select the best candidate** | **~23–29ms** | **~1ms** |
| **Total (worst run)** | **iOS 46 / Android 59** | **iOS 19 / Android 24** |

`selectComputerWord` sorted the entire candidate list and its comparator called
`scoreCandidate` twice per comparison — roughly 266k score computations to choose one word.
Replaced with a single linear pass that scores each candidate exactly once. Behaviour is
unchanged including tie-breaking (a strict `>` keeps the earliest maximum, matching the
stable sort it replaced); both are covered by tests. **This is the PRD §25 / risk-table
"naive candidate scoring stalls the computer's turn" risk materializing, caught by the
budget rather than by a player** — worth noting that the risk register was right, and that
the culprit was the ranking step, not the dictionary work it was assumed to be.

> **Same caveat as WL-105:** measured on an iPhone 17 Pro simulator and a
> `Medium_Phone_API_36.1` emulator, Debug builds on an Apple-silicon Mac — not the physical
> WL-005 matrix devices. ~2× headroom on the worst Android run is a much thinner margin than
> WL-105's, so this one genuinely does need re-measuring on real low-end hardware at WL-310
> before it can be considered settled. WL-109 (top 3–5 selection) must not reintroduce a
> full sort; a bounded partial selection keeps this budget.

**WL-107 · Complete the rule engine against real dictionary data** — M · 1.5d · WL-103, WL-104, WL-105
Wire the existing `ruleEngine.ts` to real lookups; implement the `unknown_word`,
`proper_noun`, and `offensive_excluded` paths. Confirm inflected forms are accepted per
PRD §8.6 (`cats`, `walked`, `playing`, `faster`) with no word-family restriction.
*Done when:* every one of the 7 `InvalidReason` values is produced by a passing test, and
PRD §24 "Player move" acceptance criteria are all covered. **Engine DONE 2026-08-18;
end-to-end still gated on WL-105.** `ruleEngine.ts` now calls the dictionary (async, with
an injectable lookup so the engine stays testable without a bundle) and implements all
three new paths. All 7 `InvalidReason` values and every PRD §24 "Player move" criterion
are covered by `__tests__/ruleEngine.test.ts` (21 tests); PRD §8.6 inflected forms are
confirmed against the **real** generated word list in
`scripts/verify-dictionary-fixtures.py`, including the full `play`/`plays`/`played`/
`playing` family to prove the no-word-family-restriction rule.

Two things are deliberately *not* claimed as verified, because their dependencies don't
exist yet — this task was started ahead of them:
> - **`offensive_excluded` has no real data behind it (WL-104).** The pipeline hardcodes
>   `is_offensive = false`, so the path is proven only against an injected fixture. It
>   will not fire in the app until WL-104 lands a real exclusion list.
> - ~~**No real lookups happen on-device yet (WL-105).**~~ **Resolved 2026-08-19.**
>   `lookupWord` now reads the bundled 148,111-word asset, so the engine validates
>   against real data on both platforms and no longer rejects everything as
>   `unknown_word`. The game is still not playable end-to-end, but for the remaining
>   reasons only: no computer opponent (WL-108/WL-109/WL-110) and the safe-area defect
>   logged under WL-401.

**WL-108 · Candidate generation** — M · 1.5d · WL-105, WL-106 — **DONE 2026-08-19**
Given a required letter and the used-word set, return scored candidates. Computer draws
only from the computer-playable tier (PRD §8.7); the player may submit from the wider
accepted set.
*Done when:* generation returns correctly filtered, correctly scored candidates for all 26
letters, including the sparse ones. ✅ — `generateCandidates()` in `difficultyEngine.ts`,
covered per-letter for all 26 against the real bundle plus synthetic-source unit tests
(the real dictionary cannot produce a letter with exactly two candidates on demand).

> **Bug found and fixed: the computer could play a word shorter than the minimum.**
> `MIN_WORD_LENGTH` (PRD §8.3) was only ever enforced in the *rule engine*, which
> validates **player** input — nothing constrained the computer's own move, and the
> dictionary carries **240 computer-playable words under three letters** (`a`, `ax`, `be`
> …). WL-108 is the first task where the computer picks a word, so this is where it
> surfaced; generation now filters on length. Every letter still has candidates
> afterwards (sparsest is `x` at 34), so no letter becomes a dead end.
>
> While fixing it: `MIN_WORD_LENGTH` was declared **four times** — in `gameConstants.ts`
> (exported, unused) and re-declared locally in `ruleEngine`, `scoringEngine` and the new
> code. PRD §8.3 calls the value "recommended", i.e. tunable, so four copies would have
> drifted the moment anyone tuned it. All three now import the shared constant.

**Score component definitions are this implementation's, not the docs'.** Architecture §6
and PRD §10 give the formula and the per-difficulty weights, but of the five terms only
`option_reduction_score` is defined anywhere. The rest are defined in the
`difficultyEngine.ts` module docblock and flagged there as such. Two findings that matter
for WL-605's tuning pass:

1. **`obscurity_penalty` is inert as a binary flag.** The computer draws only from the
   computer-playable tier, which already excludes obscure words outright — so
   "is it obscure" is always false and w4 (0.5 on Easy and Hard) multiplies zero. It is
   implemented as a graded hinge on the commonness tier instead, so it discriminates
   within the band that actually occurs.
2. **The model has fewer free parameters than it looks.** `commonness_score` and
   `obscurity_penalty` both derive from the same frequency tier and so cannot be tuned
   independently. `difficulty_score` deliberately uses **word length** rather than rarity;
   defining it as rarity would have made it a linear restatement of `commonness_score`,
   collapsing three of the five terms onto one signal.

*Measured* (worst-case letter `s`, 9,986 candidates, 26-word chain, generation + selection):

| | Budget (WL-106) | iOS | Android |
|---|---|---|---|
| Candidate generation + selection | ≤ 50ms | 26–**36**ms | 23–**47**ms |

> **Thinner margin than WL-105, and worth watching.** Android's 47ms is a first-run
> JIT-warmup spike against a 50ms budget, on an emulator faster than the physical WL-005
> devices; steady state is 23–25ms. WL-106's 19ms figure is not comparable — it ran with an
> **empty** chain and before the full five-term scoring existed. Re-measure on real
> hardware at WL-310. If a physical device misses, the available win is avoiding the ~25k
> intermediate object allocations per turn (a `DictionaryWord` per record decoded, then a
> `CandidateWord` per survivor), not the reply-count work.
>
> The used-word histograms in `generateCandidates` exist for the same reason: both the
> reply count and the repetition term otherwise walk the chain per candidate, which is
> O(candidates × chain) — invisible on the empty chain WL-106 measured, ~260k operations
> on the 26-word chain measured here.

**WL-109 · Difficulty selection strategies** — M · 1.5d · WL-108 — **DONE 2026-08-19**
Implement the three selection methods from Architecture §6 that ranking alone doesn't
cover: Easy = random from top candidates; Medium = weighted random from top 3–5; Hard =
top-ranked with occasional second-best. Seedable RNG so tests are deterministic.
*Done when:* over 1000 simulated turns per difficulty, selection distributions match the
spec, and Hard never picks a word outside the top 2. ✅ — all three asserted over 1,000
seeded turns each, including the Hard top-2 guarantee.

Pool sizes are `SELECTION_POOL_SIZE` (easy 10 / medium 5 / hard 2) and Hard's second-best
rate is `HARD_SECOND_BEST_CHANCE` (0.15) — Architecture §6 says "occasional" without a
number, so that constant is a WL-605 tuning input, not a fixed truth. `createSeededRandom`
is a mulberry32 PRNG; the seedable source is what makes a *distribution* testable at all
without either flaky thresholds or mocking a global.

> **Doc contradiction, resolved in favour of the Architecture doc — flagged, not silently
> picked.** PRD §10's Easy algorithm says to "choose one randomly" from *all* valid
> candidates; Architecture §6 says "random pick from **top** candidates". These differ
> sharply: **23% of computer-playable words sit in the uncommon tiers (60/65)**, so uniform
> selection over everything would have Easy playing less familiar vocabulary than Medium or
> Hard — inverting the difficulty it is named for — and would make Easy's
> `w2_commonness = 1.0` weight meaningless, since the score would never be consulted.
> Architecture's reading is implemented. If Product prefers the PRD reading, the fix is one
> constant, but the weights table should change with it.

**Ties are broken by a random key, reversing WL-106's deterministic tie-break on purpose.**
Easy's weights give every common word an identical score, so list-order tie-breaking would
have the computer play the same alphabetically-first word every single game. Each candidate
that could make the cut draws a random key and is compared on `(score, key)`, which yields
a uniform sample of the tied group. The WL-106 test that pinned "earliest candidate wins on
a tie" was replaced rather than worked around — that behaviour was correct only while
selection was "always top-ranked".

Selection stays a **bounded insertion buffer, not a sort**, per WL-106's finding: one pass,
each candidate scored exactly once, an allocation only for the few that make the cut, and a
cheap score-only reject before spending a random draw.

*Measured* (worst-case letter `s`, 9,986 candidates, 26-word chain, generation + selection):

| Difficulty | Budget | iOS | Android |
|---|---|---|---|
| Easy (largest pool, most ties) | ≤ 50ms | 26–**31**ms | 23–**32**ms |
| Medium | ≤ 50ms | 22–31ms | 23–28ms |
| Hard | ≤ 50ms | 23–27ms | 21–29ms |

No regression against WL-108 — its 47ms Android figure was a cold-JIT first-run spike, and
these run with the runtime already warm. Easy is measured explicitly because it is the
worst case for the tie-breaking path, not because it is the most expensive to score.

**WL-110 · Game session state machine** — L · 2d · WL-107, WL-109 — **DONE 2026-08-19**
Own the 7 `TurnPhase` values and the 5 `GameStatus` values already declared in
`types/game.ts`. Detect both no-valid-move conditions (PRD §24 "Game ending") and
dictionary exhaustion (draw).
*Done when:* transitions are exhaustively tested, including player-has-no-move,
computer-has-no-move, draw, and a deliberate (not accidental) answer for technical
failure. ✅ — `src/features/game/gameSession.ts`, 24 tests. Both unions are asserted
*reachable*, not merely declared: one test walks a turn cycle touching all seven
`TurnPhase` values, another collects all six `GameStatus` values.

**The technical-failure question is decided: `technical_failure` was added to
`GameStatus`.** The Data Model doc (§6) asked for this to be settled once, in whichever of
WL-110 or WL-308 reached it first. Wireframe §14 requires five result states against a
union offering four, so the fifth was being absorbed into whichever status was nearest —
telling the player "you exited" when the app had actually broken, and hiding real failures
inside an ordinary-looking metric. It is reachable rather than hypothetical: a corrupt
packed asset throws during index construction (WL-105), and Wireframe §17 specifies a
"dictionary unavailable" state. **WL-308 renders this state and must not re-decide it.**

**The machine is pure and synchronous** — every transition takes the facts it needs as
arguments and never calls the dictionary or the engines itself. The transient phases
(`validating`, `computer_thinking`) exist so the UI can *render* them, which is impossible
if a transition awaits the work internally; and endings that are rare or unreachable
through the real dictionary still have to be testable. Turn *timing* — minimum think delay,
timeout path — stays with WL-306.

**How a round ends** (PRD §24 requires detecting both no-move conditions):

| Situation | Status |
|---|---|
| Player's turn, no reply exists for the required letter | `computer_win` |
| Computer has no candidate, but the player would have had a reply | `player_win` |
| Neither side can move from the required letter | `draw` |
| Player leaves the round | `abandoned` |
| Something broke | `technical_failure` |

The first row is load-bearing rather than an edge case: blocking the player is precisely
what `option_reduction_score` exists to do, so it is the computer's main route to winning,
and PRD §9.4's 20–40% player-win target on Hard is only reachable that way. `draw` stays
distinct from `player_win` because the computer draws from a *subset* of what the player
may submit — a stuck computer usually means a human could have continued, so only an empty
player set means the dictionary genuinely ran out (Wireframe §14's "draw or exhausted
dictionary").

Two smaller decisions worth knowing:

- **The starting word is seeded into the chain as the computer's opening move**, not held
  alongside it. `usedWords` reads the chain, so keeping the opener outside it would let
  either side replay it later in the round without the duplicate rule (PRD §8.4) ever
  seeing it.
- **Transitions are inert once a round is over, except `failSession`.** A late tap or a
  queued computer move is an ordinary race in a UI with async turns, not a programming
  error, and must not resurrect a finished round or overwrite its result. A technical
  failure is the deliberate exception: a build that breaks after a round ended should not
  look healthy in the metrics.

**WL-111 · Wire rarity bonus into scoring** — S · 0.5d · WL-102, WL-110 — **DONE 2026-08-26**
Feed the commonness tier into the existing `rarity_bonus` (0 / +5 / +10 per Architecture
§7). Add round-level bonuses (+20 win, +5 per personal-best milestone).
*Done when:* scoring tests cover all three rarity tiers, the hint penalties (−5 / −10), and
the length-bonus cap of 20. ✅ — `__tests__/scoringEngine.test.ts` (24 tests), plus five
session-level tests confirming the round-end bonus actually reaches `session.score`.

**`rarity` is derived from `isCommonWord` / `isObscure`, not from a fourth tier
threshold.** Those two booleans already encode the pipeline's cutoffs (common ≤ 50,
obscure ≥ 70), so a private copy in the scoring engine would drift the moment WL-605
retunes them. Worth knowing that `rare` maps to `isObscure`: obscure words remain
*player*-submittable (PRD §8.7 constrains only the computer), which is exactly the "rare
but allowed" band Architecture §7 prices — so **the computer can never earn this bonus**,
by construction rather than by a rule.

**The dictionary entry is now carried out of validation** (`ValidationResult.entry`,
non-null only on a valid word) rather than looked up a second time for scoring. The
lookup has already happened by then; repeating it per turn would be pure waste.

**Two judgement calls, flagged rather than assumed:**

1. **Architecture §7 governs the formula, not PRD §16.** They disagree — §16 gives
   `length_bonus = word_length - 3` with no multiplier and no cap, §7 gives
   `(word_length - 3) × 2` capped at 20. The shipped code has followed §7 since the
   engine was first written, and this task's own "Done when" cites §7's numbers, so §7 is
   treated as the ratified version and §16 as the earlier sketch. **Not silently
   resolved — if Product intended §16, this is the moment to say so**, since WL-605 will
   otherwise tune §7's shape.
2. **"+5 per personal-best chain-length milestone" (§7) is ambiguous** and was read as
   *once per round that sets a new best*, not as a recurring award every N words. The
   alternative reading (a milestone every 5 or 10 words) would need a threshold nobody has
   specified. Implemented as `roundEndBonus()`, a single function, so the other reading is
   a one-place change if WL-605 prefers it.

**Scope boundaries this task deliberately did not cross:**

- **The personal-best baseline is a session field, not a live profile read.**
  `previousBestChainLength` is copied in at `createSession` (Data Model §4.1, updated).
  `null` — no profile loaded — is distinct from a real best of `0`: an unknown baseline
  awards nothing, a genuine first round beats zero and earns the milestone. **Every
  session runs with `null` until WL-402 supplies the real value**, so the milestone bonus
  is implemented and tested but cannot yet fire in the app. Stated plainly rather than
  left to look finished.
- **Only settled rounds pay out.** `player_win` / `computer_win` / `draw` are eligible;
  `abandoned` and `technical_failure` award nothing — an abandonment is not an
  achievement, and a build that breaks must not read as a generous one in the metrics.
- **Hint penalties are unreachable in the app**, since nothing can set them until the
  hint sheet exists (WL-307). Covered by tests; wired as `false` at the call site.
- **The computer's moves still score 0.** `session.score` is the player's score, which is
  what the game screen labels it.

> **Observation for WL-605, not a defect:** ESDB's tier granularity puts some
> intuitively-rare words in the `common` band — `quixotic` and `zwieback` both come out
> tier ≤ 50. The rarity bonus will therefore fire less often than the three-band split
> suggests. Worth measuring against real play before assuming the 0/+5/+10 spread is
> doing any work.

**WL-112 · Starting-word selection** — S · 0.5d · WL-108 — **DONE 2026-08-26**
Pick starting words that don't hand the player an immediately dead letter, and vary them
across rounds so replays don't feel identical.
*Done when:* 100 generated starting words all leave ≥20 valid player replies, with no
repeat inside any 10-round window. ✅ — `src/features/game/startingWord.ts`, 20 tests,
both criteria asserted against the real bundled dictionary rather than a fixture.

`GameScreen` no longer opens every round on the hardcoded `apple`. Selection draws a
**first letter** before a word, rather than sampling across the whole dictionary: it
enumerates one letter's records instead of 26 (WL-106 measured a single worst-case letter
at ~10ms, so the alternative would put a visible stall on the round-start path), and it
makes the opening letter itself vary. Measured at ~0.7ms per selection.

**The ≥20-replies criterion never fires against real data, and that is worth recording
rather than quietly passing.** The thinnest letter in the bundle (`x`) still offers 115
player replies, so every candidate clears the bar by 5×. The guard is kept — a criterion
verified to never fire is a different and better position than one never checked — but it
should not be read as evidence that dead-letter openings were a live risk.

**Two filters beyond the plan's wording are the implementation's own**, both stated as
tunable constants and both fair game for WL-605:

1. **Top frequency tier only** (`frequencyScore === 1`, ESDB tier 35), not the whole
   common band. Primarily first-impression quality — this tier reads as `cabbage`,
   `eagle`, `machine`, `zebra`.
2. **A length band of 3–8**, since Wireframe §7 teaches the rule with
   `apple → elephant → table` and a fourteen-letter opener sets a worse expectation. The
   cap applies *only* to the opening word; the computer's ordinary moves are unchanged,
   which is why a round can still run `clip → planet → thermodynamics`.

**A second variety axis was needed, and the acceptance criterion does not capture it.**
Distinct starting words are not the same thing as distinct openings: English inflection
concentrates word endings so hard that **28.5% of the eligible pool ends in `s`**, and
`s`/`d`/`g`/`e` together cover 64% of it (`-s`, `-ed`, `-ing` forms are all top-tier).
Selecting on the word alone passed the stated criterion while producing
`snmllsddeggdyssggsxs` over twenty rounds — every word different, `s` six times. Since
Design System §6 makes the required letter the single largest element on the game screen,
that is the part of an opening a player actually registers. Selection now also avoids the
last **3** rounds' required letters (`RECENT_REQUIRED_LETTERS_WINDOW`), as a preference
that yields rather than a rule, so a thin letter whose whole pool shares one ending still
produces a word. Same 20 rounds afterwards: `deksgydetklsdglsroydrgepdlrgsh`.

*Verified on an iPhone 17 Pro simulator*, four consecutive rounds opening `YARNS`/`CLIP`/
`JUMPS`/`MATRIX` — required letters S, P, S, X — and a full round played through
(`clip → planet → thermodynamics`, scoring 16 for `planet`, which is WL-111's formula
reaching the screen).

> **Finding for WL-103, surfaced here rather than fixed here: the proper-noun tagging gap
> is materially wider than that task recorded.** WL-103 named `robert`/`nike`/`pepsi` as
> words ESDB left with a blank `POS-CLASS`. Enumerating the computer-playable set for this
> task turned up many more — `xerxes`, `qaddafi`, `aachen`, `zappa`, `xemacs`, `aaliyah`,
> `honda`, `toyota`, `amazon`, `oscar` — all currently `isAllowed` **and**
> `isComputerPlayable`, meaning the computer can play them as ordinary moves today, not
> only as openings. WL-112's tier-35 filter happens to exclude every one of them (they all
> sit at tier 50 or 60), but that is a **side effect protecting the single most visible
> word in the round, not a repair**. The gap itself is upstream, in the pipeline, and
> unaddressed. Note that the words which *survive* the tier-35 filter — `victor`, `olive`,
> `ruby`, `daisy`, `martin` — are all genuine common words that PRD §8.5 says must stay
> playable, so they are correct, not leaks. Capitalization evidence is not recoverable at
> runtime: the packed asset carries only three flag bits (tier, proper-noun, offensive),
> so any real fix has to happen in `scripts/generate-dictionary.py` and be re-bundled.
>
> **Also for WL-605:** inflected forms make perfectly ordinary but slightly awkward
> openers (`quirking`, `ebbing`, `loping`, `goatees` all appear). Filtering to base forms
> is not possible today — `baseWord` is unpopulated upstream, as `dictionaryService`
> already notes — so it would need the same pipeline pass.

**WL-113 · Headless round simulator** — M · 1.5d · WL-110, WL-111 — **DONE 2026-08-26**
A CLI harness that plays complete rounds. This is the tuning instrument for Architecture
§6 and §7, and the fastest way to catch a broken Hard mode before it reaches a player.
*Done when:* `npm run simulate -- --difficulty hard --rounds 500` reports win rate, mean
chain length, mean score, and dead-letter frequency. ✅ — `src/features/game/roundSimulator.ts`
(logic, typechecked and unit-tested) plus `scripts/simulate.js`/`scripts/simulateCli.ts` (CLI
glue, plain JS/untyped like `audit-gate.mjs`, registered through the project's own
`babel.config.js` via `@babel/register` rather than a second alias config). 12 tests; full
suite 229 passing.

Reuses the real engines throughout — `gameSession`, `ruleEngine`, `difficultyEngine`,
`scoringEngine`, `startingWord` — rather than a parallel model of the rules, so it fails the
same way the shipped app would. The simulated player (no PRD spec exists for one; this is a
dev-tooling need the plan itself invented) is a deliberately weak baseline: uniform random
pick from every word `validateMove` would accept for the required letter, run back through
the real `validateMove` before being applied so any drift between this module's own
filtering and the rule engine fails loudly rather than silently miscounting.

**Two findings, both bigger than the task that found them:**

1. **Natural rounds run for hundreds to thousands of turns, not "tens of words."** Seeded,
   30 rounds per difficulty against the real dictionary: Easy averages ~6,250 chain length
   (100% player win), Medium ~1,140 (3% player win), Hard ~910 (0% player win, seed- and
   sample-dependent — a 500-round run at a different seed read 3.6%). The dictionary is
   simply too large (~140k player-allowed words) for genuine, whole-pool exhaustion to be a
   short-round event, which means the state machine's win/loss/draw conditions — the only
   ending this simulator or the shipped app can reach — are very unlikely to be what ends a
   *real* round. A real player almost certainly abandons long before any letter's pool
   genuinely runs dry. Worth knowing before reading too much into PRD §9.4's targets: they
   describe an ending condition the implementation can reach, but real play may rarely
   produce.
2. **Hard reads 0–4% player win rate against this player model — the exact "Hard sits at
   0–5%" case the Phase 1 gate below was written to catch.** The extremes match
   `option_reduction_score`'s own logic exactly: Easy (zero weight on it) resolves to the
   *computer* running out first almost every time; Medium and Hard (0.5 and 1.0 weight)
   invert that almost completely. Whether this means Hard is genuinely over-tuned or that a
   uniform-random, no-strategy player is too weak a baseline to read Hard fairly (most
   likely some of both) is exactly what WL-605 exists to determine — not adjudicated here.
3. **A latent, real correctness gap, found rather than fixed.** `replyCountForLetter`'s
   precomputed totals (WL-106) don't exclude words under `MIN_WORD_LENGTH` — the same gap
   WL-108 found and fixed for the computer's own candidate generation, but never patched on
   this side, since doing so means re-deriving the bundled asset. WL-106's own review of this
   checked only the round-*start* case and found it never fires there; that check was
   incomplete, not wrong — once a round runs long enough (per finding 1, routinely) for a
   letter's longer words to be genuinely exhausted, what's left can be entirely sub-3-letter
   entries the count still treats as available. Measured: fired on 29/30 Medium rounds and
   30/30 Hard rounds in the same run. This module falls back to ending the round when it
   happens (the objectively correct call — no real submission could satisfy the length rule
   either), but **the shipped `GameScreen`/`gameSession` have no equivalent fallback** — they
   would read the phantom nonzero count as "the player can still move" and simply wait,
   leaving a genuinely, correctly stuck player in a round the app never recognizes as over.
   Flagged for a fix against `scripts/generate-dictionary.py`'s `reply_counts_by_letter`
   (WL-106), not addressed here.

> **Phase 1 gate:** the simulator reports a plausible win-rate spread across the three
> difficulties (Easy clearly player-favoured, Hard 20–40% per section 2). If Hard sits at
> 0–5%, retune the §6 weights *now* — not after real players have abandoned it. This is the
> PRD §9.4 risk, caught cheaply. **Triggered on the first real run** — Hard measured 0–4%,
> not 20–40%. Per finding 2 above, this is exactly the signal the gate exists to catch;
> WL-605 (gated on this task) is where it gets acted on, informed by whichever of "Hard is
> over-tuned" or "the simulated player needs to be less weak" (or both) further
> investigation points to.

---

### Phase 2 — Design system in code

Goal: a component vocabulary that makes Phase 3 assembly rather than invention. Can run
partly in parallel with Phase 1 — different skills, no shared files.

**WL-201 · Font selection, licensing, and bundling** — M · 1.5d · D-06 — **DONE 2026-08-26**
Select and license the display and monospace faces. Bundle and verify rendering on both
platforms. **D-06 closed 2026-08-26 — `Baloo 2` + `JetBrains Mono`, both OFL, licence
verified to permit mobile bundling** (Design System §2). This task is now bundling and
on-device verification, not selection.
*Done when:* both faces render on device at every size in the §2 type scale, including
64px display and 12px mono, with the licence recorded. ✅ — verified on an iPhone 17 Pro
simulator **and** a `Medium_Phone_API_36.1` emulator, every one of the seven §2 roles, via
`src/screens/FontSpecimen/FontSpecimenScreen.tsx` — **since WL-206, the gallery's Type tab
(`src/screens/Gallery/sections/TypographySection.tsx`)**.

**Four static cuts bundled** (`src/assets/fonts/`), 1.21MB total: `Baloo2-ExtraBold` (349KB),
`Baloo2-Bold` (348KB), `JetBrainsMono-Bold` (271KB), `JetBrainsMono-Regular` (267KB).
Pinned versions, matching how the dictionary pinned ESDB: Baloo 2 from
`yanone/Baloo2-Variable` @ `da523dfa` (the commit Google Fonts itself pins), JetBrains Mono
from release `v2.304`. Full OFL texts committed at `licenses/fonts/`. **Neither font
declares a Reserved Font Name**, so modification (e.g. subsetting) would not require
renaming.

> **§2 said "Black/900", a weight Baloo 2 does not have — corrected to ExtraBold/800.**
> Its variable weight axis is **400–800**; the static cuts stop at ExtraBold. Confirmed from
> two independent sources (Google Fonts' `METADATA.pb` axis range and the upstream static
> set). **This changes nothing about the D-06 decision**: the specimen Baloo 2 won on
> rendered it at 800 throughout, so 800 is the weight actually evaluated. The "900" was
> aspirational text written before any face was chosen. Flagged rather than silently
> amended, per `CLAUDE.md`. Reverting to a true 900 means reopening D-06 — not faux-bolding,
> which smears an already-heavy face at 64px.

**Static cuts, not the variable fonts.** Both faces publish upstream as variable fonts, and
that is what Google Fonts serves. React Native exposes no way to select a point on a
variable axis — there is no `fontVariationSettings` equivalent — so a bundled variable font
renders only its default instance (400), and *every heavier role would have silently come
out Regular*. Statics are the only option that renders the specified weights at all.

**Three findings that will bite anyone touching fonts again, all recorded in
`src/theme/typography.ts`:**

1. **Every filename matches its font's internal PostScript name, deliberately.** iOS
   resolves `fontFamily` by PostScript name; Android resolves it by asset filename. Making
   the two identical is what lets one string work on both platforms.
2. **Never pair these with `fontWeight`.** The face already carries its weight; adding
   `fontWeight` asks Android to synthesise a *second* layer of boldness and makes iOS
   resolve to a different family member. Asserted by a test.
3. **RN font resolution fails silently** — a misnamed family, an unlinked file, or a
   PostScript mismatch all render the platform default with no error, no warning, no red
   box. A screenshot of correctly-sized text proves nothing on its own. Hence both guards
   below.

**Two gates added, both in CI:**

- `npm run fonts:verify` (`scripts/verify-fonts.js`, no dependencies) walks the whole chain:
  declared family → file exists → **the PostScript name inside the TTF** (parsed from the
  sfnt `name` table directly) → Android assets → iOS `UIAppFonts` → Xcode Resources phase →
  **no dangling pbxproj UUIDs**. That last check is not paranoia: WL-003 corrupted this
  exact project file with a scripted edit that left a build-phase UUID pointing at nothing,
  and `react-native-asset` rewrites the same file. Negative-tested by renaming a font so its
  filename and internal name diverged; it failed and named the real internal name.
- `__tests__/typography.test.ts` asserts the §2 rules that are easy to break by eye — no
  display face below 20px, monospace never on the required letter, the required letter is
  the single largest role, no `fontWeight` anywhere.

> **The verification screen was wrong twice before it was right, and both bugs are worth
> knowing.** It detects fallback by rendering each face and the platform default and
> comparing measured widths. First version hid the probes in a `height: 0` +
> `overflow: 'hidden'` container — every probe laid out at **0pt**, so all four faces
> compared "equal" to the system font and it reported a fallback on a build whose fonts were
> rendering perfectly. Second version used a single probe string, and Baloo2-ExtraBold at
> 20px measured 153pt — *exactly* San Francisco's 153pt — a coincidental collision that
> failed a correctly-loaded face. It now uses **three** probe strings with different glyph
> mixes and treats a face as loaded if it differs on any of them. Both bugs were caught only
> by looking at the screenshot and disbelieving the banner; a green result would have been
> taken at face value.

> **Same physical-device caveat as WL-105/WL-106:** verified on a simulator and an emulator,
> not the WL-005 matrix's physical iPhone SE / small Android handset. Font *rendering* is far
> less host-sensitive than the timing budgets those tasks measured, but the 64px callout and
> 12px captions on a genuinely small screen belong in the WL-310 device pass.

> **For WL-203, not a defect:** both faces ship non-Latin coverage this app cannot use —
> Baloo 2 carries Devanagari, JetBrains Mono carries Cyrillic and Greek (per each font's
> `METADATA.pb` subsets). Subsetting to Latin would reclaim a meaningful share of the 1.21MB,
> and the absent Reserved Font Names mean it is legally straightforward. Not done here: it
> adds a `fonttools` build dependency, and 1.21MB against WL-105's 8MB budget (currently
> 1.74MB used) does not justify it yet. Revisit if bundle size gets tight.

**Also landed:** `src/theme/typography.ts` (the faces plus the §2 type scale), and a dev-only
`FontSpecimen` route registered behind `__DEV__` so it cannot reach a release build
(absorbed into the WL-206 gallery).
**WL-206's component gallery should absorb that screen rather than duplicating it.**

**WL-202 · Contrast-verify the palette** — S · 1d · none — **DONE 2026-08-26**
Design System §9 open item 2: run every actual text-on-fill pairing through a contrast
checker at WCAG AA (4.5:1 body, 3:1 large). Amend the doc's hex values where a pairing
fails.
*Done when:* a committed pairing matrix shows a pass for every combination used, and the
Design System doc is updated with any changed hexes. ✅ —
`proj-docs/WordLoop_Contrast_Matrix.md`, 27 text pairings and 7 non-text pairings, all
passing.

**No hex value changed — the palette passes as designed.** That is the headline result:
the audit did not force the maximalist palette back toward neutral, which was the risk
Design System §1 was worried about. What it produced instead was three corrections and a
rule, none of which touch a colour value:

1. **A mandatory text colour per fill.** §1 said text is "either `paper` or `ink`" without
   saying which, per fill — an underspecification, not a defect, but one that would have
   been resolved per-component by whoever built it first. Measurement settles it:
   **`grape` is the only fill dark enough to carry `paper` text; every other accent takes
   `ink`.** `paper` on `sunbeam` is 1.34:1 and on `limeade` 1.38:1 — the two that would
   have looked most plausible in a mockup are the two that fail hardest.
2. **§5's valid-move border flash was a real WCAG 1.4.11 failure.** Flashing the input
   *border* to `limeade` replaced the `ink` outline with a colour at **1.38:1 against
   `paper`**, so the field lost its visible boundary at the moment it confirmed success.
   Now flashes the **fill** instead, keeping the `ink` border (17.27:1) as the boundary and
   putting the success colour where it reads (`ink` on `limeade` is 12.56:1). The error
   state is deliberately *not* changed to match — `red-alert` measures 3.42:1 and clears
   1.4.11 as a border on its own, so the resulting asymmetry is measured, not sloppy.
3. **The disabled primary button needed an `ink` label.** A 40%-opacity `grape` fill
   composites to ~`#CBABEB`, against which the inherited `paper` label is **1.86:1**.
   WCAG 1.4.3 *exempts* inactive controls, so this was legal — but Wireframe §8 disables
   Submit whenever the input is empty, which is the state **every turn opens in**, making
   it one of the most-viewed elements in the product. Fixed rather than excused.

> **Finding worth carrying into WL-204: the "always an `ink` outline" rule is load-bearing
> for accessibility, not just for the aesthetic.** `sunbeam` (1.34:1) and `tangerine`
> (2.66:1) are too close to `paper` to form a visible boundary against the page on their
> own, and never have to be, because §4 mandates a 2-4px `ink` border on everything.
> Dropping that border on a badge or callout for visual reasons would create a genuine AA
> failure, not merely an off-style component. Anyone tempted to build a borderless variant
> should read this row first.

**Mechanically:** the hexes now live in `src/theme/palette.ts` as the single source of
truth (WL-203 will build the rest of the token layer on it rather than restating it —
`MIN_WORD_LENGTH`'s four copies at WL-108 are the precedent being avoided). The verifier
*derives* the legal-text-colour table from the hexes and fails if `TEXT_ON` disagrees, so
the rule cannot rot away from the values it came from. `npm run contrast:verify -- --check`
is a CI gate and also fails on a stale committed matrix, so a palette change cannot land
without its verified matrix landing with it. All three guards were negative-tested
(lightened `ink`, falsified `TEXT_ON`, staled the matrix) rather than assumed to work.

> **Scope note:** §4's Cards permit a "`paper` or a light tint fill" — *light tint* is
> undefined, so it could not be verified. WL-203 must either define it as a concrete token
> (and add it to the matrix) or drop the phrase.

**WL-203 · Token layer** — M · 1.5d · WL-201, WL-202, D-05 — **DONE 2026-08-27**
Replace the placeholder `theme.ts` with real tokens: colours, type scale, 4px spacing
scale, radii (20 / 16 / 999), border weights (2–4px), offset-shadow specs, rotation
range. **D-05 closed 2026-08-26 — light-mode tokens only, no dark variant.**
*Done when:* no screen or component references a raw hex, px font size, or shadow value —
a lint rule enforces this. ✅ — `src/theme/theme.ts` composes `palette.ts` (WL-202) and
`typography.ts` (WL-201) rather than restating them, and adds spacing, radii, border
weights, shadows and rotation. Verified on an iPhone 17 Pro simulator and a
`Medium_Phone_API_36.1` emulator via a new dev-only `TokenSpecimen` screen — **since
WL-206, the gallery's Tokens tab**.

**The lint rule is six `no-restricted-syntax` selectors**, scoped to `src/screens/**` and
`src/components/**` (the theme directory is where these literals belong): raw hex, raw
colour keywords (`'white'` — with `transparent` exempted, since it is the absence of a
colour), raw `fontSize`, raw `fontFamily`, the legacy `shadow*`/`elevation` props, and
inline `boxShadow` arrays. Selectors rather than a custom plugin, which would mean a new
package and its own tests to express six AST patterns. **Negative-tested** — a probe file
with one violation of each produced exactly six errors and let `transparent` through.
Migration was small because no raw hex existed anywhere; only `GameScreen` and `HintSheet`
carried raw font sizes.

**Two values the doc left undefined, both resolved and both flagged rather than silently
filled in:**

1. **`shadow-ink` "at fixed opacity" → 1.0, fully opaque.** The palette's own rules decide
   it: `ink` at any lower opacity composites over `paper` to a **grey** (0.85 lands on
   `#39352F`), and §1 states "Grays are excluded from this palette entirely" — so any
   translucency manufactures the one colour family the palette bans. It also softens the
   shadow edge, the same failure §8 rejects blur for.
2. **Cards' "light tint fill" → removed.** No tint was ever specified, so nothing could be
   contrast-checked, and WL-202 flagged it as the one fill its matrix could not cover. It
   was also *narrower and vaguer* than §4's own construction block, which already permits
   "one saturated color from section 1, or `paper`" for every component. Cards now follow
   that rule, so every legal card fill is already verified with its mandatory text colour.

> **The design system depends on New Architecture, and this is where that becomes load-bearing.**
> §4 mandates "hard offset shadow, no blur" and §8 rejects blurred shadows outright. The
> legacy RN shadow props cannot express that on Android at all: `shadowColor`/`shadowOffset`/
> `shadowRadius` are iOS-only, and `elevation` draws a Material *blurred* shadow whose offset
> and colour are not controllable. `boxShadow` (RN 0.86, Fabric — `OutsetBoxShadowDrawable` on
> Android, `RCTBoxShadow` on iOS) is the only route, and it takes an explicit `blurRadius: 0`.
> **Turning off `newArchEnabled` would silently drop every shadow in the app rather than
> failing loudly.** The specimen screen renders each hard shadow beside a deliberately blurred
> control precisely so this cannot regress unnoticed — verified visually distinct on both
> platforms.

> **A real bug the specimen caught, and the process failure underneath it.** The disabled
> button was first implemented with `opacity: 0.4` on the container — which fades the `ink`
> border §4 says a disabled control must *keep*, and fades the label too, landing nowhere near
> the 9.30:1 WL-202 measured. It still looked like a plausible disabled button. The root cause
> was not the CSS: **WL-202's matrix had verified a colour the app could not produce**, because
> `verify-contrast.js` composited its own private copy of the disabled fill and exported
> nothing. `palette.ts` now exports `composite()` and `disabledFill`, and the verifier measures
> *those* values — so "verified" and "shipped" are the same bytes. The regenerated matrix is
> byte-identical, confirming the refactor changed the source of the numbers, not the numbers.

**Tests:** `__tests__/theme.test.ts` (14) asserts the §3/§4 rules that are cheap to state and
expensive to notice breaking — every shadow has `blurRadius: 0`, shadows use `shadow-ink` and
escalate badge → control → primary → card → modal, spacing is all multiples of 4, radii are
exactly the three named values, border weights stay within 2–4px with a 4px floor for modals,
and `disabledFill` is a composite rather than the raw accent. The no-blur assertion was
negative-tested. Suite: 248 passing.

> **Scope held deliberately:** `GameScreen` has only its required-letter callout tokenised —
> the one element §6 and Wireframe §8 both constrain. The rest of that screen stays unstyled
> skeleton, because **WL-301 owns the game screen layout** and restyling it here would be
> inventing that design a phase early. Same for `HintSheet`, which gets tokens but not its
> real hint levels (WL-307) or the Button component it should be built from (WL-204).

**WL-204 · Core component set** — L · 3d · WL-203 — **DONE 2026-08-27**
Per Design System §4, every component carrying **both** halves of the hybrid — thick `ink`
border and hard offset shadow **and** rounded puffy geometry: Button (primary / secondary
/ disabled, with the press-into-shadow state from §4), Card (with permitted rotation),
Input (focus → `grape` border, error → `red-alert` border **plus** icon and text), Badge/
sticker (pill, rotated 3–6°), BottomSheet/Modal (10–12px offset shadow).
*Done when:* each component renders every specified state, disabled buttons drop the
shadow entirely, and no component uses a blurred shadow. ✅ — all five in
`src/components/common/`, every state rendered and checked on an iPhone 17 Pro simulator
and a `Medium_Phone_API_36.1` emulator via the `TokenSpecimen` screen (**since WL-206, the
gallery's Components tab**).

**The design goal was to make the rules unrepresentable rather than documented.** Three
things a caller now cannot express:

1. **A failing colour pairing.** Components take a *fill*, never a text colour, and derive
   the label through the new `textOn()` helper, which reads the WL-202 contrast matrix.
   There is no prop that can put `paper` on `tangerine` (2.66:1). The single rule anyone
   needs — *grape is the only fill dark enough for paper text* — is now enforced rather
   than remembered.
2. **A borderless variant.** WL-202 found the `ink` outline is load-bearing for WCAG
   1.4.11, so it is not configurable on any component.
3. **A blurred shadow.** Shadows come only from `shadow.*` tokens, all asserted
   `blurRadius: 0`.

**`TEXT_ON` order is now significant and gated.** `textOn()` renders the head of each list,
so the order *is* what ships. `verify-contrast.js` now derives those lists ranked by
descending contrast and compares them **in order** rather than as sets — reshuffling the
preference would otherwise change every component's text colour without changing a single
ratio. Only `grape`'s large-text entry reordered (`paper` 5.32:1 ahead of `ink` 3.25:1).

**One new palette token, contrast-verified: `ink-muted`** (`#736E67`, `ink` at 60% over
`paper`, 4.72:1). §1 defined no placeholder colour and the conventional answer looked
banned — "Grays are excluded from this palette entirely". Resolved rather than assumed:
§1's objection is to cool grey neutrals *as a base*, and this is not a new hue but `ink`
composited over `paper`, so it inherits the palette's warmth and moves if either parent is
retuned. The alternative is worse for accessibility — a full-`ink` placeholder is
indistinguishable from a real value. 60% is the lowest alpha still clearing 4.5:1.

> **Also added, and flagged as this implementation's choice rather than the doc's: a modal
> scrim** (`ink` at 45%). §4 specifies a heavier shadow to make a sheet read as elevated but
> says nothing about the surface behind it, and a sheet over an undimmed page leaves the
> screen beneath looking live and tappable. Excluded from the contrast matrix because
> nothing is read against it — the sheet sits on opaque `paper`. **The exact alpha wants a
> design opinion.**

**Details worth knowing, each a decision rather than a default:**

- **Disabled *secondary* has no distinct fill, and that is §4's own answer.** `paper` at 40%
  over a `paper` page is still `paper`. §4 makes the dropped shadow the signal — "reads as
  flat, reinforcing non-interactivity without relying on color alone" — and
  `accessibilityState` carries it to assistive tech regardless.
- **Badge tilt is derived from the label, not random.** §0 wants intentional imperfection,
  but `Math.random()` at render time would re-roll the angle on every state change, so a
  streak badge would visibly jump each time the number ticked up — a glitch, not character.
  A hash of the label gives stable-per-badge, varied-across-badges.
- **Card rotation is opt-in and clamped** to §3's −2..3, so a plausible-looking
  `rotation={15}` cannot ship. §4's rule that cards holding inputs or primary controls must
  never rotate cannot be enforced by a component that cannot inspect its children — that
  judgement stays with the caller, where the information is.
- **Input carries three error signals, not one** — `red-alert` border, a marker, and the
  message — per the no-colour-only-meaning rule. The message is announced via
  `role="alert"` and an assertive live region, which is Wireframe §18's "accessible error
  announcements": without it a screen-reader user submits a word, hears nothing, and cannot
  tell why the round did not advance. The marker is typographic, not from an icon library —
  §7 rejects stock icon sets and WL-207 owns the custom set.
- **`MIN_TAP_TARGET` is 48**, satisfying both iOS HIG (44) and Android Material (48) with
  one number.
- **`BottomSheet` has no entry animation, deliberately.** §4 calls for a spring, but §5 owns
  motion and that is **WL-205**, which must also supply the reduced-motion equivalent.
  `animationType="none"` is set explicitly so the absence reads as a decision.

**`HintSheet` was rebuilt on `BottomSheet` + `Button`** rather than left restating those
styles — the first real consumer, which is what proved the API.

> **No component-rendering test library was added, and that is a deliberate non-decision to
> flag.** The project has no precedent for rendered-tree tests — the README states the
> feature-based structure exists specifically to keep logic "unit-testable without a
> rendered component tree" — and **WL-206 is the project's own chosen mechanism** for
> catching component regressions. Adding `@testing-library/react-native` is a real
> dependency call that belongs with WL-206, not smuggled in here. What *is* tested is the
> pure invariant that makes the component API safe: `__tests__/theme.test.ts` now covers
> `textOn` across every fill (21 tests in that file; suite 255).

**WL-205 · Motion primitives with reduced-motion fallbacks** — M · 1.5d · WL-204 — **DONE 2026-08-27**
Per Design System §5: scale-punch, colour flash, spring modal entry, horizontal shake,
3-dot typographic thinking indicator. **Every one needs a non-animated equivalent that
still communicates the state change.** No particle effects or confetti — explicitly
rejected in §5.
*Done when:* with OS reduced-motion enabled, every state change is still legible, verified
by a checklist walkthrough. ✅ — see the walkthrough below.

All five in `src/components/common/motion/`, driven by `useReducedMotion()`
(`src/hooks/`) with timings in `src/theme/motion.ts`. Built on React Native's own
`Animated` — **no animation library added**; §5's effects are a scale, an opacity, a
translate and a colour, and Reanimated would be a native dependency and a second build
surface to serve that.

### The reduced-motion checklist walkthrough

Run on an iPhone 17 Pro simulator and a `Medium_Phone_API_36.1` emulator, toggling the OS
setting **while the app stayed open** in both directions. The gallery (WL-206) shows the live
state in a banner pinned to the top of the screen, so every screenshot records which mode
it was taken in.

| Effect | Full motion | Reduced motion | Still legible? |
|---|---|---|---|
| Scale-punch (streak) | 1.0 → 1.15 → 1.0, 200ms | No scale; 100ms opacity dip to 0.6 | ✅ the number itself updates either way |
| Colour flash (valid move) | Eased fill flash to `limeade` | **Still flashes**, but switches instantly | ✅ colour *is* the signal here, so it is kept |
| Spring scale-in (modal, chain stamp) | Spring from 0.9 | Instant appearance | ✅ the element appearing is the state change |
| Horizontal shake (invalid word) | 3 cycles, ±6pt | **Nothing** | ✅ border, marker, message and live-region announcement all persist |
| Thinking dots | Staggered 3-dot pulse | Dots hold static at full opacity | ✅ carried by the required accompanying text |

**The live toggle is the part worth having checked.** A one-shot read at mount would leave
the app animating until the next cold start — which is exactly the wrong behaviour for
someone who reaches for that setting *because* motion has started making them unwell
mid-round. Verified in both directions on both platforms: iOS via the
`reduceMotionChanged` subscription, Android via RN's `ContentObserver` on
`TRANSITION_ANIMATION_SCALE` (which is what `isReduceMotionEnabled` actually reads there —
Android has no separate "reduce motion" flag, it is the "Remove animations" setting).

**Two fallbacks that are not "turn it off", and are the interesting ones:**

1. **The colour flash still flashes under reduced motion.** Unlike the punch and the shake,
   the *colour* is the signal rather than decoration on top of one — suppressing it would
   remove information from the very users the rule exists to protect. What is removed is
   the animated transition: it switches instantly, holds, and switches back. Reduced motion
   targets movement and vestibular triggers, not colour; WCAG 2.3.1's flashing threshold is
   three or more flashes per second, and this is a single brief change well under it that
   is never the sole carrier of the state.
2. **The shake's fallback is genuinely nothing, and that is complete rather than lazy.** §5
   says "no shake, border flash only" *and* gives the reason: "the shake must never be the
   only signal, since the error text already carries the meaning". WL-204's `Input` carries
   four independent signals permanently — `red-alert` border, marker, message, assertive
   live region — so there is nothing left to substitute. Wrapping something whose error
   signal is *not* independently carried would be a misuse of that primitive, and its
   docblock says so.

**Smaller decisions worth knowing:**

- **`ThinkingDots` requires accompanying text**, unlike the other primitives. Static dots
  alone are ambiguous — they read equally as a truncation — so the component is one
  accessibility node with `accessibilityRole="progressbar"` and a label, which is the one
  thing a static row of full stops cannot say on its own.
- **Effects fire on a `trigger` value changing, not through an imperative ref.** The
  animation is then a consequence of state and cannot drift out of sync with what is
  rendered. Every primitive skips its first render — mounting is not an increment, and
  badges jumping on a freshly-opened screen would read as a fault.
- **Badge tilt, `SpringIn`'s starting scale, and every loop are stopped on unmount.** An
  `Animated.loop` that outlives its component runs forever; the thinking indicator unmounts
  the instant the computer's turn ends.
- **`ColorFlash` cannot use the native driver**, because `backgroundColor` is neither a
  transform nor an opacity. Acceptable for a short flash that never runs alongside a
  gesture; anything longer-running should prefer opacity or transform.
- **`BottomSheet`'s spring entry — the debt WL-204 deliberately left — is paid.** `Modal`'s
  own `animationType` stays `"none"` so the platform slide and the spring do not compound
  into two separate entrances, and the scrim sits outside the spring so dimming arrives
  with the sheet rather than scaling with it.

> **Timings remain untuned, and the token file says so.** Design System §9 open item 4
> records that "motion timing values (200ms, spring parameters, etc.) are first-pass
> suggestions, not tuned against an actual build". Only the figures §5 states outright —
> the 1.15 punch, ~200ms, the 100ms reduced flash — come from the doc and are asserted in
> `__tests__/motion.test.ts` (9 tests). The rest are flagged in `motion.ts` as this
> implementation's, and are deliberately **not** pinned by tests, so that a real tuning pass
> does not read as a regression. **§9 item 4 stays open** — tuning wants someone watching
> the app on a device, which is a design review or WL-605, not a guess made while writing
> the primitives.

**WL-206 · Component gallery screen** — S · 1d · WL-204, WL-205 — **DONE 2026-08-27**
A dev-only screen rendering every component in every state. Cheap, and it's how design
reviews and visual regressions actually get caught.
*Done when:* reachable in dev builds and covering all WL-204 and WL-205 output. ✅ —
`src/screens/Gallery/`, four tabbed sections, reached from a `__DEV__`-only row on Home.

**"Reachable" was the requirement the previous specimen screens quietly failed.** Both
were registered in the navigator, but nothing linked to them — the only way in was to edit
`initialRouteName`, which is exactly how a dev tool becomes one nobody opens. There is now
a single entry point: a dev-only row at the bottom of Home. The route itself is also
`__DEV__`-gated in `RootNavigator`, so this cannot decay into a dead link in a release
build.

**Tabbed, not one long scroll.** The single-file specimen had grown past 500 lines across
four concerns, and finding a section meant scrolling past three others and regularly
overshooting — which defeats the stated purpose, since a gallery nobody can navigate is a
gallery nobody checks. Sections: **Tokens** (WL-203, including the hard-vs-blurred shadow
control), **Components** (every WL-204 component in every §4 state), **Motion** (every
WL-205 primitive with triggers), **Type** (the WL-201 font instrument). The header —
including the reduced-motion banner — stays pinned above the scroll, so every screenshot
of any section records which motion mode it was taken in.

**Both earlier specimen screens are absorbed and deleted**, as WL-201 and WL-204 each said
they should be. `FontSpecimen` became the Type section; its narrow lint exemption moved
with it and is now scoped to that one file rather than a whole directory — every other
section is styled from the tokens, which is what lets the gallery break when the token
layer does.

> **One duplicate removed on the way through.** The tokens section carried a hand-rolled
> "button states" block built from raw views. It predated the real `Button` (WL-204) and had
> become a second button implementation that would drift — and, being hand-rolled, would
> drift *silently* while still looking plausible. Deleted; the Components section shows the
> real component.

**The gallery is styled by the system it displays** — tabs use `palette`, `shadow` and
`textOn` like any other surface, including the selected/unselected raised-vs-flat treatment
§4 gives buttons. That is deliberate: chrome exempt from the design system would keep
looking fine while the tokens underneath it broke.

> **Decision: no component-rendering test library, and this was the task to decide it in
> (flagged by WL-204).** The reasoning against, rather than an absence of one:
> snapshot-testing styled components catches *structural* churn, not the visual regressions
> a design system actually suffers, and snapshots over token-driven styles are notoriously
> noisy — every spacing tweak churns them, which trains people to run `-u` without reading.
> Meanwhile the failure modes that matter here are already gated by machinery that does not
> depend on rendering: a blurred shadow fails `__tests__/theme.test.ts`, a failing colour
> pairing fails `npm run contrast:verify`, a raw value fails lint, a missing font fails
> `npm run fonts:verify`. What is left — does it *look* right — is what this gallery is
> for, and what the Delivery Plan already called "how design reviews and visual regressions
> actually get caught". Revisit if component *logic* grows (a component with real branching
> would deserve tests, and would want extracting rather than snapshotting).

> **Verified on an iPhone 17 Pro simulator only, and that is a deliberate proportionality
> call rather than an omission.** All four tabs were walked through from a cold launch via
> Welcome → Home → Gallery. Android was not re-run for this task: the gallery is
> **dev-only and never ships**, and everything it displays — tokens, components, motion
> primitives, fonts — was verified on `Medium_Phone_API_36.1` under WL-203, WL-204 and
> WL-205. The only genuinely new surface here is a tab bar built from already-verified
> tokens.

**WL-207 · Custom iconography** — M · 2d · WL-203 — **DONE 2026-08-27**
Design System §7 rejects Material/Feather-style line icons. Needs a small custom set
(settings, back, pause, hint, close, sound, haptics) at 3–4px single-weight strokes
matching component border weight.
*Done when:* every icon in the app is from this set; no stock icon library is a dependency.
✅ — `src/components/common/icons/Icon.tsx`, eight glyphs, verified on an iPhone 17 Pro
simulator via the gallery's Components tab.

**Drawn from Views, not SVG — and §7's own wording is the reason.** It does not ask for
illustration; it asks for strokes *"matching the border weight used on components (3-4px)"*.
Built from Views, these icons literally use `borderWidth.base` and `palette`, the same
tokens the components do, so "matching" is enforced rather than eyeballed — an SVG would
hard-code a stroke width that silently stops matching the day the border scale is retuned.
Every glyph is bars, rings, arcs and one triangle, which is what Views draw cleanly, so
this is not a case of contorting a design to dodge a dependency. It also avoids adding
`react-native-svg` — a native dependency with a pod install, a Gradle surface and a CI
native-build risk — for eight glyphs.

> **The escape hatch is documented in the file, not left implicit:** if the set ever needs
> organic or illustrative shapes (§7 also contemplates illustration for empty states), that
> is the point to add `react-native-svg`, not to keep torturing Views. Callers use
> `<Icon name=… />` and never see the implementation, so nothing here makes that harder.
> `__tests__/icons.test.ts` asserts the *current* absence of an SVG renderer, so adding one
> becomes a deliberate change with a reason attached rather than something that arrives
> alongside an unrelated package.

**An eighth icon beyond §7's list, flagged rather than slipped in: `alert`.** §4's Input
error state requires "an icon/text label" beside the message, and WL-204 shipped a
typographic `!` as an acknowledged placeholder pending this task. §7's list reads as
illustrative ("a small custom set") rather than exhaustive, so this is an addition, not a
contradiction — but it is the one icon the doc's own list was missing for a component that
already shipped.

**Everything replaced:** `⚙` on Home, `←` and `⏸` on Game, and Input's typographic `!`.
Icon-only controls now carry their own `accessibilityLabel` and the glyphs are hidden from
assistive tech — a gear is only "Settings" in context, and exposing each glyph as its own
focusable node would add unlabelled stops to the traversal order. Game's pause glyph is
deliberately *not* wrapped in a `Pressable`: WL-404 builds the Pause screen, and advertising
a tap target that does nothing is worse than showing none.

**"Every icon in the app is from this set" is now enforced, not just done once.** Two
`no-restricted-syntax` selectors reject pictographic emoji in `JSXText` and string literals
across screens and components. Arrows (`→`) are deliberately *not* on the list because they
appear in real prose — negative-tested with a probe file containing four emoji icons and one
line of arrow prose: four errors, prose untouched. This also catches a second problem, which
is that emoji render as tofu boxes wherever the platform lacks the glyph — the `⚙` and the
gallery's own `🎨` were both doing exactly that on the simulator.

> **Two things the on-device pass changed, both found by looking rather than by a test.**
> `hint` first tapered its base bars (neck wider than base), which is backwards for a bulb
> and made the glyph read closer to a ♀ symbol than a light; the threads are now equal-width
> and clearly below. And Input's error marker initially kept WL-204's filled red badge
> *around* the new `alert` glyph — which has its own ring — producing two concentric rings
> at 20pt that read as mud. The badge is gone; the glyph is drawn in `red-alert` directly,
> a pairing the contrast matrix already covers as a non-text row ("Input ERROR border +
> error icon", 3.42:1, clearing 1.4.11's 3:1 for a graphical object).

**`ICON_NAMES` is a runtime value, not only a type**, so the gallery iterates the whole set
rather than listing it by hand — a new glyph appears for review automatically and cannot be
added without being seen. Stroke weight scales with the box (floor `borderWidth.base`,
`size / 8` above that), because a 3px stroke in a 48pt box reads as spindly; "single-weight"
means every icon shares one weight at a given size, not that weight never responds to size.
Checked at 16/24/48pt in the gallery.

> **iOS-only verification, same proportionality call as WL-206** — the glyphs are Views
> using already-Android-verified tokens, and the gallery that displays them is dev-only.

---

### Phase 3 — Playable core loop → **M1**

> **The game screen was minimally wired to the engine on 2026-08-19**, ahead of this
> phase, because the engine was complete (WL-107 through WL-110) while the screen still
> carried a `TODO` where the computer's turn belonged — so the app looked broken to
> anyone playing it: your own word came back relabelled "Computer" and no reply ever
> came. `GameScreen` now holds a `GameSessionState` and drives
> generate → select → apply, so a full round alternates turns and reaches its end states.
> Verified on the simulator: `apple → eagle → envied → dragons → subdivision`.
>
> This is wiring only, not this phase's work. The layout, the seven Wireframe §9 states,
> the chain display, the hint sheet and the game-over screen are still WL-301 through
> WL-308 and still gated on the design system. ~~Per-word scoring still reads 0 until
> WL-111, and the starting word is still fixed until WL-112.~~ **Both closed:** scoring
> reaches the screen as of WL-111, and rounds no longer open on the hardcoded `apple` as
> of WL-112.

Goal: the thing the whole product rests on. Wireframe §21 says design the game screen
first; the same applies to building it.

**WL-301 · Game screen layout** — L · 2.5d · WL-204, WL-110 — **DONE 2026-08-28**
All Wireframe §8 required elements. The required-letter callout is the single largest
element on screen (64px display, `bubblegum`, heaviest shadow, never rotated, always
accompanied by its text label) per Design System §6.
*Done when:* the callout is verifiably the largest text element, and the layout holds on
the smallest device in the WL-005 matrix.

> **DONE 2026-08-28.** `GameScreen.tsx` composes the real WL-204/205/207 component set
> (`Card`, `Button`, `Input`, `Badge`, `Icon`, `ThinkingDots`) in place of the bare RN
> primitives it launched with — no new components needed. The required-letter card uses
> `shadow.modal` (11px) rather than the default `Card` shadow (7px) to satisfy "heaviest
> shadow on the screen," applied locally via the existing `style` prop rather than adding
> a shadow prop to `Card` for one caller. Verified on the iPhone SE (3rd gen) simulator
> (375×667, the smallest device in the WL-005 matrix): a full turn — submit, computer
> reply, chain update, invalid-word error — renders with the required letter unmistakably
> the largest element and no clipping/overlap, keyboard included. This is layout only;
> WL-302's seven individually-verified states, WL-303's keyboard-avoidance/input work,
> WL-305's animated no-reflow chain, WL-306's tuned timing, and WL-308's full 5-state
> game-over screen are still open — today's round-over branch is a single restyled
> message, not that.

**WL-302 · The seven game-screen states** — L · 2d · WL-301 — **DONE 2026-08-28**
Wireframe §9: player turn, input empty, validating, computer thinking, invalid word, valid
move, no computer move. Each has specific input/submit/message behaviour.
*Done when:* all seven are individually reachable and each matches its §9 spec exactly.

> **DONE 2026-08-28.** Auditing `GameScreen.tsx` against §9 line by line found two of the
> seven phases the WL-110 state machine already computes were never actually painted:
> `valid_move` (`applyValidation` sets it on every valid submission, but `handleSubmit`
> built and rendered `computer_thinking` in the same breath, so React batched past it —
> the same class of bug WL-301 had already fixed once for `computer_thinking` itself) and
> `no_computer_move` (`endRound` reuses this phase value for *every* round ending, not
> specifically the "computer had no word" scenario §9 describes — that's actually
> `status === 'player_win' || 'draw'` per `gameSession.ts`'s own status-mapping table).
> Fixed: `handleSubmit` now paints `valid_move` via a new `VALID_MOVE_DISPLAY_MS` (200ms,
> named distinctly from `COMPUTER_THINK_MS` — it makes the state observable, it is not
> WL-306's turn pacing) before proceeding; a new round-over branch keyed on
> `player_win`/`draw` renders §9's exact copy ("The computer has no valid word.") plus a
> "Finish Round" button (placeholder → Home, pending WL-308's real 3-action screen). Also
> added the missing `validating` message ("Checking word…") and a Submit label swap
> ("Checking…") — no spinner, since Design System §5 reserves the dots-pulse specifically
> for the computer-thinking state. `input_empty`'s message requirement turned out to
> already be satisfied by `Input`'s placeholder (only visible exactly when the field is
> empty) — documented in a comment rather than duplicated as a second element.
> Visually verified on the iPhone SE (3rd gen) simulator: `player_turn`, `input_empty`, and
> `invalid_word` directly screenshotted; the full `valid_move → computer_thinking` cycle
> confirmed correct end-to-end across 12+ real turns (chain/score/letter all advance
> correctly every time, which the code could not do without `valid_move` actually being
> painted and applied). `no_computer_move` was **not** reached through manual play — every
> rare-letter chase (X, Y) turned up a deeper computer-playable pool than expected (e.g.
> X alone: xenophobic, xamarin, xenophobia, xerography) — so that branch is verified by
> code review and by reusing the exact `Card`+`Button` pattern already proven working
> elsewhere in this file, not by direct visual reproduction. Flagged rather than hidden:
> WL-310's full device pass will exercise many more rounds and should hit it for real.
> Also noticed in passing, not chased: `xamarin` (a product name) came back
> computer-playable — likely the same POS-CLASS-blank data-tagging gap WL-103 already
> documented for `robert`/`nike`/`pepsi`.

**WL-303 · Input behaviour** — M · 1.5d · WL-301 — **DONE 2026-08-28**

> **Observed 2026-08-19 while play-testing the wired game screen:** the controlled
> `TextInput` can desync from React state under fast input — the native field showed
> "Dragon" while state still held "D", so a six-letter word was rejected as `too_short`.
> Reproduced twice on the iOS simulator, and it predates the WL-108/109/110 wiring. Most
> likely an artifact of the simulator injecting keystrokes faster than a human types
> (adding any pause made it disappear), but controlled-`TextInput` character loss is a
> real React Native failure mode, so **verify this on a physical device before assuming
> it is only a harness artifact.** If it reproduces, the fix is to read the submitted
> value from the change event rather than from state.
Wireframe §8: autofocus on turn start, keyboard submit, submit disabled while empty, trim
spaces, case-insensitive, submission blocked while the computer responds. Plus keyboard
avoidance — §19 requires input and Submit to stay visible above the keyboard.
*Done when:* every bullet is verified on both platforms with the keyboard open, on a small
phone.

> **DONE 2026-08-28, with the device-matrix half of "Done when" explicitly still owed to
> WL-310** — same posture as WL-105/106/108's perf numbers. `Input.tsx` now forwards a ref
> (`React.forwardRef`, purely additive, no existing caller broke). `GameScreen` uses it to
> refocus on every `input_empty` transition — not just mount — which is genuinely "turn
> start" per the WL-110 machine (set at round start and after every computer move), fixing
> the fact the old mount-only `autoFocus` prop went stale after turn one. `onSubmitEditing`
> + `returnKeyType="done"` wire the keyboard's return key to `handleSubmit`. Trim and
> case-folding needed no screen-level change — both already happen in
> `ruleEngine.normalizeWord`. Keyboard avoidance: `KeyboardAvoidingView` wraps the
> `ScrollView` only (header stays fixed), `behavior="padding"` on iOS only — Android already
> sets `windowSoftInputMode="adjustResize"` in the manifest, so pairing both would
> double-offset the content, which is why `undefined` there is correct and not a gap.
>
> **The prescribed fix, applied exactly:** a `latestInputRef`, updated synchronously inside
> `onChangeText` alongside the existing `setInput`, is what `handleSubmit` now reads for
> the empty-check and everything actually validated — `input` (state) stays authoritative
> only for what render needs (`value`, `submitDisabled`). Verified working end-to-end:
> `onSubmitEditing` submission, turn-start refocus without an extra tap, and the ordinary
> Submit-button path all confirmed correct across several real turns on the iPhone SE (3rd
> gen) simulator.
>
> **A distinct artifact surfaced while chasing the original bug, worth recording precisely
> so it isn't conflated with it later:** submitting via a fast `text+"\n"` injection
> occasionally delivered one fewer character than typed (`"splendid"` → field held
> `"Splendi"`) — but critically, the *native field itself* showed the short version too, not
> just React state. That's the opposite signature from the 2026-08-19 report (native field
> **ahead of** state) — here the final keystroke's `onChangeText` plausibly never fired
> before the immediately-following injected Return triggered `onSubmitEditing`, so state and
> the new ref were equally correct (equally short) for what they'd actually been told. A
> clean re-test of `"splendid"` with no trailing Return delivered all 8 characters correctly.
> This reads as a testing-tool injection-speed artifact adjacent to the original report, not
> a reproduction of it — but it's exactly the kind of platform/timing nuance a physical
> device is needed to settle, so WL-310 should specifically try fast real typing immediately
> followed by the keyboard's own return key, not just automated injection.
>
> **Not independently re-verified on Android** this session (no emulator was booted) —
> `adjustResize` was confirmed present in the manifest by inspection, not by watching it
> work. Both the Android pass and the physical-device keyboard/desync checks are WL-310's,
> per the pattern already established for the WL-105/106/108 budgets and the WL-001/WL-005
> device matrix.

**WL-304 · Invalid-word feedback** — M · 1.5d · WL-302, WL-107 — **DONE 2026-08-28**
All 7 rows of the Wireframe §10 message table, with the exact copy. Input retains the
submitted word so the player can edit rather than retype. No internal dictionary detail
leaks into the message.
*Done when:* each of the 7 reasons produces its specified message and the player can
recover from every one.

> **DONE 2026-08-28 — audit only, no code changes needed.** Byte-level diff of
> `gameConstants.ts`'s `INVALID_WORD_MESSAGES` against Wireframe §10's table (script, not
> eyeball) found all 7 already match exactly, including the curly-quote character in
> "this game's word list" — copied verbatim back when the rule engine shipped (WL-107).
> The recovery mechanism (`Input` retains the submitted word, error clears and Submit
> re-enables once `busy` clears) is the same code path for all 7 reasons, already proven
> generically in WL-301/WL-303. "No dictionary detail leaks" holds — every message is a
> fixed string, none echo an internal reason code or dictionary term.
>
> **6 of 7 reasons directly triggered and screenshotted on the iPhone SE simulator this
> session** (`too_short`, `unsupported_symbols`, `proper_noun`, `offensive_excluded` now;
> `wrong_letter`, `unknown_word` were already hit incidentally during WL-301/302/303
> testing) — each showed its exact §10 copy and left the word editable. `offensive_excluded`
> needed a real excluded+dictionary-present word, found by decoding `dictionary.pack.json`'s
> flag bytes directly rather than guessing (`data/excluded-words.txt` has many single words
> that turn out not to be in ESDB at all, e.g. `dick`/`erotic`, and produce `unknown_word`
> instead — a real trap for manual testing, not a bug).
>
> **`duplicate` was not directly reached in the UI**, despite real effort: the turn
> structure means a player can only ever face the required letter the *computer's* last
> word ended in, never the letter their own last word ended in — so deliberately steering
> into a repeat isn't controllable, only lucky. Chased it two ways (a 30-move single round
> hand-picking endings toward already-used start letters, and ~10 fresh-round restarts
> hoping for a first-letter-equals-last-letter opener to immediately resubmit) without a
> hit. Confidence instead comes from `__tests__/ruleEngine.test.ts` (`rejects a duplicate
> word`, plus two tests confirming `duplicate` wins its precedence order over
> `unknown_word`) — deterministic coverage the UI attempt couldn't be — combined with the
> shared, already-proven recovery mechanism. Flagged rather than assumed: worth a specific
> look at WL-310's device pass, where 20 full rounds make a natural repeat far more likely.

**WL-305 · Chain display** — M · 1d · WL-301 — **DONE 2026-08-28**
Recent chain plus a "view previous words" expansion. New entries stamp in with a scale-in;
existing entries must not reflow or animate (Design System §5).
*Done when:* a 30-word chain renders without layout thrash and only the new entry animates.

> **DONE 2026-08-28.** The animation primitive already existed and was unused —
> `SpringIn` (WL-205) documents itself as built for exactly this ("the 'small scale-in'
> a valid word uses to stamp onto the chain display... wrapping each entry individually
> is what satisfies [the no-reflow constraint]"). The actual work was architectural: the
> WL-301 chain was one joined string in a single `<Text>`, which can't animate a single
> entry by construction. Replaced with a `flexDirection: row, flexWrap: wrap` row of
> individually-keyed entries (`key={move.moveId}`) plus static `→` separators; only the
> entry whose `moveId` matches `session.chain[chain.length - 1]` — the true newest move,
> not just whichever renders last — is wrapped in `SpringIn`. That distinction matters
> because "View previous words" toggles which entries render at all: keying to the array
> position instead of the actual latest move would have made expanding the view
> incorrectly animate whatever landed last. Since `SpringIn` animates on mount (not on
> prop change) and older entries never remount (stable key, stable wrapper type across
> renders), this needed no new animation logic — only the one already-built primitive,
> correctly targeted. Added a grouping `accessibilityLabel` on the row so a screen reader
> hears the chain as one phrase instead of N fragments, avoiding a regression from the
> old single-`Text` version (WL-408 owns the real accessibility pass, not this).
> Verified on the iPhone SE (3rd gen) simulator: multi-line wrapping is clean at 7 words,
> "View previous words" reveals all entries with no animation on the newly-shown ones,
> and toggling back doesn't re-animate anything already visible. The spring itself
> (~250-300ms) is too fast to reliably catch in a screenshot given this session's
> tool round-trip latency — correctness rests on the mount-based reasoning above, which
> is the same reasoning `SpringIn`'s own docblock already commits to, not a new claim.
> Didn't reach a real 30-word chain this session; the flex-wrap layout has no
> per-item measurement step regardless of count, so there's no structural reason it
> would thrash, but a literal 30-word visual check is left for WL-310's device pass.

**WL-306 · Computer turn orchestration** — M · 1.5d · WL-302, WL-109 — **DONE 2026-08-28**
Thinking state, a deliberate minimum think delay so instant responses don't feel
mechanical, and the Wireframe §17 timeout state ("taking longer than expected" with Try
Again / End Round).
*Done when:* the thinking indicator is always visible for the minimum duration, and the
timeout path is reachable and recoverable.

> **DONE 2026-08-28.** The minimum think delay (`COMPUTER_THINK_MS`, 350ms) already
> existed from WL-301 and needed no change — no doc gives a figure to tune it against,
> so real timing tuning stays WL-605's, same posture `theme/motion.ts` already takes for
> its own first-pass values. The real work was the timeout path, built from scratch:
> `GameScreen`'s computer-turn body (think delay → candidate generation → selection) was
> extracted into `runComputerTurn`, which `attemptComputerTurn` races against a new
> `COMPUTER_TURN_TIMEOUT_MS` (5000ms, explicitly untuned — no doc gives a number here
> either). If the timeout wins, `computerTimedOut` (screen-local `useState`, not a new
> `TurnPhase` — WL-302 already closed that union at seven values, and Wireframe §17
> states are explicitly outside it) shows "WordLoop is taking longer than expected." with
> Try Again (`attemptComputerTurn(session)` — while timed out, `session` is still exactly
> the `thinking` state from `beginComputerTurn`, so no extra ref was needed) and End Round
> (reuses the existing `abandonSession`, already handled by the WL-301/302 round-over
> rendering).
>
> **Can't fire during real play today, by design**: the computer's work is synchronous
> JS with no network or real async risk, and WL-108/109 measured it under 60ms worst-case
> on real hardware — same category as `technical_failure`, a safety net for a slower
> device or a future async dictionary lookup, not a response to an observed problem.
> Verified by the same pattern WL-003 used for crash-reporting (temporary instrumentation,
> confirmed working, then reverted — here, temporarily setting the constant to `1`):
> confirmed the exact §17 copy and both buttons render, **Try Again** re-enters cleanly
> (times out again immediately at that threshold, no error, no double-fire), and **End
> Round** reaches the existing `abandoned` round-over card with no leftover timeout UI
> underneath it — that last part needed an explicit `computerTimedOut` reset in the End
> Round handler, since `currentWordRow` renders unconditionally outside the `roundOver`
> branch and would otherwise show both at once. Constant confirmed back at `5000` before
> finishing; `git status`/diff show no leftover test value.
>
> **Doc overlap flagged, not silently resolved:** WL-506 (Phase 5) also lists "computer
> timeout" among its three Wireframe §17 states, with a vaguer "reachable in a test build"
> criterion. Given WL-306's own criterion is the more specific one (*reachable and
> recoverable* — i.e. actually built and working) and comes first, WL-506 should treat
> this state as already built and re-verify it alongside the other two, not rebuild it.

**WL-307 · Hint sheet, levels 1–3** — M · 1.5d · WL-204, WL-108 — **DONE 2026-08-28**
Wireframe §11 bottom sheet with hint levels 1–3 (required letter, count of available
common words, example word) — all servable from local data, no API. Level 4
(definition-based clue) is Phase 5. Per-round limit, and the §11 rule that a word is never
auto-revealed without the player explicitly choosing that level.
*Done when:* each level shows correct information, the limit is enforced, and the correct
hint penalty (−5 / −10) reaches the score.

> **DONE 2026-08-28.** This was a wiring task, not a build: `HintSheet.tsx` already existed
> from WL-204 on `BottomSheet`+`Button`, its own docblock naming exactly what was left
> ("Only level 1 + 3 are stubbed here... The remaining hint-level work is WL-307") — level 2
> (word count) was the one genuinely missing. Added it, plus `Move.hintLevel`
> (`Data_Model.md` §5 had this flagged as a real, already-ratified gap scoped to this task),
> a new `exampleWordForHint` in `dictionaryService.ts` (reuses the existing
> `computerPlayableEntriesStartingWith`, excludes already-used words, prefers common +
> highest-frequency), and a new `chargeHint` session transition (named to avoid `useHint` —
> a `use`-prefixed name collides with React's hooks-linter naming convention and broke
> `react-hooks/rules-of-hooks` when called from an event handler).
>
> **Real design decision made here, not stated in any doc:** the sheet reveals all three
> levels together as one hint, not as separately-costed tiers — matching the existing
> Wireframe §11 mockup and the `HintSheet` stub's own single `[Use Hint]` action. Confirmed
> by WL-504's own text (added *after* this): level 4 "applies the −5 penalty (not −10)" —
> if even the deepest level stays at −5, nothing in the 1-4 set triggers −10, so
> `hintRevealedWord` stays unreachable by this task, same as it was. The −10 tier most
> plausibly belongs to PRD §13's separately-listed "one-time skip," which no task currently
> builds — flagged, not decided here. Flow E's "hint limit reached → show message" branch
> is instead handled by disabling the Hint button, consistent with every other
> "unavailable" control in this screen (Submit, Try Again) rather than a one-off modal.
> Per-round limit (**3**, flat across difficulties) is an explicit inference — no doc gives
> a number, same posture as WL-306's `COMPUTER_TURN_TIMEOUT_MS`.
>
> Verified on the iPhone SE (3rd gen) simulator: all three levels show correct real data
> (word count and example both changed correctly across three different required letters);
> Cancel is a true no-op; Use Hint charges immediately (round counter increments, score
> unaffected) and the penalty lands on whichever word is submitted next — checked twice
> with different word lengths (13 and 22, both exactly 5 less than the un-hinted formula
> would give); the Hint button visibly disables after the third use in a round and ignores
> taps while disabled. **One thing verified by code reasoning only, not by direct UI
> reproduction:** a hint used, then an invalid submission, then a corrected valid one in the
> same turn should still charge the penalty exactly once — `hintUsedThisTurn` only resets on
> a genuine `phase → input_empty` transition, which an invalid submission never causes, so
> this holds by construction, but a clean manual repro was blocked by this session's
> text-input tooling (clearing a field with residual text kept appending rather than
> replacing — a recurring, already-documented simulator quirk, not an app bug). Worth a
> specific check at WL-310.
>
> Added focused unit coverage alongside the fix, per the existing convention for
> `features/` logic: `chargeHint` and the new `hintUsed`/`hintLevel` wiring in
> `__tests__/gameSession.test.ts`, `exampleWordForHint` in `__tests__/dictionaryService.test.ts`.

**WL-308 · Game-over screen** — M · 1.5d · WL-110, WL-204 — **DONE 2026-08-29**
Wireframe §14: all 5 result states (player win, computer win, draw/exhausted, player exit,
technical failure), score, words played, longest chain, and the three actions. Encouraging
rather than competitive tone per §14.
**The technical-failure question is already answered** — WL-110 added `technical_failure`
to `GameStatus` (2026-08-19). Render it; do not re-decide it, and do not introduce a
separate result vocabulary for it.
*Done when:* all 5 states render, and Play Again returns to difficulty selection with no
state leaking from the previous round.

> **DONE 2026-08-29.** Replaced the two-branch placeholder round-over rendering from
> WL-301/302 (`ROUND_OVER_MESSAGES` plus a single "Finish Round" button, both explicitly
> flagged at the time as WL-308's job to replace) with a real `GameOverPanel` component
> (`src/components/game/GameOverPanel.tsx`, sibling to `HintSheet`) and a `GAME_OVER_CONTENT`
> lookup in `gameConstants.ts` typed as `Record<Exclude<GameStatus, 'active'>, {...}>` — the
> compiler enforces all 5 statuses are covered, so a missing or renamed status fails
> `tsc`, not silently at runtime. **Not a new nav route** — `navigation/types.ts` already
> places `GameOver` as a child of `Game`, same tier as the `Hint` overlay, with no
> `RootStackParamList` entry; this renders in place exactly as the old branch did.
>
> **Two things worth flagging, not hiding:** (1) only "You Win!" is literal Wireframe §14
> copy — the other four headlines are this task's own writing, staying inside §14's
> "avoid overly competitive language" instruction (no "You Lose," neutral framing for
> `computer_win`/`abandoned`/`technical_failure`); descriptions reuse the already-reviewed
> WL-301/302 sentences where they fit. (2) "Words played" and "Longest chain" render the
> same `session.chain.length` value — not a duplication bug, a round's chain only ever
> grows until the round ends, and the Wireframe §14 mockup's own example shows them equal
> (18/18).
>
> Included both optional §14 extras that were already-tracked data: hints used
> (`session.hintsUsed`) and a personal-best indicator, gated on `previousBestChainLength`
> and the same settled-status set (`player_win`/`computer_win`/`draw`) that
> `scoringEngine.roundEndBonus` itself gates on, so it never claims a milestone the round
> didn't actually pay out. Skipped "new words discovered" and "most difficult letter" —
> both need new data/logic this task doesn't otherwise touch, out of scope for rendering
> the existing 5-state result.
>
> Verified on the iPhone SE (3rd gen) simulator via the same forced-timeout path WL-306
> used (`COMPUTER_TURN_TIMEOUT_MS` temporarily set to `1`, reverted to `5000` before
> finishing — confirmed via `git diff` that no temporary value remained): reached the
> `abandoned` state directly (submit a word, let the forced timeout fire, tap End Round),
> confirming the panel's headline, description, all four stats, and all three buttons
> render correctly. From there, confirmed all three actions: **Play Again** reaches
> Difficulty selection and a subsequent round starts genuinely fresh (chain reset to 1,
> score reset to 0, no state leaked from the previous round — `GameScreen`'s `useState`
> initializer calls `createSession` fresh on remount, so this held without extra cleanup
> code); **Review Words** reaches the existing stub `WordReviewScreen` without crashing
> (its content is out of scope, same posture as WL-307 leaving hint level 4 out of scope);
> **Home** returns to the Home screen correctly.
>
> **The other four result states (`player_win`, `computer_win`, `draw`,
> `technical_failure`) were not independently reached in the UI this task** — this phase
> already spent real, documented effort chasing `player_win`/`draw`/`duplicate` via manual
> play in WL-302/304 without success, and repeating that chase here for the same reason
> wasn't a good use of time. Their correctness rests on the same rendering code path just
> proven live for `abandoned`, plus `GAME_OVER_CONTENT`'s compiler-enforced exhaustiveness
> over `GameStatus` — disclosed here rather than claimed as freshly verified. Worth a
> specific check at WL-310's device pass, which plays enough full rounds that these
> statuses should occur naturally.
>
> `npx tsc --noEmit`, `npm run lint` (0 errors, same pre-existing warning set as WL-307),
> and `npm test` (14 suites, 276 tests) all pass. No new test file — consistent with every
> screen/game-component task this phase; the `Record` type on `GAME_OVER_CONTENT` is the
> main correctness guardrail for a content-lookup table like this.

**WL-309 · Difficulty selection wiring** — S · 1d · WL-204 — **DONE 2026-08-29**
Wireframe §6: Easy preselected, plain-language descriptions, selection persists into the
session.
*Done when:* the selected difficulty demonstrably drives the engine's selection strategy.

> **DONE 2026-08-29.** The functional wiring this task's "Done when" describes already
> existed before this task started: `DifficultyScreen`'s `selected` state defaulted to
> `'easy'` and was never `null`, so "Continue disabled until selected, unless Easy
> preselected" was already trivially satisfied; `Continue` already navigated with
> `{ difficulty: selected }`, and `GameScreen` already threaded that into both
> `createSession` and every `selectComputerWord` call; `difficultyEngine.ts`
> (`DIFFICULTY_WEIGHTS`, `SELECTION_POOL_SIZE`, `HARD_SECOND_BEST_CHANCE`) already
> implemented three genuinely different per-difficulty strategies, built and unit-tested
> at WL-108/109. No logic gap remained — flagged rather than inventing wiring work that
> wasn't there.
>
> **What this task actually did:** rebuilt `DifficultyScreen.tsx` from the original
> bare-primitive stub (`View`/`Text`/`Pressable`, no header, no back button — the same
> unstyled state `HomeScreen`/`HowToPlayScreen` are still in) into a real screen using the
> design-system components, since it's the direct predecessor to the already-restyled
> `GameScreen` and sits on the M1 critical path WL-310 exercises 20 times over. Added: a
> header row with a back button (`Icon name="back"` + `Pressable`, copied verbatim from
> `GameScreen.tsx`'s own header pattern — the navigator has `headerShown: false`
> everywhere, so every screen owns its header), a `typeScale.screenTitle` title, and three
> `Pressable`-wrapped `Card`s for the options. `Card` has no built-in selected state, so
> selection reads via `fill` (`sunbeam` selected / `paper` unselected — `sunbeam` reused
> deliberately from the same tone `Badge` already shows as the in-game difficulty tag) and
> shadow depth (full `shadow.card` selected, `shadow.control` unselected), **plus** a
> leading `●`/`○` glyph carried over from the original stub, so the state never reads by
> colour alone (Design System §4). `Home`/`HowToPlay`/`Settings` were deliberately left
> untouched — not in this task's WL-204-only dependency chain, restyling them would be
> scope creep.
>
> Verified on the iPhone SE (3rd gen) simulator: Easy renders preselected (sunbeam + ●);
> tapping Medium then Hard moves the indicator cleanly, previous selection correctly
> reverts to paper + ○; Continue from Hard opens `GameScreen` with the `HARD` badge shown
> (confirming the difficulty genuinely reached the session, not just the screen); submitted
> one word and watched the computer reply land on a scarce letter (Y), consistent with
> Hard's option-reduction-weighted strategy — re-confirming already-tested engine behaviour
> end-to-end through the UI, not new logic. Back correctly returns to Home.
>
> `npx tsc --noEmit`, `npm run lint` (0 errors, same pre-existing warning set as WL-308 —
> `DifficultyScreen` no longer appears in the inline-style warnings at all), and `npm test`
> (14 suites, 276 tests) all pass. No test file added — the screen is composition only
> (`CLAUDE.md`'s "screens stay thin" rule); the logic it drives already has its own
> coverage in `difficultyEngine.test.ts` and `gameSession.test.ts`.

**WL-310 · M1 device pass** — M · 1d · all Phase 3
Play 20 complete rounds across all three difficulties on physical iOS and Android.
*Done when:* 20 rounds complete with no crash, no stuck state, and no unreadable layout.

> **M1 gate:** a full round is playable on a real device. Anyone on the team can pick up a
> phone and finish a game. Also the point to start D-10 name clearance.

> **NOT DONE — physical-device requirement unmet, simulator/emulator pass only
> (2026-08-29).** This task explicitly asks for *physical* iOS and Android hardware — this
> environment has neither, only the iPhone SE (3rd gen) iOS Simulator and the
> `Medium_Phone_API_36.1` Android emulator. Marking this DONE from simulator/emulator
> evidence would misrepresent the gate: the M1 note itself is "anyone on the team can pick
> up a *phone*," and every perf budget this doc already deferred here (WL-105, WL-106,
> WL-108) was deferred specifically because simulators/emulators run on the host Mac's own
> CPU, not representative low-end hardware. This task stays open until someone runs it on
> real devices.
>
> **What this pass did cover, prompted by a request to specifically verify Android
> (previously unverified in any session — every prior Phase 3 visual check was iOS
> Simulator only):** built and installed a fresh Debug APK on the Android emulator
> (`JAVA_HOME` pointed at Android Studio's bundled JBR, `env-wordloop-android-java`'s
> already-documented requirement), then played through Welcome → Home → Difficulty → Game
> across 5 chained turns on Easy, with the keyboard opened, typed into, and dismissed
> repeatedly. Cross-checked against a fresh iOS Simulator pass over the same flow.
> Everything already built in Phase 3 renders and behaves identically on both: claymorphism
> shadows/borders (`boxShadow`, no blur) render correctly on Android — a real cross-platform
> risk given the design system's "hard offset shadow, no blur" requirement, not previously
> confirmed on Android in any prior task; `windowSoftInputMode="adjustResize"` correctly
> keeps Submit/Hint above the keyboard on Android (WL-303's Android-side claim, unverified
> until now); the 5-word chain wraps correctly (WL-305); turn orchestration, scoring, and
> the newly-styled Difficulty screen (WL-309) are all pixel-consistent with iOS. `adb
> logcat` showed no `FATAL`/`AndroidRuntime` crash across the whole session — only routine
> IME/system noise.
>
> **Not attempted this pass, left for the real device-pass:** 20 complete rounds (only
> partial rounds played — reaching game-over deliberately wasn't repeated here since WL-308
> already verified `GameOverPanel` thoroughly on iOS Simulator), Medium/Hard on Android
> specifically (only exercised on iOS this pass — Android's engine code path is identical,
> not platform-specific, so this is a low-risk gap, but it's still unexercised), and every
> other Phase 4+ concern (persistence, accessibility, orientation) this task's scope never
> covered anyway.

---

### Phase 4 — App shell, persistence, accessibility

**WL-401 · Navigation and back behaviour** — M · 1.5d · WL-308 — **DONE 2026-08-29**
Wireframe §2 structure. Android hardware back and iOS safe areas per §19. Confirmation
before any action that discards a round.
*Done when:* every screen's back behaviour is defined and correct on both platforms, and
Android back never silently destroys an in-progress game.

> **DONE 2026-08-29.** Three things were wrong, only one of which this task's title
> predicts.
>
> **1. Nothing guarded an in-progress round.** `GameScreen`'s back control called
> `navigation.goBack()` outright, and Android's hardware back and the iOS edge-swipe
> never touched that handler at all. The guard is `useConfirmBeforeLeave`
> (`src/hooks/`), built on React Navigation 7's `usePreventRemove`, which intercepts the
> *navigation action* rather than any one control — so the header button, the hardware
> button, the swipe gesture, and any future in-screen `goBack`/`popTo` are all covered
> by one guard. `usePreventRemove` specifically (not a bare `beforeRemove` listener) is
> what makes the iOS gesture stop: `native-stack` reads its prevented-route registry and
> sets `preventNativeDismiss`, so the platform never starts the dismissal. Confirming
> replays the exact held action, so back goes back and Home goes Home.
>
> What counts as "in progress" is `isRoundInProgress` (`gameSession.ts`, unit-tested):
> deliberately narrower than "not over" — a round the player hasn't moved in holds only
> the computer's opener, and confirming there would put a dialog in front of the Back
> button on a screen just opened, which is how confirmations stop being read.
>
> The dialog is `ConfirmSheet` (`components/common/`) on the existing `BottomSheet`,
> whose own docblock already named this task as the caller needing
> `dismissOnScrimPress={false}`. Not RN's `Alert`: that renders the platform dialog,
> which carries none of Design System §4's component language. Android back *inside* the
> dialog resolves to cancel, so back can't become a two-tap way to destroy the round.
> The destructive action is the `secondary` button and the safe one is primary — §4
> offers no destructive button fill (`red-alert` is for error text and input borders,
> not a fill in the WL-202 matrix), so emphasis is inverted rather than inventing a tone.
> Copy is in `gameConstants.ts` (`DISCARD_ROUND_CONFIRM`) with the other reviewed
> strings; §13 states the rule but gives no wording. WL-404's Pause reuses all of it.
>
> **2. Every backwards `navigate` was pushing a duplicate screen.** React Navigation 7
> only pops back to an existing route when told to (`popTo`); a plain `navigate` to a
> route that isn't the current one pushes. So Game Over's "Play Again" and "Home", and
> Word Review's "Back to Home", each grew the stack — three rounds left
> Home → Difficulty → Game → Difficulty → Game → … behind the player, with Android back
> walking backwards through every finished round. All three now use `popTo`, which is
> what makes §2's flat Home → Difficulty → Game structure actually flat.
>
> **3. Two screens had no back control at all.** With `headerShown: false` stack-wide,
> Settings and the dev Gallery could only be left by the invisible iOS edge swipe —
> Android's hardware back always worked, which is why the gap was easy to miss. Both now
> carry the same `Icon name="back"` control the other screens use. Settings' styling
> stays WL-407's.
>
> Per-screen back behaviour is now documented as a table in `RootNavigator`'s docblock,
> next to the stack it describes.
>
> **Verified on both platforms** (iPhone SE 3rd-gen simulator, `Medium_Phone_API_36.1`
> emulator — no physical hardware here, same limitation WL-310 is held open for).
> iOS: back on an untouched round leaves immediately (no dialog); after one played word,
> both the back control *and* the edge-swipe raise the confirmation without the screen
> moving; Keep Playing leaves the chain and score intact; Discard lands on Difficulty.
> Word Review → "Back to Home" lands on Home with nothing beneath it (edge-swipe does
> nothing), confirming `popTo` unwound rather than pushed. Settings' new control returns
> to Home. Android: hardware back mid-round raises the same dialog; a second hardware
> back *cancels* it with the round intact (chain and score unchanged); Discard lands on
> Difficulty; back from Difficulty reaches Home; back at Home exits to the launcher
> rather than returning to Welcome. `adb logcat` showed no `FATAL`/`AndroidRuntime`
> across the session.
>
> **Not covered here:** the discarded round isn't *recorded* anywhere — `abandonSession`
> would only write to state the screen is about to unmount. Once WL-402/403 persist a
> round, the confirm handler in `GameScreen` is the point that has to mark it
> `abandoned` before replaying the action, and the same point WL-602's "game abandoned"
> event belongs at. Marked in the code at that spot.

> **Defect found on-device 2026-08-18 (during WL-107 verification) — FIXED 2026-08-19.**
> No screen wrapped its content in a safe-area view, so on a notched device the first
> control on each screen rendered *underneath* the Dynamic Island and did not receive
> taps. Home's "Start Game" (the primary CTA, and the only route to Difficulty → Game)
> was unreachable, making the app effectively unplayable on modern iPhones while
> working normally on Android — which is exactly how it was reported by a user before
> this task was due to start.
>
> Fixed ahead of the rest of this task because it blocked all iOS use: `RootNavigator`
> now wraps the stack in a single `SafeAreaView`. Applied once at the navigator rather
> than per screen so no future screen can forget it — `headerShown: false` means
> nothing else insets the content. Verified on an iPhone 17 Pro simulator by walking
> Welcome → Difficulty → Game, the exact path that was broken.
>
> Still owned by this task: per-screen back behaviour, Android hardware back, and the
> confirmation-before-discard rule. WL-409 owns any screen that later wants to draw
> deliberately edge-to-edge. Separately, some skeleton buttons aren't wired to any
> handler yet (How to Play's "Got It" is a no-op) — expected at this stage, noted so
> it isn't mistaken for the same bug.

**WL-402 · Guest profile and local persistence** — M · 2d · WL-002 — **DONE 2026-08-29**
Persist the `GuestProfile` shape from the trigger policy doc: `guest_id`, `created_at`,
`last_active_at`, `games_played`, `local_scores`, `local_streak`, `discovered_words`,
`settings`. Created locally on first launch, no server call (Architecture §8.1, Guest
Deletion doc "best v1 approach").
*Done when:* profile survives cold start and app update; a fresh install creates a new
guest.

> **DONE 2026-08-29.** Three layers, split the way the rest of the codebase already
> splits: `features/profile/guestProfile.ts` is pure (create, record a round, reset,
> serialize, parse — every function takes `now`, same posture as `gameSession.ts` and
> `promptPolicy.ts`), `services/profile/profileRepository.ts` is the only thing that
> touches storage, and `store/useProfileStore.ts` is the only writer, applying a pure
> function and persisting the result so the in-memory and stored copies can't drift.
> Loaded once at launch from `App.tsx` — nothing is gated on it, so the game stays
> playable before it resolves.
>
> **The shape is documented as Data Model §2.1**, mirroring the §4.1 treatment
> `GameSessionState` already gets. Five deliberate differences from §2 are recorded
> there; the two that were real decisions rather than transcription:
>
> - **`local_streak` counts consecutive wins.** No doc defines a WordLoop streak.
>   Wireframe §5's "best streak **or** longest chain" rules out longest chain, and
>   Architecture §8.2 listing "returning on a new day" separately from "streak milestone"
>   rules out a day streak. Consecutive wins is what remains. **Flagged for WL-405**,
>   which displays it and may overrule.
> - **`local_scores` is capped at 100 rounds, with `bests` stored beside it.** §2 gives
>   `local_scores` no shape, and an uncapped array inside a value rewritten after every
>   round grows for the life of the install. Capping means a record can age out, so bests
>   are stored rather than derived — otherwise trimming would silently lower a player's
>   personal best.
>
> **Which rounds count** is the other rule worth stating: `gamesPlayed`, `bests` and the
> streak move only on a settled result, using the *same* `isSettledResult` gate as
> `roundEndBonus` — pulled out into one function here, since `GameOverPanel` had its own
> third copy of it. Three copies meant a bonus could be paid for a milestone the profile
> then refused to record. History and discovered words, by contrast, keep every finished
> round including abandoned ones.
>
> **Also wired, because they were this task's own loose ends:**
> - `GameScreen` reads `previousBestChainLength` from the profile at session creation —
>   the value WL-111 designed for and `createSession`'s docblock has been waiting on, so
>   the personal-best bonus can finally pay out. Read via `getState()`, not subscribed:
>   the baseline is defined as of session creation and must not move mid-round.
> - **WL-401's open item is closed.** Discarding a round now records it as `abandoned`
>   before the held navigation action is replayed. It lands in the history and keeps the
>   words found, but doesn't count as a game played, touch a best, or break the streak.
> - `useSettingsStore` was a standalone store whose own docblock said persistence "is not
>   yet wired up". It is now a view over the profile's `settings` field rather than a
>   second store — Data Model §2 makes settings part of `GuestProfile`, and the Guest
>   Deletion doc deletes them with it, so two stores would have needed to agree about
>   creation, reset, and deletion.
> - Home's Best Score / Best Streak read the profile instead of showing hardcoded `--`
>   (the TODO there asked for exactly this). Layout and Wireframe §17's empty state stay
>   WL-405's.
>
> **Verification.** 49 new unit tests across the pure module, the repository, and the
> store — including cold start, reinstall, the capped history, a best that has aged out
> of it, and tolerant parsing of a corrupt or older stored profile.
>
> On the iPhone SE simulator, read back from the app's actual MMKV file: a guest is
> created on first launch and keeps its id across a relaunch; `lastSeenAt` advances on
> launch while `lastActiveAt` stays at the last round; two rounds recorded newest-first
> with the right results and scores; discovered words accumulate across rounds without
> duplicates and exclude the computer's words; `gamesPlayed`/`bests`/`localStreak` all
> correctly stayed at zero because both rounds were abandoned.
>
> **What that on-device pass could not cover: a settled round.** Ending one by playing
> requires exhausting a letter, and the thinnest letter in the bundled dictionary (`x`)
> still offers the computer 34 candidates — not reachable by hand in a session. The
> settled path is covered by the store-level tests instead, which run a won round through
> the real store and storage adapter. Worth re-checking during WL-310's 20-round pass,
> where settled results happen naturally.
>
> **Flagged in passing, not fixed (dictionary quality, PRD §25 / WL-103 / WL-505):** the
> computer played `xiongnu` — a proper noun the filter did not catch — plus `xml` and
> `xmas`. Rare letters are where the word list is thinnest, so they are where its
> misclassifications surface first.

**WL-403 · In-progress game save and restore** — M · 1.5d · WL-402, WL-110 — **DONE 2026-08-29**
Wireframe §13 requires the chain to survive a temporary exit. Save after every turn;
restore on launch.
*Done when:* backgrounding, force-quitting, and OS-killing the app all restore the exact
round state including chain, score, and hints used.

> **DONE 2026-08-29.** Same three layers as WL-402:
> `features/game/sessionPersistence.ts` (pure — serialize, parse, and the restore
> rules), `services/game/sessionRepository.ts` (the `CURRENT_SESSION` key), and
> `store/useSavedRoundStore.ts` (the only writer). Loaded at launch in `App.tsx`
> alongside the profile, so "is there a round to resume" is a synchronous question by
> the time any screen renders.
>
> **Saving is eager, not on the way out.** The round is written on every session change,
> not just at turn boundaries — same requirement, fewer places to forget one, and the
> write is a synchronous MMKV set of a few hundred bytes. It has to be eager because the
> exits this actually protects against give the app no chance to run anything: a
> force-quit, an OS eviction, a crash. Backgrounding was never the risk — the process
> survives it.
>
> **Three decisions the doc didn't make.**
>
> - **Where the player picks the round back up.** §13 requires the round to survive but
>   never says where it resurfaces, and §5's Home element list predates there being
>   anything to resume. Home is the answer by elimination — it is the first screen after
>   launch, and the alternative (dropping the player straight into a half-played round
>   on open) takes the decision away from them. The entry renders only while a round is
>   saved, and shows its chain length so the player knows which round is waiting.
>   Behaviour is this task's; styling stays WL-405's.
> - **A restored round can't always just be "your turn".** A round killed during the
>   computer's turn has the player's word already in the chain and a reply owed; landing
>   it on `input_empty` would leave the player needing a word starting with their own
>   word's last letter, playing against themselves. Such a round restores as
>   `computer_thinking` and the screen finishes the turn the dead process started. The
>   other transient phases settle to `input_empty`: an in-flight submission's verdict is
>   unknown (the player retypes rather than the app guessing), and a rejection's error
>   text isn't part of the session.
> - **A deliberate exit still discards.** Leaving via WL-401's confirmation clears the
>   save slot and records the round as `abandoned` — the dialog says the round will be
>   lost, and it must not then be quietly offered back on Home. The save slot covers
>   exits the player *didn't* choose. **Flagged for WL-404:** its Pause screen could
>   reasonably add an "Exit and save for later" that keeps the round instead, at which
>   point this rule is worth revisiting.
>
> Starting a new round while one is saved confirms first (`START_NEW_ROUND_CONFIRM`,
> reusing WL-401's `ConfirmSheet`) — the same "nothing discards a round without asking"
> rule, applied to a round that isn't on screen. The message names Resume Game, since a
> dialog offering only "lose it" or "cancel" leaves the player to work out the third
> option themselves.
>
> **Parsing is strict here, unlike the profile's.** `parseProfile` repairs what it can
> because a player's whole history is at stake. A saved round is worth minutes, and a
> half-repaired one is a *playable object* — a chain missing entries, a required letter
> that no longer follows from the last word. So anything that doesn't read back exactly
> is discarded, including a round whose chain disagrees with the word on the board, one
> from a different schema version, and any round that is already finished.
>
> **Verified on both platforms, by playing and by reading the stored bytes.** iPhone SE
> simulator: played a round with a hint used (chain 5, score 25, `hintsUsed` 1),
> force-quit, and read the app's MMKV file back — status `active`, the exact chain,
> score, and hint count. Relaunched: Home offered "Resume Game (5 words)", Start Game
> raised the confirmation instead of silently replacing it, and resuming restored the
> chain, score, difficulty badge, current word, and required letter exactly. Playing on
> after the resume wrote the round again. Backgrounding and returning kept the screen
> untouched, typed input included. Android emulator: same flow — force-stop mid-round,
> relaunch, "Resume Game (3 words)", resumed identically, no `FATAL`/`AndroidRuntime` in
> `adb logcat`. 26 unit tests cover the pure rules and the store, including the
> mid-computer-turn restore, which is the one case too fast to trigger by hand (the
> window is one 350ms think delay).

**WL-404 · Pause screen** — S · 1d · WL-401 — **DONE 2026-08-29**
Wireframe §13: Resume, How to Play, Restart, Exit to Home. Confirm before restart or exit.
*Done when:* all four actions work and both destructive ones confirm first.

> **DONE 2026-08-29.** `PauseSheet` on the existing `BottomSheet`, the same tier as the
> Hint sheet — `navigation/types.ts` already placed Pause there rather than in
> `RootStackParamList`. That is also what satisfies §13's first requirement ("preserve
> the current game state") by construction: the round stays mounted underneath, so there
> is nothing to save and reload in order to show four buttons.
>
> **Only one of the two destructive actions has a confirmation of its own.** Exit to
> Home is a navigation, and WL-401's guard already holds every route off the game screen
> behind "Leave this round?" — so Exit simply performs the `popTo` and lets that dialog
> do the asking. Adding a second, near-identical dialog first would ask the same question
> twice in a row, in two wordings. Restart is not a navigation and nothing else guards
> it, so it confirms (`RESTART_ROUND_CONFIRM`, distinct copy: leaving asks whether to
> give up the round, restarting asks whether to trade it for another).
>
> Both destructive actions skip the confirmation when the player hasn't moved yet — the
> same `isRoundInProgress` rule WL-401 established, for the same reason: a round holding
> only the computer's opener has nothing to lose, and confirming there is how a
> confirmation stops being read. Restart on an untouched round is a reroll, and behaves
> like one.
>
> **Restart rebuilds the round in place** rather than re-entering the route. A
> `replace('Game', …)` would remove the screen, which WL-401's guard would intercept —
> a second dialog about a round the player just agreed to give up. The round being
> replaced is recorded as `abandoned` first, exactly as leaving records it (WL-402), and
> the personal-best baseline is re-read for the new round.
>
> **The pause control is disabled while a turn resolves**, which is doing real work
> rather than being fussy: `attemptComputerTurn` has a promise in flight that will
> `setSession` an absolute value when it lands, so a Restart taken mid-turn would be
> overwritten seconds later by the round it just replaced. Blocking the entry point
> makes that unreachable. It is also the nearest thing this build has to §13's "pause
> computer timers if timers are added later" — that turn is the only live timer. The
> window is a few hundred milliseconds. **Flagged for WL-408:** the control keeps its
> glyph while disabled, since Design System §4 rejects opacity for disabled states and
> an icon has no fill or shadow to drop instead; `accessibilityState` carries it to
> assistive tech, but a visual treatment for disabled icon controls should be designed
> once, there, for all of them.
>
> No new unit tests: this task adds nothing to `src/features/` — it is screen wiring
> over rules WL-401/402/403 already own and test. The 357 existing tests still pass.
>
> **Verified on both platforms.** iPhone SE simulator: all four actions, in §13's order.
> Resume closes the sheet with the round untouched; How to Play navigates and returns to
> the round intact (chain 5, score 25 across the round trip); Restart confirms, and
> cancelling returns to the pause sheet rather than dumping the player back in the game;
> confirming dealt a fresh round (chain 1, score 0, new starting word, hints reset) while
> the profile recorded the replaced round as `abandoned` and the save slot took the new
> one — both read back from the app's MMKV file; Restart on an untouched round skipped
> the dialog as designed; Exit to Home raised WL-401's "Leave this round?" and, after
> confirming, landed on Home with no Resume entry — the save slot cleared, so WL-403's
> rule holds through this path too. Android emulator: the sheet renders identically, and
> hardware back while it is open resumes (closes the sheet, round intact at chain 3 /
> score 16) rather than leaving the round — the "back must not become a two-tap way to
> destroy the round" rule, holding one level deeper. No `FATAL`/`AndroidRuntime` in
> `adb logcat`.
>
> **Corrected while here:** `GameScreen`'s docblock still said the five-state game-over
> screen was "still pending" and that the round-over branch was two minimal messages.
> WL-308 shipped `GameOverPanel` and the screen has been rendering it since. Stale
> comment, fixed.

**WL-405 · Home screen** — M · 1.5d · WL-402, WL-204 — **DONE 2026-08-29**
Wireframe §5: start game, best score, best streak, Word Review, How to Play, Settings.
Empty state ("No games completed yet") per §17. Per §5, **no** shop, feed, leaderboard, or
dashboard.
*Done when:* stats read from the persisted profile and the empty state shows on a fresh
install.

> **DONE 2026-08-29.** Home was the last bare-primitive screen on the core path — the
> same unstyled state WL-309 found `DifficultyScreen` in. It is now built from the
> WL-204 component set: `Button`, `Card`, `Icon`, and the WL-203 tokens, with no raw
> hex, size, or shadow at the call site.
>
> **Layout.** §5's purpose line is "give the user immediate access to gameplay", so the
> screen is ordered by what matters: wordmark (40px display), the primary action, the
> statistics that give it a reason, then the two secondary entries. **Start Game is the
> only primary-tone control on the screen** — everything else is `secondary`, so nothing
> competes with it, which is the same instinct behind §5's own "no shop, feed,
> leaderboard, dashboard" decision. It is the one full-width control; the rest size to
> their labels.
>
> The two stat cards are the screen's decoration as well as its content: `tangerine` and
> `sunbeam` fills (both `ink` text, per the WL-202 contrast table), `ink` borders, hard
> offset shadows, and **opposing tilts** (-2° / +3°) — Design System §0's "asymmetry is
> a feature" and §3's rotation range. They are informational, which is what makes
> rotating them legal; nothing else on the screen is tilted, because everything else is
> a control (§3 forbids rotating those). The empty-state card carries the same tilt.
>
> **Three states, not two.** `gamesPlayed > 0` decides between statistics and §17's
> empty state — *not* "a profile exists", since a fresh guest has a profile from its
> first launch (Architecture §8.1). And while the profile is still loading the slot
> renders nothing: flashing "No games completed yet" at a returning player for a frame,
> then replacing it with their real score, is worse than a frame of nothing. §17's copy
> is verbatim, in `gameConstants.ts` with the other reviewed strings.
>
> **The daily-challenge placeholder was removed.** §5 lists it as *optional*, v1 has no
> daily challenge, and what was there was an empty `View` carrying a marker label — no
> layout, nothing visible, one more node for a screen reader to walk past. Noted here
> rather than done silently, since it is the one §5 element this screen no longer has.
>
> WL-403's Resume Game entry and its start-new confirmation were already here as
> behaviour; this task gave them their form (a full-width secondary button directly
> under Start Game, showing the waiting round's chain length).
>
> **Verified on both platforms.** iPhone SE simulator: the empty state renders with
> §17's copy on a profile with no completed games; Resume Game appears under Start Game
> after a force-quit mid-round and shows the right chain length; Start Game with a round
> saved still raises the confirmation. Android emulator: identical rendering — hard
> shadows, tilts, and both bundled faces — with no `FATAL`/`AndroidRuntime` in
> `adb logcat`.
>
> **How the populated stats were checked, precisely.** A settled round is still not
> reachable by hand (WL-402's note explains why: the thinnest letter in the dictionary
> still offers the computer 34 candidates), so the populated layout was rendered by a
> **temporary local edit forcing that branch with §5's own example numbers (120 / 14),
> screenshotted, and reverted** — `git diff` and a grep for the marker confirm nothing
> remains. That verifies the *layout*, not the binding; the binding is
> `profile.bests.score` / `profile.localStreak.best`, which the WL-402 store tests cover
> end-to-end through real storage. Both halves meet for the first time on real hardware
> at WL-310.

**WL-406 · Welcome and How to Play** — S · 1d · WL-204 — **DONE 2026-08-29**
Wireframe §4 and §7. Welcome shown on first launch only. How to Play uses the concrete
apple→elephant→table example, not abstract rules.
*Done when:* Welcome appears once, and How to Play covers exactly the six v1 rules from §7.

> **DONE 2026-08-29.** Both screens rebuilt on the WL-204 component set; the last two
> bare-primitive screens on the player-facing path are gone.
>
> **"First launch only" needed no new stored flag.** It is
> `useProfileStore.isFirstLaunch`, set when `load` had to *create* the guest rather than
> read one — "first launch" and "no profile existed yet" are the same fact, and
> Architecture §8.1 already has the profile created on first use, so a `hasSeenWelcome`
> field would be a second thing saying what the first one says. Consequences, both
> deliberate: a reinstall shows the welcome again (that install genuinely is new), while
> "Delete guest data" in Settings does not (it writes a replacement profile immediately,
> and the app is not new to someone who just used its settings screen). The one edge it
> gets wrong: quitting from the Welcome screen without tapping Play Now counts as seen,
> because the profile was already written — a player who has read the screen.
>
> **`RootNavigator` now waits for the profile before mounting**, because
> `initialRouteName` is read once and never again — deciding it late would mean routing
> correctly only by remounting the whole navigator. The wait is a synchronous MMKV read
> behind an async interface, so it is a frame or two of `paper`, not a spinner (Design
> System §5 has no spinner in it, and an indicator for something this fast is worse than
> a still background). The alternative — start on Welcome and redirect — flashes the
> welcome screen at every returning player, which is the exact thing this task exists to
> prevent. The WL-401 back-behaviour table is updated: Home is the stack root on every
> launch after the first.
>
> **How to Play was missing half its rules.** §7 lists six; the old screen showed three
> (names, repeats, minimum length) and omitted "start with the required letter" — the
> rule the entire game turns on — plus "use a valid dictionary word" and hints. All six
> now render from `HOW_TO_PLAY_RULES`, one countable list rather than lines scattered
> through JSX. The hint rule interpolates `HINT_LIMIT_PER_ROUND` through the same
> `{placeholder}` convention `INVALID_WORD_MESSAGES` uses, so WL-605 retuning the limit
> cannot leave the rules screen quietly lying. Rule 2 is worded as "use a word from the
> game's word list" rather than §7's "valid dictionary word" — deliberately matching the
> rejection message the player will actually see, so both places speak the same
> language.
>
> The example leads, per §7's "should include a real example rather than only abstract
> instructions": the doc's own apple → elephant → table, one card per step, each naming
> who played, the word, and the handoff letter — shown in the same `Badge` the game uses
> for its difficulty tag, so the shape is familiar before the first round. The screen
> scrolls; six rules plus three example cards exceed a small phone at large text sizes,
> and unlike the game screen nothing here has to stay on screen.
>
> Welcome stays deliberately thin — §4.1's last requirement is that it "should not
> contain a long explanation" — so it is the wordmark, the promise, one sentence in a
> tilted `sunbeam` card, and the two controls. `Play Now` still `replace`s, so Home
> becomes the root and back exits rather than returning to a dismissed welcome.
>
> **Verified on both platforms.** iPhone SE simulator: uninstalled and reinstalled for a
> genuine fresh install — Welcome appeared; Play Now → Home; force-quit and relaunch →
> straight to Home, no Welcome, which is the "appears once" criterion. Before that, a
> returning profile launched directly to Home. How to Play renders all six rules with
> the hint limit interpolated ("3 per round") and the three example cards. Android
> emulator: uninstall/reinstall, same sequence, same result, no `FATAL`/`AndroidRuntime`
> in `adb logcat`.
>
> Three store tests cover the derivation itself (created → first launch, read → not,
> reinstall → first launch again), since that is the part with a rule rather than a
> layout. 360 tests pass.

**WL-407 · Settings screen** — M · 1.5d · WL-405, D-05 — **DONE 2026-08-29**
Wireframe §16 minus whatever D-04 and D-05 remove: sound, haptics, text size, reset
statistics, privacy policy, terms, report a word, contact support. Plus the Attributions
screen carrying the WL-101 notices, and "Delete guest data" per the Guest Deletion doc.
**Three notices, not two:** ESDB and WordNet (WL-101, text in the licence review §7), plus
**LDNOOBW under CC-BY-4.0**, added by WL-104 as the source of the excluded-word list.
**The Account row is already done** — D-04 closed, and `SettingsScreen.tsx` shows only
"Continue as guest," gated behind `ACCOUNTS_ENABLED_V1`, ahead of the rest of this task.
*Done when:* every toggle persists and takes effect immediately; reset and delete both
confirm first.

> **DONE 2026-08-29.** Settings rebuilt on the WL-204 component set, plus a new
> `Attributions` route carrying the notices this project has taken on.
>
> **Four notices, not three.** ESDB and WordNet (WL-101), LDNOOBW under CC-BY-4.0
> (WL-104) — and the two OFL fonts, which Design System §2 assigns to this screen and
> this task's line above does not mention. OFL 1.1 requires the licence text itself to
> travel with the software, so the full body ships, not a reference to it; both fonts
> carry byte-identical licence bodies and differ only in their copyright line, hence one
> entry with two copyright lines rather than two near-duplicate entries.
>
> **The notices are copied from their sources, and CI proves they stay that way.** A
> paraphrase satisfies nobody and looks perfectly fine on screen, so
> `npm run attributions:verify` re-reads the licence review and `licenses/fonts/` and
> fails on any drift — a script beside `contrast:verify` and `fonts:verify` rather than a
> Jest test, because it reads repository files the app never sees and this TypeScript
> project has no Node types. Added to the CI `verify` job. A smaller Jest suite covers
> what is about the app rather than the documents: that all four entries exist, each has
> something a player can read, and the CC-BY entry names work, source, licence, and the
> fact that WordLoop modified the list.
>
> **Notices are re-wrapped but not rewritten.** They are typed for an 80-column terminal,
> and every hard line break lands mid-sentence on a phone, which then wraps the wrapped
> line — the first render looked broken rather than legal. Each paragraph is now reflowed
> at display time (single newlines become spaces, blank lines stay paragraph breaks).
> The *stored* text is untouched and byte-identical to source, which is what the verifier
> checks; the obligation is that the notice appear, not that it appear 78 characters
> wide.
>
> **Toggles are buttons, because the design system has no toggle.** §4 defines buttons,
> cards, modals, inputs and badges and nothing else, and Wireframe §16 itself draws each
> setting as `Sound [On]`. So a setting is a `Button` whose label is its state: `grape`
> and "ON", or `paper` and "OFF" — state carried by both word and fill, never colour
> alone. That is right to look at and wrong to *announce* ("Sound, ON, button" leaves the
> listener guessing whether ON is the state or the outcome), so `Button` gained an
> optional `role="switch"` + `checked`, changing nothing else about it. **Flagged as a
> Design System gap**: if toggles spread beyond this screen, §4 should either define a
> real toggle or record this substitution.
>
> Both toggles persist through the guest profile (WL-402's `useSettingsStore`), which is
> what makes §16's "takes effect immediately" true — verified by toggling Sound off and
> reading `soundEnabled: false` straight out of the app's MMKV file.
>
> **Text size is a statement, not a control**: the app already scales with the OS
> setting, and a second in-app scale would be a competing source of truth. WL-408 owns
> making that scaling *usable* at the extremes.
>
> **What §16 lists that is deliberately not here.** A row that opens nothing is worse
> than a row that is not there, so each is omitted and tracked instead:
> **Report a word** → WL-505, which depends on this task and owns both its entry points.
> **Privacy policy** and **Terms of use** → WL-801, whose own "done when" is that both
> documents are live *and linked in-app*; nothing exists to link to yet.
> **Contact / support** → **no owner and no decision**: §16 lists it, but no project
> document names a support address. Added to the Store Submission Checklist as a gap
> rather than invented here.
>
> Reset Statistics and Delete My Data both confirm through WL-401's `ConfirmSheet`, with
> separate copy because they destroy different things — a reset clears the scoreboard and
> keeps discovered words (`resetStatistics`'s own rule), a deletion ends the guest and
> itemises what goes, as the Guest Deletion doc's wireframe requires.
>
> **Verified on both platforms.** iPhone SE simulator: toggled Sound off and confirmed
> `settings.soundEnabled: false` on disk; both destructive dialogs appear with their own
> copy; Delete My Data replaced the stored profile with a fresh guest and defaults back
> on (`soundEnabled: true`), which is also proof that settings are part of what deletion
> removes; Attributions renders all four notices including the full OFL clause list.
> Android emulator: identical rendering, no `FATAL`/`AndroidRuntime` in `adb logcat`.
>
> **Store Submission Checklist updated**: the "attribution notices actually shipped
> in-app" row is now ✅, with new rows for the CI drift gate, the LDNOOBW creator
> question, and the missing support contact.

**WL-408 · Accessibility pass** — L · 2.5d · all Phase 3 — **ENGINEERING DONE 2026-08-30; screen-reader walkthrough outstanding**
Wireframe §18: screen-reader labels on every control, error announcements via live region,
large tap targets, no colour-only meaning, visible focus states, keyboard submission,
reduced-motion honoured, and text-size scaling. **Highest risk here: a 64px display glyph
at the largest OS text setting will overflow** — needs an explicit clamping strategy.
*Done when:* a full VoiceOver and TalkBack walkthrough of the core loop succeeds, and the
game screen stays usable at the largest system text size.

> **The flagged risk, handled.** The 64px required letter takes two guards, because
> either alone leaves a hole: `MAX_DISPLAY_FONT_SCALE` (1.5) caps how far the display
> face grows, and `adjustsFontSizeToFit` shrinks whatever is left to fit its card.
> Uncapped, iOS's largest accessibility size multiplies by ~3.1 — a ~200px glyph on a
> 375pt phone. At the cap it reaches ~96px, still four times body size and by a distance
> the largest thing on screen, which is what Design System §6 actually requires. **Only
> the display face is capped**; body and UI copy scale without limit, since capping the
> text a player reads at length would defeat the setting. `typography.test.ts` guards the
> number against the narrowest screen in the WL-005 matrix.
>
> **Testing at the largest size found four failures that were not the flagged one**, all
> of them "text scales, function doesn't":
> - **Button labels truncated** — `numberOfLines={1}` is invisible at ordinary sizes and
>   renders "START G…" at the largest. A button whose own name is unreadable is a WCAG
>   1.4.4 failure. Labels now wrap and the button grows.
> - **Home, Welcome and Difficulty could not scroll.** At the largest size their content
>   is roughly twice a small phone's height, so Word Review, How to Play and *Continue*
>   were simply unreachable. All three scroll now.
> - **Submit and Hint ran off both edges of the game screen** — the two controls the turn
>   depends on, half off-screen, because that one action row lacked the `flexWrap` every
>   other row in the app already had.
> - **Screen titles clipped** next to their back control ("Choose Difficulty" lost its
>   last letters). They wrap now.
>
> **Tap targets: a 40pt bug at six call sites.** Every icon control was a bare
> `Pressable` around a 24pt glyph with `hitSlop` 8 — 40pt, under WCAG 2.5.5's 44 and
> Android's 48. `IconButton` (new, in the WL-204 set) enforces `MIN_TAP_TARGET` on both
> axes and *requires* an accessibility label, so an unlabelled icon control can no longer
> be written. Measured at 48×48dp in the Android node tree afterwards.
>
> **Announcements, on both platforms.** RN's two mechanisms do not overlap:
> `accessibilityLiveRegion` is Android-only, so TalkBack heard the invalid-word message
> and VoiceOver heard nothing. `utils/accessibility.ts` announces on iOS only, and
> callers pair the two — a live region for Android, an announcement for iOS. Applied to
> the input's error (Wireframe §18's "accessible error announcements") and, new, to
> **whose turn it is**: the computer replies on its own, so without it a screen-reader
> user submits a word and hears nothing until they go looking.
>
> **The settings toggles now announce as switches.** `Button` gained `role="switch"` +
> `checked` (WL-407 built them as buttons because §4 defines no toggle). Confirmed in the
> Android tree: `class="android.widget.Switch" checkable="true" checked="true"
> content-desc="Sound"` — TalkBack says "Sound, switch, on", not "Sound ON, button".
>
> Also: labels and roles added to the WordReview skeleton's controls (WL-502 still owns
> that screen) and the dev gallery link. Already correct and re-audited without change:
> focus states and error styling (WL-204/304), keyboard submission (WL-303),
> reduced-motion fallbacks on all five motion primitives (WL-205), contrast (WL-202, CI
> gated), and no colour-only meaning anywhere.
>
> **Verified.** iOS at `accessibility-extra-extra-extra-large`: Home, Welcome,
> Difficulty and the game screen all remain fully usable — every control reachable, the
> required letter inside its card, Submit and Hint stacked and whole. Android at
> `font_scale 2.0`, plus an `uiautomator dump` of Home, Difficulty, the game screen and
> Settings — **zero unlabelled clickable nodes on any of them**, and every product
> control ≥48dp. That dump is the tree TalkBack reads, which is the closest thing to a
> TalkBack pass that can be run without the screen reader itself.
>
> **What is not done: the walkthrough itself.** The first "done when" asks for VoiceOver
> and TalkBack *driven through the core loop*, listening — neither screen reader can be
> operated from this environment. The tree is verified and every announcement is wired,
> but nobody has yet heard the app. Held open like WL-310's physical-device pass, and
> recorded in the Store Submission Checklist as its own row rather than folded into the
> engineering rows it would otherwise hide behind.

**WL-409 · Responsive and orientation pass** — M · 1.5d · WL-301
Wireframe §19: small phones, large phones, tablets, landscape.
*Done when:* the game screen is usable at every size in the WL-005 matrix in portrait, and
landscape either works or is deliberately locked out with that decision recorded.

---

### Phase 5 — Learning layer

Per PRD §12, none of this may block a round.

**WL-501 · Word definition overlay** — M · 1.5d · WL-204, D-08
Wireframe §12, including the unavailable state ("Definition unavailable for this word. You
can continue playing.") as a first-class outcome, not an error.
*Done when:* the overlay opens mid-round without disturbing turn state, and the
unavailable path is verified by disabling the source.

**WL-502 · Word review screen** — M · 2d · WL-402, WL-501
Wireframe §15: words from the completed round, player vs. computer distinction, per-word
independent definition loading with per-word loading and unavailable states, and the §17
empty state.
*Done when:* one word's definition failing to load leaves every other row functional.

**WL-503 · Discovered-words tracking** — S · 1d · WL-402
Track first-time-seen words into the guest profile — this feeds the "new words
discovered" line on game over (Wireframe §14) and a soft-prompt trigger.
*Done when:* discovered count increments only on genuinely new words and survives restart.

**WL-504 · Hint level 4** — S · 1d · WL-307, WL-501
The definition-based clue from Wireframe §11, which reveals meaning without revealing the
word.
*Done when:* level 4 never contains the target word as a substring, and applies the −5
penalty (not −10, since the word isn't revealed).

**WL-505 · Report a word** — M · 1.5d · WL-407
PRD §26: the five report types, storing word, game_id, report_type, player_comment,
dictionary_source, created_at. D-03 is closed (no backend for v1) — queue locally and
export via Settings; a lightweight endpoint is not an option here without a scoped
exception to D-03, which isn't warranted for this one feature.
*Done when:* a report is capturable from both the invalid-word state and Settings, and
persists.

**WL-506 · Offline and failure states** — S · 1d · WL-302
Wireframe §17: offline notice, dictionary unavailable, computer timeout. Under D-03 the
app is offline-native, so these are mostly reassurance rather than degradation — worth
stating plainly to the player.
*Done when:* each state is reachable in a test build and none of them blocks play.

> **Note (flagged at WL-306, 2026-08-28):** the computer-timeout state is already built
> as of WL-306 — `GameScreen`'s `computerTimedOut`/`attemptComputerTurn`, Try Again/End
> Round both working. This task re-verifies it alongside offline notice and dictionary
> unavailable (which are still unbuilt), not a second build.

---

### Phase 6 — Instrumentation and tuning → **M2**

**WL-601 · Analytics layer** — M · 1.5d · none
An anonymous-identifier event pipeline per PRD §22 — no personal information, disclosed in
the privacy policy.
*Done when:* events reach the backend with an anonymous ID and no PII, and a kill switch
exists.

**WL-602 · Gameplay events** — M · 1.5d · WL-601, all Phase 3
Every PRD §23 event: game started, difficulty selected, valid move, invalid move (with
reason), hint used, definition opened, game completed, player win, computer win, game
abandoned, rematch started.
*Done when:* a scripted 10-round session produces a complete, correctly-ordered event
stream verified against the §23 list.

**WL-603 · Account-prompt events (dormant)** — S · 1d · WL-601
The Architecture §10 event list. D-04 is closed — these ship dormant behind the same
`ACCOUNTS_ENABLED_V1` flag as the rest of the account surface (`src/constants/
gameConstants.ts`).
*Done when:* the events exist and are unit-tested against `promptPolicy.ts`, and fire
nothing while the flag is off.

**WL-604 · Metrics dashboard** — M · 1.5d · WL-602, D-09
The section 2 metrics, plus invalid-reason distribution and win rate by difficulty.
*Done when:* every D-09 metric is visible without running an ad-hoc query.

**WL-605 · Difficulty and scoring tuning pass** — M · 2d · WL-113, WL-604
Use the simulator plus internal play to bring Hard into the 20–40% band and sanity-check
score magnitudes. Architecture §6 and §7 both label their formulas first-pass drafts
explicitly awaiting this.
*Done when:* final weights are committed **and the Architecture doc is updated** with the
tuned values and the evidence behind them.

**WL-606 · Playtest build and script** — M · 1.5d · all Phase 5
TestFlight and Play internal testing builds, plus a moderation script for 5–10 players per
Wireframe §24. The three questions to answer: do they understand the rule, do they know
what to do next, do they want another round.
*Done when:* builds are installable by external testers and the script is written and
reviewed.

> **M2 gate:** playtest complete, findings written up, and a decision made on whether any
> core-loop change is needed before store submission. This is the milestone the plan exists
> to reach.

---

### Phase 7 — Accounts and backend *(the 1.1 release — D-04 closed 2026-08-17)*

This is no longer conditional — D-04 decided guest-only for v1, so this phase is
definitely out of the v1 critical path and definitely still happening, as 1.1, after M3.
Sequenced entirely after Phase 8.

**Scope note:** D-03 (also closed) settled *gameplay* authority — the client's rule engine
stays the sole validator, permanently, not just through v1. Building this phase's backend
for accounts doesn't reverse that. `WL-701`'s backend is scoped to accounts, auth, and
sync — it is **not** a green light to also move move-validation authority to the server.
That would be a distinct decision, triggered only by the condition D-03 itself names:
leaderboards, purchases, or anti-cheat entering scope. Conflating "we need a backend for
accounts" with "therefore the server validates moves again" would quietly undo a decision
that was made for unrelated reasons.

**WL-701 · Backend service and data store** — L · 4d · Architecture §11 items 1
Node/TypeScript API, hosting, and the still-undecided data store — scoped to accounts/auth/
sync only, per the note above. Closes Architecture §11 open item 1 for the accounts case
specifically (that item is otherwise already resolved for v1 gameplay, per D-03).
*Done when:* a deployed environment serves a health check from CI.

**WL-702 · Account API endpoints** — M · 2d · WL-701
Architecture §9 open item: create account, sign in, sign out, link guest data, delete
account.
*Done when:* endpoints are specified, implemented, and integration-tested.

**WL-703 · Verify Apple Sign-In requirements** — S · 0.5d · none
Architecture §8.4 flags this as unverified against current App Store guidelines. Confirm
before building providers — it determines whether Apple Sign-In is optional or mandatory
given Google sign-in.
*Done when:* a written conclusion cites current Apple documentation.

**WL-704 · Auth providers** — L · 4d · WL-702, WL-703
Sign in with Apple, Google, email magic link.
*Done when:* each provider completes a full sign-in on a real device on both platforms.

**WL-705 · Guest data linking** — L · 3d · WL-704, WL-402
Transfer the eight categories the trigger policy doc lists (completed games, best score,
longest chain, difficulty stats, discovered words, saved words, settings, hint
preferences), skipping corrupted/incomplete/duplicate records per that doc's rule. Show
the confirmation screen naming what transferred.
*Done when:* a guest with a populated profile links with zero data loss, and the local copy
is marked migrated rather than orphaned.

**WL-706 · Activate the soft-prompt policy** — M · 1.5d · WL-705, WL-603
Flip `ACCOUNTS_ENABLED_V1` (`src/constants/gameConstants.ts`) and turn on `promptPolicy.ts`
at all Architecture §8.2 trigger points, with the §8.3 frequency caps.
*Done when:* the caps hold under simulated multi-session use across a 30-day cycle
boundary, including the reset behaviour.

**WL-707 · Hard-gated features** — L · 3d · WL-705
The features the gates actually gate: vocabulary history, saved words, statistics, backup/
restore. Without these, accounts have nothing to offer (see D-04).
*Done when:* each feature works signed-in and shows its account prompt when opened as a
guest.

**WL-708 · Account deletion** — M · 2d · WL-702
Apple and Google Play both require an in-app deletion path. Deletes profile, saved words,
history, preferences, linked guest data, and the auth record, with confirmation and the
exact copy from the Guest Deletion doc.
*Done when:* deletion removes every listed category, signs the user out, and is verified
server-side.

**WL-709 · Web deletion request page** — S · 1d · WL-708
Google Play requires a web resource for deletion requests.
*Done when:* the page is live and linked from the Play listing.

**WL-710 · Server-side guest retention cleanup** — S · 1d · WL-701
Only if server-side guest records exist. Scheduled deletion after the documented
inactivity period (90 days suggested).
*Done when:* the job runs on schedule and its behaviour matches the privacy policy text.

---

### Phase 8 — Store release readiness → **M3**

Work this phase against `WordLoop_Store_Submission_Checklist.md`, not just the task list
below — that doc is the itemized, source-cited backing checklist (including the items that
need legal/compliance sign-off rather than engineering) that WL-801 through WL-806
collectively execute.

**WL-801 · Privacy policy and terms** — M · 1.5d · WL-601, WL-505
Must match actual behaviour, including the Guest Deletion doc's point that uninstall is
**not** a reliable deletion signal — do not claim uninstall deletes cloud data.
*Done when:* both documents are live, linked in-app, and reviewed against what the app
actually collects.

**WL-802 · Store privacy declarations** — M · 1d · WL-801
Apple App Privacy details and Google Play Data Safety, consistent with WL-801 and the
analytics in WL-602. Inconsistency here is a common rejection cause.
*Done when:* both forms are complete and cross-checked against the event list.

**WL-803 · Store listings and assets** — M · 2d · D-10, WL-204
Name, icon, screenshots, descriptions, keywords, age rating. Icon and screenshots should
carry the design language, not generic templates.
*Done when:* both listings are complete and pass their respective pre-submission checks.

**WL-804 · Release build hardening** — M · 1.5d · WL-003
Release configs, signing, ProGuard/R8, bundle size check, source-map upload, cold-start
measurement on the slowest target device.
*Done when:* release builds are installable and crash reports symbolicate correctly.

**WL-805 · Pre-submission QA pass** — L · 2d · all
Full matrix walkthrough: every screen, every state, both platforms, every device in
WL-005, plus a11y and offline.
*Done when:* the checklist is complete with no open P0 or P1 defects.

**WL-806 · Submit and respond to review** — M · 1d + latency · all
*Done when:* both stores approve. Budget calendar time for at least one rejection round.

---

### Phase 9 — Market validation → **M4**

Non-engineering, per PRD §29 Phase 5. Runs against the live M3 build.

**WL-901** · Recruit and observe casual players; report against D-09 targets — 1wk
**WL-902** · Interview learners and parents on perceived educational value — 1wk
**WL-903** · Teacher interviews (5–8) on classroom fit — 1wk · PRD §27
**WL-904** · Retention and metrics readout at 2 and 4 weeks post-launch — 0.5wk · WL-604
**WL-905** · Go/no-go recommendation on the school product — 0.5wk · all Phase 9

> **M4 gate:** an evidence-based recommendation on PRD §27, explicitly *not* an assumption
> that schools are the buyer (PRD §6).

---

## 6. Critical path

```text
D-01 licence (DONE)  →  WL-102 pipeline  →  WL-105 bundle format
                                     ↓
                          WL-107 rules + WL-108/109 difficulty
                                     ↓
                             WL-110 state machine
                                     ↓
                        WL-301/302 game screen  →  M1
                                     ↓
                    Phase 4 shell  →  Phase 6 instrumentation  →  M2
                                     ↓
                              Phase 8  →  M3
```

Everything else can be parallelised or resequenced. Three observations:

1. **The dictionary is the whole project's gating dependency.** Rule engine, difficulty
   engine, hint counts, rarity scoring, and starting-word selection all block on it. D-01
   is closed (see `WordLoop_Word_List_Licence_Review.md`), so WL-102 can start now — that
   was the step most likely to slip the whole schedule, so it's worth confirming it's
   actually unblocked before treating the rest of Phase 1 as routine.
2. **Phase 2 is genuinely parallel with Phase 1** — different skills, no shared files. Use
   that, or Phase 3 waits on design work that could have been done already.
3. **Phase 7 was the only large block that could be lifted out entirely, and it has
   been.** D-04 closed guest-only for v1, removing ~15–20 days from the v1 critical path —
   it was the highest-leverage decision on this page, and it's now resolved. Combined with
   D-03, both of the decisions this plan flagged as blocking are closed; nothing else on
   this page is waiting on a product decision.

---

## 7. Definition of Ready / Done

A task is **Ready** when: its spec reference is identified and unambiguous; blocking
decisions are closed; dependencies are done; acceptance criteria are demonstrable.

A task is **Done** when: acceptance criteria are demonstrated on a real device where
applicable; `test` / `lint` / `typecheck` / `audit:ci` all pass; unit tests exist for
anything in `src/features/` (the `ruleEngine.test.ts` pattern); any doc contradiction found
along the way is **flagged, not silently resolved** (`CLAUDE.md`); and no design value is
hardcoded outside the token layer.

---

## 8. Build-specific risks

These are delivery risks, additional to the product risks in PRD §25.

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| ~~Word-list licence fails review~~ | ~~Blocks everything~~ | ~~Medium~~ | **Retired** — D-01 closed, ESDB cleared review (`WordLoop_Word_List_Licence_Review.md`). Two narrow items remain for legal sign-off before store submission (that doc, section 8), neither blocks Phase 1 |
| COCA-derived data's licence rests on a third-party NDA WordLoop isn't party to | Legal exposure discovered late | Low | Flagged explicitly in the licence review, section 8, for counsel to confirm before store submission — not a Phase 1 blocker |
| Dictionary bundle blows cold-start or app size | Bad first impression, store size limits | Medium | Explicit budgets in WL-105, measured on the slowest device |
| Naive candidate scoring stalls the computer's turn | Core loop feels broken | High if unaddressed | WL-106 precomputed index, 50ms budget |
| Never-compiled scaffold hides integration breakage | Phase 0 overruns | Medium | WL-001 first; native CI in WL-004 so it can't regress |
| Hard mode unbeatable (PRD §25) | Abandonment | Medium | Caught by the Phase 1 simulator gate, before players see it |
| Design system's maximalism collides with a11y at large text sizes | a11y failure or visual breakdown | High | WL-408 clamping strategy for the 64px callout, tested early |
| ~~Accounts pull the launch date~~ | ~~M2/M3 slip~~ | ~~High~~ | **Retired** — D-04 closed guest-only at M3, so this risk can no longer materialize for v1. Re-open only if D-04 is ever reversed |
| Proper-noun misclassification (PRD §25) | Player frustration, support load | Medium | WL-103 fixture suite; WL-505 report-a-word as the feedback loop |
| Store rejection on privacy inconsistency | Weeks of delay | Medium | WL-801/802 cross-checked against the real event list |
| Font licence disallows app bundling | Design system compromised late | Low | D-06 resolved in Phase 2 week 1 |

---

## 9. Scope explicitly excluded from v1

From PRD §5, restated so it survives contact with the build: real-time multiplayer, school
dashboards, teacher accounts, class management, curriculum alignment, progress reporting,
full definitions for every word, social profiles, global leaderboards, subscriptions,
institution deployments. Plus, from this plan: dark mode (D-05), commercial dictionary
enrichment (D-08), backend and server-side sync (**D-03, closed** — client-authoritative,
no backend, for as long as v1 has no leaderboards or purchases), and accounts (**D-04,
closed** — guest-only, deferred to 1.1). No monetization ships in v1; PRD §28 is right
that returning-player behaviour comes first.

Timed rounds, daily challenges, and pronunciation are all post-v1. The Home screen has a
placeholder slot for a daily challenge (Wireframe §5) and nothing behind it — keep it that
way.

---

## 10. Documentation gaps to close

1. ~~**The Data Model doc doesn't exist.**~~ **Resolved.** It did exist, as
   `proj-docs/wordloop-data-model.ms` — a mistyped file extension, which is why it was
   invisible to every `*.md` search and to anyone browsing the folder for docs. Renamed to
   `WordLoop_Data_Model.md`. Its content is complete and its section numbering already
   matches every code citation (`types/game.ts` §4/§5, `storage.ts` §2/§4,
   `GameScreen.tsx` §4, `WordReviewScreen.tsx` §7, `AccountCreationScreen.tsx` §2). No
   rewrite needed.
2. ~~**`CLAUDE.md` filenames don't match reality.**~~ **Resolved.** All seven reference
   docs renamed to the `WordLoop_*` convention `CLAUDE.md` already used, and `CLAUDE.md`
   now carries full `proj-docs/` paths plus a table of what each doc governs.
3. ~~**Six of the Data Model doc's ten entities are marked `[Inference]`.**~~ **Resolved —
   all ten reviewed, 2026-08-17.** Three had shipped code to reconcile against and were
   ratified against it, all three with real drift found and fixed, not a rubber stamp:
   - `GameSession`/`Move` (§4/§5): the doc's `GameSession` described the eventual full
     persisted/server entity, while `types/game.ts` implements a distinct, narrower v1
     client-runtime shape. Split into `GameSession` (§4, future/Phase 7) and
     `GameSessionState` (§4.1, ratified v1 shape) rather than force a premature merge.
     `Move`'s `hint_level` field cited a "Hint section" that never existed anywhere in the
     document — corrected; the field itself is real but not implemented in code yet
     (`WL-307` follow-up).
   - `AccountPromptState` (§9): doc and code share a name, unlike the pair above, so this
     was reconciled to the code directly rather than split. Added `hasShownThisSession`
     (real, persisted, missing from the doc); flagged `last_prompt_trigger_type` /
     `last_prompt_shown_at` as documented-but-unimplemented (`WL-706` follow-up).

   Three had no code yet, so this pass checked them for consistency against their source
   docs instead of against an implementation:
   - `Account` (§3) and `AnalyticsEvent` (§10) held up — no changes.
   - `RoundSummary` (§6) didn't: its `result` field used a standalone `(win/loss/draw)`
     vocabulary that both under-covered Wireframe §14's five game-over result states and
     duplicated `GameStatus` under different names. Fixed by reusing `GameStatus`
     directly — which surfaced a real, previously invisible gap: **nothing in the system
     distinctly represents "technical failure,"** one of those five required states. That
     couldn't be fixed in a doc; it needed a value added to the shipped `GameStatus` type.
     **Closed 2026-08-19 by `WL-110`**, which added `technical_failure` to `GameStatus`.
     `RoundSummary.result` reuses that union, so it inherits the value; `WL-308` renders
     the state rather than re-deciding it.
4. ~~**Doc status lines are stale.**~~ **Resolved, both docs.** `WordLoop_Data_Model.md`
   and `WordLoop_Architecture.md` now both say "Active build" with an accurate account of
   what's been reviewed/closed. As of D-04 closing, `WordLoop_Architecture.md`'s status
   line reflects **six of its original six open items now resolved or deferred to a named
   release** — nothing in that doc is still described as hinging on an undecided call.
5. ~~**Architecture §11 open items** get resolved by this plan as follows~~ **Written
   directly into `WordLoop_Architecture.md` §11 now, not just asserted here:** item 1
   (data store) → **resolved, moot for v1** (D-03); item 2 (reconciliation) →
   **resolved, deleted for v1** (D-03) — not deferred, deleted, since there's nothing to
   reconcile against without a server; item 3 (dictionary provider) → flagged open,
   deliberately deferred by D-08; item 4 (SCOWL licence) → **closed**, see
   `WordLoop_Word_List_Licence_Review.md`; item 5 (account endpoints) → **deferred to
   1.1** (D-04 closed — accounts are coming, just not at v1 launch), tracked as `WL-702`;
   item 6 (Apple Sign-In) → **deferred to 1.1**, same reasoning, tracked as `WL-703`;
   item 7 (formula tuning) → flagged open, genuinely can't close early, tracked as
   `WL-605`.
6. **Design System §9 open items:** item 1 → D-06/WL-201; item 2 → WL-202; item 3 (dark
   mode) → D-05; item 4 (motion timings) → WL-205 and WL-605.
7. **README needs a rewrite at M1.** It currently says "do not assume this compiles or
   runs" — accurate today, actively misleading the moment WL-001 lands.
8. **D-03 closed 2026-08-17 — v1 is client-authoritative and local-first, adopted as
   recommended.** Propagated everywhere it was referenced as pending: this section, the
   D-03 row above, `WL-505`, Phase 7's scope note (added, clarifying that accounts
   backend work doesn't imply reversing gameplay authority), the scope-excluded list, the
   immediate-next-actions table below, and `WordLoop_Architecture.md` §1/§2/§3/§11,
   `WordLoop_Data_Model.md` §4/§12, and `WordLoop_Store_Submission_Checklist.md` section
   B. Nothing was silently left saying "pending" anywhere it was previously flagged as such.
9. **D-04 closed 2026-08-17 — v1 ships guest-only, adopted as recommended.** Both of this
   plan's originally-flagged blocking decisions are now closed. Unlike D-03, this one had
   a concrete code contradiction to fix, not just docs: `SettingsScreen.tsx` was showing a
   live, reachable "Create Account" button, contradicting the decision's own spec the
   moment it was adopted. Fixed by adding `ACCOUNTS_ENABLED_V1` (`src/constants/
   gameConstants.ts`, `false`) and gating the Account row behind it — the same pattern
   D-04's text already called for ("dormant behind a flag"), now an actual flag instead of
   a description of one. Propagated through: this section, the D-04 row, the Phase
   overview table and calendar, `WL-407`, `WL-603`, `WL-706`, Phase 7's header, the
   critical-path observations, the risk table (retired one risk outright), the
   scope-excluded list, and `WordLoop_Architecture.md` §8/§11, `WordLoop_Data_Model.md`
   (four separate notes), and `WordLoop_Store_Submission_Checklist.md` section C and the
   legal-sign-off summary.

---

## 11. Immediate next actions

| # | Action | Owner | Why now |
|---|---|---|---|
| 1 | ~~Decide **D-03** (server authority) and **D-04** (accounts in v1)~~ | — | **Both done.** Client-authoritative and guest-only, both adopted as recommended. No decision is blocking any remaining item on this page |
| 2 | ~~Start **D-01** word-list licence review (WL-101)~~ | — | **Done.** See `WordLoop_Word_List_Licence_Review.md`. WL-102 (dictionary pipeline) is now unblocked and can start |
| 3 | Start **WL-001** native project generation | Engineering | Parallel with the licence review; unblocks all of Phase 0 |
| 4 | ~~Ratify the `[Inference]` **`GameSession` and `Move`** entities in the Data Model doc~~ | — | **Done.** Split into `GameSession` (future/Phase 7) and `GameSessionState` (ratified v1 shape) — see Data Model doc §4/§4.1. WL-110 can build against §4.1 with confidence |
| 5 | Start **D-06** font selection and licensing | Design | Phase 2 can't start without it |
| 6 | Ratify or amend the **section 2 metrics** (D-09) | Product | M2 needs a pass/fail bar defined before the build, not after the playtest |

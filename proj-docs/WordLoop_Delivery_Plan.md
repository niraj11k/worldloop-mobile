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
| Difficulty engine | Candidate *ranking* implemented and unit-tested per Architecture §6 weights. Selection (random / weighted-random / top-pick) not implemented — `WL-109` — current stub behavior (always top-ranked) is itself now locked in by a test, so a change won't go unnoticed. Candidate *generation* blocked on the dictionary |
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
| **D-05** | Dark mode in v1 **[changes a doc]** | Phase 2 | Wireframe §16 lists dark mode as a v1 setting; Design System §9 open item 3 says no dark palette has been designed. Two options: (a) design the dark palette in Phase 2 — adds ~3 days design + ~2 days implementation, and every one of the 8 accent colours needs re-contrast-checking; (b) cut the toggle from v1 Settings. **Recommend (b).** A maximalist warm-paper palette does not have an obvious dark translation, and a rushed one will look worse than not offering it |
| **D-06** | Display + monospace font selection and mobile licence | Phase 2 | Design System §2 explicitly forbids shipping a system font in the display role. Needs a named font, a licence permitting app bundling, and a check that the 64px required-letter glyphs and 12px monospace captions both hold up on a small phone. Pick in week 1 of Phase 2 — the type scale can't be built without it |
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

**WL-003 · Crash and error reporting** — S · 0.5d · WL-001
Wire a crash reporter (Sentry or Crashlytics) with source maps for both platforms, behind
a config flag so it's inert in dev.
*Done when:* a deliberately thrown error appears in the dashboard with a symbolicated
stack from a release build.

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

**WL-104 · Offensive/excluded word list** — S · 1d · WL-102
Per PRD §8.8 this must be configurable data, not code. Sourced list plus a manual review
pass, applied at pipeline time and overridable at runtime.
*Done when:* the exclusion list is a standalone reviewable data file, and excluded words
reject with reason `offensive_excluded`.

**WL-105 · Bundle format and lookup performance** — L · 2d · WL-102
Decide the on-device representation. A parsed JSON blob of 50k+ entries will cost visible
cold-start time; expect to need a packed asset loaded into an in-memory index, or SQLite —
this is its own format decision, independent of D-07 (the small-state `StorageAdapter`
library), which this task doesn't depend on despite an earlier version of this plan
listing it as a dependency.
Budget: **cold-start dictionary ready ≤ 400ms; single-word lookup ≤ 5ms; bundle size
increase ≤ 8MB.**
*Done when:* the three budgets are measured on the slowest device in the WL-005 matrix and
recorded.

**WL-106 · Precompute the reply-count index** — M · 1.5d · WL-102
The difficulty engine's `option_reduction_score` needs "how many valid replies does this
candidate leave?" Computed naively that's O(candidates × dictionary) per turn and will
stall the turn. Precompute counts of playable words by first letter at pipeline time; at
runtime subtract used words.
*Done when:* candidate scoring for a worst-case letter completes in ≤ 50ms on the slowest
target device.

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
> - **No real lookups happen on-device yet (WL-105).** `dictionaryService.lookupWord`
>   is still the not-found stub, so wiring the engine means the app now rejects *every*
>   submitted word as `unknown_word`. That is the correct behaviour for the current
>   stub, not a regression, and it resolves the moment WL-105 provides a loader — but
>   it does mean the game is temporarily unplayable end-to-end, on top of the
>   safe-area defect logged under WL-401.

**WL-108 · Candidate generation** — M · 1.5d · WL-105, WL-106
Given a required letter and the used-word set, return scored candidates. Computer draws
only from the computer-playable tier (PRD §8.7); the player may submit from the wider
accepted set.
*Done when:* generation returns correctly filtered, correctly scored candidates for all 26
letters, including the sparse ones.

**WL-109 · Difficulty selection strategies** — M · 1.5d · WL-108
Implement the three selection methods from Architecture §6 that ranking alone doesn't
cover: Easy = random from top candidates; Medium = weighted random from top 3–5; Hard =
top-ranked with occasional second-best. Seedable RNG so tests are deterministic.
*Done when:* over 1000 simulated turns per difficulty, selection distributions match the
spec, and Hard never picks a word outside the top 2.

**WL-110 · Game session state machine** — L · 2d · WL-107, WL-109
Own the 7 `TurnPhase` values and the 5 `GameStatus` values already declared in
`types/game.ts`. Detect both no-valid-move conditions (PRD §24 "Game ending") and
dictionary exhaustion (draw). **Decide here or in WL-308, not both:** the Data Model doc's
ratification pass (§12 item 8) found that no status value anywhere — not `GameStatus`, not
`RoundSummary.result` — distinctly represents Wireframe §14's "technical failure" result
state; it's currently silently absorbed into whichever status is closest. Either add a
`GameStatus` value for it here, or explicitly decide it's out of scope and document why.
*Done when:* transitions are exhaustively tested, including player-has-no-move,
computer-has-no-move, draw, and a deliberate (not accidental) answer for technical
failure.

**WL-111 · Wire rarity bonus into scoring** — S · 0.5d · WL-102, WL-110
Feed the commonness tier into the existing `rarity_bonus` (0 / +5 / +10 per Architecture
§7). Add round-level bonuses (+20 win, +5 per personal-best milestone).
*Done when:* scoring tests cover all three rarity tiers, the hint penalties (−5 / −10), and
the length-bonus cap of 20.

**WL-112 · Starting-word selection** — S · 0.5d · WL-108
Pick starting words that don't hand the player an immediately dead letter, and vary them
across rounds so replays don't feel identical.
*Done when:* 100 generated starting words all leave ≥20 valid player replies, with no
repeat inside any 10-round window.

**WL-113 · Headless round simulator** — M · 1.5d · WL-110, WL-111
A CLI harness that plays complete rounds. This is the tuning instrument for Architecture
§6 and §7, and the fastest way to catch a broken Hard mode before it reaches a player.
*Done when:* `npm run simulate -- --difficulty hard --rounds 500` reports win rate, mean
chain length, mean score, and dead-letter frequency.

> **Phase 1 gate:** the simulator reports a plausible win-rate spread across the three
> difficulties (Easy clearly player-favoured, Hard 20–40% per section 2). If Hard sits at
> 0–5%, retune the §6 weights *now* — not after real players have abandoned it. This is the
> PRD §9.4 risk, caught cheaply.

---

### Phase 2 — Design system in code

Goal: a component vocabulary that makes Phase 3 assembly rather than invention. Can run
partly in parallel with Phase 1 — different skills, no shared files.

**WL-201 · Font selection, licensing, and bundling** — M · 1.5d · D-06
Select and license the display and monospace faces. Bundle and verify rendering on both
platforms.
*Done when:* both faces render on device at every size in the §2 type scale, including
64px display and 12px mono, with the licence recorded.

**WL-202 · Contrast-verify the palette** — S · 1d · none
Design System §9 open item 2: run every actual text-on-fill pairing through a contrast
checker at WCAG AA (4.5:1 body, 3:1 large). Amend the doc's hex values where a pairing
fails.
*Done when:* a committed pairing matrix shows a pass for every combination used, and the
Design System doc is updated with any changed hexes.

**WL-203 · Token layer** — M · 1.5d · WL-201, WL-202, D-05
Replace the placeholder `theme.ts` with real tokens: colours, type scale, 4px spacing
scale, radii (20 / 16 / 999), border weights (2–4px), offset-shadow specs, rotation
range.
*Done when:* no screen or component references a raw hex, px font size, or shadow value —
a lint rule enforces this.

**WL-204 · Core component set** — L · 3d · WL-203
Per Design System §4, every component carrying **both** halves of the hybrid — thick `ink`
border and hard offset shadow **and** rounded puffy geometry: Button (primary / secondary
/ disabled, with the press-into-shadow state from §4), Card (with permitted rotation),
Input (focus → `grape` border, error → `red-alert` border **plus** icon and text), Badge/
sticker (pill, rotated 3–6°), BottomSheet/Modal (10–12px offset shadow).
*Done when:* each component renders every specified state, disabled buttons drop the
shadow entirely, and no component uses a blurred shadow.

**WL-205 · Motion primitives with reduced-motion fallbacks** — M · 1.5d · WL-204
Per Design System §5: scale-punch, colour flash, spring modal entry, horizontal shake,
3-dot typographic thinking indicator. **Every one needs a non-animated equivalent that
still communicates the state change.** No particle effects or confetti — explicitly
rejected in §5.
*Done when:* with OS reduced-motion enabled, every state change is still legible, verified
by a checklist walkthrough.

**WL-206 · Component gallery screen** — S · 1d · WL-204, WL-205
A dev-only screen rendering every component in every state. Cheap, and it's how design
reviews and visual regressions actually get caught.
*Done when:* reachable in dev builds and covering all WL-204 and WL-205 output.

**WL-207 · Custom iconography** — M · 2d · WL-203
Design System §7 rejects Material/Feather-style line icons. Needs a small custom set
(settings, back, pause, hint, close, sound, haptics) at 3–4px single-weight strokes
matching component border weight.
*Done when:* every icon in the app is from this set; no stock icon library is a dependency.

---

### Phase 3 — Playable core loop → **M1**

Goal: the thing the whole product rests on. Wireframe §21 says design the game screen
first; the same applies to building it.

**WL-301 · Game screen layout** — L · 2.5d · WL-204, WL-110
All Wireframe §8 required elements. The required-letter callout is the single largest
element on screen (64px display, `bubblegum`, heaviest shadow, never rotated, always
accompanied by its text label) per Design System §6.
*Done when:* the callout is verifiably the largest text element, and the layout holds on
the smallest device in the WL-005 matrix.

**WL-302 · The seven game-screen states** — L · 2d · WL-301
Wireframe §9: player turn, input empty, validating, computer thinking, invalid word, valid
move, no computer move. Each has specific input/submit/message behaviour.
*Done when:* all seven are individually reachable and each matches its §9 spec exactly.

**WL-303 · Input behaviour** — M · 1.5d · WL-301
Wireframe §8: autofocus on turn start, keyboard submit, submit disabled while empty, trim
spaces, case-insensitive, submission blocked while the computer responds. Plus keyboard
avoidance — §19 requires input and Submit to stay visible above the keyboard.
*Done when:* every bullet is verified on both platforms with the keyboard open, on a small
phone.

**WL-304 · Invalid-word feedback** — M · 1.5d · WL-302, WL-107
All 7 rows of the Wireframe §10 message table, with the exact copy. Input retains the
submitted word so the player can edit rather than retype. No internal dictionary detail
leaks into the message.
*Done when:* each of the 7 reasons produces its specified message and the player can
recover from every one.

**WL-305 · Chain display** — M · 1d · WL-301
Recent chain plus a "view previous words" expansion. New entries stamp in with a scale-in;
existing entries must not reflow or animate (Design System §5).
*Done when:* a 30-word chain renders without layout thrash and only the new entry animates.

**WL-306 · Computer turn orchestration** — M · 1.5d · WL-302, WL-109
Thinking state, a deliberate minimum think delay so instant responses don't feel
mechanical, and the Wireframe §17 timeout state ("taking longer than expected" with Try
Again / End Round).
*Done when:* the thinking indicator is always visible for the minimum duration, and the
timeout path is reachable and recoverable.

**WL-307 · Hint sheet, levels 1–3** — M · 1.5d · WL-204, WL-108
Wireframe §11 bottom sheet with hint levels 1–3 (required letter, count of available
common words, example word) — all servable from local data, no API. Level 4
(definition-based clue) is Phase 5. Per-round limit, and the §11 rule that a word is never
auto-revealed without the player explicitly choosing that level.
*Done when:* each level shows correct information, the limit is enforced, and the correct
hint penalty (−5 / −10) reaches the score.

**WL-308 · Game-over screen** — M · 1.5d · WL-110, WL-204
Wireframe §14: all 5 result states (player win, computer win, draw/exhausted, player exit,
technical failure), score, words played, longest chain, and the three actions. Encouraging
rather than competitive tone per §14.
*Done when:* all 5 states render, and Play Again returns to difficulty selection with no
state leaking from the previous round.

**WL-309 · Difficulty selection wiring** — S · 1d · WL-204
Wireframe §6: Easy preselected, plain-language descriptions, selection persists into the
session.
*Done when:* the selected difficulty demonstrably drives the engine's selection strategy.

**WL-310 · M1 device pass** — M · 1d · all Phase 3
Play 20 complete rounds across all three difficulties on physical iOS and Android.
*Done when:* 20 rounds complete with no crash, no stuck state, and no unreadable layout.

> **M1 gate:** a full round is playable on a real device. Anyone on the team can pick up a
> phone and finish a game. Also the point to start D-10 name clearance.

---

### Phase 4 — App shell, persistence, accessibility

**WL-401 · Navigation and back behaviour** — M · 1.5d · WL-308
Wireframe §2 structure. Android hardware back and iOS safe areas per §19. Confirmation
before any action that discards a round.
*Done when:* every screen's back behaviour is defined and correct on both platforms, and
Android back never silently destroys an in-progress game.

> **Defect found on-device 2026-08-18 (during WL-107 verification), logged here rather
> than fixed out-of-phase:** no screen wraps its content in a safe-area view, so on a
> notched device the first control on each screen renders *underneath* the Dynamic
> Island and does not receive taps. Verified on an iPhone 17 Pro simulator: Home's
> "Start Game" (the primary CTA, and the only route to Difficulty → Game) is
> unreachable, while lower controls on the same screen navigate normally. `App.tsx`
> already mounts `SafeAreaProvider`, but no screen consumes it. This makes the app
> effectively unplayable on modern iPhones today and should be treated as the first
> item of this task, not a polish pass. Separately, some skeleton buttons aren't wired
> to any handler yet (How to Play's "Got It" is a no-op) — expected at this stage,
> noted so it isn't mistaken for the same bug.

**WL-402 · Guest profile and local persistence** — M · 2d · WL-002
Persist the `GuestProfile` shape from the trigger policy doc: `guest_id`, `created_at`,
`last_active_at`, `games_played`, `local_scores`, `local_streak`, `discovered_words`,
`settings`. Created locally on first launch, no server call (Architecture §8.1, Guest
Deletion doc "best v1 approach").
*Done when:* profile survives cold start and app update; a fresh install creates a new
guest.

**WL-403 · In-progress game save and restore** — M · 1.5d · WL-402, WL-110
Wireframe §13 requires the chain to survive a temporary exit. Save after every turn;
restore on launch.
*Done when:* backgrounding, force-quitting, and OS-killing the app all restore the exact
round state including chain, score, and hints used.

**WL-404 · Pause screen** — S · 1d · WL-401
Wireframe §13: Resume, How to Play, Restart, Exit to Home. Confirm before restart or exit.
*Done when:* all four actions work and both destructive ones confirm first.

**WL-405 · Home screen** — M · 1.5d · WL-402, WL-204
Wireframe §5: start game, best score, best streak, Word Review, How to Play, Settings.
Empty state ("No games completed yet") per §17. Per §5, **no** shop, feed, leaderboard, or
dashboard.
*Done when:* stats read from the persisted profile and the empty state shows on a fresh
install.

**WL-406 · Welcome and How to Play** — S · 1d · WL-204
Wireframe §4 and §7. Welcome shown on first launch only. How to Play uses the concrete
apple→elephant→table example, not abstract rules.
*Done when:* Welcome appears once, and How to Play covers exactly the six v1 rules from §7.

**WL-407 · Settings screen** — M · 1.5d · WL-405, D-05
Wireframe §16 minus whatever D-04 and D-05 remove: sound, haptics, text size, reset
statistics, privacy policy, terms, report a word, contact support. Plus the Attributions
screen carrying the WL-101 notices, and "Delete guest data" per the Guest Deletion doc.
**The Account row is already done** — D-04 closed, and `SettingsScreen.tsx` shows only
"Continue as guest," gated behind `ACCOUNTS_ENABLED_V1`, ahead of the rest of this task.
*Done when:* every toggle persists and takes effect immediately; reset and delete both
confirm first.

**WL-408 · Accessibility pass** — L · 2.5d · all Phase 3
Wireframe §18: screen-reader labels on every control, error announcements via live region,
large tap targets, no colour-only meaning, visible focus states, keyboard submission,
reduced-motion honoured, and text-size scaling. **Highest risk here: a 64px display glyph
at the largest OS text setting will overflow** — needs an explicit clamping strategy.
*Done when:* a full VoiceOver and TalkBack walkthrough of the core loop succeeds, and the
game screen stays usable at the largest system text size.

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
     can't be fixed in a doc; it needs a value added to the shipped `GameStatus` type.
     Flagged against `WL-110`/`WL-308` (updated above) so it's decided once, not twice.
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

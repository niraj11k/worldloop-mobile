# WordLoop Beta Release Readiness Report

**Version:** 1.0
**As of:** 2026-11-11 (branch `hotfix/ci-build-error-fix`, HEAD `b0be3c1`, tree clean)
**Status:** Analysis — introduces no new product scope. Recommendations are marked **[Recommendation]**; items that are my judgement rather than a documented fact are marked **[Inference]**.
**Companion doc:** `WordLoop_Beta_Blocker_Register.md` (the itemised register with IDs, sources and unblock actions)
**Sources read:** every doc in `proj-docs/` (Delivery Plan in full for Phases 0–1 status notes, Phases 3–9, §§2–11; Store Submission Checklist in full), `README.md`, `package.json`, `.github/workflows/ci.yml`, `android/app/build.gradle`, `ios/` project files, the `src/` tree and `scripts/`, git history to HEAD, the auto-memory project notes, and the transcripts of the WordLoop Claude Code sessions (most usefully *Phase 6 engineering readiness*, *Testing app on physical devices*, *Review computer-playable religious/ethnic adjectives*).

---

## 1. What "beta" means here

The Delivery Plan has no milestone called beta. It has four (§2 "Release milestones"):

| Milestone | Contents | Audience |
|---|---|---|
| M1 — Internal playable | End of Phase 3 | Team, dev build |
| **M2 — Playtest build** | End of Phase 6 + 7-day take-home week | 5–10 recruited players, via TestFlight and Play internal testing |
| M3 — Store release | End of Phase 8 | Public |
| M4 — Validation readout | Phase 9 | Internal |

**This report treats "beta" as M2**: the first build that goes to people outside the team, through TestFlight and Google Play internal testing (WL-606). That is the only external-tester milestone the plan defines. Everything required for M3 (public store release) is listed separately in §6 as **post-beta**, so nothing is lost, but it does not gate the beta.

> If you meant an open or public beta (anyone can join), the scope is closer to M3 and §6 moves into the blocking list. Tell me and I will re-cut the register.

## 2. Bottom line

- **The game itself is built.** Phases 0–5 and the three vocabulary-reframe tasks (WL-410/411/412, done 2026-11-04) are complete. All product decisions D-01..D-18 are closed except D-10 (name clearance), which is still open and has an external lead time.
- **What stands between today and a beta build is Phase 6 plus release plumbing.** Phase 6 (analytics, events, dashboard, playtest build) has not started: `src/features/analytics/` is an empty directory, there is no `@react-native-firebase/analytics` dependency and no `firebase.json`.
- **Nothing the plan lists is blocked by an undecided product question.** The blocks are all external: Apple Developer Program and Play Console enrolment, a final bundle ID (D-10), and physical devices. Two of them (enrolment, D-10) have lead time, so they are the first things to start.
- **One defect has no task against it** and affects the core loop (the "stuck player" reply-count bug, §4.3). It should be fixed before testers play long games.
- **Engineering effort to beta, from the plan's own estimates: about 9 working days for one engineer** (§7), plus external lead time that runs in parallel. That is arithmetic on the plan's numbers, not a commitment; the plan itself notes an additional week for the take-home period, which sits after the build ships.

## 3. State snapshot

| Area | State | Evidence |
|---|---|---|
| Native projects, CI | Done. `ios/` and `android/` committed; CI builds both platforms (debug) plus lint, typecheck, tests, contrast, font, attribution and audit gates | `ci.yml` has `verify`, `build-ios`, `build-android` |
| Dictionary and engine | Done (WL-101..113). Bundle 1.74MB, budgets met on simulator/emulator only | Delivery Plan WL-105/106 |
| Design system | Done (WL-201..207) | Delivery Plan |
| Core loop (Phase 3) | Done except WL-310 device pass | Delivery Plan |
| App shell (Phase 4) | Done. WL-408 has the screen-reader walkthrough outstanding | Delivery Plan |
| Learning layer (Phase 5) | Done (WL-501..506) | Delivery Plan |
| Reframe (D-13..D-15) | Done (WL-410/411/412) | Delivery Plan, git log |
| Dictionary re-bundle (D-17/D-18) | Done, merged (PRs #46/#47) | git log |
| **Phase 6 (WL-601..606)** | **Not started** | No analytics code, package or `firebase.json` |
| Release signing | Not done. Android `release` build type uses `signingConfigs.debug` | `android/app/build.gradle:105-109` |
| App versions | `versionCode 1` / `versionName 1.0`; iOS `MARKETING_VERSION 1.0` / build 1 | `build.gradle`, `project.pbxproj` |
| iOS app icon | **Missing image files**: `AppIcon.appiconset/` contains only `Contents.json` | `ls ios/WordLoop/Images.xcassets/AppIcon.appiconset` |
| Firebase config files | Present: `android/app/google-services.json`, `ios/WordLoop/GoogleService-Info.plist` | `git ls-files` |
| Dependency audit | One reviewed exception (`deepmerge`), expires **2027-02-05** | `audit-allowlist.json` |
| Physical-device testing | iPhone 14 Pro was used once (2026-08-30/09-01) and found real keyboard bugs. No structured pass has happened. No Android physical device evidence | Sessions *Testing app on physical devices*, *iPhone 14 Pro layout issues*; WL-310 note |

## 4. Pending engineering work (needed for the beta build)

Estimates are the plan's own unless marked **[Inference]**.

### 4.1 Phase 6 — the critical path

| ID | Task | Estimate | Depends on | Notes |
|---|---|---|---|---|
| WL-601 | Analytics layer (Firebase Analytics, D-12/D-16) | 2–2.5d | none (decisions closed) | Native-off via `firebase.json`; `ANALYTICS_ENABLED` flag; "Share anonymous usage data" toggle (Wireframe §16, Data Model §2.1); Delete My Data keeps the choice and resets the analytics ID; GA4 event retention set to 2 months. Done-when needs an empty DebugView on first launch in three off-states and a populated one on a scripted session. **Needs a real device run** |
| WL-602 | Gameplay events (PRD §23) | 1.5d | WL-601 | Includes `ended_by_player` and `ended_while_pause_slot_full`. No event may carry a typed word, enforced by a test (D-16) |
| WL-604 | Metrics dashboard | 1.5d | WL-602 | Mostly GA4 configuration. Needs per-cohort view so the take-home week reads separately. Gates 1–2 come from moderator notes |
| WL-606 | Playtest build and moderation script | 1.5d | all Phase 5, plus the external items in §5 | TestFlight + Play internal testing; script must define "explained again" and "stuck" precisely (D-09). Allow 1–2 days for TestFlight Beta App Review |

### 4.2 Verification work that is documented as outstanding

| ID | Task | Estimate | Why it is not done |
|---|---|---|---|
| WL-310 | M1 device pass: 20 rounds across all difficulties on **physical** iOS and Android | 1d | The task needs hardware the build environment did not have. It also absorbs five deferred checks: WL-105 and WL-106 budgets on the slowest matrix device (WL-106 has only ~2× headroom on the Android emulator), the WL-312 sheet-keyboard lift, WL-506 real airplane-mode behaviour, and Medium/Hard on Android |
| WL-408 | VoiceOver and TalkBack walkthrough of the core loop | **[Inference]** 0.5d | Engineering is done; the accessibility tree was checked with `uiautomator dump`, but no screen reader was ever run. The plan's own done-when for WL-408 is this walkthrough |

### 4.3 Defect with no task — "stuck player" reply count

**Not in the Delivery Plan task list; recorded only in the WL-113 notes and raised in the *Phase 6 engineering readiness* session.**

- `replyCounts` in the bundled dictionary (`scripts/generate-dictionary.py:273`, `reply_counts_by_letter`) counts every allowed word per first letter and does not exclude words under `MIN_WORD_LENGTH`.
- In a long game, a letter's longer words run out and what remains can be entirely 1–2 letter entries that the count still treats as available.
- The simulator measured this firing in 29/30 Medium and 30/30 Hard rounds. The simulator ends the round correctly; **`gameSession.ts` and `GameScreen.tsx` have no equivalent fallback**, so a genuinely stuck player is never told the game is over.
- End Game (WL-412) now gives the player a way out, so this is no longer a trap, but the count is still wrong. It also feeds `option_reduction_score`, so WL-605 tuning would be reading skewed numbers.
- **[Recommendation]** Fix before the beta: filter by minimum length in `reply_counts_by_letter`, regenerate the pack, re-run `dictionary:verify` and the WL-113 simulator, and add the equivalent "no valid reply" check in the session. **[Inference]** 0.5–1d. Word count and record order do not change, so `definitions.pack.json` alignment is unaffected (same argument D-17 used). Gate 2 ("knows what to do next") is the one a testers' stuck game would fail.

### 4.4 Release plumbing needed to ship any build to testers

These are not separate numbered tasks in the plan for the beta; they are the parts of WL-804 and WL-803 that a TestFlight/Play upload cannot avoid. The plan places them in Phase 8, but WL-606 depends on them in practice. **[Inference]**

| Item | Today | Needed for beta |
|---|---|---|
| Android signing | Release uses the debug keystore | Generate an upload keystore; keep it out of git; configure Play App Signing |
| iOS signing | Free-Apple-ID dev signing only (expires every 7 days, device must be plugged in) | Paid Apple Developer Program team, distribution certificate and profile, archive and upload |
| Version numbers | 1 / 1.0 | Build number must increase for each upload |
| iOS app icon | No image files in the asset catalog | Real 1024px icon (WL-803 owns the full icon set) |
| Bundle ID | `com.wordloop.mobile`, provisional | Final value before the **first** upload; it cannot change afterwards (D-10) |
| Crashlytics from a release build | WL-003 was proven on a release build | Re-confirm symbolication on the signed beta build (the WL-804 done-when) |
| ProGuard/R8, bundle size, source maps | Not hardened | Needed for symbolicated crash reports from testers |

## 5. Blocked items (and what unblocks them)

Nothing is blocked on a product decision. The blocks are:

| # | Blocked item | Blocked by | Unblock | Lead time |
|---|---|---|---|---|
| 1 | WL-606 (any tester build) | Apple Developer Program enrolment (paid, $99/yr per the device-testing session) and Google Play Console account | Owner enrols | Days to weeks (identity verification) **[Inference]** |
| 2 | First TestFlight/Play upload | **D-10** product name clearance (store availability, domain, handles, trademark) → final bundle ID | Run the PRD §30 checks. The plan said to start this at Phase 3 / M1 and it has not been done | External |
| 3 | WL-310, WL-408 walkthrough, WL-601 DebugView proof | Physical devices and a screen reader | A person with an iPhone and an Android phone. The iPhone 14 Pro is available. An Android phone is not evidenced anywhere | — |
| 4 | WL-601 start | A small decision: Firebase announced it is ending CocoaPods publishing for new iOS releases after October 2026, and WL-601 adds a new Firebase pod | Decide whether to stay on the current setup now or plan the move first (raised in the *Phase 6 engineering readiness* session; a "Plan Firebase iOS move off CocoaPods" chip exists there). I could not verify the Firebase announcement independently | — |
| 5 | Recruiting minors as testers | The open question on audience (13+ general vs kids/education). Kids/Education categories restrict third-party analytics and would reopen D-12 | Decide the audience before recruiting. If all testers are adults and consent informally per WL-606's script, the beta is unaffected; the question then moves to M3 | — |

## 6. Post-beta: required for M3 (public store release)

Not blocking the beta, listed so the beta does not hide them. Full detail is in the Store Submission Checklist.

- **WL-801** privacy policy and terms — **blocked on legal**: EU/UK analytics consent (opt-out as built, or opt-in behind a consent prompt) must be settled first (D-16, Checklist legal item 6). The built design makes switching a constant change plus a consent screen.
- **WL-802** Apple App Privacy and Google Play Data Safety, cross-checked against the fired-event list.
- **WL-803** store listings, icon set, screenshots, age rating (legal item 5).
- **WL-804** release hardening: ProGuard/R8, cold start on the slowest device, export-compliance answers.
- **WL-805** full QA matrix, including tablet landscape on a real tablet (WL-409 never saw it) and offline states on a device.
- **WL-806** submission, with budget for a rejection round.
- **Legal sign-offs 1, 2, 3, 5, 6** (COCA provenance, commercial-bundling reading of the ESDB licence, font licence check, age rating, analytics consent).
- **Small open Checklist gaps:** support contact row in Settings (no address decided), LDNOOBW creator attribution, vendoring a frozen copy of the ESDB `Copyright` file, privacy handling of `WordReport.player_comment`, a final grep for stock icons.
- **WL-603** (dormant account-prompt events) is listed in Phase 6 but feeds nothing in v1. **[Recommendation]** defer to 1.1 with Phase 7 so it does not sit on the beta path.
- **Phase 7 (accounts/backend, WL-701..710)** is the 1.1 release by D-04 and is out of scope for both beta and v1.

## 7. Suggested sequence and effort

```text
Start now, in parallel (owner, no code):
  • Apple Developer + Play Console enrolment
  • D-10 name clearance  ->  final bundle ID
  • Decide: Firebase/CocoaPods timing; tester audience

Engineering, one engineer:
  1. Stuck-player reply-count fix ............ ~0.5-1d  [Inference]
  2. WL-601 analytics layer .................. 2-2.5d
  3. WL-602 gameplay events .................. 1.5d
  4. WL-604 dashboard config (can overlap 3) . 1.5d
  5. Signing, versioning, icon, R8 for beta .. ~1d     [Inference]
  6. WL-310 + WL-408 device and screen-reader . 1.5d   (needs devices and a person)
  7. WL-606 build + script ................... 1.5d  (+1-2d Beta App Review)
                                               ------
                                               ~9-11 working days
Then: moderated session + 7-day take-home -> M2 gate (five D-09 gates)
```

Steps 1 and 5 have no dependency on analytics and can start immediately. Step 6's device work should happen before testers receive the build, not after.

## 8. Documentation debt found while reading

Not engineering blockers, but each contradicts `CLAUDE.md`'s rule that code and docs be reconciled. None was changed here.

1. **`README.md` still opens "Scaffold only. No gameplay is fully wired up yet."** Delivery Plan §10 item 7 scheduled a rewrite at M1.
2. **Delivery Plan §1 "Where we actually are" is stale** — it says `ios/` and `android/` do not exist, the dictionary is a stub, and screens are skeletons. The header still reads "Version 0.1, Draft — not yet approved".
3. **Several tasks carry no status marker although the work is evidently done**: WL-001, 002, 004, 005, 102, 105, 106, 107. WL-004's done-when is met by `ci.yml`. WL-105/106 headings are unmarked but their bodies say DONE.
4. **WL-103's heading says "formal fixture suite still open"** while its body says the fixture test is DONE (`npm run dictionary:verify`). One of them is wrong.
5. **WL-408 and WL-310 are the only two tasks whose done-when is knowingly unmet**, and both say so clearly. Keep them visible; do not let a later phase's "all Phase 3" dependency quietly absorb them.
6. **Time-boxed item:** the `deepmerge` audit exception expires 2027-02-05. The weekly CI cron will fail on that date if it is neither re-reviewed nor removed.

## 9. What I did not verify

- I did not run the test suite, typecheck, lint or any build; the status above is from the repository files and the recorded notes, not a fresh run.
- I could not confirm whether an Android physical device exists, whether an Apple Developer or Play account has been started, or whether any name-clearance work has happened outside the repo.
- The Firebase CocoaPods announcement comes from an earlier session's summary, not an independent check.
- I did not open the older sessions beyond the ones listed in the header; unrelated projects' sessions (Prompt Genie etc.) were excluded.

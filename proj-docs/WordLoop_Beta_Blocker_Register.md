# WordLoop Beta Blocker Register

**Version:** 1.0
**As of:** 2026-11-11
**Status:** Working register. Companion to `WordLoop_Beta_Release_Readiness_Report.md`, which explains the scope ("beta" = Delivery Plan milestone **M2**, the TestFlight / Play internal testing build) and the reasoning. This doc is the itemised list to work from and tick off.
**Source of truth:** the Delivery Plan. If this register and the plan disagree, the plan wins; fix this doc.

**Legend**

| Field | Meaning |
|---|---|
| **Class** | **ENG** engineering task · **VER** verification that needs a person/device · **EXT** external or non-engineering dependency · **DEC** decision needed · **DOC** documentation debt |
| **State** | **Pending** (can start now) · **Blocked** (cannot start until the listed item clears) · **Open** (decision/outside work) |
| **Gate** | **Beta** = must clear before the M2 build goes to testers · **Beta-parallel** = must finish before the readout, can overlap · **Post-beta** = needed for M3 |
| `[Inference]` | My judgement or estimate, not stated in a project doc |

---

## A. Beta-blocking

| ID | Class | Item | State | Gate | Est. | Depends on / blocked by | Source | Unblock action |
|---|---|---|---|---|---|---|---|---|
| BR-01 | EXT | Apple Developer Program enrolment (paid) | Open | Beta | owner time | — | Session *Testing app on physical devices*; Delivery Plan WL-606 | Owner enrols. Free Apple ID builds expire in 7 days and install only by cable, so no remote tester can use them |
| BR-02 | EXT | Google Play Console account and an internal-testing track | Open | Beta | owner time | — | Delivery Plan WL-606 | Owner creates the account |
| BR-03 | DEC/EXT | **D-10** product name clearance → final bundle ID / package name | Open | Beta | external | — | Delivery Plan D-10; PRD §30; Checklist §A | Run the store, domain, handle and trademark checks. The plan said to start at Phase 3 / M1 and no record shows it started. Bundle ID `com.wordloop.mobile` is provisional and cannot change after the first upload |
| BR-04 | DEC | Firebase on iOS: timing of the CocoaPods question before WL-601 adds a pod | Open | Beta | decision | — | Session *Phase 6 engineering readiness* (unverified externally) | Decide "now" or "later"; the session recommended starting WL-601 on the current setup |
| BR-05 | DEC | Tester audience: adults / 13+ general vs kids-education | Open | Beta | decision | — | Memory note on the reframe; D-12 | If any tester may be a minor, decide before recruiting. Kids/Education store categories restrict third-party analytics and would reopen D-12 |
| BR-06 | ENG | **WL-601** Analytics layer: `@react-native-firebase/analytics`, `firebase.json` native-off, `ANALYTICS_ENABLED` flag, Settings toggle "Share anonymous usage data", Delete My Data keeps the choice and resets the analytics ID, GA4 retention 2 months | Pending | Beta | 2–2.5d | D-12, D-16 (both closed) | Delivery Plan WL-601, D-12, D-16 | Start. `src/features/analytics/` is empty today; no `firebase.json`. Done-when includes an empty DebugView in three off-states **including first launch**, and a populated one on a real run |
| BR-07 | ENG | **WL-602** Gameplay events per PRD §23, with `ended_by_player` and `ended_while_pause_slot_full`; test that no payload contains a typed word | Blocked | Beta | 1.5d | BR-06 | Delivery Plan WL-602, D-13, D-15, D-16 | After BR-06 |
| BR-08 | ENG | **WL-604** Metrics dashboard (GA4 configuration, per-cohort view for the take-home week) | Blocked | Beta-parallel | 1.5d | BR-07 | Delivery Plan WL-604, D-09 | Configure while BR-09 and BR-10 run; must be readable before the readout |
| BR-09 | ENG | ~~**Stuck-player reply-count defect**~~ **DONE 2026-11-11 as WL-114.** `reply_counts_by_letter` now applies `MIN_WORD_LENGTH`; pack regenerated (only `replyCounts` changed, 215 phantom replies removed); `dictionary:verify` passes; simulator phantom dead ends went 29/30 Medium and 30/30 Hard → 0/30; 482 tests pass. No `gameSession`/`GameScreen` change was needed: the session already ended the round on a zero count, the count was wrong | Done | Beta | 0.5–1d | — | Delivery Plan WL-114; WL-113 finding 3 | Closed. WL-605 can rely on the counts |
| BR-10 | ENG | Release plumbing for a signed beta build: Android upload keystore (release currently uses the debug keystore), iOS distribution signing, incrementing build numbers, real iOS app-icon images (asset catalog has only `Contents.json`), R8/ProGuard check, source-map upload, Crashlytics symbolication on the signed build | Blocked | Beta | `[Inference]` ~1d | BR-01, BR-02, BR-03 | `android/app/build.gradle:105-109`; Delivery Plan WL-804, WL-803; Checklist §E | Do the minimum for WL-606; leave store-listing polish to BR-20 |
| BR-11 | VER | **WL-310** M1 physical-device pass: 20 rounds across all difficulties on real iOS and Android, plus the deferred checks: WL-105/106 budgets on low-end hardware (WL-106 has ~2× headroom on the emulator), WL-312 keyboard lift on a sheet, WL-506 real airplane mode, Medium/Hard on Android | Pending (needs hardware) | Beta | 1d | An iPhone (exists) and an **Android phone (not evidenced)** | Delivery Plan WL-310, WL-105, WL-106, WL-312, WL-506 | Owner runs it, ideally before testers get the build |
| BR-12 | VER | **WL-408** VoiceOver and TalkBack walkthrough of the core loop | Pending (needs person + device) | Beta | `[Inference]` 0.5d | — | Delivery Plan WL-408; Checklist §F | Listen to the app with both screen readers. The tree was checked with `uiautomator dump` only |
| BR-13 | ENG | **WL-606** Playtest build and moderation script: TestFlight + Play internal builds; script scoring all five D-09 gates and defining "explained again" and "stuck"; handover of the 7-day take-home week | Blocked | Beta | 1.5d + 1–2d Beta App Review | BR-01..03, BR-06, BR-07, BR-10, all Phase 5 (done) | Delivery Plan WL-606, D-09 | Last step before the session |

## B. Beta follow-through (after the build ships)

| ID | Class | Item | State | Gate | Est. | Source |
|---|---|---|---|---|---|---|
| BR-14 | EXT | Moderated session with 5–10 players, then the 7-day take-home week | Blocked on BR-13 | M2 gate | ~2 wks | Delivery Plan §2, D-09 |
| BR-15 | EXT | Score the five D-09 gates; name the core-loop fix for any failing gate; re-confirm the provisional M4 targets | Blocked on BR-14 | M2 gate | 1–2d | Delivery Plan §2 |
| BR-16 | ENG | **WL-605** Difficulty and scoring tuning, set from playtest data (turns per game by difficulty, split by `ended_by_player`); update Architecture §6/§7 with tuned values and evidence | Blocked on BR-08, BR-15 | After beta | 2d | Delivery Plan WL-605, D-09 |

## C. Post-beta, required for M3 (public store release)

| ID | Class | Item | State | Notes / source |
|---|---|---|---|---|
| BR-17 | DEC (legal) | EU/UK analytics consent model: opt-out as built vs opt-in behind a consent prompt | Open — **blocks BR-18** | D-16; Checklist legal item 6. Switching is a constant change plus a consent screen |
| BR-18 | ENG/DOC | **WL-801** privacy policy and terms; must name Google Analytics for Firebase, describe the opt-out, word GA4 retention honestly (2 months event-level; aggregated reports not covered); must not claim uninstall deletes data | Blocked on BR-17 | Delivery Plan WL-801; Checklist §B |
| BR-19 | ENG/DOC | **WL-802** Apple App Privacy + Google Play Data Safety, cross-checked against the fired-event list | Blocked on BR-18 | Delivery Plan WL-802 |
| BR-20 | ENG | **WL-803** store listings, icon set, screenshots, age rating | Blocked on BR-03 | Age rating is legal item 5 |
| BR-21 | ENG | **WL-804** remaining hardening: cold start on the slowest device, export-compliance answers | Pending after BR-10 | Checklist §D/§E |
| BR-22 | VER | **WL-805** pre-submission QA matrix, including **tablet landscape on a real tablet** and offline states on device | Blocked on beta fixes | Checklist §E/§F |
| BR-23 | EXT | **WL-806** submission, with a rejection round budgeted | Blocked on all above | Delivery Plan |
| BR-24 | LEGAL | Sign-offs: COCA provenance; commercial-bundling reading of ESDB licence; font licence (D-06 closed, check still to be signed); age rating | Open | Checklist "Items needing legal or compliance sign-off" 1, 2, 3, 5 |
| BR-25 | ENG | Small Checklist gaps: Settings support-contact row (no address decided); LDNOOBW creator attribution; vendored frozen copy of the ESDB `Copyright` file; privacy handling of `WordReport.player_comment`; final grep for stock icons | Open | Checklist §A, §B, §D |
| BR-26 | ENG | **WL-603** dormant account-prompt events. `[Inference]` defer to 1.1; it feeds nothing in v1 | Pending, deferrable | Delivery Plan WL-603, D-04 |

Phase 7 (WL-701..710, accounts/backend) is the 1.1 release by D-04 and is deliberately not in this register.

## D. Documentation debt

| ID | Item | Where |
|---|---|---|
| BR-27 | README still says "Scaffold only. No gameplay is fully wired up yet." | `README.md`; Delivery Plan §10 item 7 |
| BR-28 | Delivery Plan §1 "Where we actually are" and the header ("v0.1, Draft — not yet approved") are stale | Delivery Plan lines 3–4, 25–45 |
| BR-29 | No status marker on WL-001, 002, 004, 005, 102, 105, 106, 107 although the work appears done | Delivery Plan §5 |
| BR-30 | WL-103 heading says "fixture suite still open"; its body says the fixture test is DONE | Delivery Plan WL-103 |
| BR-31 | `audit-allowlist.json` `deepmerge` exception expires 2027-02-05; CI's weekly cron fails after that date unless re-reviewed or removed | `audit-allowlist.json` |

---

## Counts

| Group | Items |
|---|---|
| Beta-blocking (A) | 13 — of which 5 are external or decisions (BR-01..05), 6 are engineering (BR-06..10, 13; BR-09 done), 2 need a person with a device (BR-11, 12) |
| Beta follow-through (B) | 3 |
| Post-beta for M3 (C) | 10 |
| Documentation debt (D) | 5 |

**Engineering effort inside group A, from the plan's estimates plus my two `[Inference]` figures: about 9–11 working days for one engineer**, excluding external lead time and the take-home week.

## Suggested order

1. **Today, no code:** BR-01, BR-02, BR-03 (long lead), BR-04, BR-05 decisions.
2. **Engineering, in this order:** BR-09 → BR-06 → BR-07 → BR-08 (parallel with BR-10) → BR-10 → BR-11 + BR-12 → BR-13.
3. **After the build:** BR-14 → BR-15 → BR-16, while BR-17 gets a legal answer so the M3 chain (BR-18..23) is not waiting when the beta ends.

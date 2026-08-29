# WordLoop Store Submission Checklist

**Version:** 1.0
**Status:** Draft — consolidates items already flagged across other docs; not yet a complete substitute for Apple/Google's own submission requirements
**Owner:** Product
**Gate:** every item below should be ✅ or explicitly waived before WL-806 (submit to stores)

---

## How to use this document

This is **not** a new source of requirements — it's an index. Every item cites the doc and
section it actually came from, so this can be worked through as a checklist without
re-reading five other documents, but the cited doc remains the source of truth if the two
ever disagree. Where an item is a standard store requirement that no existing WordLoop doc
has addressed yet, it's marked **[Gap]** rather than falsely attributed to a doc that
doesn't mention it — per `CLAUDE.md`'s rule to flag rather than silently resolve.

**Status legend:**

| Symbol | Meaning |
|---|---|
| ✅ | Done, verified |
| ⚠️ | Done in draft, but rests on a claim WordLoop can't independently verify — needs legal/compliance sign-off, not more engineering |
| 🔒 | Blocked on a Delivery Plan decision (D-0x) |
| ⬜ | Not started |

---

## A. Licensing & intellectual property

| Item | Status | Source | Delivery Plan task |
|---|---|---|---|
| Word-list licence reviewed and source selected | ✅ | `WordLoop_Word_List_Licence_Review.md` | WL-101 (done) |
| Required word-list attribution notices actually shipped in-app (Settings → Attributions), not just drafted | ✅ | `WordLoop_Word_List_Licence_Review.md` §7 | WL-407 (done 2026-08-29) |
| **All four** shipped notices stay byte-identical to their sources — ESDB and WordNet against the licence review, the SIL OFL 1.1 body against `licenses/fonts/`. Gated in CI (`npm run attributions:verify`), so a paraphrase cannot reach a build | ✅ | `src/constants/attributions.ts`; `scripts/verify-attributions.mjs` | WL-407 (done 2026-08-29) |
| LDNOOBW creator attribution confirmed against the upstream repository — CC-BY-4.0 asks the creator to be named, and no WordLoop document records one, so the shipped notice names the project rather than a company | ⚠️ | **[Gap]** — WL-104 recorded the licence but not an author; the app deliberately does not invent one | — (confirm before submission) |
| In-app **support contact**, which Wireframe §16 lists as a v1 settings row — no support address is decided in any document, so the row is deliberately absent from the shipped Settings screen rather than pointing nowhere | ⬜ | **[Gap]** — `WordLoop_User_Flows_and_Wireframe_Requirements.md` §16 lists it; no doc decides the address | — (needs a decision, then a row) |
| A frozen copy of the exact ESDB `Copyright` file text is vendored into the repo alongside the bundled dictionary asset — not just linked by URL, which can rot or be edited upstream after `rel-2026.02.25` | ⬜ | **[Gap]** — follows from PRD §25's "review licence before release; maintain source records" mitigation, but the specific action (vendor a copy, don't just link) isn't spelled out anywhere yet | WL-102 |
| **COCA data provenance**: the ESDB maintainer represents that COCA 3-gram data is redistributable under an NDA he signed, which WordLoop is not a party to and cannot independently verify | ⚠️ | `WordLoop_Word_List_Licence_Review.md` §8, item 1 | — (legal sign-off, not a build task) |
| **Commercial bundling reading**: confirm "permission to use, copy, modify, distribute, and sell... without fee" is read as covering a derived word list bundled inside a paid or ad-supported mobile app binary, not only standalone redistribution | ⚠️ | `WordLoop_Word_List_Licence_Review.md` §8, item 2 | — (legal sign-off) |
| Display and monospace font licences confirmed to permit mobile app bundling | 🔒 | `WordLoop_Design_System.md` §2 (open item 1); Delivery Plan D-06 | WL-201 |
| Product name cleared: App Store availability, Google Play availability, domain, social handles, trademark conflicts, search discoverability | ⬜ | `WordLoop_Product_Requirements_Document.md` §30; Delivery Plan D-10 | — (Phase 3 start, per Delivery Plan §11) |
| No stock/generic icon set remains in the shipped build (Design System explicitly rejects Material/Feather-style icons — worth a final grep before submission, not just a design-time rule) | ⬜ | `WordLoop_Design_System.md` §7 | WL-207 |

---

## B. Privacy & data handling

| Item | Status | Source | Delivery Plan task |
|---|---|---|---|
| Privacy policy exists and matches actual data collected | ⬜ | `WordLoop_Product_Requirements_Document.md` §22; `WordLoop_Guest_Data_Deletion_Policy.md` | WL-801 |
| Privacy policy does **not** claim uninstall deletes cloud/server-side data — it doesn't reliably fire, and the policy must say so | ⬜ | `WordLoop_Guest_Data_Deletion_Policy.md`, "Do not promise deletion on uninstall" | WL-801 |
| Terms of Use document exists (Settings lists it as a separate row from Privacy Policy) | ⬜ | `WordLoop_User_Flows_and_Wireframe_Requirements.md` §16 | WL-407, WL-801 |
| Analytics uses an anonymous identifier only; no unnecessary names/contacts collected | ⬜ | PRD §22 | WL-601 |
| Analytics and any optional advertising disclosed in the privacy policy | ⬜ | PRD §22 | WL-801 |
| Apple "App Privacy" nutrition label completed and cross-checked against the actual fired-event list (not the planned one) | ⬜ | Delivery Plan, common store-rejection cause noted in the risk table | WL-802 |
| Google Play "Data Safety" form completed and cross-checked the same way | ⬜ | Delivery Plan | WL-802 |
| ~~If any server-side guest record exists, scheduled deletion after the documented inactivity period is actually running, not just specified~~ | N/A for v1 | D-03 (resolved 2026-08-17): v1 is client-authoritative with no backend, so no server-side guest record exists to expire. Re-open if D-03 is ever reversed | — |
| "Report a word" free-text comment field (`WordReport.player_comment`) — confirm the privacy policy covers what happens to submitted comments, since it's user-authored free text even though it's never shown to other users | ⬜ | **[Gap]** — the field exists (PRD §26, `WordLoop_Data_Model.md` §8) but no doc currently addresses its privacy handling | WL-505, WL-801 |

---

## C. Account & deletion compliance

**D-04 is closed: v1 ships guest-only.** This entire section is confirmed **deferred to
the 1.1 accounts release** — none of it blocks v1 store submission. Not "waiting on a
decision" anymore, since the decision is made; "N/A for v1" below means exactly that, not
"still pending." Listed here so it isn't lost between now and 1.1 planning.

| Item | Status | Source | Delivery Plan task |
|---|---|---|---|
| In-app account deletion path exists, removing profile, saved words, scores/history, preferences, linked guest data, and the auth record | N/A for v1 | `WordLoop_Guest_Data_Deletion_Policy.md`, "Account deletion"; `WordLoop_Architecture.md` §8.5 | WL-708 (1.1) |
| Confirmation step required before deletion executes | N/A for v1 | `WordLoop_Guest_Data_Deletion_Policy.md` | WL-708 (1.1) |
| If deletion is asynchronous, the user is told expected processing time (Apple specifically advises this) | N/A for v1 | `WordLoop_Guest_Data_Deletion_Policy.md` | WL-708 (1.1) |
| Google Play web deletion-request page is live and linked from the store listing | N/A for v1 | `WordLoop_Guest_Data_Deletion_Policy.md`; Google Play account-deletion policy | WL-709 (1.1) |
| "Delete guest data" option available in Settings for unlinked guests, independent of full account deletion — shipped as "Delete My Data", confirms first, itemises what goes, and starts a fresh guest | ✅ (applies to v1 — not deferred, this one is guest-only by design, not accounts-gated) | `WordLoop_Guest_Data_Deletion_Policy.md`, "Guest deletion controls" | WL-407 (done 2026-08-29) |
| Apple's requirement to offer Sign in with Apple when other third-party logins are present, verified against **current** App Store guidelines | N/A for v1 ⚠️ (still needs legal/compliance sign-off before 1.1 ships auth providers) | `WordLoop_Architecture.md` §8.4 — already marked `[Unverified]` there | WL-703 (1.1) |

---

## D. Platform store requirements

| Item | Status | Source | Delivery Plan task |
|---|---|---|---|
| Age / content rating questionnaire answered deliberately, not defaulted — a casual word game is likely all-ages, but the free-text "Report a word" field and any future ads should be considered before answering | ⬜ | **[Gap]** — PRD §22 flags child/school privacy review as a *future* concern; no doc currently addresses the v1 store rating questionnaire itself | WL-803 |
| Export compliance / encryption questionnaire answered (both stores ask this regardless of app category) | ⬜ | **[Gap]** — standard submission requirement, not yet referenced in any WordLoop doc | WL-804 |
| Store listing assets (icon, screenshots at each required device size, description, keywords) reflect the actual shipped Design System, not the grayscale wireframes | ⬜ | `WordLoop_User_Flows_and_Wireframe_Requirements.md` §3 (wireframes are explicitly low-fidelity placeholders); `WordLoop_Design_System.md` | WL-803 |
| App icon tested at every required size on both platforms | ⬜ | WL-803 (Delivery Plan) | WL-803 |

---

## E. Release engineering readiness

| Item | Status | Source | Delivery Plan task |
|---|---|---|---|
| Release signing configured for both platforms | ⬜ | Delivery Plan | WL-804 |
| Crash reporting wired and symbolicating correctly from release builds | ⬜ | Delivery Plan | WL-003, WL-804 |
| Bundle size within the budget set for dictionary + assets | ⬜ | Delivery Plan, WL-105 budgets (cold-start ≤400ms, lookup ≤5ms, bundle size increase ≤8MB) | WL-105, WL-804 |
| Orientation policy shipped and verified: phones portrait-locked on both platforms, tablets unrestricted (WL-409) | ✅ | `WordLoop_User_Flows_and_Wireframe_Requirements.md` §19; README | WL-409 (done 2026-08-30) |
| **Tablet landscape** actually looked at on a real tablet — WL-409 could rotate neither an iOS simulator nor an Android tablet AVD in that environment, so the tablet path is reasoned, not seen | ⬜ | **[Gap]** — §19 lists tablets and landscape | WL-805 |
| Device/OS support matrix confirmed and tested on real hardware, including the smallest phone | ⬜ | `WordLoop_User_Flows_and_Wireframe_Requirements.md` §19 | WL-005, WL-805 |
| CI builds both native platforms, so a broken release build can't merge silently | ⬜ | Delivery Plan | WL-004 |

---

## F. Pre-submission QA

| Item | Status | Source | Delivery Plan task |
|---|---|---|---|
| Full screen/state matrix walked on both platforms, all devices in the support matrix | ⬜ | Delivery Plan | WL-805 |
| Accessibility engineering complete: labels and roles on every control, 48dp tap targets, error and turn announcements on both platforms, reduced-motion fallbacks, display-face scaling capped so the 64px glyph fits | ✅ | `WordLoop_User_Flows_and_Wireframe_Requirements.md` §18 | WL-408 (done 2026-08-30) |
| App usable at the largest system text size on both platforms — verified at iOS `accessibility-extra-extra-extra-large` and Android `font_scale 2.0` | ✅ | §18, §19 | WL-408 (done 2026-08-30) |
| **A screen reader actually driven through the core loop** — VoiceOver on iOS and TalkBack on Android, listening. WL-408 verified the accessibility *tree* TalkBack reads (`uiautomator dump`: zero unlabelled clickable nodes) but ran neither screen reader | ⬜ | §18 | WL-408 / WL-805 (needs a device with a screen reader) |
| Offline and failure states verified on-device, not just in code | ⬜ | `WordLoop_User_Flows_and_Wireframe_Requirements.md` §17 | WL-506 |

---

## Items needing legal or compliance sign-off, not more engineering

Everything else in this doc resolves by doing engineering work. These five don't — they
need a person with legal/compliance authority to read a specific claim and confirm it,
and no amount of additional code changes that:

1. **COCA data provenance** (section A) — reliance on a third-party NDA WordLoop cannot see.
2. **Commercial-bundling reading of the ESDB licence** (section A) — a plain-language
   interpretation that's very likely correct but has never been tested against WordLoop's
   specific distribution model.
3. **Font licence's mobile-bundling permission** (section A) — depends on which font gets
   picked (D-06), so this can't close until that decision is made.
4. **Apple Sign-In parity requirement** (section C) — already flagged `[Unverified]` in
   the Architecture doc. D-04 is closed (guest-only v1), so this is now a **1.1 item, not
   a v1 Phase 8 item** — it needs closing before 1.1 ships auth providers, not before v1
   ships.
5. **Age rating / content questionnaire answers** (section D) — a judgment call about how
   the free-text word-report field and any future ad integration should be characterized,
   not something a document can decide unilaterally.

None of these block Phase 1 or Phase 2 engineering work. Items 1, 2, 3, and 5 should be
closed out during v1's Phase 8, before `WL-806`. Item 4 moves to whenever 1.1 accounts
work is scheduled.

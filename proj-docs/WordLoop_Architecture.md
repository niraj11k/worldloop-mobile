# WordLoop Architecture Document

**Version:** 0.2
**Status:** Active build. Reviewed 2026-08-17 against what's actually been closed since this was written: the dictionary/licence open item (§11 item 4) is resolved (§4); **D-03 (server authority) is decided — v1 is client-authoritative and local-first (§2/§3 rewritten to match)**; **D-04 (accounts in v1) is decided — v1 ships guest-only, accounts implemented but dormant behind a flag (§8 rewritten to match)**. All six of this doc's originally-open items are now either resolved or explicitly tracked — see §11.
**Related docs:** all in `proj-docs/` — `WordLoop_Product_Requirements_Document.md`, `WordLoop_User_Flows_and_Wireframe_Requirements.md`, `WordLoop_Data_Model.md`, `WordLoop_Guest_Account_Trigger_Policy.md`, `WordLoop_Guest_Data_Deletion_Policy.md`, `WordLoop_Word_List_Licence_Review.md`, `WordLoop_Store_Submission_Checklist.md`, `WordLoop_Delivery_Plan.md`

This document consolidates the architecture decisions made during planning. It does not introduce new product scope; it organizes decisions already agreed on and flags what remains open.

---

## 1. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Mobile client | React Native | Single codebase for iOS and Google Play |
| Backend | Node.js + TypeScript | Chosen partly so validation logic can realistically be shared or kept in sync between client and server |
| Local storage (client) | MMKV | Stores guest profile, current game, settings. Resolved via Delivery Plan D-07 — implementation is `WL-002`, gated on native projects existing (`WL-001`) |
| Server data store | **None for v1** | PRD section 18 lists this as "Data Store" without specifying a technology — moot for v1 now that D-03 (§3) has resolved toward client-authoritative, no-backend. Revisit as `WL-701` if a post-v1 feature reintroduces server authority |

[Unverified] No decision has been made yet on the server-side database technology, hosting provider, or ORM. This needs a follow-up planning pass before implementation.

---

## 2. System overview

**v1, per D-03 (§3):**

```text
React Native App
   ├── Local Rule Engine       — authoritative. The only validity decision-maker in v1.
   ├── Local Dictionary        — bundled ESDB-based word list (see section 4)
   ├── Local Difficulty Engine
   ├── Local Scoring Engine
   └── Local Storage (MMKV)    — guest profile, current session, settings
```

No backend, no network calls for gameplay, no data store. `services/api/client.ts` stays
a stub that throws if called — there's deliberately nothing for it to call yet. This is
the actual v1 architecture; treat it as current, not aspirational.

**Future state, if D-03 is ever revisited** (originally the sole design in this doc,
before the D-03 review — preserved here as the target shape for whenever server authority
is reintroduced, not deleted just because v1 doesn't need it yet):

```text
React Native App
   ↓
Local Rule Engine (offline validation, lightweight)
   ↓ (when online)
Game API (Node/TypeScript)
   ├── Session Service
   ├── Rule Engine (source of truth)
   ├── Dictionary Service
   ├── Difficulty Engine
   ├── Account Service
   └── Analytics Service
          ↓
      Data Store
```

This extends the data flow from PRD section 18 with an explicit local rule engine on the client and an Account Service, both introduced during planning. It's the design to return to the moment a feature that actually needs server authority — leaderboards, purchases, anti-cheat — enters scope (per D-03's own exit condition, §3).

---

## 3. Offline and sync strategy

**Resolved 2026-08-17 (Delivery Plan D-03).** This section originally specified
server-authoritative with offline-as-fallback (preserved below, unchanged, as the design
to return to post-v1). For v1 specifically, the decision is the opposite:

**Decision:** v1 is client-authoritative and local-first. The client's own rule engine is
the sole, permanent authority on move validity — not a temporary offline fallback awaiting
reconciliation with a server that doesn't exist. There is no server to be a source of
truth, and no reconciliation logic to design, because v1 has no backend at all.

```text
Player opens app
   ↓
Local dictionary + local rule engine (always — online or offline makes no difference)
   ↓
Play continues, fully validated on-device
```

Rationale, from the D-03 decision record: a single-player game with no leaderboards, no
purchases, and no competitive integrity to protect gets nothing from server authority
except a backend to build, a data-store technology to pick, and reconciliation logic that
— per this section's own original open item — nobody had actually designed. Paying that
cost for a benefit v1 doesn't need was the wrong trade. Revisit the moment a feature that
actually needs server authority (leaderboards, purchases, anti-cheat) enters scope — that
condition, not a calendar date, is what should trigger reopening this decision.

Consequences of this decision, made concrete:
- Architecture §11's open items 1 (server data store technology) and 2 (offline/online
  reconciliation logic) are **deleted for v1**, not merely deferred — there is no
  reconciliation to design when there is nothing to reconcile against.
- `GameSession`'s `sync_status` field (Data Model doc §4) is dead for v1; `is_offline_session`
  survives since "was connectivity available" remains meaningful without a server.
- `services/api/client.ts` stays a stub. The PRD §20 API surface stays designed, on paper,
  unbuilt — ready to implement without a redesign if this decision is ever reversed.
- Network connectivity is still reserved for future definition/enrichment lookups ("get
  help" functionality), per PRD section 12 and section 21 — that was never server-authority
  territory, and is unaffected by this decision either way.

---

### 3.1 Pre-D-03 design (preserved as the post-v1 target, not current)

This is what section 3 said before the D-03 review, kept for exactly one reason: it's the
design to come back to if leaderboards, purchases, or anything else that needs server
authority ever enters scope. It is **not** what v1 builds.

**Original decision:** Offline mode is a lightweight, temporary fallback. The server remains the source of truth. The client does not permanently own validity decisions.

```text
Player opens app
   ↓
Online? ──No──→ Use local dictionary + local rule engine
   │                     ↓
   │              Play continues locally
   │                     ↓
   │              Reconcile with server when connection returns
  Yes
   ↓
Standard online flow (server validates every move, per PRD section 18-19)
```

Original open item, preserved for whenever this is revisited: reconciliation logic (what
happens if a locally-accepted word turns out invalid server-side, or vice versa) was never
specified. Still true, still unsolved, still irrelevant until this section is live again.

---

## 4. Dictionary strategy

Per PRD section 11 and confirmed during planning:

```text
ESDB, formerly SCOWL (or equivalent open word list)
        ↓
Local normalized game dictionary (bundled with the app; no server-side mirror for v1,
per D-03 — see section 3)
        ↓
Fast validation and computer move generation (no live API calls for gameplay)

Commercial dictionary API (Oxford / Merriam-Webster / Collins — deliberately not
selected for v1, see below)
        ↓
Used only for: definitions, pronunciation, enrichment
        ↓
Never blocks a round if unavailable (PRD section 12)
```

**Decision:** v1 uses a free/open word list for gameplay validation. Commercial APIs are reserved for optional definitions and enrichment only, not for word acceptance.

**Resolved 2026-08-17:** the source is **ESDB** (`en-wl/wordlist` — the actively maintained
successor to SCOWL, which is now a frozen legacy project), pinned at release
`rel-2026.02.25`, capped at word-list size ≤ 70. Licence reviewed and cleared; required
attribution notices identified. Full review, including the two items flagged for legal
sign-off before public release, is in `WordLoop_Word_List_Licence_Review.md`. This closes
what was open item 4 in section 11 below.

**Still open, but now a deliberate stance rather than a bare TBD:** no commercial
dictionary provider has been selected — Delivery Plan D-08 recommends not selecting one
for v1 at all (ship the definition overlay against bundled glosses or an "unavailable, you
can continue playing" state, and use Phase 6 usage data to decide whether a paid provider
is worth it later), rather than picking one before knowing anyone taps "Definition."

---

## 5. Rule engine

The rule engine is the authoritative gameplay logic, per the PRD. It should exist in two forms:

1. **Server-side (authoritative):** Node/TypeScript. Owns final validity decisions, matching PRD section 18.
2. **Client-side (local, offline fallback):** A subset or mirror of the same logic, ideally sharing code where the TypeScript-based stack allows it.

Rule engine responsibilities (from PRD section 8):

- Enforce letter chaining (last letter of previous word = first letter of new word).
- Normalize input (trim, lowercase, reject empty/numeric/symbol input).
- Enforce minimum word length (3 letters).
- Reject exact-duplicate words within a round (normalized comparison).
- Reject proper nouns using dictionary classification, not a simple name blocklist (PRD section 8.5).
- Accept valid inflected forms (plurals, verb forms, comparatives/superlatives) per PRD section 8.6.
- Apply the exclusion list for offensive/inappropriate terms (configurable, not hard-coded, per PRD section 8.8).

---

## 6. Difficulty engine

Implements the computer's move selection per PRD section 10, using the candidate scoring formula agreed during planning:

```text
candidate_score = (w1 × option_reduction_score)
                 + (w2 × commonness_score)
                 + (w3 × difficulty_score)
                 - (w4 × obscurity_penalty)
                 - (w5 × repetition_penalty)
```

| Difficulty | w1 | w2 | w3 | w4 | w5 | Selection method |
|---|---|---|---|---|---|---|
| Easy | 0 | 1.0 | 0 | 0.5 | 0.2 | Random pick from top candidates |
| Medium | 0.5 | 0.3 | 0.1 | 0.3 | 0.2 | Weighted random from top 3-5 candidates |
| Hard | 1.0 | 0.2 | 0.3 | 0.5 | 0.1 | Top-ranked candidate, occasional 2nd-best pick |

**Status:** First-pass draft, approved for prototyping. Per PRD section 9.4 and 10, weights should be tuned using real win-rate, abandonment, and rematch data once testable.

---

## 7. Scoring engine

Per-word scoring formula, agreed during planning:

```text
score_for_word = base_points + length_bonus + rarity_bonus - hint_penalty

base_points = 10
length_bonus = (word_length - 3) × 2, capped at 20
rarity_bonus = 0 (common) / +5 (uncommon) / +10 (rare but allowed)
hint_penalty = -5 if any hint used this turn, -10 if the hint revealed the actual word
```

Round-level bonus (optional, proposed):

- +20 for winning the round.
- +5 per personal-best chain-length milestone.

**Status:** First-pass draft, approved for prototyping. Subject to tuning per PRD section 16.

---

## 8. Account system

**Resolved 2026-08-17 (Delivery Plan D-04): v1 ships guest-only.** This section originally
said accounts (§8.2 onward) are in v1 scope. They're not, as of this decision — every hard
gate §8.2 lists below (vocabulary history, saved words, statistics, backup, cross-device)
is itself out of v1 scope, so accounts currently gate nothing real. Everything from §8.2
onward is **implemented, unit-tested, and dormant behind the `ACCOUNTS_ENABLED_V1` flag**
(`src/constants/gameConstants.ts`, currently `false`), not deleted — it ships live
together with the features it gates as a 1.1 release. Section 8.1 (guest play) is
unaffected: it's v1 regardless, and always was.

**What "dormant behind a flag" means concretely, now that it's implemented:**
`SettingsScreen.tsx` shows only "Continue as guest" and hides the Create Account button
while the flag is false (§8.6 below, updated to match). The `AccountCreationScreen` route
stays registered in the navigator but is unreachable in practice — nothing links to it.
`promptPolicy.ts`'s soft-prompt logic (§8.3) is implemented and tested but isn't called
from any live screen yet regardless of the flag, since the game-over/milestone wiring that
would call it is itself 1.1 scope (`WL-706`).

**Original decision, still the target for 1.1:** Build the lightweight account system as originally specified in the PRD (guest play by default, no account required to play) plus the guest-to-account trigger policy developed during planning.

### 8.1 Guest play

- Guest profile created locally and immediately on first use, no server account required.
- Guest data stored on-device by default (see Data Model doc for `GuestProfile`).

### 8.2 Account creation triggers

Two trigger categories, per the trigger policy document:

**Soft prompts** (dismissible, frequency-capped):
- After first completed game.
- After three more completed games, if previously dismissed.
- At meaningful engagement milestones (personal best, streak milestone, new-word-discovery milestone, returning on a new day).
- From Settings, at any time (not frequency-capped).

**Hard gates** (not dismissible, feature requires identity):
- Personal vocabulary history.
- Saved words.
- Statistics.
- Backup and restore.
- Cross-device play.
- Future: purchases, leaderboards (explicitly deferred to a future state, not v1).

### 8.3 Prompt frequency policy

```text
Maximum one soft prompt per session.
Maximum three soft prompts per 30-day cycle.
After the third dismissal in a cycle, suppress soft prompts for 30 days.
After 30 days, the cycle resets; soft prompts resume starting from the next
  qualifying trigger (not automatically on day 31).
Hard gates are exempt from this cap and always prompt when the feature is opened.
```

**Decision rationale:** Counter reset (not permanent suppression) was chosen specifically because WordLoop plans future monetization. Permanently suppressing prompts would lock out engaged long-term guests from ever seeing a soft conversion prompt again.

### 8.4 Auth providers (proposed, unverified against store policy)

- Sign in with Apple.
- Google sign-in.
- Email magic link.

[Unverified] Apple's requirement to offer Sign in with Apple when other third-party logins are present has not been confirmed against current App Store guidelines in this conversation. Verify directly with Apple's developer documentation before implementation.

### 8.5 Account deletion

Per the Guest Data Deletion document:

- In-app account deletion required (Apple and Google Play compliance).
- Deletion removes profile, saved words, scores/history, preferences, linked guest data, and auth record.
- Confirmation step required before deletion executes.
- A "Delete guest data" option should also exist in Settings for unlinked guests.

### 8.6 Settings screen

**v1 (implemented):** the Wireframe doc's original pre-accounts guidance applies again —
the Account row shows only "Continue as guest," no Create Account button. This is what's
actually in `SettingsScreen.tsx` today, gated behind `ACCOUNTS_ENABLED_V1`.

**1.1 (designed, dormant):** once the flag flips, the Account row becomes Continue as
guest / Create Account, or the signed-in state with Sign Out, per the addendum this
section originally described. The code for this state already exists in
`SettingsScreen.tsx`, behind the flag — it doesn't need to be rebuilt, just enabled
alongside the rest of the 1.1 accounts work.

---

## 9. API endpoints (extends PRD section 20)

Existing (from PRD):

```text
POST /api/v1/games
POST /api/v1/games/{game_id}/moves
POST /api/v1/games/{game_id}/hint
GET  /api/v1/games/{game_id}
POST /api/v1/games/{game_id}/end
```

**Open item:** Account-related endpoints (create account, link guest data, sign in, sign out, delete account) are not yet drafted. This should be a follow-up planning task.

---

## 10. Analytics

Extends PRD section 23 with account-related events developed during planning:

```text
- Account prompt shown (trigger_type, cycle_number, prompt_count_in_cycle)
- Account prompt dismissed (trigger_type, cycle_number, prompt_count_in_cycle)
- Account prompt suppressed by cooldown (cycle_number, days_remaining_in_cooldown)
- Account prompt cycle reset
- Account creation started (entry_point: game_over / settings / sync_feature / milestone)
- Account creation method selected (apple / google / email)
- Account creation completed
- Account creation abandoned
- Guest data linked to account (games_played, discovered_words, saved_scores)
- Signed out
```

Additional product metrics:

- Guest-to-account conversion rate, overall and by trigger type.
- Conversion rate by cycle number.
- Percentage of players reaching cooldown suppression without converting.
- Drop-off rate during account creation (started vs. completed).
- Time from first game to account creation.

---

## 11. Open items summary

Reviewed 2026-08-17 against the Delivery Plan and Licence Review doc, and updated twice
more the same day as D-03 and then D-04 were decided. Four items are now resolved, two are
deferred to a specific, named future point (not just "someday"), and one remains genuinely
open with no decision able to close it early.

1. ~~Server-side data store technology (database, hosting).~~ **Resolved — moot for v1.**
   D-03 decided client-authoritative, no-backend for v1 (§3). Revisit as `WL-701` only if
   a post-v1 feature reintroduces server authority.
2. ~~Offline/online reconciliation logic when validation results conflict.~~ **Resolved —
   deleted for v1, not merely deferred.** Same D-03 decision (§3) — there's nothing to
   reconcile against when there's no server. Revisit if D-03 is ever reversed.
3. Commercial dictionary provider selection (Oxford vs. Merriam-Webster vs. Collins).
   **Still open**, but Delivery Plan D-08 recommends deliberately not deciding this for
   v1 — see section 4 above.
4. ~~SCOWL licence review and notice preservation.~~ **Resolved 2026-08-17.** See
   `WordLoop_Word_List_Licence_Review.md` and section 4 above.
5. Account-related API endpoint definitions. **Deferred, not resolved** — D-04 (closed)
   confirms accounts are coming, in 1.1, just not before v1. This still needs solving
   before that release ships, unlike items 1/2 above which are genuinely dead unless D-03
   reverses. Tracked as Delivery Plan `WL-702` (Phase 7).
6. Verification of Apple Sign-In requirements against current App Store policy.
   **Deferred**, same reasoning as item 5 — needed before 1.1's auth providers ship, not
   before v1. Tracked as Delivery Plan `WL-703` and
   `WordLoop_Store_Submission_Checklist.md` section C.
7. Tuning plan and thresholds for scoring and difficulty formulas once real gameplay data
   exists. **Still open** — genuinely can't close until Phase 6 produces real data.
   Tracked as Delivery Plan `WL-605`.
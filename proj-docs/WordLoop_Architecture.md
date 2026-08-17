# WordLoop Architecture Document

**Version:** 0.1
**Status:** Draft (planning phase, not for implementation yet)
**Related docs:** WordLoop Product Requirements Document, WordLoop User Flows and Wireframe Requirements, Guest Account Trigger Policy, Guest Data Deletion Policy

This document consolidates the architecture decisions made during planning. It does not introduce new product scope; it organizes decisions already agreed on and flags what remains open.

---

## 1. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Mobile client | React Native | Single codebase for iOS and Google Play |
| Backend | Node.js + TypeScript | Chosen partly so validation logic can realistically be shared or kept in sync between client and server |
| Local storage (client) | Device-local storage (exact library TBD, e.g. AsyncStorage / SQLite) | Stores guest profile, current game, settings |
| Server data store | TBD | Not yet decided; PRD section 18 lists this as "Data Store" without specifying a technology |

[Unverified] No decision has been made yet on the server-side database technology, hosting provider, or ORM. This needs a follow-up planning pass before implementation.

---

## 2. System overview

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

This extends the data flow from PRD section 18 with an explicit local rule engine on the client and an Account Service, both introduced during planning.

---

## 3. Offline and sync strategy

**Decision:** Offline mode is a lightweight, temporary fallback. The server remains the source of truth. The client does not permanently own validity decisions.

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

Notes:

- The local rule engine should implement the same normalization and validation rules described in PRD section 8 (letter chaining, normalization, minimum length, duplicate detection, proper-name exclusion, inflected forms) against the bundled SCOWL-based word list.
- Reconciliation logic (what happens if a locally-accepted word turns out invalid server-side, or vice versa) is not yet specified. This is an open design question, not a decision.
- Network connectivity is also reserved for future definition/enrichment lookups ("get help" functionality), per PRD section 12 and section 21. This is explicitly out of scope for v1 beyond the existing optional word-definition feature.

**Open item:** Define the reconciliation behavior for conflicting offline/online validation results before implementation begins.

---

## 4. Dictionary strategy

Per PRD section 11 and confirmed during planning:

```text
SCOWL (or equivalent open word list)
        ↓
Local normalized game dictionary (bundled with app + mirrored server-side)
        ↓
Fast validation and computer move generation (no live API calls for gameplay)

Commercial dictionary API (Oxford / Merriam-Webster / Collins — TBD)
        ↓
Used only for: definitions, pronunciation, enrichment
        ↓
Never blocks a round if unavailable (PRD section 12)
```

**Decision:** v1 uses a free/open SCOWL-based list for gameplay validation. Commercial APIs are reserved for optional definitions and enrichment only, not for word acceptance.

**Open item (carried from PRD section 11.3):** SCOWL licence terms must be reviewed and required notices preserved before public release. No commercial dictionary provider has been selected yet.

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

**Decision:** Build the lightweight account system as originally specified in the PRD (guest play by default, no account required to play) plus the guest-to-account trigger policy developed during planning.

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

### 8.6 Settings screen (updated)

The wireframe doc's earlier guidance to avoid account settings until required no longer applies, since accounts are in v1 scope. See the Wireframe doc addendum for the updated Settings layout, which adds an Account row (Continue as guest / Create Account, or signed-in state with Sign Out).

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

These are unresolved and should be addressed in future planning passes, not assumed:

1. Server-side data store technology (database, hosting).
2. Offline/online reconciliation logic when validation results conflict.
3. Commercial dictionary provider selection (Oxford vs. Merriam-Webster vs. Collins).
4. SCOWL licence review and notice preservation.
5. Account-related API endpoint definitions.
6. Verification of Apple Sign-In requirements against current App Store policy.
7. Tuning plan and thresholds for scoring and difficulty formulas once real gameplay data exists.
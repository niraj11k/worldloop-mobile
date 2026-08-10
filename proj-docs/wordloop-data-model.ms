# WordLoop Data Model

**Version:** 0.1
**Status:** Draft (planning phase, not for implementation yet)

This document consolidates entity structures referenced across the PRD, wireframe requirements, and the guest-account trigger and deletion policies. Field types are indicative, not final; exact types depend on the server data store decision, which is still open (see Architecture doc, section 11).

---

## 1. DictionaryWord

Source: PRD section 11.4, unchanged.

```text
DictionaryWord
--------------
id
word
normalized_word
base_word
part_of_speech
is_proper_noun
is_common_word
is_obscure
is_offensive
is_allowed
frequency_score
definition_available
pronunciation_available
source_name
source_version
created_at
updated_at
```

Notes:

- `source_name` / `source_version` should reflect SCOWL (or whichever list is used) per the confirmed v1 dictionary strategy.
- This entity governs both server-side and client-side (bundled) validation.

---

## 2. GuestProfile

Source: PRD's guest data policy and the trigger document, combined.

```text
GuestProfile
------------
guest_id
created_at
last_active_at
last_seen_at
games_played
local_scores
local_streak
discovered_words
settings
data_expiry_at        (only if stored server-side)
is_linked              (boolean, false until account created)
linked_user_id          (null until linked)
```

Notes:

- For v1, this is stored locally on-device by default, per the "Best v1 approach" in the Guest Data Deletion document.
- If server-side guest records are introduced later (for sync or analytics), `data_expiry_at` supports the 90-day inactivity deletion policy described in that document. This is a product policy suggestion, not a confirmed legal requirement, and should be reviewed before implementation.
- `is_linked` / `linked_user_id` support the guest-to-account conversion flow.

---

## 3. Account (User)

**Status: [Inference]** This entity is not explicitly defined in any source document. It's proposed here based on the account requirements described across the PRD, the trigger document's auth provider list, and the deletion document's account requirements. Confirm before treating as final.

```text
Account
-------
user_id
auth_provider        (apple / google / email)
auth_provider_id
email                 (nullable, depending on provider)
display_name          (optional)
created_at
last_login_at
guest_id_origin       (the GuestProfile this account was created from, if any)
account_status        (active / pending_deletion / deleted)
deletion_requested_at (nullable)
```

**Open item:** Confirm required fields per auth provider (e.g., Apple Sign-In may supply a relay email rather than a real one). Not yet verified.

---

## 4. GameSession

**Status: [Inference]** Proposed based on PRD sections 7, 18, and 19, which describe session state and ownership but don't give a full field list.

```text
GameSession
-----------
session_id
owner_type            (guest / account)
owner_id               (guest_id or user_id)
difficulty             (easy / medium / hard)
current_word
required_letter
status                 (active / player_win / computer_win / draw / abandoned)
started_at
ended_at
is_offline_session      (boolean; true if started/played without connectivity)
sync_status             (synced / pending_sync / conflict)
```

Notes:

- `is_offline_session` and `sync_status` support the offline-fallback / reconciliation strategy described in the Architecture doc. Exact reconciliation logic is still an open item.

---

## 5. Move

**Status: [Inference]** Proposed based on the move validation flow in PRD sections 8 and 19.

```text
Move
----
move_id
session_id
turn_number
actor                 (player / computer)
submitted_word
normalized_word
is_valid
invalid_reason         (wrong_letter / unknown_word / proper_noun / duplicate /
                        too_short / unsupported_symbols / offensive_excluded / null)
hint_used              (boolean)
hint_level              (nullable; see Hint section below)
score_awarded
created_at
```

---

## 6. Score / Round Summary

**Status: [Inference]** Proposed based on the scoring formula agreed during planning (Architecture doc section 7) and the game-over screen requirements (Wireframe doc section 14).

```text
RoundSummary
------------
session_id
final_score
words_played
longest_chain
hints_used
result                 (win / loss / draw)
is_personal_best
created_at
```

---

## 7. DiscoveredWord

Source: Referenced in PRD section 12 ("Learned words" list) and the trigger document's "what gets transferred" list.

```text
DiscoveredWord
--------------
owner_type            (guest / account)
owner_id
word
session_id             (round in which it was encountered)
definition_viewed       (boolean)
pronunciation_viewed    (boolean)
first_seen_at
```

---

## 8. WordReport

Source: PRD section 26, unchanged.

```text
WordReport
----------
word
game_id
report_type            (should_be_allowed / should_not_be_allowed / offensive /
                        too_obscure / definition_incorrect)
player_comment
dictionary_source
created_at
review_status
```

---

## 9. AccountPromptState

**Status: [Inference]** Proposed to support the prompt frequency and cooldown policy agreed during planning (Architecture doc section 8.3). Not present in any source document as a distinct entity; needed to track cycle state per guest/account.

```text
AccountPromptState
-------------------
owner_id               (guest_id, pre-conversion)
current_cycle_number
prompts_shown_in_cycle
cycle_started_at
cooldown_until          (nullable; set after 3rd dismissal in a cycle)
last_prompt_trigger_type
last_prompt_shown_at
```

Notes:

- Drives the logic: max 1 prompt per session, max 3 per 30-day cycle, cooldown after the 3rd dismissal, cycle resets on the next qualifying trigger after cooldown ends.
- This state should be retained through the guest-to-account conversion so historical prompt behavior isn't lost, though whether it's needed post-conversion is an open question since hard gates and soft prompts no longer apply once signed in.

---

## 10. AnalyticsEvent

**Status: [Inference]** A generic shape is proposed here to hold the event types defined in PRD section 23 and the additional account-related events from the Architecture doc section 10. Actual analytics implementation (batching, transport, storage) is not specified anywhere and remains fully open.

```text
AnalyticsEvent
--------------
event_id
event_name             (see full list in Architecture doc, section 10)
owner_type              (guest / account)
owner_id
session_id              (nullable, not all events are session-scoped)
properties               (event-specific key/value data, e.g. trigger_type, cycle_number)
created_at
```

---

## 11. Entity relationship summary

```text
GuestProfile ──(on conversion)──> Account
     │                                │
     ├── GameSession(s) ──────────────┤ (owner_type/owner_id pattern shared)
     │        │
     │        ├── Move(s)
     │        └── RoundSummary
     │
     ├── DiscoveredWord(s)
     ├── AccountPromptState
     └── AnalyticsEvent(s)

DictionaryWord ── referenced by ──> Move.normalized_word validation
                                    Difficulty Engine candidate selection

WordReport ── references ──> DictionaryWord.word (loosely, by word text)
```

---

## 12. Open items summary

1. Server data store technology not yet chosen, affects final field types (see Architecture doc).
2. `Account`, `GameSession`, `Move`, `RoundSummary`, `AccountPromptState`, and `AnalyticsEvent` are all [Inference] proposals built to support agreed decisions; none exist as explicit entities in the source documents. These should be reviewed and confirmed, not assumed as final.
3. Reconciliation fields (`sync_status`, `is_offline_session`) are placeholders until the offline/online reconciliation logic itself is defined.
4. Whether `AccountPromptState` needs to persist after conversion to a full account is unresolved.
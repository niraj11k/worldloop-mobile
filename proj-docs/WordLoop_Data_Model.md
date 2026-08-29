# WordLoop Data Model

**Version:** 0.3
**Status:** Active build. All ten entities reviewed as of 2026-08-17 (see section 12 for the full record). Three carry real shipped code and were ratified against it: `GameSession`/`GameSessionState` (§4), `Move` (§5), `AccountPromptState` (§9) — each of those found and fixed genuine drift, not just a rubber-stamp. `Account` (§3), `RoundSummary` (§6), and `AnalyticsEvent` (§10) have no code yet, so they were checked for consistency against their source docs instead; `RoundSummary` needed a real fix (its `result` field didn't match the system's actual outcome vocabulary). `GuestProfile` (§2), `DictionaryWord` (§1), `DiscoveredWord` (§7), and `WordReport` (§8) were unchanged from the original PRD/policy-doc sourcing and weren't re-reviewed this pass.

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

- `source_name` / `source_version`: confirmed per `WordLoop_Word_List_Licence_Review.md` §6 — `"English Speller Database (ESDB), formerly SCOWL"` / `"rel-2026.02.25"`.
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

### 2.1 GuestProfile (v1 client runtime shape — implemented)

**Added 2026-08-29 by WL-402**, which implemented this entity as `GuestProfile` in
`src/types/profile.ts`. Same treatment as section 4.1: the shape above is what a guest
record looks like in general (including the server-side branch); this is what a
guest-only, local-first v1 actually stores. Field names are camelCase in code, matching
`GameSessionState` and every other shipped type.

```text
GuestProfile
------------
schemaVersion          (number — see "How this survives an app update" below)
guestId
createdAt
lastActiveAt           (last round played)
lastSeenAt             (last app launch)
gamesPlayed            (settled rounds only — see below)
localScores            (RoundSummary[], newest first, capped at 100)
bests                  ({ score, chainLength })
localStreak            ({ current, best } — consecutive wins, see below)
discoveredWords        (DiscoveredWord[] — section 7)
settings               ({ soundEnabled, hapticsEnabled })
isLinked
linkedUserId
```

Differences from section 2, each deliberate:

- **`data_expiry_at` is absent.** Section 2 already scopes it to "only if stored
  server-side", and D-03 leaves no server. It returns with the server-side branch.
- **`local_scores` is `RoundSummary[]`, capped, with `bests` beside it.** Section 2 gives
  `local_scores` no shape. Storing every round forever inside a value rewritten after
  every round grows unbounded for the life of an install, so the history is capped at the
  100 most recent — which means a personal best can age out of it. `bests` is therefore
  stored rather than derived: without it, trimming would silently lower the player's
  record. Not a field section 2 needs, since an uncapped server-side record wouldn't have
  the problem.
- **`local_streak` is `{ current, best }`, counting consecutive wins.** No doc defines
  what a WordLoop streak counts. Wireframe §5 offers "best streak **or** longest chain"
  as alternatives, which rules out longest chain; Architecture §8.2 lists "returning on a
  new day" as a milestone separate from "streak milestone", which rules out a day streak.
  Consecutive wins is what's left. **Flagged, not settled** — WL-405 displays this and may
  overrule it.
- **`lastActiveAt` and `lastSeenAt` are given distinct meanings.** Section 2 lists both
  without distinguishing them; opening the app writes `lastSeenAt`, finishing a round
  writes `lastActiveAt`. Either could have been the "activity" one — this is the reading
  that keeps both fields useful.
- **`schemaVersion` is new.** It is what makes "survives an app update" enforceable rather
  than hoped for: any future incompatible change to this shape has to state, in
  `parseProfile`, how the profiles already on players' phones become readable. Reading is
  otherwise tolerant — a missing or wrong-typed collection or counter is repaired to its
  empty value, and only an unusable `guestId` makes a stored profile unreadable, so one
  bad field can't cost a player every score they have.

**Which rounds count.** `gamesPlayed`, `bests` and `localStreak` only move on a *settled*
result (`player_win` / `computer_win` / `draw`) — the same gate `roundEndBonus` uses, so
the profile can never refuse to record a milestone a round already paid a bonus for.
`gamesPlayed` in particular is what the trigger doc's "after first completed game" /
"after three more completed games" prompts read. `localScores` and `discoveredWords`, by
contrast, record every finished round including abandoned ones: the history should agree
with what the player actually did, and a word the player found is found whether or not
they stayed to the end.

---

## 3. Account (User)

**Status: [Inference] — reviewed for internal consistency 2026-08-17, not yet ratified against code.** No `Account` type exists anywhere in `src/` (confirmed by search); `AccountCreationScreen.tsx` is a UI stub with no data shape behind it yet. This entity can't be ratified the way `GameSession`/`Move` were — there's nothing shipped to compare it against — so this pass checked it for consistency against the docs it's built from instead of against code.

That check found no contradiction: the field list holds up against Architecture §8.4 (auth provider list: Apple / Google / email — matches `auth_provider`), Architecture §8.5 and the Guest Deletion doc (deletion must remove profile, saved words, scores/history, preferences, linked guest data, auth record, with a confirmation step and, if async, a "this may take a moment" message — `account_status` and `deletion_requested_at` support that), and the Trigger doc's conversion flow (`guest_id_origin` supports "guest progress will be linked to this account"). Shape is unchanged. D-04 (closed 2026-08-17) confirms accounts are coming — as a 1.1 release, not v1. Real ratification against code happens when `WL-702`/`WL-704` (Phase 7) actually implement it.

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

**Status: Ratified 2026-08-17, in two parts.** Originally proposed as a single `[Inference]` entity based on PRD sections 7, 18, and 19. Reviewing it against the entity actually shipped in `src/types/game.ts` (`GameSessionState`) found real drift, not just a naming difference — some doc fields are unused in the current code, and some code fields aren't in the doc. That drift isn't a mistake in either direction: it's because the doc entity below describes the eventual **full, persisted, server-synced session** (relevant once Phase 7 — accounts and backend — lands), while `src/types/game.ts` implements only what a **local-first v1** (Delivery Plan D-03 and D-04, both decided 2026-08-17 — client-authoritative, no backend, guest-only) actually needs at runtime. Section 4.1 documents that v1 shape explicitly, rather than leaving it undocumented or forcing a premature merge of the two.

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

- `owner_type` / `owner_id` only become meaningful once accounts exist. Dormant for v1 per Delivery Plan D-04 (closed — guest-only through v1, accounts in 1.1).
- `sync_status` supports the offline-fallback / reconciliation strategy described in the Architecture doc — but Delivery Plan D-03 (decided 2026-08-17) makes v1 client-authoritative with no server reconciliation at all, which makes this field dead until Phase 7, not merely open. `is_offline_session` survives into 4.1 below because it's meaningful even without a server: it's just "was connectivity available," independent of whether anything reconciles against it.
- `started_at` / `ended_at` are persistence/audit fields for a session once something durable stores it (the future backend, or the Phase 4 local persistence in `WL-403`). Not part of the pure in-memory v1 runtime shape.

### 4.1 GameSessionState (v1 client runtime shape — implemented)

This is the shape actually shipped as `GameSessionState` in `src/types/game.ts`. It is a
**related but distinct entity from `GameSession` above**, not a partial implementation of
it — it adds fields `GameSession` doesn't have (`phase`, `chain`, `score`, `hintsUsed`)
because those are runtime-necessary for a client that owns its own game logic under D-03,
and it omits `GameSession`'s ownership/sync/persistence-timestamp fields because none of
those exist yet in a guest-only, local-first v1.

```text
GameSessionState
-----------------
sessionId
difficulty             (easy / medium / hard)
currentWord
requiredLetter
status                 (active / player_win / computer_win / draw / abandoned /
                        technical_failure)
phase                  (player_turn / input_empty / validating / computer_thinking /
                        invalid_word / valid_move / no_computer_move)
chain                  (Move[] — the round's move history, embedded rather than
                        related by session_id, since v1 has no separate Move store)
score
hintsUsed
isOfflineSession
previousBestChainLength (number | null — the player's longest chain before this
                        round, for the round-end personal-best bonus)
```

Notes:

- `status` includes `technical_failure`, added to `GameStatus` by WL-110 (see section 6's
  note on `RoundSummary.result`). This line previously listed only five values, predating
  that change.
- `previousBestChainLength` is a **baseline copied in at session creation** (WL-111), not
  a running statistic the round updates — the round-end bonus needs a value to compare
  against, and reading the live profile mid-round would let a concurrent write change the
  payout. `null` means no profile has been loaded, which is deliberately distinct from a
  real best of `0`: an unknown baseline awards no milestone, whereas a genuine first
  round beats zero and earns one. WL-402 is what will supply the real value; until then
  every session runs with `null`.

- `phase` is the `TurnPhase` union also declared in `types/game.ts`; it's UI/interaction
  state that has no reason to exist in a server-persisted `GameSession`, only in the
  client actually running a turn.
- `chain` embeds `Move` records directly rather than relating them by `session_id`
  (contrast with the relational `Move` entity in section 5) because v1 has no separate
  move store to relate against — the whole session, chain included, lives in one
  in-memory object per Delivery Plan Phase 1's exit criteria (a Node test harness playing
  complete rounds with no persistence layer).
- When Phase 7 introduces a backend, expect `GameSessionState` to either gain the
  ownership/sync fields from `GameSession` (converging the two) or stay a distinct
  client-side view fed by a `GameSession` the server owns — that's a Phase 7 design
  decision, not one this doc should pre-empt now.
- **Persisted as-is since WL-403** (2026-08-29), under `CURRENT_SESSION`, wrapped in a
  `{ schemaVersion, session }` envelope — the whole round in one value, chain included,
  which is only cheap because `chain` is embedded rather than related (see above). Two
  fields of this shape are *not* restored verbatim, and both are deliberate:
  `phase` is normalized on restore (a round killed mid-computer-turn comes back as
  `computer_thinking` so the reply the player is owed still arrives; every other
  transient phase settles to `input_empty`, since neither the typed word nor an error
  message is part of the session), and a round whose `status` is anything but `active`
  is discarded rather than restored. Unlike the profile, a saved round that doesn't read
  back exactly is thrown away instead of repaired — see the WL-403 note in the Delivery
  Plan.

---

## 5. Move

**Status: Ratified 2026-08-17.** Proposed based on the move validation flow in PRD sections 8 and 19; reviewed against the shipped `Move` interface in `src/types/game.ts`, which matches this entity closely (see notes below for the two fields that don't apply to v1's shape).

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
hint_level              (nullable — see notes)
score_awarded
created_at
```

Notes:

- `session_id` and `created_at` aren't present on the shipped `Move` interface. Under
  `GameSessionState` (section 4.1), `Move` records are embedded directly in the parent
  session's `chain` array rather than stored as flat, independently-queried records, so
  `session_id` is implicit through containment and `created_at` isn't yet needed without a
  persistence layer to timestamp against (Phase 4, `WL-403`).
- `hint_level` previously read *"nullable; see Hint section below"* — **there is no Hint
  section in this document**, and there never was; that citation was a leftover from
  drafting and pointed nowhere. Corrected here rather than left dangling. The field itself
  is real and not yet implemented: `types/game.ts`'s `Move` interface has no `hintLevel`
  field, though the four hint levels it would hold already exist as
  `HINT_LEVELS` in `src/constants/gameConstants.ts` (`required_letter` / `word_count` /
  `example_word` / `definition_clue`). Wiring `hintLevel` onto `Move` is small, scoped
  follow-up work for the Delivery Plan's `WL-307` (hint sheet, Phase 3) — deliberately not
  bundled into this doc-ratification pass, since it changes shipped code rather than just
  describing it.

---

## 6. Score / Round Summary

**Status: [Inference] — reviewed 2026-08-17, one real inconsistency found and fixed.** Proposed based on the scoring formula agreed during planning (Architecture doc section 7) and the game-over screen requirements (Wireframe doc section 14). No `RoundSummary` type exists in code yet — `HomeScreen.tsx` has a TODO citing it by name but nothing implements it — so this is a consistency review against source docs, not a code ratification.

That check found `result` didn't hold up: the original proposal used a standalone `(win / loss / draw)` vocabulary, but Wireframe §14 requires **five** distinct game-over result states (player wins, computer wins, draw/exhausted dictionary, player exits, technical failure), and the system already has a working vocabulary for outcomes — `GameStatus` in `types/game.ts` (`active / player_win / computer_win / draw / abandoned`) — that `RoundSummary.result` should reuse rather than duplicate under different names. Fixed below.

```text
RoundSummary
------------
session_id
final_score
words_played
longest_chain
hints_used
result                 (player_win / computer_win / draw / abandoned — reuses GameStatus,
                        see note below)
is_personal_best
created_at
```

**~~Open item this review surfaced, not resolved~~ — RESOLVED 2026-08-19 in `WL-110`.**
Neither `GameStatus` nor this `result` field had a distinct value for Wireframe §14's fifth
state, "technical failure", so it was being conflated with whatever status was nearest
(most likely `abandoned`, though that was never written down as a decision). This review
flagged it for whichever of `WL-110` or `WL-308` reached it first, to be decided once;
`WL-110` got there first.

**Decision: `technical_failure` was added to `GameStatus`**, which is now
`active / player_win / computer_win / draw / abandoned / technical_failure`. `result` above
reuses the union, so it inherits the value and needs no separate change. Reasoning:

- Wireframe §14 requires the game-over screen to render five distinct result states.
  Without a distinct value, `WL-308` could not tell this state from the others — the
  screen would have had to invent its own vocabulary, which is exactly the duplication
  this section fixed for `result` in the first place.
- Conflating it with `abandoned` tells the player "you exited" when the app in fact broke,
  and buries genuine failures inside an ordinary-looking metric (PRD §23).
- It is reachable, not hypothetical: a corrupt packed dictionary asset throws during index
  construction (`dictionaryService`, WL-105), and Wireframe §17 specifies a "dictionary
  unavailable" state.

`WL-308` should render this state and must not re-decide it.

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

**Status: Ratified 2026-08-17, with one addition and one flagged gap.** Proposed to support the prompt frequency and cooldown policy agreed during planning (Architecture doc section 8.3). Unlike `Account`/`RoundSummary`/`AnalyticsEvent`, this one already has shipped code — `AccountPromptState` in `src/features/account/promptPolicy.ts` — so it could actually be reconciled against an implementation, the same way `GameSession`/`Move` were. Unlike that pair, the doc and code entities share the same name here, which reads as one implementer's intent rather than two deliberately distinct shapes — so the fix is to reconcile the doc to the code, not to split it into two entities.

```text
AccountPromptState
-------------------
owner_id               (guest_id, pre-conversion)
current_cycle_number
prompts_shown_in_cycle
cycle_started_at
cooldown_until          (nullable; set after 3rd dismissal in a cycle)
hasShownThisSession     (boolean; resets each app session — added, see notes)
last_prompt_trigger_type
last_prompt_shown_at
```

Notes:

- `owner_id` isn't a field on the shipped type. It doesn't need to be: `storage.ts`'s
  `STORAGE_KEYS.ACCOUNT_PROMPT_STATE` is a single global key, not one keyed per guest, so
  ownership is implicit through "the one guest profile active on this device" (v1 has no
  multi-profile switching). Documented here rather than silently dropped, in case
  multi-profile support ever changes that assumption.
- `hasShownThisSession` exists in the shipped type but not in the original doc entity —
  added above. It's real, persisted state (round-tripped through storage alongside the
  rest, per `resetSessionFlag()` in `promptPolicy.ts`), not ephemeral runtime-only data, so
  it belongs in the entity, not just in code.
- **Flagged, not fixed:** `last_prompt_trigger_type` and `last_prompt_shown_at` are in the
  doc but not in the shipped type — `recordPromptShown()` doesn't currently accept or
  store which trigger fired. The policy logic itself (`shouldShowSoftPrompt` /
  `recordPromptShown`) doesn't need either field to work correctly, but losing them means
  losing the ability to answer "why did/didn't this guest see a prompt" for support or
  analytics purposes, and Architecture §10's "Account prompt shown" event already expects
  a `trigger_type` payload — this state would be a natural place to also persist the most
  recent one. Small, scoped follow-up for `WL-706` (Phase 7, "activate the soft-prompt
  policy"), not done here since it's a code change, not a doc correction.
- Drives the logic: max 1 prompt per session, max 3 per 30-day cycle, cooldown after the 3rd dismissal, cycle resets on the next qualifying trigger after cooldown ends.
- This state should be retained through the guest-to-account conversion so historical prompt behavior isn't lost, though whether it's needed post-conversion is an open question since hard gates and soft prompts no longer apply once signed in.

---

## 10. AnalyticsEvent

**Status: [Inference] — reviewed for internal consistency 2026-08-17, not yet ratified against code.** No `AnalyticsEvent` type exists in `src/` — Phase 6 (`WL-601`/`WL-602`) hasn't started. A generic shape is proposed here to hold the event types defined in PRD section 23 and the additional account-related events from the Architecture doc section 10. Actual analytics implementation (batching, transport, storage) is not specified anywhere and remains fully open.

Checked against every named event and payload field across PRD §23, Architecture §10, and Wireframe §23 (trigger_type, cycle_number, prompt_count_in_cycle, days_remaining_in_cooldown, entry_point, games_played, discovered_words, saved_scores): all of them fit inside the generic `properties` bag without needing dedicated columns, so the shape doesn't need widening. `owner_type`/`owner_id` stay meaningful even under v1's guest-only scope (D-04, closed) — unlike the same pair on `GameSession`, an anonymous guest identifier is required from day one for PRD §22's "use an anonymous player identifier," not something that only activates once accounts exist. No changes made.

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
     ├── GameSession(s) ──────────────┤ (owner_type/owner_id pattern shared;
     │        │                        Phase 7+ persisted/server shape)
     │        ├── Move(s)
     │        └── RoundSummary
     │
     ├── DiscoveredWord(s)
     ├── AccountPromptState
     └── AnalyticsEvent(s)

DictionaryWord ── referenced by ──> Move.normalized_word validation
                                    Difficulty Engine candidate selection

WordReport ── references ──> DictionaryWord.word (loosely, by word text)

GameSessionState (v1 client runtime, section 4.1) ── embeds ──> Move(s) directly
     in its `chain` array — not a separate relation, since v1 has no session-external
     Move store to relate against. Converges toward (or stays distinct from) GameSession
     once Phase 7 introduces persistence — undecided, see open item 5 below.
```

---

## 12. Open items summary

1. Server data store technology not yet chosen, affects final field types (see Architecture doc).
2. **All ten entities have now been reviewed (2026-08-17).** Three had shipped code to
   reconcile against and were ratified against it — `GameSession`/`GameSessionState` (§4),
   `Move` (§5), `AccountPromptState` (§9) — and all three had real drift, not just a
   naming mismatch, now fixed and documented. Three had no code yet and were checked for
   internal/cross-doc consistency instead — `Account` (§3) and `AnalyticsEvent` (§10)
   held up with no changes; `RoundSummary` (§6) did not and was corrected (item 8 below).
   `GuestProfile`, `DictionaryWord`, `DiscoveredWord`, and `WordReport` were not
   re-reviewed this pass. "Reviewed" for the no-code entities means "internally
   consistent with its source docs," not "verified against an implementation" — that
   verification still has to happen whenever each one is actually built.
3. Reconciliation fields (`sync_status` on `GameSession`) are dead for v1, per Delivery Plan D-03 (decided 2026-08-17: client-authoritative, no server reconciliation) — not merely a placeholder pending future design, but explicitly out of scope for v1. Re-open if D-03 is ever reversed.
4. Whether `AccountPromptState` needs to persist after conversion to a full account is unresolved.
5. `GameSession` and `GameSessionState` (section 4) are documented as two distinct, related entities rather than one — a full persisted/server shape and a v1 client-runtime shape — because reviewing them against shipped code found real field-level drift, not just a naming difference. Whether these converge into one entity once Phase 7 (backend) lands, or stay permanently distinct, is a Phase 7 design question this doc doesn't answer yet.
6. `Move.hint_level` is a real, ratified field with no dangling reference, but it isn't implemented in `types/game.ts` yet. Small follow-up scoped to Delivery Plan `WL-307`, not a doc problem.
7. `AccountPromptState.last_prompt_trigger_type` / `last_prompt_shown_at` (§9) are documented and ratified as real fields, but `promptPolicy.ts`'s `recordPromptShown()` doesn't currently accept or store either one. Small follow-up scoped to `WL-706`.
8. **New, from this pass:** `RoundSummary.result` (§6) originally used a standalone `(win / loss / draw)` vocabulary that both under-covered Wireframe §14's five required game-over states and duplicated `GameStatus` under different names. Fixed by reusing `GameStatus`'s vocabulary directly — but that surfaced a deeper gap: **no status value anywhere in the system (not `GameStatus`, not the old `result` field) distinctly represents "technical failure,"** one of Wireframe §14's five required result states. This needs a real decision — add a status value to the shipped `GameStatus` type — not another doc edit. Flagged for `WL-110` or `WL-308`, whichever lands first, so it's decided once.
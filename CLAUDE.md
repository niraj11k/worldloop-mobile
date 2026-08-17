# WordLoop — Claude Code project instructions

## Design
Before designing, building, or modifying any screen UI, read `proj-docs/WordLoop_Design_System.md` in full and follow it exactly. Style direction: playful maximalist / tactile claymorphism with brutalist component mechanics (thick borders, hard offset shadows, no blur). Do not introduce colors, fonts, shadows, or spacing outside that doc without updating it first. Never default to flat minimalism, pastel-only claymorphism, or generic rounded-corner SaaS styling — the design doc explicitly rejects these.

## Game logic
Rule engine, scoring, and difficulty logic must match `proj-docs/WordLoop_Product_Requirements_Document.md` sections 8-10 and `proj-docs/WordLoop_Architecture.md` sections 5-7. Entity shapes and field names must match `proj-docs/WordLoop_Data_Model.md`. Do not alter validation rules, scoring formulas, difficulty weights, or entity fields without flagging the change against those docs first.

## Project structure
Follow the existing structure in `src/` — screens stay thin (composition only), domain logic goes in `src/features/`, I/O boundaries go in `src/services/`. See `README.md` for the full layout and what's implemented vs. stubbed.

## Stack
React Native + TypeScript (client), Node/TypeScript (backend, not yet scaffolded). Path aliases (`@features/*`, `@screens/*`, etc.) are configured in `tsconfig.json`, `babel.config.js`, and `package.json`'s jest config — keep all three in sync if aliases change.

## Reference docs
All in `proj-docs/`, all prefixed `WordLoop_`. Cite them by section number in code comments (e.g. "Data Model doc section 4"):

| Doc | Covers |
|---|---|
| `WordLoop_Product_Requirements_Document.md` | Product scope, game rules (§8), difficulty algorithms (§10), dictionary strategy (§11), scoring (§15-16), analytics (§23), acceptance criteria (§24) |
| `WordLoop_User_Flows_and_Wireframe_Requirements.md` | Screen-by-screen requirements, game screen states (§9), error copy (§10), accessibility (§18) |
| `WordLoop_Architecture.md` | Tech stack, offline strategy, difficulty weights (§6), scoring formula (§7), account system (§8), open items (§11) |
| `WordLoop_Data_Model.md` | Entity shapes: DictionaryWord (§1), GuestProfile (§2), Account (§3), GameSession (§4), Move (§5), RoundSummary (§6), DiscoveredWord (§7), WordReport (§8), AccountPromptState (§9), AnalyticsEvent (§10) |
| `WordLoop_Design_System.md` | Palette, type scale, component language (§4), motion (§5), game screen treatment (§6) |
| `WordLoop_Guest_Account_Trigger_Policy.md` | When to prompt for account creation, guest-to-account conversion |
| `WordLoop_Guest_Data_Deletion_Policy.md` | Guest data retention, account deletion, store compliance |
| `WordLoop_Word_List_Licence_Review.md` | D-01/D-02 decision record: word-list source (ESDB), licence terms, required attribution text, size-tier cutoffs |
| `WordLoop_Store_Submission_Checklist.md` | Everything to verify or complete before submitting to the App Store / Google Play, cross-referenced to its source doc |
| `WordLoop_Delivery_Plan.md` | Phases, task breakdown, open decisions (D-01..D-10), milestones |

## Status
Planning is complete; this is now an active build. The reference docs above are the source of truth — treat contradictions between code and docs as bugs to flag, not silently resolve. Several docs carry unresolved decisions; check the Delivery Plan's decision log (section 3) before building against anything marked open or `[Inference]`.
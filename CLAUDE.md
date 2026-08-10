# WordLoop — Claude Code project instructions

## Design
Before designing, building, or modifying any screen UI, read `WordLoop_Design_System.md` in full and follow it exactly. Style direction: playful maximalist / tactile claymorphism with brutalist component mechanics (thick borders, hard offset shadows, no blur). Do not introduce colors, fonts, shadows, or spacing outside that doc without updating it first. Never default to flat minimalism, pastel-only claymorphism, or generic rounded-corner SaaS styling — the design doc explicitly rejects these.

## Game logic
Rule engine, scoring, and difficulty logic must match `WordLoop_Product_Requirements_Document.md` sections 8-10 and `WordLoop_Architecture.md` sections 5-7. Do not alter validation rules, scoring formulas, or difficulty weights without flagging the change against those docs first.

## Project structure
Follow the existing structure in `src/` — screens stay thin (composition only), domain logic goes in `src/features/`, I/O boundaries go in `src/services/`. See `README.md` for the full layout and what's implemented vs. stubbed.

## Stack
React Native + TypeScript (client), Node/TypeScript (backend, not yet scaffolded). Path aliases (`@features/*`, `@screens/*`, etc.) are configured in `tsconfig.json`, `babel.config.js`, and `package.json`'s jest config — keep all three in sync if aliases change.

## Status
Planning is complete; this is now an active build. Reference docs (PRD, Wireframe Requirements, Architecture, Data Model, Design System) are the source of truth — treat contradictions between code and docs as bugs to flag, not silently resolve.
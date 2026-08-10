# WordLoop Design System

**Version:** 0.1
**Status:** Draft — style direction confirmed, exact token values are a first pass for implementation and visual QA
**Direction:** Playful Maximalist / Tactile Claymorphism, with explicit-border and offset-shadow component mechanics borrowed from Neo-Brutalism
**Explicitly rejected:** generic flat minimalism, sterile rounded-corner SaaS aesthetics, pastel-only claymorphism, corporate blue/gray palettes, symmetric "AI-generated" layouts

This doc is the single source of truth for visual design. Before designing or building any screen, read this in full. Do not introduce colors, type, shadows, or spacing outside what's defined here without updating this doc first and flagging the change.

---

## 0. Design thesis

WordLoop should feel **handmade, loud, and a little chaotic on purpose** — like a sticker-covered notebook, not a fintech dashboard. Every screen should look like it was designed by someone with a strong point of view, not generated from a component library on defaults.

The signature move: **thick black outlines + hard offset shadows + saturated fills**, applied to soft, rounded, tactile shapes rather than sharp brutalist rectangles. That combination is what keeps this from reading as either "generic claymorphism" (too soft, too safe) or "generic neo-brutalism" (too harsh, too cold). Every component in section 4 should visibly carry both halves of that combination — border + offset shadow AND rounded, puffy geometry.

**Asymmetry is a feature, not an accident.** Elements should feel intentionally imperfect: slight rotation on cards (2-4 degrees), staggered shadow directions, uneven sticker-like badges. Perfectly centered, perfectly symmetrical layouts are the thing to avoid.

---

## 1. Color palette

High-contrast, saturated, deliberately unconventional pairings. No corporate blue, no cool gray-scale neutrals as a base.

| Token | Hex | Role |
|---|---|---|
| `paper` | `#FFF6E9` | Base background — warm off-white, not clinical white |
| `ink` | `#161311` | Primary text, all outlines/borders |
| `grape` | `#7C3AED` | Primary brand accent — headers, primary CTA fill |
| `tangerine` | `#FF6B1A` | Secondary accent — score, streaks, energy states |
| `bubblegum` | `#FF3D8A` | Tertiary accent — required-letter callout, hint sheet |
| `limeade` | `#B4E600` | Success / valid move / win state |
| `red-alert` | `#FF3131` | Error / invalid move — reserved, don't overuse |
| `sunbeam` | `#FFD400` | Highlight / badge fills, level-up moments |
| `shadow-ink` | `#161311` at fixed opacity | Used only for offset drop shadows, never as a fill |

**Pairing rules:**
- Never pair two accent colors directly touching without a black outline or paper-colored gap between them — this is what keeps "unconventional" from becoming "illegible."
- `red-alert` is reserved strictly for invalid-word states. Do not use it decoratively, or its meaning as an error signal weakens (this also serves the "no color-only meaning" accessibility rule below).
- `limeade` is reserved strictly for success/valid states, same reasoning.
- Every accent color must be paired with `ink` for outlines and either `paper` or `ink` for text — never gray. Grays are excluded from this palette entirely.

**Accessibility reconciliation:** [Design constraint, not optional] Every text/fill combination in this palette must meet WCAG AA contrast (4.5:1 for body text, 3:1 for large text) before shipping. `ink` on `paper`, `ink` on `sunbeam`, `paper` on `grape`, and `paper` on `ink` all pass. Verify any new pairing before using it — this satisfies the Wireframe doc's high-contrast requirement (section 18) without forcing the palette back toward neutral.

---

## 2. Typography

**Display face:** An expressive, loud, high-personality display font for headlines, the game's wordmark, the required-letter callout, and score numbers. Think chunky rounded-slab or bold condensed display, something with real character, not a system font. Candidates to evaluate: a rounded-slab display face with heavy weight (e.g. in the family of Fredoka, Baloo 2, or Lilita One), or a chunkier variable display face if the team wants something less "kids app" and more "skate brand." **Decision needed:** pick one and license/bundle it before implementation; do not ship with a system font standing in for the display role.

**Body face:** A highly readable **monospace** for body copy, instructions, word-chain history, and settings. Monospace reinforces the "word game / word puzzle" identity (every letter takes equal visual weight, which suits a letter-chain mechanic) while staying more legible than the display face at small sizes. Candidates: JetBrains Mono, IBM Plex Mono, Space Mono. **Decision needed:** confirm licensing for mobile bundling.

**Type scale:**

| Role | Face | Size | Weight | Notes |
|---|---|---|---|---|
| Wordmark / hero | Display | 40px | Black/900 | Home, Welcome screens |
| Required letter | Display | 64px | Black/900 | Must be the single largest text element on the Game screen — see section 6 |
| Screen title | Display | 28px | Bold/700 | |
| Computer/player word | Display | 26px | Bold/700 | |
| Body / instructions | Monospace | 15px | Regular/400 | |
| Button label | Monospace | 15px | Bold/700 | Uppercase, letter-spacing +0.02em |
| Caption / metadata | Monospace | 12px | Regular/400 | Score labels, timestamps |

**Rule:** never use the display face below 20px — it loses its character and becomes hard to read at small sizes. Never use the monospace face for the required-letter callout — it's not expressive enough to carry that moment.

---

## 3. Layout and spacing

- Base spacing unit: 4px. Use multiples of 4 (4, 8, 12, 16, 24, 32, 48).
- Corner radius is generous and consistent: 20px for cards/modals, 16px for buttons/inputs, 999px (pill) for badges and tags. This is the claymorphism half of the hybrid — components are rounded and puffy, not sharp brutalist rectangles.
- Intentional asymmetry: cards and stickers may carry a `rotate(-2deg)` to `rotate(3deg)` transform. Do not rotate interactive controls (buttons, inputs) — rotation is reserved for decorative/informational elements (badges, the computer's word display, score callouts) so it never interferes with tap targets or the accessibility requirement for clear, predictable focus states.
- Maintain generous whitespace around the required-letter callout specifically — it needs breathing room to stay dominant on screen, per the Wireframe doc's "must be visually prominent" rule.

---

## 4. Component language

Every interactive and card-like component follows the same construction:

```
[shape]         rounded rectangle or pill, per section 3
[border]         3-4px solid `ink`, always
[shadow]         hard offset shadow, no blur: 4-8px, direction consistent
                  per component type, color = `shadow-ink`
[fill]            one saturated color from section 1, or `paper`
```

### Buttons
- Primary: saturated fill (`grape` or `tangerine`), `ink` border, 6px hard offset shadow bottom-right.
- Secondary: `paper` fill, `ink` border, same shadow treatment, smaller offset (4px).
- **Tactile press state:** on press, the button shifts to overlap its own shadow (translate 4-6px toward the shadow direction, shadow shrinks or disappears) so it visually "presses into" the screen. This is the primary tactile feedback mechanism — see section 5.
- Disabled buttons keep their border and shape but drop to 40% opacity fill and lose the offset shadow entirely (reads as "flat," reinforcing non-interactivity without relying on color alone).

### Cards
- `paper` or a light tint fill, `ink` border, 6-8px offset shadow, 20px radius.
- Slight rotation permitted (see section 3) for informational cards (word review entries, stat cards). Never rotate cards containing the input field or primary game controls.

### Modals / bottom sheets (Hint sheet, Word definition overlay, Pause)
- Heavier shadow than cards (10-12px offset) to reinforce elevation above the base screen.
- `ink` border, minimum 4px.
- Enter animation: spring-based scale/slide, respecting reduced-motion (see section 5).

### Input fields
- `paper` fill, `ink` border (3px), 16px radius, monospace type.
- Focus state: border color shifts to `grape`, plus a visible focus outline — this is a hard accessibility requirement (Wireframe doc section 18, "clear focus states") and must not be dropped for aesthetic reasons.
- Error state: border shifts to `red-alert` AND an icon/text label appears — never color alone, per the "no colour-only meaning" rule.

### Badges / tags / stickers
- Pill-shaped, `sunbeam` or `bubblegum` fill, `ink` border 2-3px, small drop shadow (2-4px), often rotated 3-6 degrees for the "sticker" feel. Used for streak counts, difficulty tags, "new word" callouts.

---

## 5. Micro-interactions and gamification

All motion must respect the system-level reduced-motion setting (Wireframe doc section 18). Every effect below needs a reduced-motion fallback that keeps the *state change* legible without the animation — e.g. a streak badge still updates its number and color even if it doesn't bounce.

### Streak counter
- Lives near the score, `tangerine` badge, monospace numerals.
- On increment: quick scale-punch (1.0 → 1.15 → 1.0, ~200ms) plus a color flash to `sunbeam` and back.
- Reduced-motion fallback: number updates instantly, brief 100ms opacity flash only (no scale).
- Milestone streaks (5, 10, 15...) trigger a slightly bigger version of the same punch plus a one-off badge sticker appearing with a rotate-in. Do not add particle effects or confetti explosions — keep the maximalist energy in the shapes and color, not in animated debris, which is a common way this aesthetic tips into feeling cluttered rather than confident.

### Level-up / difficulty unlock
- A modal using the section 4 modal treatment, `grape` fill, oversized display-face headline ("New difficulty unlocked").
- Enter with a spring scale-in (reduced-motion: instant appearance, no scale).

### Valid word submitted
- Input field border flashes `limeade` briefly, word "stamps" onto the chain display with a small scale-in.
- Chain display itself doesn't reflow/animate other entries — only the new entry animates in, to avoid a busy, distracting list.

### Invalid word submitted
- Input field border flashes `red-alert`, plus a short horizontal shake (reduced-motion: no shake, border flash only) — the shake must never be the only signal, since the error text (section 4, Input fields) already carries the meaning.

### Computer "thinking" state
- A simple 3-dot pulse in the monospace face, not a spinner — keeps the handmade, typographic feel rather than borrowing a generic loading spinner.

**General rule:** every animation needs a non-animated equivalent that communicates the same state change. This isn't a compliance checkbox, it's what keeps the "high-energy, tactile" identity from excluding players who need reduced motion.

---

## 6. Applying this to the Game screen specifically

The Game screen is the product's core loop (Wireframe doc section 21) and has one non-negotiable rule from that doc: **the required letter must be the most visually dominant element on screen, communicated through text, not only color.**

In this system, that means:
- The required-letter callout uses the largest type size in the entire scale (64px display face, section 2).
- It sits in its own card component (section 4) with the heaviest shadow treatment on the screen, in `bubblegum`.
- It is never rotated (rotation is reserved for decorative elements, not the single most important piece of information on screen).
- Text label ("Required letter") always accompanies it — the letter is never communicated by a color-coded background alone.

---

## 7. Iconography and imagery

- No stock icon sets that read as generic (standard Material/Feather-style line icons will fight this aesthetic). If icons are needed, they should be hand-drawn or custom-illustrated in a chunky, single-weight style that matches the border weight used on components (3-4px strokes).
- No photographic imagery. If illustration is used (empty states, welcome screen), it should be flat, bold-outlined, and use only palette colors from section 1.

---

## 8. Do / Don't

| Do | Don't |
|---|---|
| Thick `ink` borders on every component | Borderless "floating" flat elements |
| Hard offset shadows, no blur | Soft blurred drop shadows (reads as generic claymorphism) |
| Saturated, unconventional color pairings | Corporate blue, cool gray, pastel-only palettes |
| Slight rotation on decorative/informational elements | Rotating interactive controls or the required-letter callout |
| Monospace for body/UI copy | Monospace for the required-letter or wordmark |
| Motion with a reduced-motion fallback for every effect | Motion that's the only carrier of a state change |
| Error/success color reserved strictly for those states | Reusing `red-alert` or `limeade` decoratively |

---

## 9. Open items

1. Final display and monospace font selection and mobile licensing not yet confirmed (section 2).
2. Exact palette hex values are a first pass — should be run through a contrast checker against every actual text/fill pairing used in final screens, not just the ones listed in section 1.
3. No dark mode variant has been designed. The Wireframe doc lists "dark mode or system theme" as a v1 setting (section 16); this doc currently only specifies a light/paper-based palette. This needs a follow-up pass before Settings' dark mode toggle can be implemented against real tokens.
4. Motion timing values (200ms, spring parameters, etc.) are first-pass suggestions, not tuned against an actual build.
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
| `shadow-ink` | `#161311`, **fully opaque** | Used only for offset drop shadows, never as a fill |

> **WL-203 (2026-08-27): "at fixed opacity" resolved to 1.0 — fully opaque.** The value was
> never named, and the palette's own rules decide it: `ink` at any opacity below 1.0
> composites over `paper` to a **grey** (at 0.85 it lands on `#39352F`), and section 1 states
> that "Grays are excluded from this palette entirely." Any translucency therefore
> manufactures the one colour family this palette bans. It also softens the shadow edge,
> which is the same failure mode as the blur that section 8 explicitly rejects. The token
> stays separate from `ink` so shadow colour can be retuned later without touching every
> border in the app — the separation is semantic, not a difference in value.

**Pairing rules:**
- Never pair two accent colors directly touching without a black outline or paper-colored gap between them — this is what keeps "unconventional" from becoming "illegible."
- `red-alert` is reserved strictly for invalid-word states. Do not use it decoratively, or its meaning as an error signal weakens (this also serves the "no color-only meaning" accessibility rule below).
- `limeade` is reserved strictly for success/valid states, same reasoning.
- Every accent color must be paired with `ink` for outlines and either `paper` or `ink` for text — never gray. Grays are excluded from this palette entirely.

**Accessibility reconciliation:** [Design constraint, not optional] Every text/fill combination in this palette must meet WCAG AA contrast (4.5:1 for body text, 3:1 for large text) before shipping. This satisfies the Wireframe doc's high-contrast requirement (section 18) without forcing the palette back toward neutral.

**Verified under WL-202 (2026-08-26). No hex value changed.** Every pairing the system actually uses was measured; the full results are in `WordLoop_Contrast_Matrix.md`, regenerated from `src/theme/palette.ts` by `npm run contrast:verify`. The palette survived intact — what the audit produced instead is a **mandatory text colour per fill**, which section 1 previously left open by saying text is "either `paper` or `ink`" without saying which:

| Fill | Body / button / caption text | Display text (≥24px) |
|---|---|---|
| `paper` | `ink` | `ink` |
| `ink` | `paper` | `paper` |
| `grape` | **`paper` only** (ink is 3.25:1) | `paper` or `ink` |
| `tangerine` | **`ink` only** (paper is 2.66:1) | `ink` only |
| `bubblegum` | **`ink` only** | `ink` or `paper` (paper is 3.12:1 — thin; prefer `ink`) |
| `limeade` | **`ink` only** (paper is 1.38:1) | `ink` only |
| `red-alert` | **`ink` only** (paper is 3.42:1) | `ink` or `paper` |
| `sunbeam` | **`ink` only** (paper is 1.34:1) | `ink` only |

Read the pattern rather than memorising the table: **`grape` is the only fill dark enough to carry `paper` text, and every other accent takes `ink`.** That is a stronger, simpler rule than section 1's original phrasing, and it is enforced in code — `TEXT_ON` in `src/theme/palette.ts` is the machine-readable copy, and the verifier *derives* it from the hexes and fails if the two disagree, so it cannot rot.

Two findings worth carrying into WL-203 and WL-204:

- **The "always an `ink` outline" rule is doing real accessibility work, not just carrying the aesthetic.** `sunbeam` (1.34:1) and `tangerine` (2.66:1) are too close to `paper` to form a visible boundary against the page on their own. They never have to, because the component language mandates a 2-4px `ink` border on everything. Dropping that border on a badge or callout for visual reasons would create a genuine WCAG 1.4.11 failure, not merely an off-style component.
- **Disabled controls need `ink` labels.** See section 4.

---

## 2. Typography

**Display face: `Baloo 2`** (ExtraBold/800 and Bold/700 cuts). **Decided — Delivery Plan D-06,
closed 2026-08-26.**

> **Corrected under WL-201 (2026-08-26): this said "Black/900", a weight Baloo 2 does not
> have.** Its variable weight axis runs **400–800**, and the static cuts stop at ExtraBold
> — confirmed from two independent sources (Google Fonts' `METADATA.pb` axis range, and the
> upstream `yanone/Baloo2-Variable` static set: Regular, Medium, SemiBold, Bold, ExtraBold).
> **This changes nothing about what was chosen.** The D-06 specimen that Baloo 2 won on
> rendered it at weight 800 throughout, so 800 is the weight actually evaluated and picked;
> the "900" was aspirational text written before any face was selected. Recorded as a
> correction rather than silently amended, per `CLAUDE.md`. Reverting to a true 900 means
> reopening D-06 and choosing a different display face — **do not** simulate it with
> synthetic/faux bolding, which on an already-heavy face smears the letterforms at 64px and
> is exactly the "loses its character" failure the section-2 rule below guards against. Chosen over Fredoka (reads warmer/softer, closer to the "kids app"
register this doc's thesis warns against overshooting into) and Lilita One (single heavy
weight only, more comic/sticker-like — closer to the "skate brand" alternative, but with no
lighter cut available for the 40px wordmark role). Baloo 2 carries the most weight and
confidence at the 64px required-letter size — the single largest, highest-stakes text
element in the app — without losing the rounded-slab warmth the rest of the palette commits
to. Google Fonts, **SIL Open Font License** — verified against the license text directly:
bundling, embedding, and redistributing inside app software is explicitly permitted at no
cost, provided the license text ships with the app. Covered by the Attributions screen
(WL-407), alongside the ESDB, WordNet, and LDNOOBW notices.

**Body face: `JetBrains Mono`** (Regular/400 and Bold/700, plus Italic where needed) for
body copy, instructions, word-chain history, and settings. Monospace reinforces the "word
game / word puzzle" identity (every letter takes equal visual weight, which suits a
letter-chain mechanic) while staying more legible than the display face at small sizes.
**Decided — Delivery Plan D-06, closed 2026-08-26.** Chosen over IBM Plex Mono (very
legible, but reads more geometric/corporate) and Space Mono (most characterful of the
three, but its lower x-height hurts legibility at the 12px caption size where score labels
and timestamps actually get read) — JetBrains Mono stays clearest at that size while
keeping a calm, technical register next to Baloo 2's louder display voice. Same OFL
licensing basis as above — mobile bundling is explicitly permitted.

**Type scale:**

| Role | Face | Size | Weight | Font file to reference | Notes |
|---|---|---|---|---|---|
| Wordmark / hero | Display | 40px | ExtraBold/800 | `Baloo2-ExtraBold` | Home, Welcome screens |
| Required letter | Display | 64px | ExtraBold/800 | `Baloo2-ExtraBold` | Must be the single largest text element on the Game screen — see section 6 |
| Screen title | Display | 28px | Bold/700 | `Baloo2-Bold` | |
| Computer/player word | Display | 26px | Bold/700 | `Baloo2-Bold` | |
| Body / instructions | Monospace | 15px | Regular/400 | `JetBrainsMono-Regular` | |
| Button label | Monospace | 15px | Bold/700 | `JetBrainsMono-Bold` | Uppercase, letter-spacing +0.02em |
| Caption / metadata | Monospace | 12px | Regular/400 | `JetBrainsMono-Regular` | Score labels, timestamps |

**Reference the face by `fontFamily` and do not also set `fontWeight`** (WL-201). Each
weight is bundled as its own file whose filename matches its PostScript name, which is what
lets one string work on both platforms — iOS resolves `fontFamily` by PostScript name,
Android by asset filename. Setting `fontWeight` on top of an already-weighted face invites
the platform to synthesise a *second* layer of boldness on Android, and silently picks a
different face on iOS. `src/theme/typography.ts` encodes this; use it rather than raw
strings.

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
- Disabled buttons keep their border and shape but drop to 40% opacity fill and lose the offset shadow entirely (reads as "flat," reinforcing non-interactivity without relying on color alone). **The label must switch to `ink`** — see below.

> **WL-202 (2026-08-26): the disabled primary button needs an `ink` label, not the `paper` one it inherits from its enabled state.** A 40%-opacity `grape` fill composites over `paper` to roughly `#CBABEB`, against which `paper` text measures **1.86:1** — effectively unreadable. `ink` on that same fill is 9.30:1.
>
> WCAG 1.4.3 *exempts* inactive controls from contrast minimums, so this was legal as written. It is still worth fixing, because the exemption assumes disabled controls are peripheral and here that assumption is wrong: Wireframe section 8 disables Submit whenever the input is empty, which is the state **every single turn opens in**. The disabled Submit button is one of the most-viewed elements in the entire product. Shipping it at 1.86:1 to stay inside a technicality would be the wrong call.

### Cards
- `paper` or any section 1 palette fill, `ink` border, 6-8px offset shadow, 20px radius.
- Slight rotation permitted (see section 3) for informational cards (word review entries, stat cards). Never rotate cards containing the input field or primary game controls.

> **WL-203 (2026-08-27): "a light tint fill" is removed — it was undefined and unverifiable.**
> No tint values were ever specified, so nothing could be contrast-checked against it, and
> WL-202 flagged it as the one fill in the system its matrix could not cover. It was also
> *narrower and vaguer* than this section's own construction block, which already permits
> "one saturated color from section 1, or `paper`" for any component. Cards now follow that
> same rule, so every legal card fill is one the contrast matrix has already verified along
> with its mandatory text colour. If a genuine tint is wanted later, it has to be a named
> token in section 1 and go through `npm run contrast:verify` like every other fill.

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
- Input field **fill** flashes `limeade` briefly — the `ink` border is retained throughout. Word "stamps" onto the chain display with a small scale-in.
- Chain display itself doesn't reflow/animate other entries — only the new entry animates in, to avoid a busy, distracting list.

> **Corrected under WL-202 (2026-08-26): this was a border flash, and it was an accessibility defect.** Flashing the *border* to `limeade` replaced the `ink` outline with a colour that sits at **1.38:1 against `paper`** — under WCAG 1.4.11's 3:1 floor for UI component boundaries, so the input field lost its visible boundary at the exact moment it was confirming success. Flashing the fill instead keeps the `ink` border (17.27:1) carrying the boundary and puts the success colour somewhere it reads: `ink` on `limeade` is 12.56:1, so the word the player just typed stays perfectly legible during the flash. See `WordLoop_Contrast_Matrix.md`.
>
> **The error state below is deliberately *not* changed to match.** `red-alert` measures 3.42:1 against `paper` and clears 1.4.11 as a border on its own, so there is no defect to fix there — and the error state's border change is doing more work than the success one, since it persists rather than flashing. The resulting asymmetry (success flashes fill, error flashes border) is a measured outcome, not an oversight.

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

1. ~~Final display and monospace font selection...~~ **Resolved — Delivery Plan D-06,
   closed 2026-08-26: `Baloo 2` (display) + `JetBrains Mono` (body/UI).** Both are Google
   Fonts under SIL OFL, verified to permit mobile app bundling at no cost. See section 2.
2. ~~Exact palette hex values are a first pass — should be run through a contrast checker
   against every actual text/fill pairing used in final screens...~~ **Resolved — WL-202,
   2026-08-26.** Every pairing measured against WCAG 2.1 AA; results in
   `WordLoop_Contrast_Matrix.md`, regenerated from `src/theme/palette.ts` by
   `npm run contrast:verify` and gated in CI. **No hex value needed changing** — the
   palette passes as designed. What the audit produced instead was a mandatory
   text-colour-per-fill rule (section 1), one corrected motion spec (section 5's
   valid-move flash was a real 1.4.11 failure), and one corrected disabled-button label
   colour (section 4).
3. ~~No dark mode variant has been designed...~~ **Resolved — Delivery Plan D-05, closed
   2026-08-26: no dark mode in v1.** The Wireframe doc's §16 toggle is cut for v1 (updated
   there to match). The v1 token layer (`WL-203`) only needs to produce light-mode values.
   Designing a real dark palette — this maximalist warm-paper palette has no obvious dark
   translation, and a rushed one would look worse than not offering the toggle — is a
   post-v1 target, revisited when that release is scoped.
4. Motion timing values (200ms, spring parameters, etc.) are first-pass suggestions, not tuned against an actual build.
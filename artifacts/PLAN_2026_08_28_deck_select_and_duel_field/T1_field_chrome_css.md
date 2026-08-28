# T1: Field chrome CSS: hover, zone borders, field border, rail divider (items 7,8,9,10)

**Plan:** `./artifacts/PLAN_2026_08_28_deck_select_and_duel_field.md`
**Depends:** none
**Commit outcome:** Open-card hover scale gone; card-slot border gone; zone border solid; outer field border gone; straight rail divider added

## Context (self-contained)

- Goal: implement the 2026-08-27 owner feedback round on the duel field and right pane. This ticket covers feedback items 7–10 (owner wording, binding):
  7. "Remove hover effects over the opened cards by default."
  8. "Remove the solid card border that represents only vertical card. Make the dashed full size zone a solid border"
  9. "Remove the border around the duel field."
  10. "Add straight separation border between right pane and duel field"
- This slice: pure CSS chrome changes in `src/styles/app.css`, plus manual-test-checklist entries. Independent of every sibling ticket.
- Out of scope here:
  - No Svelte component edits (nothing under `src/battle/`, `src/shell/`, etc.).
  - No other feedback items than 7–10.
  - Never edit `feedback.md` (owner-authored, byte-identical rule in AGENTS.md).
  - Sibling tickets restyle other selectors in `src/styles/app.css` — touch ONLY the rules listed under Impl steps. No drive-by cleanups elsewhere in the file.
  - `src/styles/tokens.css` untouched.
- Assumptions in force:
  - A3/A13: item 9 removes only the outer `.duel-field` border; the inner mat border on `.duel-field-board` stays — it reads as the play mat. Owner reviews the result.
  - Item 7 scope = hover/focus zoom scale on opened (identity-known) field/zone cards. The hand-card `:focus-within` lift stays (keyboard focus, not hover). The z-index raise on hover/focus stays (layering, not a visual effect).
  - A11: `npm run check:headless` and `npm run test:component` are the merge gates.

## Requirements

- Hovering an identity-known, non-hand, non-pinned card on the board no longer scales it 1.35×; the card keeps its normal `translate(-50%, -50%)` position. Focus does not scale it either (the removed rule covered `:hover, :focus-within` together — remove the whole rule).
- Hand cards keep their `:focus-within` 1.35× lift unchanged.
- Hovered/focused/pinned cards still get `z-index: var(--duel-field-layer-card-raised)` (rule at `src/styles/app.css:2133-2136` stays).
- `.duel-field-zone__slot` (the inner card-shaped inset box) draws no border. The element and its geometry rule stay.
- `.duel-field-zone` and `.duel-field-zone--shared` borders become `solid` at the same widths and colors as today. The `--zone-outline-color` custom-property path keeps working, including the `data-zone-outlines="false"` admin toggle that sets it transparent.
- `.duel-field` (outer wrapper) has no border. Its radius, gradient background, and box-shadow stay.
- `.duel-right-rail` gets a full-height straight left border: `1px solid var(--border)`. The line must sit flush against the duel field (the `.duel-shell` grid at `src/styles/app.css:447-457` declares no `gap` — verified by inspection; re-verify, and if a gap has appeared, remove nothing — report it instead). If the border visually crowds the rail's content, add a small `padding-inline-start` (e.g. `0.5rem`) to `.duel-right-rail`.
- `artifacts/manual_test_checklist.md` gains manual steps for all four visual changes.

## Inputs

- `src/styles/app.css` — all edits here. Current rule locations (verified 2026-08-27; re-locate by selector if lines drifted):
  - `.duel-shell` grid: lines 447–457 (`grid-template-columns: var(--preview-w) auto minmax(var(--rail-min), 1fr);`, no `gap`)
  - `.duel-right-rail`: lines 528–538
  - `.duel-field`: lines 1173–1189 (contains `border: 1px solid var(--border);`)
  - `.duel-field-board`: lines 1284–1293 (contains `border: 1px solid var(--field-border);` — STAYS)
  - `.duel-field-zone`: lines 1337–1350 (`border: 1px dashed var(--zone-outline-color, ...)`)
  - `.duel-field-zone--shared`: lines 1355–1358 (`border: 2px dashed var(--zone-outline-color, var(--accent));`)
  - `data-zone-outlines="false"` toggle: lines 1361–1363 (STAYS)
  - `.duel-field-zone__slot`: lines 1369–1378 (contains the border to remove)
  - z-index raise rule: lines 2133–2136 (STAYS)
  - field/zone hover-scale rule + its explanatory comment: lines 2138–2155 (REMOVE both)
  - hand `:focus-within` lift + comment: lines 2183–2187 (STAYS; comment reworded, see 1.3)
- `artifacts/manual_test_checklist.md` — append a new section at the end (current last section: `## R6 duel-chrome-trim`).
- `tests/component/DuelField.test.ts`, `tests/component/CardControl.test.ts` — read-only. Inspected: hover tests assert preview/overlay behavior via DOM queries, not CSS transform values, and Vitest/jsdom does not apply `app.css` anyway. No test edits expected; verify by running the suite.
- **From Depends:** none.

## Interface contract (level 5)

CSS-only slice; no TS/API surface. The contract is exact rule shapes.

- **Produces** (final state of each touched rule):

  ```css
  .duel-right-rail {
    display: grid;
    grid-template-rows: auto auto minmax(0, 1fr) auto;
    gap: 0.75rem;
    min-width: 0;
    border-inline-start: 1px solid var(--border);
    /* The pillarbox used to sit between this rail and the edge of the screen.
       Once the duel spends it the rail runs to the true viewport edge, so it
       keeps the same inset the board does — and only while there was a bar to
       spend, so an exactly-16:9 viewport is untouched. */
    padding-inline-end: var(--duel-field-margin, 0px);
  }
  ```

  `.duel-field`: identical to today minus the single declaration `border: 1px solid var(--border);`.

  ```css
  .duel-field-zone {
    z-index: var(--duel-field-layer-zone);
    display: grid;
    place-items: center;
    padding: 0.2rem;
    border: 1px solid
      var(
        --zone-outline-color,
        color-mix(in srgb, var(--field-zone-outline) 48%, transparent)
      );
    border-radius: var(--radius-sm);
    background: color-mix(in srgb, var(--field-zone-fill) 28%, transparent);
    color: color-mix(in srgb, var(--text) 70%, transparent);
    font-size: clamp(0.42rem, 0.7vw, 0.68rem);
    line-height: 1.15;
    text-align: center;
  }

  .duel-field-zone--shared {
    border: 2px solid var(--zone-outline-color, var(--accent));
    background: color-mix(in srgb, var(--field-zone-shared) 72%, transparent);
    color: var(--text);
  }

  .duel-field-zone__slot {
    position: absolute;
    left: 50%;
    top: 50%;
    width: calc(var(--field-width) * 0.6923076923 + 6px);
    height: var(--field-height);
    transform: translate(-50%, -50%);
    pointer-events: none;
  }
  ```

  Removed entirely (rule + its 13-line comment, `src/styles/app.css:2138-2155`):

  ```css
  .duel-field-card.is-identity-known:not(.is-hand-item):not(.is-pinned):is(
      :hover,
      :focus-within
    ) {
    transform: translate(-50%, -50%) scale(1.35);
  }
  ```

- **Consumes:** `var(--border)`, `var(--zone-outline-color)`, `var(--field-zone-outline)`, `var(--accent)` — all pre-existing, unchanged.
- **Errors:** n/a (CSS).
- **Invariants:**
  - `grep -c 'dashed' src/styles/app.css` == 0 after the change (today's only two `dashed` uses are the two zone rules).
  - `grep -c 'scale(1.35)' src/styles/app.css` == 1 after the change (the surviving hand `:focus-within` rule at ~2186).
  - `.duel-field-board[data-zone-outlines="false"] { --zone-outline-color: transparent; }` still hides zone outlines — solid borders inherit the same custom property.
  - `.duel-field-board` border declaration byte-identical to before.
  - z-index raise rule (`.duel-field-card:is(:hover, :focus-within), .duel-field-card.is-pinned { z-index: ... }`) byte-identical to before.
- **Integration links:** none — single-file CSS, observed via manual Chromium check + grep assertions.

## TDD

CSS has no unit harness — acceptance-check substitution per skill override:

1. **Red** — before editing, confirm the old rules exist: `grep -c 'scale(1.35)' src/styles/app.css` prints `2`; `grep -c 'dashed' src/styles/app.css` prints `2`; `grep -n 'border: 1px solid var(--border);' src/styles/app.css` matches inside `.duel-field`.
2. **Green** — after editing, the grep assertions under Invariants hold, and both gate suites pass unmodified.
3. **Refactor** — none expected; do not reflow untouched rules.

## Test plan (check plan)

| Check | Input | Expect |
| ----- | ----- | ------ |
| `grep -c 'scale(1.35)' src/styles/app.css` | edited file | `1` |
| `grep -c 'dashed' src/styles/app.css` | edited file | `0` |
| `grep -n 'border' src/styles/app.css \| sed -n '/duel-field-zone__slot/,$p'` — or open rule at ~1369 | edited file | `.duel-field-zone__slot` block has no `border:` line |
| `grep -A4 '^\.duel-field {' src/styles/app.css \| grep border` | edited file | no `border: 1px solid var(--border);` (only `border-radius` may remain in the block) |
| `grep -A6 '^\.duel-right-rail {' src/styles/app.css` | edited file | contains `border-inline-start: 1px solid var(--border);` |
| `npm run check:headless` | repo | exit 0 |
| `npm run test:component` | repo | exit 0 (DuelField.test.ts + CardControl.test.ts hover tests assert DOM behavior, not CSS — verified, should pass untouched) |
| Manual Chromium (`npm run dev`, `#/free-play`, start duel) | live board | four visual changes below hold |

## Impl steps

- [ ] 1. Item 7 — remove the field/zone hover-scale rule
  - [ ] 1.1 `src/styles/app.css` — delete lines 2138–2155: the comment block starting `/* Field/zone cards are absolutely centred via \`translate(-50%, -50%)\`` through the closing `}` of the rule `.duel-field-card.is-identity-known:not(.is-hand-item):not(.is-pinned):is(:hover, :focus-within) { transform: translate(-50%, -50%) scale(1.35); }`. Delete comment and rule together.
  - [ ] 1.2 Do NOT touch the z-index raise rule directly above it (`.duel-field-card:is(:hover, :focus-within), .duel-field-card.is-pinned { z-index: var(--duel-field-layer-card-raised); }`, lines 2133–2136) nor its comment.
  - [ ] 1.3 In the comment above the hand focus rule (lines 2183–2184), replace `/* Same pin exclusion as the field/zone rule above. The overlay handles the hover state; only focus-within keeps the in-place lift. */` with `/* Board cards no longer zoom on hover; a focused hand card keeps its in-place lift so keyboard users see which card holds focus. Pinned cards are excluded: pinning moves focus onto a card-action-chips button, and scaling then can push that chip outside the viewport. */` Keep the rule itself (`.duel-field-card.is-identity-known.is-hand-item:not(.is-pinned):focus-within { transform: scale(1.35); }`) byte-identical.
- [ ] 2. Item 8 — slot border off, zone borders solid
  - [ ] 2.1 `src/styles/app.css` `.duel-field-zone__slot` (~line 1369): delete the two-line declaration `border: 1px solid color-mix(in srgb, var(--field-card-edge) 40%, transparent);` and the now-pointless `border-radius: 0.28rem;` line. Keep the rest of the block.
  - [ ] 2.2 `.duel-field-zone` (~line 1337): change `border: 1px dashed` → `border: 1px solid` (the multi-line `var(--zone-outline-color, ...)` value stays byte-identical).
  - [ ] 2.3 `.duel-field-zone--shared` (~line 1355): change `border: 2px dashed var(--zone-outline-color, var(--accent));` → `border: 2px solid var(--zone-outline-color, var(--accent));`.
  - [ ] 2.4 Leave `.duel-field-board[data-zone-outlines="false"] { --zone-outline-color: transparent; }` (~line 1361) untouched.
- [ ] 3. Item 9 — outer field border off
  - [ ] 3.1 `src/styles/app.css` `.duel-field` (~line 1173): delete the single line `border: 1px solid var(--border);`. Keep `border-radius: var(--radius-lg);`, the gradient background, and the box-shadow. Do not touch `.duel-field-board` (~line 1284) — its `border: 1px solid var(--field-border);` stays.
- [ ] 4. Item 10 — rail divider
  - [ ] 4.1 `src/styles/app.css` `.duel-right-rail` (~line 528): insert `border-inline-start: 1px solid var(--border);` after `min-width: 0;`.
  - [ ] 4.2 Verify `.duel-shell` (~line 447) still declares no `gap` (it does today), so the divider sits flush against the field. If a gap exists, leave it and report — do not restructure the grid.
  - [ ] 4.3 Manual check (step 6): if rail content touches the new line, add `padding-inline-start: 0.5rem;` to `.duel-right-rail`; otherwise add nothing.
- [ ] 5. Manual checklist
  - [ ] 5.1 Append to `artifacts/manual_test_checklist.md` after the `## R6 duel-chrome-trim` section:

    ```md
    ---

    ## T1 field-chrome-css (PLAN_2026_08_27_duel_field_right_pane_feedback)

    Owner feedback items 7–10: no hover zoom on opened board cards, solid zone
    outlines with no inner slot box, no border around the whole field, and a
    straight divider between the field and the right rail.

    Run `npm run dev` (default `DEV_PORT=4300`), open `#/free-play`, start a duel.

    - [ ] Summon a monster face-up, then hover it: the card no longer grows. It still rises above its neighbours (nothing clips it) and its action buttons still work.
    - [ ] Tab to a card in your hand: the focused hand card still lifts 1.35× as before.
    - [ ] Look at an empty monster zone: one solid outline, no second card-shaped box inset inside it. Occupied zones show no extra frame around the vertical card either.
    - [ ] Open the admin zone-outline toggle (`data-zone-outlines` off): zone outlines disappear entirely, as before.
    - [ ] The duel field has no border around its outer edge; the play mat's own inner frame is still there.
    - [ ] A single straight vertical line separates the duel field from the right pane, running the pane's full height, with the rail's text not touching it.
    ```
- [ ] 6. Gates
  - [ ] 6.1 Run `grep -c 'scale(1.35)' src/styles/app.css` → `1`; `grep -c 'dashed' src/styles/app.css` → `0`.
  - [ ] 6.2 Run `npm run check:headless` → exit 0.
  - [ ] 6.3 Run `npm run test:component` → exit 0.
  - [ ] 6.4 Run the manual checklist section from 5.1 in Chromium; apply 4.3's padding only if needed.

## Outputs

- Files touched: `src/styles/app.css`, `artifacts/manual_test_checklist.md`.
- Behavior change: visual chrome only — no legality, layout-model, or component behavior change; no public API change.
- Migrations/config: none.

## Validation

- [ ] Checks pass: `npm run check:headless` and `npm run test:component` both exit 0
- [ ] Grep assertions hold: `grep -c 'scale(1.35)' src/styles/app.css` == 1, `grep -c 'dashed' src/styles/app.css` == 0
- [ ] Manual Chromium check: all six checklist items from step 5.1 pass
- [ ] No silent-failure swallow on a path this slice adds: none — CSS only, no code paths added
- [ ] App functional — duel starts, cards hover/focus/pin, zone toggle works, no clipped controls
- [ ] Commit msg draft: `style(duel): drop board hover zoom and chrome borders, solidify zone outlines, add rail divider`

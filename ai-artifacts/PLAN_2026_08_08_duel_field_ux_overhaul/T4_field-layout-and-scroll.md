# T4: Full-width board, free page scroll, hand fixes

**Plan:** `./ai-artifacts/PLAN_2026_08_08_duel_field_ux_overhaul.md`
**Depends:** T1, T3
**Commit outcome:** The board fills the width of its column, the wheel over the duel field always scrolls the page, the opponent hand zone has no border or tint, and opponent hand cards stand upright like the player's.

## Context (self-contained)

- Goal: turn the app from a panel stack into a field-first duel client. This ticket covers feedback items 1, 7, 15 and 16.
- This slice: pure layout and view-model geometry. No new component, no interaction change.
- Out of scope here: hiding panels (T5), action bar (T6), end-turn button (T7), pills (T8), chips (T9), drag (T10), preview panel (T11).
- Assumptions in force: A1.

## Root causes to fix

- **Scroll trap:** `.duel-field` in `src/styles/app.css` sets `overflow: auto` **and** `overscroll-behavior: contain`. The board's `min-width: 52rem` makes the field a real scroll container, and `contain` stops scroll chaining, so the wheel does nothing once the field has no scroll room of its own. A `@media (max-width: 48rem)` rule additionally caps `.duel-field` at `max-height: calc(100svh - 1rem)`.
- **Board width:** `.duel-field-board` is capped at `width: min(100%, calc((100vh - 4rem) * 16 / 9))` with `min-width: 52rem`.
- **Opponent hand tint:** `.duel-field-zone[data-zone-kind="hand"]` applies a dashed border and green background to *both* hands.
- **Sideways opponent hand:** `addHiddenHandPlaceholder` in `src/field/board-view-model.ts` hard-codes `position: "faceDownDefense"` and `orientation: "sideways"`, and `.duel-field-card.is-opponent.is-sideways .duel-field-card__art` then rotates the art 270°.

## Requirements

- Wheel over the duel field scrolls the page whenever the page can scroll.
- `.duel-field-board` spans 100% of its container's width and keeps its 16:9 aspect ratio.
- No horizontal scrollbar inside `.duel-field` at any supported viewport.
- `p1:hand` zone renders with no border and no distinct background; `p0:hand` keeps the existing dashed treatment.
- Hidden hand placeholders for both players are `upright`, never `sideways`.
- Field controls stay keyboard reachable and the existing 44px entry target is unaffected.

## Inputs

- Edit: `src/styles/app.css`, `src/field/board-view-model.ts`, `tests/unit/duel-field.test.ts`, `tests/unit/global-styles.test.ts`, `e2e/duel-smoke.spec.ts`.
- **From Depends (T1):** `data-cy` exists on every element; `duel-field`, `duel-field-board`, `` `field-card-${card.id}` ``, `` `field-zone-${zone.id}` `` are the frozen selectors.
- **From Depends (T3):** `src/styles/app.css` now owns the global `.visually-hidden` rule; `tests/unit/global-styles.test.ts` exists and reads `src/styles/app.css` as text; `src/app/components/DuelField.svelte` no longer renders a heading or the two live paragraphs.
- Read only: `src/field/duel-field-layout.ts` (`STANDARD_DUEL_FIELD_LAYOUT`, hand zone is 720×72 field units at y 42 for player 1 and y 678 for player 0), `src/app/components/duel-field/ZoneControl.svelte` (renders `data-zone-id={zone.id}` and `data-zone-kind={zone.kind}`).

## TDD

1. **Red** — add the view-model and stylesheet assertions below; run and record failures.
2. **Green** — apply the CSS and view-model edits.
3. **Refactor** — none.

## Test plan

| Test | Input | Expect |
| --- | --- | --- |
| `hidden hand placeholders are upright` | `mapSnapshotToBoard` on a fixture where `handCount > hand.length` for player 1 | every card whose `zoneId === "p1:hand"` has `orientation === "upright"` |
| `hidden hand placeholders are not defense position` | same | every such card has `position === "faceDownAttack"` |
| `own hidden hand placeholders are upright too` | fixture with player 0 `handCount > hand.length` | cards in `p0:hand` have `orientation === "upright"` |
| `duel field does not contain overscroll` | `src/styles/app.css` text | the `.duel-field {` block contains neither `overscroll-behavior: contain` nor `overflow: auto` |
| `duel field is not height-capped on small screens` | same | the file contains no `max-height: calc(100svh - 1rem)` |
| `board is full width` | same | the `.duel-field-board {` block contains `width: 100%` and no `min-width: 52rem` |
| `opponent hand zone is plain` | same | the file contains a `.duel-field-zone[data-zone-id="p1:hand"]` rule setting `border-color: transparent` and `background: transparent` |
| e2e `wheel over the duel field scrolls the page` | viewport 900×420, production build | after `page.mouse.move` to the field centre and `page.mouse.wheel(0, 400)`, `window.scrollY` is greater than 0 |
| e2e `duel field has no horizontal overflow` | viewports 1366×768 and 1024×768 | `scrollWidth <= clientWidth + 1` for `[data-cy="duel-field"]` |

## Impl steps

- [ ] 1. Add the three view-model rows to `tests/unit/duel-field.test.ts`. Build the fixture by taking an existing public-state fixture from `tests/fixtures/board-public-states.ts` and setting `handCount` above `hand.length` for the relevant player. Run `npx vitest run tests/unit/duel-field.test.ts` and record the failures.
- [ ] 2. Add the four stylesheet rows to `tests/unit/global-styles.test.ts`; record the failures.
- [ ] 3. In `src/field/board-view-model.ts`, inside `addHiddenHandPlaceholder`, change `position: "faceDownDefense" as const` to `position: "faceDownAttack" as const` and `orientation: "sideways" as const` to `orientation: "upright" as const`.
- [ ] 4. Check the rest of `board-view-model.ts` for other hand-orientation assumptions: `orientationFor` is only used by `addCard` and stays as is; do not change it.
- [ ] 5. In `src/styles/app.css`, edit the `.duel-field` rule: delete `overflow: auto;`, delete `overscroll-behavior: contain;`, keep `container`, `position`, `min-width: 0`, `max-width: 100%`, `padding`, `border`, `border-radius`, `background`, `box-shadow`, `scroll-padding`.
- [ ] 6. In `src/styles/app.css`, edit the `.duel-field-board` rule: replace `width: min(100%, calc((100vh - 4rem) * 16 / 9));` with `width: 100%;` and replace `min-width: 52rem;` with `min-width: 0;`. Keep `aspect-ratio: 16 / 9`, `overflow: hidden`, `margin-inline: auto`, border, radius, background, `isolation: isolate`.
- [ ] 7. In `src/styles/app.css`, in the `@media (max-width: 48rem)` block, delete the whole `.duel-field { max-height: …; padding: …; }` rule.
- [ ] 8. In `src/styles/app.css`, immediately after the `.duel-field-zone[data-zone-kind="hand"]` rule, add `.duel-field-zone[data-zone-id="p1:hand"] { border-color: transparent; background: transparent; }`.
- [ ] 9. In `src/styles/app.css`, widen the shell: change the `main { width: min(90rem, calc(100% - 2rem)); … }` declaration to `width: min(120rem, calc(100% - 2rem));`, and apply the same width to `.app-menubar`.
- [ ] 10. Run `npx vitest run tests/unit/duel-field.test.ts tests/unit/global-styles.test.ts` to green.
- [ ] 11. Run `npm run test:component`; fix any DuelField/DuelHud assertion that asserted `is-sideways` on a hand card.
- [ ] 12. In `e2e/duel-smoke.spec.ts`, add `test("wheel over the duel field scrolls the page", …)`: `await page.setViewportSize({ width: 900, height: 420 })`, wait for `[data-cy="duel-field"]`, read its bounding box, `await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)`, `await page.mouse.wheel(0, 400)`, then `await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0)`.
- [ ] 13. In `e2e/duel-smoke.spec.ts`, extend the existing `responsive field compositions contain controls across supported viewports` test with a per-viewport assertion that `[data-cy="duel-field"]` has `scrollWidth <= clientWidth + 1`.
- [ ] 14. Run `npx playwright test -g "wheel over the duel field"` and `npx playwright test -g "responsive field compositions"` to green.

## Outputs

- Files edited: `src/styles/app.css`, `src/field/board-view-model.ts`, `tests/unit/duel-field.test.ts`, `tests/unit/global-styles.test.ts`, `e2e/duel-smoke.spec.ts`.
- Behaviour change: page scroll never trapped; board fills the column; opponent hand plain and upright.
- Migrate / config: none.

## Validation

- [ ] `npx vitest run tests/unit/duel-field.test.ts tests/unit/global-styles.test.ts` passes
- [ ] `npm run test:unit && npm run test:component` passes
- [ ] `npm run typecheck && npm run lint` passes
- [ ] `npm run format` then `npm run format:check` passes
- [ ] `npm run test:e2e` passes
- [ ] manual check: `npm run dev`, hover the field and scroll the wheel — the page moves; the board touches both edges of its column; the opponent hand row has no green dashed box; opponent hand card backs are portrait, not landscape
- [ ] app functional — cards still clickable, keyboard arrows still move across the board
- [ ] commit msg draft: `fix(field): free page scroll and widen the board`

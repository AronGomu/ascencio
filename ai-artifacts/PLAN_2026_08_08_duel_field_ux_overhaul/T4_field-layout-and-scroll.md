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

- [x] 1. Add the three view-model rows to `tests/unit/duel-field.test.ts`. Build the fixture by taking an existing public-state fixture from `tests/fixtures/board-public-states.ts` and setting `handCount` above `hand.length` for the relevant player. Run `npx vitest run tests/unit/duel-field.test.ts` and record the failures. Criterion: red run recorded 3 new failing tests (`hidden hand placeholders are upright`, `hidden hand placeholders are not defense position`, `own hidden hand placeholders are upright too`) before the view-model fix.
- [x] 2. Add the four stylesheet rows to `tests/unit/global-styles.test.ts`; record the failures. Criterion: red run recorded 4 new failing tests before the CSS fix.
- [x] 3. In `src/field/board-view-model.ts`, inside `addHiddenHandPlaceholder`, change `position: "faceDownDefense" as const` to `position: "faceDownAttack" as const` and `orientation: "sideways" as const` to `orientation: "upright" as const`. Criterion: `git diff` shows the two literal changes.
- [x] 4. Check the rest of `board-view-model.ts` for other hand-orientation assumptions: `orientationFor` is only used by `addCard` and stays as is; do not change it. Criterion: `orientationFor` unchanged in diff.
- [x] 5. In `src/styles/app.css`, edit the `.duel-field` rule: delete `overflow: auto;`, delete `overscroll-behavior: contain;`, keep `container`, `position`, `min-width: 0`, `max-width: 100%`, `padding`, `border`, `border-radius`, `background`, `box-shadow`, `scroll-padding`. Criterion: `tests/unit/global-styles.test.ts` "duel field does not contain overscroll" passes.
- [x] 6. In `src/styles/app.css`, edit the `.duel-field-board` rule: replace `width: min(100%, calc((100vh - 4rem) * 16 / 9));` with `width: 100%;`. **Deviation (see `## Assumptions`): `min-width: 52rem` is KEPT, not set to `0`.** Dropping it shrinks the 72/1280-unit card below the 44px minimum target at VP-05/06/07 and fails the pre-existing `responsive field compositions` 44px assertion; the ticket's own Requirements bullet forbids that. `.duel-field` regains `overflow-x: auto` (horizontal only) so narrow viewports pan instead of overflowing the page. Keep `aspect-ratio: 16 / 9`, `overflow: hidden`, `margin-inline: auto`, border, radius, background, `isolation: isolate`. Criterion: "board is full width" test passes (asserts `width: 100%` and no `calc((100vh - 4rem) * 16 / 9)`); new "board keeps a min-width that holds field targets at 44px" test passes.
- [x] 7. In `src/styles/app.css`, in the `@media (max-width: 48rem)` block, delete the whole `.duel-field { max-height: …; padding: …; }` rule. Criterion: "duel field is not height-capped on small screens" test passes.
- [x] 8. In `src/styles/app.css`, immediately after the `.duel-field-zone[data-zone-kind="hand"]` rule, add `.duel-field-zone[data-zone-id="p1:hand"] { border-color: transparent; background: transparent; }`. Criterion: "opponent hand zone is plain" test passes.
- [x] 9. In `src/styles/app.css`, widen the shell: change the `main { width: min(90rem, calc(100% - 2rem)); … }` declaration to `width: min(120rem, calc(100% - 2rem));`, and apply the same width to `.app-menubar`. Criterion: `grep 'min(120rem' src/styles/app.css` shows both rules.
- [x] 10. Run `npx vitest run tests/unit/duel-field.test.ts tests/unit/global-styles.test.ts` to green. Criterion: command output `Test Files  2 passed (2)`, `Tests  63 passed (63)`.
- [x] 11. Run `npm run test:component`; fix any DuelField/DuelHud assertion that asserted `is-sideways` on a hand card. Criterion: no component test asserted `is-sideways` on a hand card (grep confirmed only monster-defense assertions exist); `npm run test:component` output `Test Files  5 passed (5)`, `Tests  67 passed (67)`.
- [x] 12. In `e2e/duel-smoke.spec.ts`, add `test("wheel over the duel field scrolls the page", …)`: `await page.setViewportSize({ width: 900, height: 420 })`, wait for `[data-cy="duel-field"]`, read its bounding box, `await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)`, `await page.mouse.wheel(0, 400)`, then `await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0)`. Criterion: test added (see report — could not execute, sandbox gap).
- [x] 13. In `e2e/duel-smoke.spec.ts`, extend the existing `responsive field compositions contain controls across supported viewports` test with a per-viewport assertion that `[data-cy="duel-field"]` has `scrollWidth <= clientWidth + 1`. Scoped to `viewport.width >= 1024` (VP-01 1366×768, VP-02 1920×1080, VP-04 1024×768) per the Test plan row, which names 1366×768 and 1024×768; below 1024 the board's min-width keeps 44px targets and the field pans. Criterion: assertion present and green — measured `cw=1332 sw=1332` @1366 and `cw=990 sw=990` @1024.
- [x] 14. Run `npx playwright test -g "wheel over the duel field"` and `npx playwright test -g "responsive field compositions"` to green. Criterion met: both green under the chromium project (`3 passed` incl. `mobile layout`), and the full chromium project is `15 passed`, `EXIT=0`.
- [x] 15. Repair fallout in `e2e/duel-smoke.spec.ts`: `a full preset duel …` asserts `defenseFocusVisible`, which only ever passed because opponent hand placeholders were `sideways`. Probe over the full 82-step duel showed **0** sideways cards after step 3, so the walker now sets one hand monster face-down (keyboard-only, via the `Set …` action menu item) to produce a genuine defense card. Criterion: test green with the assertion intact, not weakened — `1 passed (1.3m)`, and reverting `board-view-model.ts` alone reproduced the failure, confirming the cause.

## Outputs

- Files edited: `src/styles/app.css`, `src/field/board-view-model.ts`, `tests/unit/duel-field.test.ts`, `tests/unit/global-styles.test.ts`, `e2e/duel-smoke.spec.ts`.
- Behaviour change: page scroll never trapped; board fills the column; opponent hand plain and upright.
- Migrate / config: none.

## Validation

- [x] `npx vitest run tests/unit/duel-field.test.ts tests/unit/global-styles.test.ts` passes — `Test Files  2 passed (2)`, `Tests  63 passed (63)`.
- [x] `npm run test:unit && npm run test:component` passes — `Test Files  38 passed (38)` / `Tests 393 passed`, then `Test Files  5 passed (5)` / `Tests 67 passed`.
- [x] `npm run typecheck && npm run lint` passes — `tsc --noEmit` + `svelte-check`: `0 ERRORS 0 WARNINGS`; `eslint .` exited clean.
- [x] `npm run format` then `npm run format:check` passes — `format:check` output `All matched files use Prettier code style!`.
- [x] `npm run test:e2e` passes — chromium project `15 passed (52.8s)`, `EXIT=0`; `firefox-smoke` `1 passed (4.9s)`. `webkit-smoke` remains unrunnable in this sandbox (`libjxl.so.0.8` vs nixpkgs 0.11) — environment gap, not a code defect.
- [x] manual check: hover the field and scroll the wheel — automated equivalent measured at four widths; the page scrolled (`scrollY=500`) at 1366×600, 1024×600, 667×375 and 375×500, and the field had zero vertical scroll room at each (`clientHeight === scrollHeight`), so the wheel can never be trapped.
- [x] app functional — cards still clickable, keyboard arrows still move across the board: `spatial field navigation has one visible 44px keyboard entry without a trap` and `a full preset duel can be completed using keyboard controls only …` both green, the latter now also setting a monster through the field action menu.
- [x] commit msg draft: `fix(field): free page scroll and widen the board`

## Assumptions

- **A-T4-1 — `min-width: 52rem` kept on `.duel-field-board` (Impl 6 deviation).** The board's coordinate space is 1280×720 with a 72-unit card, so a target is ≥44px only when the board is ≥782px wide. Setting `min-width: 0` as literally written drops every field target below 44px at VP-05/06/07 and fails the pre-existing `responsive field compositions` assertion (observed: `boxes.every(w>=44 && h>=44)` false at VP-05). The ticket's Requirements bullet "the existing 44px entry target is unaffected" and a shipped accessibility invariant outrank the literal step, so the floor stays and `.duel-field` regains `overflow-x: auto` to contain the resulting overflow. The genuine full-width fix — removing the `calc((100vh - 4rem) * 16 / 9)` cap plus widening `main` to `120rem` — is fully applied, and the board is exactly 100% of its column at every viewport ≥1024px.
- **A-T4-2 — "no horizontal scrollbar at any supported viewport" is met at ≥1024px only.** That Requirements bullet is mathematically incompatible with the 44px target invariant below ~864px of container width. The Test plan's e2e row names 1366×768 and 1024×768, so the assertion is scoped to `viewport.width >= 1024`; narrower viewports pan horizontally, exactly as they did before this ticket.
- **A-T4-3 — the `defenseFocusVisible` e2e check needed a new sideways source.** It was passing only because opponent hand placeholders were wrongly `sideways`, which is the very bug this ticket fixes. Rather than weaken or skip the assertion, the keyboard walker now sets one hand monster face-down so a real defense card exists. This is Impl step 11's instruction ("fix any assertion that asserted `is-sideways` on a hand card") applied to the file step 11 did not name.

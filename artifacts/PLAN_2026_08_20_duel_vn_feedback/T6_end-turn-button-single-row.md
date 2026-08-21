# T6: End-turn button single row

**Plan:** `./artifacts/PLAN_2026_08_20_duel_vn_feedback.md`
**Depends:** T1
**Commit outcome:** The end-turn button renders its label on one line and is visibly bigger.

## Context (self-contained)

- Goal: land `feedback-duel.md` and `feedback-vn.md` as one ticket chain on `main`. This ticket is `feedback-duel.md` item 7.
- This slice: one component's styling. The label text itself comes from the engine's phase choice and is not rewritten.
- Out of scope here: the rest of the right rail, the phase strip, LP plates.
- Assumptions in force: bigger means a larger min-height and horizontal padding plus a font step up, not a layout change to the rail's grid.

## Requirements

- The button never wraps: labels such as `End Turn` or `End Phase` stay on one row at every supported width.
- The button's minimum height rises to `3rem` (from the global 44px control floor) and its font size steps to `var(--text-md)`.
- The 44px interaction floor the stylesheet test asserts for controls is not weakened.

## Inputs

- `src/battle/app/components/duel-field/EndTurnButton.svelte` — renders `<button class="warning field-end-turn" data-cy="field-end-turn-button">{choice?.label ?? "End turn"}</button>`.
- `src/styles/app.css` — search `field-end-turn` for the existing rule; the duel's control floor is asserted by `tests/unit/global-styles.test.ts` (`it("board uses explicit geometry while interaction controls keep 44px floors")`).
- `tests/component/EndTurnButton.test.ts` — existing component test.
- Design tokens available: `--text-md`, `--space-3`, `--space-4`, `--radius-md` (`src/styles/tokens.css`).

## From Depends

- T1 changed documentation only; `src/` is unchanged from `main`.

## TDD

1. **Red** — add `end-turn button never wraps its label` to `tests/unit/global-styles.test.ts`, asserting the `.field-end-turn` rule declares `white-space: nowrap` and a `min-height` of at least `3rem`.
2. **Green** — write the rule.
3. **Refactor** — none.

## Test plan

| Test                                             | Input                     | Expect                                           |
| ------------------------------------------------ | ------------------------- | ------------------------------------------------ |
| `end-turn button never wraps its label`          | `app.css` text            | `.field-end-turn` contains `white-space: nowrap` |
| `end-turn button is at least 3rem tall`          | `app.css` text            | `.field-end-turn` contains `min-height: 3rem`    |
| `end-turn button still renders the choice label` | component test, spec stub | button text equals the choice's label            |

## Impl steps

- [ ] 1. Add the two stylesheet assertions to `tests/unit/global-styles.test.ts`; run `npx vitest run tests/unit/global-styles.test.ts` and see them fail.
- [ ] 2. In `src/styles/app.css`, extend (or add) the `.field-end-turn` rule with `white-space: nowrap; min-height: 3rem; padding-inline: var(--space-4); font-size: var(--text-md);`.
- [ ] 3. Re-run the stylesheet test.
- [ ] 4. Run `npx vitest run tests/component/EndTurnButton.test.ts` to confirm the label assertion still holds.
- [ ] 5. Check the rail at 1280×720 and at the mobile breakpoint that the taller button does not overflow its grid row.

## Outputs

- Files touched: `src/styles/app.css`, `tests/unit/global-styles.test.ts`.
- Behaviour change: end-turn button size and wrapping.
- Migration/config: none.

## Validation

- [ ] `npx vitest run tests/unit/global-styles.test.ts` passes
- [ ] `npx vitest run tests/component/EndTurnButton.test.ts` passes
- [ ] `npm run check:headless` passes
- [ ] manual: the rail's end-turn button is one line at desktop and mobile widths
- [ ] app functional — pressing it still passes the phase
- [ ] commit msg draft: `fix(duel-rail): the end-turn button keeps its label on one row`

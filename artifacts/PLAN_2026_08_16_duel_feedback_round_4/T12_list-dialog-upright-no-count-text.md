# T12: List dialog upright + drop count text

**Plan:** `./artifacts/PLAN_2026_08_16_duel_feedback_round_4.md`
**Depends:** none
**Commit outcome:** Opponent cards render upright inside the list dialog (title top, text bottom); the "Select between 1 and 1 choices" footer text is gone.

## Context (self-contained)

- Goal: duel feedback round 4 — YGO story duel simulator (Svelte 5). List Dialog feedback #2: "When looking at opponent zones, the cards are inverted. In list dialog they must be in the correct position — title at the top, text at the bottom." Feedback #4: "Remove text: 'Select between 1 and 1 choices' at bottom right."
- Inversion source: `src/styles/app.css` (~line 1918): `.duel-field-stack.is-opponent .duel-field-stack__art img, .zone-list-entry.is-opponent > img { transform: rotate(180deg); }` — the field-stack half is correct (board orientation), the `.zone-list-entry` half must die.
- Count text source: `validatePromptSelection` (`src/battle/app/prompts/prompt-selection.ts` line ~66) produces `Select between ${minimum} and ${maximum} choices`; `ZoneListDialog.svelte` target footer renders it as `<p id="zone-list-dialog-validation" data-cy="zone-list-dialog-validation">` when `!confirmValid`. The footer's `<output data-cy="zone-list-dialog-selection-count">` (`0 / 1 selected`) already carries the requirement. Decision: remove the validation paragraph + its `aria-describedby` wiring from the target footer entirely; keep the message elsewhere (`FieldActionBar` untouched).
- Out of scope here: halo colors (T14), collapse behavior (T13), `validatePromptSelection` itself (other surfaces depend on the message).
- Assumptions in force: none beyond above.

## Requirements

- CSS: delete only the `.zone-list-entry.is-opponent > img` selector from the shared rotate rule; `.duel-field-stack.is-opponent .duel-field-stack__art img` keeps rotating.
- `ZoneListDialog.svelte`: remove the `{#if !confirmValid && validationMessage}` paragraph block in the target footer and the `aria-describedby={... "zone-list-dialog-validation" ...}` attribute on the Validate button; drop now-unused `validationMessage` prop ONLY if `DuelField.svelte` call site is also updated (it passes `validationMessage={validation.valid ? "" : validation.message}`) — remove prop + call-site arg together.

## Inputs

- `src/styles/app.css` — rotate rule ~1918–1920.
- `src/battle/app/components/duel-field/ZoneListDialog.svelte` — target footer block (`data-cy="zone-list-dialog-target-footer"`), Validate button (`data-cy="zone-list-dialog-confirm-button"`).
- `src/battle/app/components/DuelField.svelte` — first `<ZoneListDialog mode="target" … validationMessage={…} …>` call site.
- Tests: `tests/component/ZoneListDialog.test.ts` line ~585 queries `[data-cy="zone-list-dialog-validation"]`; `e2e-acceptance/card-list-dialog.spec.ts` — grep both for `zone-list-dialog-validation` and `rotate(180`.

## TDD

1. **Red**
   - `tests/component/ZoneListDialog.test.ts` — test name: `never renders the selection-range validation text` — render target mode with `minimum: 1, maximum: 1, confirmValid: false, validationMessage: "Select between 1 and 1 choices"`… after prop removal the test becomes: render target mode with an invalid selection → `document.querySelector('[data-cy="zone-list-dialog-validation"]')` is null and no text matching `/Select between/` exists. Red first against current code.
   - test name: `opponent entries carry no rotation class contract` — render browse list with a controller-1 entry → entry root has class `is-opponent` (unchanged) BUT computed style assertions live in acceptance: extend `e2e-acceptance/card-list-dialog.spec.ts` with test name `an opponent card renders upright in the list` — scenario with opponent entry (`card-list-hand-mixed` or nearest existing scenario containing a controller-1 entry; check scenario fixtures in `src/battle/app/acceptance/card-list-dialog-scenarios.ts`) → `expect(entryImg).toHaveCSS("transform", "none")`.
2. **Green** — CSS + markup edits per Requirements.
3. **Refactor** — update the old test at line ~585 that asserted the validation element.

## Test plan

| Test | Input | Expect |
| ---- | ----- | ------ |
| never renders selection-range validation text | invalid target selection | no `zone-list-dialog-validation` node, no "Select between" text |
| opponent card renders upright in the list | acceptance scenario w/ controller-1 entry | img `transform: none` |
| field stacks still mirror opponent art | existing acceptance/e2e suites | unchanged/green |

## Impl steps

- [ ] 1. Red component test; `npm run test:component -- tests/component/ZoneListDialog.test.ts`.
- [ ] 2. CSS: split the shared rule; delete `.zone-list-entry.is-opponent > img` line.
- [ ] 3. `ZoneListDialog.svelte`: remove validation paragraph + `aria-describedby`; delete `export let validationMessage = "";` and its usages.
- [ ] 4. `DuelField.svelte`: drop `validationMessage={…}` from the target-mode ZoneListDialog call.
- [ ] 5. Update stale test at ~585 + any `grep -rn "zone-list-dialog-validation" tests/ e2e/ e2e-acceptance/` hits.
- [ ] 6. Acceptance test for upright entry; `npx playwright test -c playwright.acceptance.config.ts e2e-acceptance/card-list-dialog.spec.ts`.
- [ ] 7. `npm run test:component && npm run typecheck && npm run lint`.
- [ ] 8. Manual check: dev duel — browse opponent GY: cards upright; search prompt with 1/1 requirement: no "Select between 1 and 1 choices", counter still reads "0 / 1 selected".

## Outputs

- Files touched: `src/styles/app.css`, `ZoneListDialog.svelte`, `DuelField.svelte`, `tests/component/ZoneListDialog.test.ts`, `e2e-acceptance/card-list-dialog.spec.ts`.
- Public API: `ZoneListDialog` loses `validationMessage` prop (single call site updated in same commit).
- Migrate/config: none.

## Validation

- [ ] tests pass: `npm run test:component`, acceptance card-list spec
- [ ] manual check: upright opponent cards; no range text
- [ ] app functional — no broken path from this slice
- [ ] commit msg draft: `fix(list-dialog): upright opponent cards, drop the selection-range footer text`

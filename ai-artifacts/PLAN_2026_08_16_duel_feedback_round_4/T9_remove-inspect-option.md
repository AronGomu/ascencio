# T9: Remove Inspect from decision dialog

**Plan:** `./ai-artifacts/PLAN_2026_08_16_duel_feedback_round_4.md`
**Depends:** none
**Commit outcome:** PromptControls (decision dialog + workspace panel) renders no "Inspect …" expanders; choices unchanged.

## Context (self-contained)

- Goal: duel feedback round 4 — YGO story duel simulator (Svelte 5). User: Decision Dialog → "Remove the Inspect option."
- Decision dialog = `PromptDialog.svelte` wrapping `src/battle/app/prompts/PromptControls.svelte`. PromptControls has 5 `<details class="card-detail">` blocks whose `<summary>` starts with `Inspect` (context card ~line 296; single-choice ~line 373; plus 3 more at ~438, ~536, ~628 for other prompt families). Card info remains reachable via the left preview panel (ADR-006) — the expanders duplicate it.
- Out of scope here: `CardTray.svelte` / `DuelHud.svelte` `aria-label="Inspect …"` buttons (HUD surface, different feature), PromptControls choice buttons/labels, CSS `.card-detail` cleanup beyond dead selectors.
- Assumptions in force: removing the blocks removes the images/descriptions from the dialog too — accepted per feedback.

## Requirements

- Zero `Inspect` text nodes in rendered PromptControls for every prompt kind.
- All choice buttons, constraints text, submit flow untouched.
- Orphaned code removed: `cardTitle`/`cardImageUrl`/`useFallbackImage` helpers ONLY if they become unused (check references first); dead `data-cy` constants; unused `.card-detail` CSS left alone unless fully orphaned (then delete the `button.card-detail-trigger`? NO — that selector belongs elsewhere; touch only what this removal orphans).

## Inputs

- `src/battle/app/prompts/PromptControls.svelte` — grep `Inspect` → 5 `<details class="card-detail">…</details>` blocks (data-cy: `prompt-controls-context-card-detail`, `prompt-controls-single-choice-detail-*`, and the three sibling variants).
- `tests/component/PromptControls.test.ts` — line ~107 `click(screen.getByText(/Inspect/))`, line ~331 test `provides effect-text inspection from public prompt data` + line ~352 `click(screen.getByText("Inspect La Jinn"))`.
- `src/styles/app.css` — `.card-detail` / `button.card-detail-trigger` styles (verify remaining users with `grep -rn "card-detail" src/`).

## TDD

1. **Red** — `tests/component/PromptControls.test.ts` — new test name: `renders no inspect expander for any prompt surface`. Render a prompt with `contextCard` + card-carrying choices → `expect(screen.queryByText(/Inspect/)).toBeNull()` and `document.querySelector("details.card-detail") === null`. Red today.
2. **Green** — delete the 5 blocks; rewrite/delete the two old tests that click Inspect (replace `provides effect-text inspection from public prompt data` with an assertion that the choice button still carries the card name/label — behavior that survives).
3. **Refactor** — remove now-unused helpers/imports in PromptControls (typecheck + lint will flag).

## Test plan

| Test | Input | Expect |
| ---- | ----- | ------ |
| renders no inspect expander for any prompt surface | prompt w/ contextCard + card choices | no `Inspect` text, no `details.card-detail` |
| existing PromptControls suite | all prompt kinds | still green after removing inspect-click tests |

## Impl steps

- [ ] 1. Add red test; `npm run test:component -- tests/component/PromptControls.test.ts`.
- [ ] 2. Delete the 5 `<details class="card-detail">` blocks in `PromptControls.svelte` (grep `Inspect` inside the file until zero matches).
- [ ] 3. Remove orphaned helpers/imports the deletion created (run `npm run typecheck`; `svelte-check` flags unused).
- [ ] 4. Update `tests/component/PromptControls.test.ts`: drop/rework the two Inspect-clicking tests.
- [ ] 5. `grep -rn "card-detail" src/ tests/ e2e/ e2e-acceptance/` — delete CSS rules only if no remaining user.
- [ ] 6. `npm run test:component && npm run test:unit && npm run typecheck && npm run lint`.
- [ ] 7. Manual check: dev duel — force dialog surface (workspace toggle in settings, or any yes/no prompt) → no Inspect rows.

## Outputs

- Files touched: `src/battle/app/prompts/PromptControls.svelte`, `tests/component/PromptControls.test.ts`, possibly `src/styles/app.css`.
- Behavior: dialog loses inline card inspection; preview panel remains the card-info surface.
- Migrate/config: none.

## Validation

- [ ] tests pass: `npm run test:component`
- [ ] manual check: decision dialog shows choices only
- [ ] app functional — no broken path from this slice
- [ ] commit msg draft: `feat(prompts): drop the Inspect expanders from decision surfaces`

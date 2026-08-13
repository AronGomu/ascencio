# T14: Card-list selection UI integration

**Plan:** `./ai_artefacts/PLAN_2026_08_13_feedback_follow_up.md`
**Depends:** T13
**Commit outcome:** Off-field exact/range prompts draft through dialog, Validate explicitly, hard-lock at max, unselect safely; focused component integration passes.

## Context (self-contained)

- Goal: Wire pure T13 policy into current dialog/tile/menu/reducer seam without bundling browser evidence work.
- This slice: Svelte + DuelField + CSS + focused component tests. Acceptance fixtures/spec wait T15.
- Out of scope: Worker/WASM, prompt encoding, sum/order/counter families, mounted-field exact-single change, browser scenario additions.
- Assumptions: outside/Escape/collapse/sorting already preserve target draft. `validatePromptSelection` result reaches dialog as current `confirmValid`.

## Requirements

- Off-field target choice always calls current `oninteraction` reducer with `toggleChoice`; no immediate submit including 1/1.
- Mounted-field exact-single path remains unchanged.
- Target dialog derives count/lock/Validate from `cardListSelectionState`.
- Always render `Validate selection`; enable exact/range per pure state.
- At max: native-disable every unselected choice; selected choices stay enabled for unselect. Tile orange if any selected; red only when unselected + all choices unavailable.
- Selected/unavailable/menu state keyed by `ChoiceId`; display sort never changes draft.
- Final selection removed from tile → local `hoverSuppressed=true`, immediate transform none; clear on pointerleave. If another choice on tile remains selected, no suppression.
- Red state CSS specificity exceeds hover/focus; color supplements `disabled`, `aria-disabled`, `aria-pressed`.
- Confirmation uses existing `onconfirm` → current `{type:"confirm"}` reducer path; existing prompt-order submission preserved.

## Inputs

- `src/app/components/DuelField.svelte`, `duel-field/ZoneListDialog.svelte`, `ZoneListEntryTile.svelte`, `ProjectedChoiceMenu.svelte`.
- `src/app/presentation/card-list-dialog-model.ts`, `src/app/prompts/interaction-session.ts`.
- `tests/component/ZoneListDialog.test.ts`, `DuelField.test.ts`, `ProjectedChoiceMenu.test.ts`, `tests/unit/global-styles.test.ts`.
- `docs/ADR/021_ADR_card_list_dialog_modes_and_selection.md`.
- `ai_artefacts/manual_test_checklist.md` — append/update only T14 human checks; preserve all other sections.
- **From Depends:** `cardListSelectionState` exact API/algorithm; target chrome/sorting/collapse/no-dismiss; physical tiles + menu; selected IDs opaque.

## Exact callback replacement

Replace current off-field target-list `chooseTargetChoice` body only:

```ts
function chooseTargetChoice(choice: InteractionChoice): void {
  if (spec === null) return;
  oninteraction({
    type: "toggleChoice",
    choiceId: choice.id,
    key: spec.key,
  });
}
```

`InteractionSessionAction` currently requires `key`; no `dispatch` symbol exists. Do not change `isImmediateSingleSelection` globally or mounted-card `chooseChoice` path.

## TDD

1. **Red** — replace old exact-single/no-Confirm/outside-close assertions; add range/max/menu/unselect/DuelField regression tests.
2. **Green** — model integration, exact callback, per-choice props, hover suppression/CSS.
3. **Refactor** — no duplicate count/validity derivation outside pure model.

## Test plan

| Test | Input | Expect |
| ---- | ----- | ------ |
| `always renders Validate for exact single` | min=max=1 | button disabled at 0, enabled at 1 |
| `drafts singleton without submitting` | tile click | `toggleChoice` action; no command/response |
| `preserves mounted-field singleton behavior` | on-field choice | existing immediate path unchanged |
| `enables range Validate inclusively` | min1,max3 | enabled counts1..3 |
| `hard maximum blocks another choice` | at max | native disabled; callback 0; red attrs |
| `keeps selected choice enabled` | at max | pressed selected can unselect |
| `unselects only pressed ID` | duplicate menu | other selected ID remains |
| `suppresses zoom after final unselect` | final ID removed | class/transform-reset state until pointerleave |
| `keeps selected IDs through sort/collapse/outside/Escape` | interactions | same pressed IDs; no response |
| `fails closed for stale/unrendered IDs` | `confirmValid=true` + stale | Validate disabled |
| `submits existing prompt order` | display reordered | reducer command IDs in prompt order |

## Impl steps

- [ ] 1. Rewrite conflicting ZoneListDialog/DuelField tests; add exact range/max/menu/unselect table; prove red.
- [ ] 2. Derive state once in ZoneListDialog via `cardListSelectionState`; render exact label/Validate/unavailable props.
- [ ] 3. Extend tile/menu props with `unavailableChoiceIds`; native-disable + ARIA each choice correctly.
- [ ] 4. Add tile selected/unavailable aggregate classes + checkmark behavior; preserve privacy/image lifecycle.
- [ ] 5. Add exact `chooseTargetChoice` callback above in DuelField; leave mounted-field path + global helper untouched.
- [ ] 6. Add hover suppression on final tile unselect; clear pointerleave; pass existing selected set transitions.
- [ ] 7. Add red-priority CSS + actual disabled semantics assertions; keep field/list green/orange regressions.
- [ ] 8. Run focused unit/component/type/lint/build gates.

## Outputs

- Modified: model consumers/dialog/tile/menu/DuelField/styles/focused tests.
- No acceptance scenario/spec changes.
- No public domain/Worker/persistence API changes.

## Validation

- [ ] `npx vitest run tests/unit/card-list-dialog-model.test.ts tests/unit/prompt-selection.test.ts tests/unit/interaction-session.test.ts` → exit 0.
- [ ] `npx vitest run tests/component/ProjectedChoiceMenu.test.ts tests/component/ZoneListDialog.test.ts tests/component/DuelField.test.ts tests/unit/global-styles.test.ts` → exit 0.
- [ ] `npm run typecheck && npm run lint && npm run format:check` → exit 0.
- [ ] manual component check — singleton click drafts; Validate submits; mounted field unchanged.
- [ ] app functional — `npm run build` exits 0; real-duel startup smoke passes.
- [ ] commit msg draft: `feat(card-list): integrate exact and range target drafts`

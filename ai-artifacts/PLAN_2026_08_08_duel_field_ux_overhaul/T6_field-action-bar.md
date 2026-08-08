# T6: Field action bar replaces selection dock

**Plan:** `./ai-artifacts/PLAN_2026_08_08_duel_field_ux_overhaul.md`
**Depends:** T5
**Commit outcome:** `SelectionDock.svelte` is deleted and a compact `FieldActionBar` pinned inside the duel field carries Confirm, Cancel, counter steppers, order controls, validation text and global choices.

## Context (self-contained)

- Goal: turn the app from a panel stack into a field-first duel client. Feedback item 9 says remove `selection-dock`.
- This slice: replace the wide three-column dock with a small bar floating at the bottom of the field. The dock is the only place Confirm/Cancel, counter `+`/`−`, order `↑`/`↓`, the validation message and non-card global choices exist, so those affordances move rather than disappear (assumption A4).
- Out of scope here: the corner End turn button (T7) — `endPhase` stays in this bar for now so it never becomes unreachable; hover chips (T9); drag (T10).
- Assumptions in force: A4, A11.

## Requirements

- `src/app/components/duel-field/SelectionDock.svelte` deleted, along with every `.selection-dock*` rule in `src/styles/app.css` and their two media-query entries.
- `FieldActionBar.svelte` renders inside `section.duel-field`, absolutely positioned bottom-centre, and never covers the bottom row of zones by more than its own height.
- Button labels are unchanged: `Confirm selection`, `Confirm allocation`, `Confirm order`, `Confirm placement`, `Confirm`, `Cancel`.
- Counter allocation keeps its `−`/value/`+` group per choice; order keeps its `↑`/`↓` per row. Both lists live inside a `max-height: 9rem; overflow: auto` scroller so the bar stays compact.
- The bar renders only when it has something to offer: `spec.kind` is one of `cardSelection`, `placeSelection`, `counterAllocation`, `order`, or `spec.globalChoices` is non-empty.
- The bar never renders for a `nonField` spec — those go to the T5 prompt dialog.
- Selected-choice summary is a count (`2 selected`), not a comma list, so the bar stays one line.

## Inputs

- Delete: `src/app/components/duel-field/SelectionDock.svelte`.
- Create: `src/app/components/duel-field/FieldActionBar.svelte`, `tests/component/FieldActionBar.test.ts`.
- Edit: `src/app/components/DuelField.svelte`, `src/styles/app.css`, `tests/component/DuelField.test.ts`, `e2e/duel-smoke.spec.ts`.
- **From Depends (T5):** `section.duel-field` carries `data-cy="duel-field"` and `data-prompt-kind`; non-field prompts already render in `[data-cy="prompt-dialog"]` and never reach the field; `promptSurface()` in `src/app/prompts/prompt-surface.ts` returns `"field"` only when `spec.fieldCapable` is true.
- Read only, and copy the behaviour verbatim from the deleted dock: `dispatch(action)` wraps `oninteraction({ ...action, key: spec.key })`; `move(choice, offset)` dispatches `{ type: "moveChoice", choiceId, toIndex: session.order.indexOf(choice.id) + offset }`; the `+`/`−` buttons dispatch `{ type: "adjustAllocation", choiceId, delta }` and disable on `allocatedTotal >= spec.constraints.maximum` or `(session.allocations.get(choice.id) ?? 0) >= (choice.allocationMaximum ?? 0)`; `confirmLabel()` maps `counterAllocation → "Confirm allocation"`, `order → "Confirm order"`, `placeSelection → "Confirm placement"`, `cardSelection → "Confirm selection"`, `cardAction`/`nonField` → `"Confirm"`; `choicesInPromptOrder(spec)` rebuilds order from `prompt.choices`.
- Read only: `src/app/prompts/interaction-session.ts` (`InteractionSession`, `InteractionSessionAction`, `interactionSessionChoiceIds`), `src/app/prompts/interaction-spec.ts` (`ActiveInteractionSpec`, `InteractionChoice`).

## Exact API to create

```svelte
<!-- src/app/components/duel-field/FieldActionBar.svelte -->
export let prompt: PlayerPrompt;
export let spec: ActiveInteractionSpec;
export let session: InteractionSession;
export let disabled = false;
export let confirmValid = false;
export let validationMessage = "";
export let oninteraction: (action: InteractionSessionAction) => unknown;
```

Add an exported helper so the render condition is testable without a DOM:

```ts
// bottom of src/app/prompts/interaction-spec.ts
export function fieldActionBarRequired(spec: ActiveInteractionSpec): boolean;
```

Returns `true` when `spec.kind` is `cardSelection`, `placeSelection`, `counterAllocation` or `order`, or when `spec.globalChoices.size > 0`; `false` otherwise (that is, `cardAction` with no global choices, and `nonField`).

## data-cy contract added here

`field-action-bar`, `field-action-bar-title`, `field-action-bar-summary`, `field-action-bar-list`, `` `field-action-bar-row-${choiceId}` ``, `` `field-action-bar-decrement-${choiceId}` ``, `` `field-action-bar-allocation-${choiceId}` ``, `` `field-action-bar-increment-${choiceId}` ``, `` `field-action-bar-up-${choiceId}` ``, `` `field-action-bar-down-${choiceId}` ``, `` `field-action-bar-choice-${choiceId}` ``, `field-action-bar-confirm`, `field-action-bar-cancel`, `field-action-bar-validation`.

## TDD

1. **Red** — write `tests/unit/interaction-spec.test.ts` additions for `fieldActionBarRequired` and `tests/component/FieldActionBar.test.ts`; record failures.
2. **Green** — add the helper, the component, swap it into `DuelField.svelte`, delete the dock.
3. **Refactor** — delete dead CSS in the same commit; `npm run lint` must be clean.

## Test plan

| Test | Input | Expect |
| --- | --- | --- |
| `bar required for card selection` | spec `kind: "cardSelection"`, no global choices | `true` |
| `bar required for counter allocation` | spec `kind: "counterAllocation"` | `true` |
| `bar required for order` | spec `kind: "order"` | `true` |
| `bar required for place selection` | spec `kind: "placeSelection"` | `true` |
| `bar required when a card action has global choices` | `kind: "cardAction"` with one global choice | `true` |
| `bar not required for a bare card action` | `kind: "cardAction"`, `globalChoices.size === 0` | `false` |
| `bar not required for non-field specs` | `kind: "nonField"` | `false` |
| `confirm dispatches with the spec key` | render bar, `confirmValid: true`, click `[data-cy="field-action-bar-confirm"]` | `oninteraction` called once with `{ type: "confirm", key: spec.key }` |
| `confirm blocked while invalid` | `confirmValid: false` | confirm button disabled and `aria-describedby` points at `[data-cy="field-action-bar-validation"]` |
| `cancel only when cancelable` | `spec.constraints.cancelable: false` | `[data-cy="field-action-bar-cancel"]` absent |
| `counter increment dispatches` | counter spec, click `[data-cy="field-action-bar-increment-c1"]` | one `{ type: "adjustAllocation", choiceId: "c1", delta: 1 }` |
| `counter decrement disabled at zero` | allocation 0 | decrement disabled |
| `order move up dispatches the new index` | order spec, click `[data-cy="field-action-bar-up-c2"]` where `c2` is index 1 | one `{ type: "moveChoice", choiceId: "c2", toIndex: 0 }` |
| `global choices are buttons` | spec with global choice `g1` labelled `Enter Battle Phase` | `[data-cy="field-action-bar-choice-g1"]` exists; clicking dispatches `{ type: "chooseChoice", choiceId: "g1" }` |
| `summary counts selections` | two selected ids | `[data-cy="field-action-bar-summary"]` text is `2 selected` |
| `bar is inside the field` | render `DuelField` with a `cardSelection` spec | `[data-cy="duel-field"] [data-cy="field-action-bar"]` matches |
| `dock is gone` | render `DuelField` with the same spec | `container.querySelector(".selection-dock")` is `null` |

## Impl steps

- [ ] 1. Append the seven `fieldActionBarRequired` rows to `tests/unit/interaction-spec.test.ts`; run `npx vitest run tests/unit/interaction-spec.test.ts` and record the failure.
- [ ] 2. Add `fieldActionBarRequired` to `src/app/prompts/interaction-spec.ts` exactly as specified; re-run to green.
- [ ] 3. Create `tests/component/FieldActionBar.test.ts` (`// @vitest-environment jsdom`) with the eight component rows; record failures.
- [ ] 4. Create `src/app/components/duel-field/FieldActionBar.svelte` with the props above; root is `section.field-action-bar[data-cy="field-action-bar"][aria-label="Field decision"][aria-busy={disabled}]`.
- [ ] 5. In the bar, render the title as `p[data-cy="field-action-bar-title"]` holding `spec.title`, and the summary as `p[data-cy="field-action-bar-summary"]` holding `` `${session.selectedChoiceIds.length} selected` `` — only when that length is above zero.
- [ ] 6. In the bar, render the counter list for `spec.kind === "counterAllocation"` and the ordered list for `spec.kind === "order"`, copying the dispatch behaviour listed under Inputs, inside `div[data-cy="field-action-bar-list"]`.
- [ ] 7. In the bar, render one button per `spec.globalChoices` value using `` data-cy={`field-action-bar-choice-${choice.id}`} `` and class `secondary compact-button`.
- [ ] 8. In the bar, render Confirm and Cancel only when `spec.kind !== "cardAction" && spec.kind !== "nonField"`, reusing `confirmLabel()` and the `cancelable` guard.
- [ ] 9. In the bar, render `p[data-cy="field-action-bar-validation"][id="field-action-bar-validation"]` when `!confirmValid && validationMessage`.
- [ ] 10. In `src/styles/app.css`, delete every `.selection-dock`, `.selection-dock__list`, `.selection-dock__row`, `.selection-dock__actions`, `.selection-dock h3`, `.selection-dock p` rule and remove `.selection-dock` from the `@container duel-field (max-width: 48rem)` and `@media (max-width: 48rem)` blocks (delete the container block if it becomes empty).
- [ ] 11. In `src/styles/app.css`, add `.field-action-bar { position: absolute; z-index: var(--duel-field-layer-control); bottom: .75rem; left: 50%; display: flex; flex-wrap: wrap; align-items: center; gap: .5rem; max-width: min(52rem, calc(100% - 2rem)); padding: .45rem .6rem; border: 1px solid var(--border); border-radius: .7rem; background: color-mix(in srgb, var(--surface-strong) 94%, transparent); box-shadow: 0 .6rem 1.6rem rgb(0 0 0 / .4); transform: translateX(-50%); }`.
- [ ] 12. In `src/styles/app.css`, add `.field-action-bar p { margin: 0; font-size: .8rem; }`, `.field-action-bar [data-cy="field-action-bar-list"] { display: grid; gap: .3rem; max-height: 9rem; overflow: auto; width: 100%; }` and `.field-action-bar [data-cy="field-action-bar-validation"] { color: var(--danger); width: 100%; }`.
- [ ] 13. In `src/app/components/DuelField.svelte`, replace the `SelectionDock` import with `FieldActionBar` and `fieldActionBarRequired`, and change the render guard to `{#if prompt && spec && spec.fieldCapable && fieldActionBarRequired(spec)}`.
- [ ] 14. Delete `src/app/components/duel-field/SelectionDock.svelte`.
- [ ] 15. Run `npx vitest run tests/component/FieldActionBar.test.ts tests/component/DuelField.test.ts`; update the two DuelField cases that click `Confirm allocation` and `Confirm order` if their queries relied on dock markup, and add the last two rows of the test plan.
- [ ] 16. In `e2e/duel-smoke.spec.ts`, replace `field.locator(".selection-dock")` with `field.locator('[data-cy="field-action-bar"]')`, and replace the `[data-cy="selection-dock"]` assertions introduced in T5 with `[data-cy="field-action-bar"]`.
- [ ] 17. Run `npm run test:e2e` to green.
- [ ] 18. Run `npx vitest run tests/unit/data-cy-coverage.test.ts` to green.

## Outputs

- Files created: `src/app/components/duel-field/FieldActionBar.svelte`, `tests/component/FieldActionBar.test.ts`.
- Files deleted: `src/app/components/duel-field/SelectionDock.svelte`.
- Files edited: `src/app/prompts/interaction-spec.ts`, `src/app/components/DuelField.svelte`, `src/styles/app.css`, `tests/unit/interaction-spec.test.ts`, `tests/component/DuelField.test.ts`, `e2e/duel-smoke.spec.ts`.
- Public API: `fieldActionBarRequired(spec)` consumed by `DuelField.svelte` and T7.
- Migrate / config: none.

## Validation

- [ ] `npx vitest run tests/unit/interaction-spec.test.ts tests/component/FieldActionBar.test.ts` passes
- [ ] `npm run test:unit && npm run test:component` passes
- [ ] `npm run typecheck && npm run lint` passes
- [ ] `npm run format` then `npm run format:check` passes
- [ ] `npm run test:e2e` passes
- [ ] manual check: `npm run dev`, reach a tribute or sort prompt and confirm the compact bar appears at the bottom of the field with working Confirm/Cancel and, for sorting, working arrows
- [ ] app functional — multi-select, counter, order and place prompts all still answerable
- [ ] commit msg draft: `refactor(field): replace the selection dock with a compact action bar`

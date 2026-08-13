# T13: Card-list selection-state model

**Plan:** `./ai_artefacts/PLAN_2026_08_13_feedback_follow_up.md`
**Depends:** T12
**Commit outcome:** Pure exact/range/max/stale selection model exists with exhaustive frozen-state tests; production UI still behaves as before.

## Context (self-contained)

- Goal: Define every selection-derived flag before UI/reducer integration so T14 has zero policy choices.
- This slice: Pure presentation model + unit matrix only. App compiles/behaves unchanged.
- Out of scope here: Svelte changes, DuelField callback, CSS, acceptance scenarios, Worker/WASM.
- Assumptions: existing prompt validator remains authority via `promptValid`; UI adds rendered-ID/duplicate/count checks only.

## Requirements

- Exact label `X / Y selected`; range label `X selected · choose min–max`.
- Validate enabled iff: `promptValid`, `minimum<=selectedCount<=maximum`, every selected ID occurs exactly once among rendered entry choices, selected input has no duplicate IDs.
- `maximumReached=selectedCount>=maximum` for finite `maximum>=0`.
- `unavailableChoiceIds` = every rendered unselected choice only when max reached. Selected IDs never unavailable.
- Invalid bounds (`minimum<0`, `maximum<minimum`) fail closed: Validate false; no unavailable lock; label still finite deterministic `X selected · invalid requirement`.
- Never trim/reorder/replace selected IDs. Return object + unavailable set frozen.

## Inputs

- `src/app/presentation/card-list-dialog-model.ts`, `src/field/off-field-target-list.ts`.
- `tests/unit/card-list-dialog-model.test.ts`, `src/app/prompts/prompt-selection.ts` for existing validity semantics.
- `docs/ADR/021_ADR_card_list_dialog_modes_and_selection.md` decisions 6–9.
- **From Depends:** model already exports stable display order/title/alphabetical/source notice; `OffFieldTargetEntry.choices` groups every projected ID/address; target sort/dismiss/collapse complete.

## Exact API

```ts
export interface CardListSelectionState {
  readonly selectedCount: number;
  readonly maximumReached: boolean;
  readonly renderedSelectionValid: boolean;
  readonly validateEnabled: boolean;
  readonly countLabel: string;
  readonly unavailableChoiceIds: ReadonlySet<ChoiceId>;
}

export function cardListSelectionState(input: {
  readonly selectedChoiceIds: readonly ChoiceId[];
  readonly entries: readonly Pick<OffFieldTargetEntry, "choices">[];
  readonly minimum: number;
  readonly maximum: number;
  readonly promptValid: boolean;
}): CardListSelectionState;
```

Implementation algorithm exact:

1. Flatten rendered `entry.choices.map(choice=>choice.id)` into `renderedIds` Set.
2. `uniqueSelected=new Set(selectedChoiceIds)`.
3. `renderedSelectionValid = uniqueSelected.size===selectedChoiceIds.length && selectedChoiceIds.every(id=>renderedIds.has(id))`.
4. Valid bounds = integer min/max, `min>=0`, `max>=min`.
5. `maximumReached = validBounds && selectedCount>=maximum`.
6. Add rendered ID to unavailable only when max reached + not selected.
7. `validateEnabled = validBounds && promptValid && renderedSelectionValid && selectedCount>=minimum && selectedCount<=maximum`.

## TDD

1. **Red** — add exact/range/max/stale/duplicate/invalid-bound tests to existing model suite.
2. **Green** — implement exact API/algorithm.
3. **Refactor** — freeze outputs; reuse no Svelte/store helpers.

## Test plan

| Test | Input | Expect |
| ---- | ----- | ------ |
| `enables exact validation only at exact count` | min=max=3, counts0..4 | only count3 true when promptValid |
| `enables range validation inclusively` | min1,max3, counts0..4 | counts1..3 true |
| `locks all unselected choices at maximum` | 3 selected/5 rendered | exact 2 unavailable |
| `keeps selected choices available` | max reached | selected absent from unavailable |
| `fails closed for stale selected id` | ID not rendered | rendered false, Validate false |
| `fails closed for duplicate selected id` | same ID twice | rendered false, Validate false |
| `honors prompt validator` | count valid, promptValid false | Validate false |
| `fails closed for invalid bounds` | negative/reversed/noninteger | deterministic invalid label, no lock |
| `counts duplicate choices across one address` | entry choices A/B | both rendered/independently modeled |
| `freezes state and unavailable set` | valid | mutation throws/no effect |

## Impl steps

- [ ] 1. Extend `tests/unit/card-list-dialog-model.test.ts` with exact table above; run focused red.
- [ ] 2. Add interface + fn using exact 7-step algorithm.
- [ ] 3. Add focused `src/app/presentation/immutable-choice-id-set.ts` exporting `ImmutableChoiceIdSet implements ReadonlySet<ChoiceId>` with constructor(iterable), `size`, `has`, `entries`, `keys`, `values`, `forEach`, `[Symbol.iterator]`, readonly internal copied Set. Use it for `unavailableChoiceIds`; do not expose/cast mutable Set.
- [ ] 4. Add invalid-number tests for NaN/Infinity/noninteger bounds.
- [ ] 5. Run focused + type/lint/build gates; UI untouched.

## Outputs

- Created: `src/app/presentation/immutable-choice-id-set.ts`, `tests/unit/immutable-choice-id-set.test.ts`.
- Modified: `src/app/presentation/card-list-dialog-model.ts`, `tests/unit/card-list-dialog-model.test.ts`.
- Public pure API exact above.
- No UI/Worker/persistence/config changes.

## Validation

- [ ] `npx vitest run tests/unit/immutable-choice-id-set.test.ts tests/unit/card-list-dialog-model.test.ts tests/unit/prompt-selection.test.ts` → exit 0.
- [ ] `npm run typecheck && npm run lint` → exit 0.
- [ ] `npm run build:app` → exit 0; production UI unchanged.
- [ ] manual check not needed — pure model only; unit matrix is behavior evidence.
- [ ] app functional — existing `npx vitest run tests/component/ZoneListDialog.test.ts tests/component/DuelField.test.ts` remains green.
- [ ] commit msg draft: `feat(card-list): define exact and range selection state`

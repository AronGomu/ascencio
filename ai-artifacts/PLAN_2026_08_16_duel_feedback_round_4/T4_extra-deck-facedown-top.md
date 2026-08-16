# T4: Extra deck top renders face-down

**Plan:** `./ai-artifacts/PLAN_2026_08_16_duel_feedback_round_4.md`
**Depends:** none
**Commit outcome:** Own extra deck stack shows a card back (like Deck); private piles never show top-card face; public piles unchanged.

## Context (self-contained)

- Goal: duel feedback round 4 — YGO story duel simulator (Svelte 5). User rule: private zones (deck, extra deck — yours AND opponent's) show a face-down top card; public zones (GY, banished) show face-up top. Own extra deck currently shows its top card face-up. ADR-030 (`docs/ADR/030_ADR_private_pile_tops_render_face_down.md`) records the rule.
- This slice: stack view model + stack control art.
- Out of scope here: browse list contents (extra deck list dialog keeps showing own faces — browsing a private pile is allowed), preview panel behavior (T11 owns that), face-up-banished exceptions.
- Assumptions in force: hovering a private stack no longer updates preview once T11 lands (independent; do not implement preview logic here).

## Requirements

- `BoardStackView` for `zone === "extra"` never carries `topCardCode`/`topCardLabel` (same as `deck` today).
- Stack tile for a non-empty private pile (`deck`, `extra`) renders the card-back image.
- GY/banished stacks unchanged (face-up top from `publicCards.at(-1)`).

## Inputs

- `src/battle/field/board-view-model.ts` — `createStacks(snapshot, cardTexts)`: `const top = zone === "deck" ? undefined : publicCards.at(-1);` and the `detail` string appending `, top card ${topCardLabel}`.
- `src/battle/app/components/duel-field/StackControl.svelte` — props `stack`, `placement`, `imageLibrary`, `placeholderUrl`; renders art only when `stack.topCardCode !== undefined`.
- `src/battle/app/components/duel-field/FieldBoard.svelte` — StackControl call site (~line 275) currently passes `{imageLibrary} {placeholderUrl}`; component has `cardBackUrl` prop available in scope (`export let cardBackUrl: string;`).
- Existing tests: `tests/unit/duel-field.test.ts` (board view model), `tests/component/DuelField.test.ts`, component test for stack? none dedicated — extend `tests/component/DuelField.test.ts`.

## TDD

1. **Red**
   - `tests/unit/duel-field.test.ts` — test name: `an extra deck stack exposes no top card identity`. Snapshot with own extraDeck containing identity-known cards → stack `zone === "extra"` has `topCardCode === undefined`, `topCardLabel === undefined`, `count` intact, `accessibleLabel` without "top card".
   - `tests/unit/duel-field.test.ts` — test name: `graveyard stack keeps its face-up top card`. GY with known card → `topCardCode` set (guards regression).
   - `tests/component/DuelField.test.ts` — test name: `deck and extra stacks render a card back`. Render board with non-empty deck + extra → `[data-cy="stack-control-back-p0:deck"]` and `[data-cy="stack-control-back-p0:extra"]` images exist with `src` = cardBackUrl.
2. **Green** — impl below.
3. **Refactor** — none.

## Test plan

| Test | Input | Expect |
| ---- | ----- | ------ |
| extra deck stack exposes no top card identity | snapshot w/ known extra cards | no `topCardCode`/`topCardLabel` |
| graveyard stack keeps its face-up top card | GY w/ known card | `topCardCode` set |
| deck and extra stacks render a card back | mounted DuelField | back `<img>` present, `src === cardBackUrl` |

## Impl steps

- [ ] 1. Write unit tests; `npm run test:unit -- tests/unit/duel-field.test.ts`; red.
- [ ] 2. `board-view-model.ts` `createStacks`: change to `const top = zone === "deck" || zone === "extra" ? undefined : publicCards.at(-1);` (touch nothing else — `publicCount` stays engine-truth for browse).
- [ ] 3. `StackControl.svelte`: add `export let cardBackUrl = "";`. Change art block to render when `stack.topCardCode !== undefined` (existing branch, unchanged) **plus** new `{:else if stack.count > 0 && (stack.zone === "deck" || stack.zone === "extra")}` branch: `<div class="duel-field-stack__art" data-cy={\`stack-control-back-${stack.id}\`}><img src={cardBackUrl} alt="" aria-hidden="true" decoding="async" data-cy={\`stack-control-back-image-${stack.id}\`} /></div>`. Every new element carries `data-cy` (repo data-cy gate: `tests/unit/data-cy-coverage.test.ts`).
- [ ] 4. `FieldBoard.svelte` StackControl call site: add `{cardBackUrl}`.
- [ ] 5. Write component test; `npm run test:component -- tests/component/DuelField.test.ts`; green.
- [ ] 6. Grep for stale expectations: `grep -rn "topCardCode\|topCardLabel" tests/ e2e/ e2e-acceptance/` — update any test asserting an extra-deck top card face.
- [ ] 7. `npm run test:unit && npm run test:component && npm run typecheck && npm run lint`.
- [ ] 8. Manual check: dev duel — both deck + both extra stacks show identical card-back art; GY shows top face.

## Outputs

- Files touched: `src/battle/field/board-view-model.ts`, `src/battle/app/components/duel-field/StackControl.svelte`, `src/battle/app/components/duel-field/FieldBoard.svelte`, `tests/unit/duel-field.test.ts`, `tests/component/DuelField.test.ts`.
- Behavior: private pile tops face-down everywhere; `BoardStackView.topCardCode` absent for `extra` (consumers: `stackTopCode` in `card-preview.ts` now returns undefined for extra — preview no longer leaks extra top; T11 makes that a no-op update).
- Migrate/config: none.

## Validation

- [ ] tests pass: `npm run test:unit`, `npm run test:component`
- [ ] manual check: extra deck stack = card back
- [ ] app functional — no broken path from this slice
- [ ] commit msg draft: `fix(field): render private pile tops face-down, extra deck included`

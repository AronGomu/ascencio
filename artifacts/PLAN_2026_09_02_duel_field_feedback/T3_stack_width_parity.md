# T3: Stack card-back width/height parity with cards

**Plan:** `./artifacts/PLAN_2026_09_02_duel_field_feedback.md`
**Depends:** none
**Commit outcome:** Deck/extra/graveyard/banished stack tiles render at exactly the same card width and height as cards in hand and on the field.

## Context (self-contained)

- Goal: owner feedback `feedback.md` § Duel Field item 4 — stack card backs narrower than cards; suspected reduced-width zone; must match card image width and height.
- This slice: `StackControl` sizing only.
- Out of scope here: empty-stack rendering (T4 — edits the same file afterwards; file-conflict serialization, not semantic), card back asset (T1).
- Assumptions in force: none new.

## Requirements

- Rendered stack tile = `geometry.cardWidth` × `geometry.cardHeight`, identical to field cards, centered inside its pile slot.
- Root cause to remove: `StackControl.svelte` line ~15/27 applies a second aspect factor: `--field-width: ${placement.width * (72 / 104)}px` where `placement.width` is already `slotWidth = cardWidth + SLOT_PAD` (`duel-field-geometry.ts` pile zones, `:165-183`) → ~22% too narrow. Height uses raw `placement.height` instead of card height.

## Inputs

- `src/battle/field/duel-field-geometry.ts`: `CARD_ASPECT = 72/104` (`:4`), `slotWidth = cardWidth + SLOT_PAD` (`SLOT_PAD = 6`), pile zones take `slotWidth`; `FieldRenderLayout` also carries `cardWidth`/`cardHeight` (see `FieldBoard.svelte:125-135` `cardPlacementFor` which uses `geometry.cardWidth` directly).
- `src/battle/app/components/duel-field/StackControl.svelte` — `positionStyle` reactive, `--field-width`/`--field-height` custom props.
- **From Depends:** none.

## Interface contract (level 5)

- **Produces:** `StackControl.svelte` `positionStyle` becomes (exact shape):
  ```ts
  $: positionStyle = `--field-x: ${placement.x + (placement.width - cardWidth) / 2}px; --field-y: ${placement.y + (placement.height - cardHeight) / 2}px; --field-width: ${cardWidth}px; --field-height: ${cardHeight}px;`;
  ```
  with new required props `export let cardWidth: number; export let cardHeight: number;` fed by the parent (`FieldBoard.svelte` / `DuelField.svelte` — wherever `StackControl` is instantiated) from the same `FieldRenderLayout` values `cardPlacementFor` uses. If the render layout does not expose `cardWidth/cardHeight` to that call site today, thread them; do not recompute `72/104` locally.
- **Consumes:** `FieldPlacement { x, y, width, height }` unchanged; `BoardStackView` unchanged.
- **Errors:** none new.
- **Invariants:** stack stays inside its slot bounds (cardWidth ≤ slotWidth by construction); `data-cy` values unchanged.
- **Integration links:** observe in Chromium: `getBoundingClientRect().width` of `field-card-*` (a field monster) equals width of the deck stack tile (±1px).

## TDD

1. **Red** — NEW component test file `tests/component/StackControl.test.ts` (does not exist yet — create it): stack `--field-width` equals `geometry.cardWidth` (not `slotWidth * 72/104`); update `tests/component/DuelField.test.ts:4888` ("deck and extra stacks render a card back") if style strings asserted. (`FieldBoard.test.ts` is 116 lines — the stack assertions live in `DuelField.test.ts`.)
2. **Green** — impl.
3. **Refactor** — keep green.

## Test plan

| Test | Input | Expect |
| ---- | ----- | ------ |
| component StackControl | placement `{width: slotWidth}` + cardWidth/cardHeight | style `--field-width: ${cardWidth}px`, `--field-height: ${cardHeight}px`, centered x/y |
| component DuelField | full board render | stack tile width == field card width |
| e2e duel-smoke | live duel | deck stack rect width == hand card rect width (±1px) |

## Impl steps

- [ ] 1. Create `tests/component/StackControl.test.ts`; red component test.
- [ ] 2. Thread `cardWidth`/`cardHeight` props; replace `positionStyle`.
- [ ] 3. Update touched assertions in `FieldBoard.test.ts`, `e2e/duel-smoke.spec.ts:3742-3797` snapshots if geometry-sensitive.

## Validation

- [ ] `npm run check:headless`; component gate (NOT in check:headless): `npx vitest run tests/component/StackControl.test.ts tests/component/DuelField.test.ts tests/component/FieldBoard.test.ts`
- [ ] manual check: Chromium — deck/extra/GY/banish tiles same size as cards
- [ ] silent-failure sites: none
- [ ] app functional
- [ ] commit msg draft: `fix(duel-field): render pile stacks at true card dimensions`

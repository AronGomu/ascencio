# T6: Stack zones as interaction targets

**Plan:** `./ai-artifacts/PLAN_2026_08_09_duel_field_feedback_round_2.md`
**Depends:** none
**Commit outcome:** A prompt choice sourced from a deck, extra deck, graveyard or banished pile resolves to that pile's stack target and gives the stack an orange "you may act here" halo, instead of silently degrading to a non-field global choice.

## Context (self-contained)

- Goal: ship 17 duel-field feedback items. This slice is item 12 and the contract every later stack ticket (T8, T10, T11) builds on.
- This slice: `src/field/card-mapping.ts`'s `resolvePromptChoiceBoardTarget` looks a prompt choice's card up in `board.cards`. `board.cards` only ever holds hand cards and cards in monster/spell-trap/field slots — deck, extra deck, graveyard and banished contents live in `board.stacks`, which `src/app/prompts/interaction-spec.ts` never consults. Every graveyard or banished activation therefore resolves to `nonField`, lands in `globalChoices`, and the prompt falls through to the modal `PromptDialog`. `BoardTargetId` already admits `stack:${PhysicalZoneId}`; nothing produces one.
- Out of scope here: clicking a stack (T8 owns it — a stack stays a non-interactive `<div>` in this ticket), rendering the top card (T7), the zone list dialog (T8), removing the chain modal (T11), the deck contents projection (T9).
- Assumptions in force:
  - **A9** `stackChoices` must **not** make a prompt `fieldCapable` yet. `fieldCapable` stays `cardChoices.size > 0 || zoneChoices.size > 0`. If it changed here, `promptSurface` would stop opening the modal for a graveyard activation while nothing on the field could answer it, and the duel would deadlock.
  - **A10** a stack never fires a choice directly; T8 makes the click open a list.

## Requirements

1. `src/field/card-mapping.ts` — widen the resolution union and resolve stack-located cards:
   ```ts
   export type PromptChoiceBoardTargetResolution =
     | { readonly kind: "board"; readonly targetId: BoardTargetId }
     | { readonly kind: "stack"; readonly targetId: `stack:${PhysicalZoneId}` }
     | {
         readonly kind: "nonField";
         readonly reason:
           | "choice_has_no_field_target"
           | "unsupported_field_address"
           | "target_not_mounted";
       };
   ```
   New branch inside `resolvePromptChoiceBoardTarget`, evaluated **before** the existing `board.cards.find(...)` lookup, when `choice.card !== undefined`:
   ```ts
   const stackZone = STACK_ZONE_BY_LOCATION[choice.card.location];
   if (stackZone !== undefined) {
     const stack = board.stacks.find(
       (value) => value.player === choice.card!.controller && value.zone === stackZone,
     );
     return stack === undefined
       ? Object.freeze({ kind: "nonField", reason: "target_not_mounted" })
       : Object.freeze({ kind: "stack", targetId: stack.targetId });
   }
   ```
   with
   ```ts
   const STACK_ZONE_BY_LOCATION: Partial<
     Record<PublicLocation, "deck" | "extra" | "graveyard" | "banished">
   > = Object.freeze({
     deck: "deck",
     extra: "extra",
     graveyard: "graveyard",
     banished: "banished",
   });
   ```
2. `src/app/prompts/interaction-spec.ts`:
   - `ActiveInteractionSpecBase` gains
     ```ts
     readonly stackChoices: ReadonlyMap<BoardTargetId, readonly InteractionChoice[]>;
     ```
     built the same way as `cardChoices` (`appendChoice` into a `stackEntries` map, then `freezeChoiceMap`).
   - In `mapPromptToInteractionSpec`, the resolution switch becomes: `resolution.kind === "nonField"` → `globalEntries`; `resolution.kind === "stack"` → `stackEntries`; otherwise the existing `targetKind === "card" ? cardEntries : zoneEntries` split.
   - `fieldCapable` stays **exactly** `cardChoices.size > 0 || zoneChoices.size > 0`. Add a code comment naming assumption A9 so nobody "fixes" it before T8.
   - `base` gains `stackChoices`.
3. `src/app/components/duel-field/StackControl.svelte` gains
   ```ts
   export let actionable = false;
   ```
   and `class:is-actionable={actionable}` plus `data-actionable={actionable ? "true" : undefined}` on its root `<div>`. It stays a `<div role="group">` — no button, no click handler.
4. `src/app/components/duel-field/FieldBoard.svelte`:
   - passes `actionable={!disabled && spec?.stackChoices.has(stack.targetId) === true}` in the `{#each board.stacks …}` loop.
   - adds `...(spec?.stackChoices.keys() ?? [])` to the `actionableTargets` set so roving focus reaches an actionable stack.
5. `src/styles/app.css` gets the stack halo, matching the existing orange legality treatment at line ~860:
   ```css
   .duel-field-stack.is-actionable {
     border-color: var(--warning);
     box-shadow: 0 0 0 2px rgb(255 213 128 / 0.55);
   }
   ```
6. Every rendered element keeps a unique kebab-case `data-cy`; this ticket adds no new elements.

## Inputs

- `src/field/card-mapping.ts` — full file (97 lines). `resolvePromptChoiceBoardTarget(choice, snapshot, board)` currently handles `choice.place` first, then `choice.card` via `findPublicCard` + `board.cards.find`, then falls through to `choice_has_no_field_target`. `publicCards(player, location)` already returns `undefined` for `deck` and `extra`, which is why those choices die today.
- `src/field/board-view-model.ts` — `BoardStackView` is `{ id: PhysicalZoneId; targetId: \`stack:${PhysicalZoneId}\`; player: PlayerIndex; zone: "deck" | "extra" | "graveyard" | "banished"; count: number; publicCount: number; label: string; topCardLabel?: string; x; y; width; height }`. `BoardTargetId` is `` `zone:${PhysicalZoneId}` | `card:${string}` | `stack:${PhysicalZoneId}` ``.
- `src/app/prompts/interaction-spec.ts` — `ActiveInteractionSpecBase`, `mapPromptToInteractionSpec`, `targetKindFor`, `appendChoice`, `freezeChoiceMap`, `fieldActionBarRequired`, `INTERACTION_SPEC_KINDS`.
- `src/app/components/duel-field/StackControl.svelte` — full file (38 lines).
- `src/app/components/duel-field/FieldBoard.svelte` — `actionableTargets`, the stack loop.
- `src/app/components/DuelField.svelte` — `targetSelections(spec, session)` iterates `[...value.cardChoices, ...value.zoneChoices]`; leave it alone, a stack is never "selected" in this ticket.
- `src/duel/contracts/public-duel-state.ts` — `PublicLocation` is `"deck" | "hand" | "monster" | "spellTrap" | "field" | "graveyard" | "banished" | "extra"`.
- `src/styles/app.css` — the `.duel-field-zone.is-actionable, .duel-field-card.is-actionable .duel-field-card__art` rule (~line 860) and the `.duel-field-stack` rule (~line 958).
- `tests/unit/interaction-spec.test.ts`, `tests/component/DuelField.test.ts`, `tests/fixtures/board-view-model.ts`, `tests/fixtures/board-public-states.ts`.
- **From Depends:** none.

## TDD

1. **Red** — add the card-mapping and interaction-spec cases plus the `DuelField` halo case. Run `npm run test:unit && npm run test:component`; the new cases must fail.
2. **Green** — widen the resolution union, add `stackChoices`, add `actionable` to `StackControl`, wire `FieldBoard`, add the CSS.
3. **Refactor** — only if needed. Keep green.

## Test plan

| Test | Input | Expect |
| --- | --- | --- |
| `resolves a graveyard card to its stack` | choice with `card.location: "graveyard"`, `controller: 0`, standard board | `{ kind: "stack", targetId: "stack:p0:graveyard" }` |
| `resolves a banished card to its stack` | `card.location: "banished"`, `controller: 1` | `{ kind: "stack", targetId: "stack:p1:banished" }` |
| `resolves an extra-deck card to its stack` | `card.location: "extra"`, `controller: 0` | `{ kind: "stack", targetId: "stack:p0:extra" }` |
| `resolves a deck card to its stack` | `card.location: "deck"`, `controller: 0` | `{ kind: "stack", targetId: "stack:p0:deck" }` |
| `still resolves a hand card to its card target` | `card.location: "hand"` for a mounted hand card | `{ kind: "board", targetId: "card:<instanceId>" }` |
| `reports a missing stack as non-field` | `card.location: "graveyard"` against a board whose stacks array is empty | `{ kind: "nonField", reason: "target_not_mounted" }` |
| `spec collects stack choices separately` | `chain` prompt with one graveyard activation and one `pass` | `spec.stackChoices.get("stack:p0:graveyard")` has length 1; `spec.cardChoices.size === 0`; `spec.globalChoices` holds only the pass |
| `stack choices do not make a prompt field capable` | same spec | `spec.fieldCapable === false` |
| `actionable stack renders the halo` | render `DuelField` with a spec whose `stackChoices` holds `stack:p0:graveyard` | `field-stack-p0:graveyard` carries class `is-actionable` and `data-actionable="true"` |
| `stack stays non-interactive` | same render | `field-stack-p0:graveyard` `tagName` is `DIV` and has no `onclick` behaviour (clicking it dispatches nothing) |

## Impl steps

- [x] 1. Add the six `resolvePromptChoiceBoardTarget` cases to the test file that already covers it (`tests/unit/interaction-spec.test.ts` builds the boards; if a dedicated card-mapping test file does not exist, create `tests/unit/card-mapping.test.ts` and put them there).
- [x] 2. Add the two `mapPromptToInteractionSpec` cases to `tests/unit/interaction-spec.test.ts`.
- [x] 3. Add the two `DuelField` cases to `tests/component/DuelField.test.ts`.
- [x] 4. Run `npm run test:unit && npm run test:component`; confirm the new cases fail.
- [x] 5. In `src/field/card-mapping.ts`, add `STACK_ZONE_BY_LOCATION`, widen `PromptChoiceBoardTargetResolution` with the `stack` member, and insert the stack branch before the `board.cards.find` lookup. Import `PhysicalZoneId` from `./duel-field-layout.ts` if it is not already imported.
- [x] 6. In `src/app/prompts/interaction-spec.ts`, add `stackChoices` to `ActiveInteractionSpecBase`, create `stackEntries`, route `resolution.kind === "stack"` into it, freeze it into `stackChoices`, add it to `base`, and add the A9 comment above the unchanged `fieldCapable` expression.
- [x] 7. In `src/app/components/duel-field/StackControl.svelte`, add `export let actionable = false;`, `class:is-actionable={actionable}` and `data-actionable={actionable ? "true" : undefined}`.
- [x] 8. In `src/app/components/duel-field/FieldBoard.svelte`, pass `actionable` in the stack loop and add the `stackChoices` keys to `actionableTargets`.
- [x] 9. In `src/styles/app.css`, add the `.duel-field-stack.is-actionable` rule next to the existing orange legality rule.
- [x] 10. Run `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run test:component`, `npm run test:integration`.

## Outputs

- Edited: `src/field/card-mapping.ts`, `src/app/prompts/interaction-spec.ts`, `src/app/components/duel-field/StackControl.svelte`, `src/app/components/duel-field/FieldBoard.svelte`, `src/styles/app.css`, `tests/unit/interaction-spec.test.ts`, `tests/component/DuelField.test.ts`, possibly added `tests/unit/card-mapping.test.ts`.
- Public contract for successors:
  - `PromptChoiceBoardTargetResolution` gains `{ kind: "stack"; targetId: \`stack:${PhysicalZoneId}\` }`.
  - `ActiveInteractionSpec.stackChoices: ReadonlyMap<BoardTargetId, readonly InteractionChoice[]>` — keys are `stack:p0:deck`, `stack:p0:extra`, `stack:p0:graveyard`, `stack:p0:banished` and their `p1` counterparts.
  - `spec.fieldCapable` still ignores `stackChoices`. **T8 flips this.**
  - `StackControl` accepts `actionable: boolean` and renders `class="is-actionable"` + `data-actionable="true"`.
  - `FieldBoard`'s `actionableTargets` includes stack targets.
- No migration, no config change.

## Validation

- [x] `npm run format:check` exits 0
- [x] `npm run lint` exits 0
- [x] `npm run typecheck` exits 0
- [x] `npm run test:unit` exits 0
- [x] `npm run test:component` exits 0
- [x] `npm run test:integration` exits 0
- [ ] manual check: `npm run dev`; when the engine offers a graveyard activation the graveyard pile glows orange **and** the existing modal still lets you take it (the modal dies in T11, not here)
- [x] app functional — no prompt becomes unanswerable; every previously reachable choice is still reachable
- [x] commit msg draft: `feat(field): resolve stack-located choices to their pile target`
</content>

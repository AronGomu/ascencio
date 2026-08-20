# T10: Deck list in the zone dialog

**Plan:** `./artifacts/PLAN_2026_08_09_duel_field_feedback_round_2.md`
**Depends:** T8, T9
**Commit outcome:** Opening a deck shows one entry per remaining card, top first, with every position the local player has legitimately been shown rendered face-up and everything else face-down.

## Context (self-contained)

- Goal: ship 17 duel-field feedback items. This slice closes item 13 by joining the projected deck order to the zone list dialog.
- This slice: two halves already exist and are not yet connected. The worker projects an ordered deck; the dialog synthesises anonymous placeholders instead of reading it.
- Out of scope here: the chain UI (T11), any new projection behaviour, extra-deck changes, opponent AI.
- Assumptions in force:
  - **A8** a revealed deck slot arrives with `position: "faceUpAttack"`, `faceUp: true` and a `code`; an unrevealed one arrives face-down with no `code`. The UI must not re-derive visibility from anything else.
- **From Depends (T9):**
  - `PublicPlayerState` carries `readonly deck: readonly PublicCard[]`, length always equal to `deckCount`, **index 0 is the top of the deck**, `sequence === index`, `owner === controller === player`.
  - Unrevealed slot: `instanceId: \`deck-p${player}-${offset}\``, no `code`, `position: "faceDownAttack"`, `faceUp: false`.
  - Revealed slot: same id shape, `code` present, `position: "faceUpAttack"`, `faceUp: true`.
  - `deckSlots(player, count)` exists in `tests/fixtures/board-public-states.ts` and builds face-down slots.
- **From Depends (T8):**
  - `src/field/zone-list.ts` exports
    ```ts
    export interface ZoneListEntry {
      readonly id: string;          // `${stackId}:${position}`
      readonly position: number;    // 1-based
      readonly controller: PlayerIndex;
      readonly location: PublicLocation;
      readonly sequence: number;
      readonly identityVisible: boolean;
      readonly code?: CardCode;
      readonly label: string;
    }
    export function zoneListEntries(stack, snapshot, cardTexts): readonly ZoneListEntry[];
    export function zoneListsForBoard(board, snapshot, cardTexts): ReadonlyMap<PhysicalZoneId, readonly ZoneListEntry[]>;
    ```
    Its `stack.zone === "deck"` branch currently emits `stack.count` synthetic entries with `identityVisible: false`, `code: undefined`, `sequence: index`, `location: "deck"`, `position: index + 1`. **That branch is the only thing this ticket rewrites.**
  - `src/app/components/duel-field/ZoneListDialog.svelte` renders entries, haloes the actionable ones by matching `InteractionChoice.cardAddress` against `(controller, location, sequence)`, and falls back to `cardBackUrl` when `entry.code` is undefined.
  - Clicking a pile opens the dialog; `data-cy` values are `zone-list-dialog`, `zone-list-entry-<id>`, `zone-list-entry-image-<id>`, `zone-list-entry-position-<id>`.

## Requirements

1. `src/field/board-view-model.ts` — `stackCollection(player, zone)`'s `case "deck":` returns `player.deck` instead of `[]`. Consequences, all intended:
   - `stackCount` still returns `player.deckCount` for the deck; leave that branch alone.
   - `publicCards = collection.filter(cardIdentityVisible)` now finds revealed deck cards, so a deck stack's `publicCount`, `topCardLabel` and (from T2) `topCardCode` become meaningful.
   - **The deck pile must still not show art on the board.** `createStacks` currently derives `top` from `publicCards.at(-1)`, which for a deck would be the *deepest* revealed card, not the top one, and item 11 only asks for graveyard and banished. Add an explicit guard in `createStacks`: compute `topCardLabel`/`topCardCode` only when `zone !== "deck"`. Keep `publicCount` accurate.
2. `src/field/zone-list.ts` — replace the `stack.zone === "deck"` branch so it reads `snapshot.players[stack.player].deck` exactly like the graveyard branch reads `graveyard`:
   - `position = index + 1`, where index 0 is the top of the deck.
   - `identityVisible = isCardIdentityVisible(0, card.controller, card.location, card.position) && card.code !== undefined`. For a deck card that reduces to "the projector marked it face-up", which is precisely A8.
   - `label` = the card name when visible, `"Face-down card"` otherwise.
   - `sequence = card.sequence`.
   Delete the synthetic-placeholder code path entirely; if `snapshot.players[stack.player].deck` is empty the list is empty, which matches an empty deck.
3. `src/app/components/duel-field/ZoneListDialog.svelte` — no change. Its face-down rendering already keys off `entry.code === undefined`.
4. The dialog's position numbering for a deck therefore reads **1 = top of deck**. Add that wording to the dialog's `aria-label` for deck stacks only: `` `${stack.label} contents, position 1 is the top of the deck` ``. Implement by extending `ZoneListDialog`'s label expression with a `stack.zone === "deck"` branch.
5. Every rendered element keeps a unique kebab-case `data-cy`; this ticket adds no new elements.

## Inputs

- `src/field/board-view-model.ts` — `stackCollection`, `stackCount`, `createStacks` (the `const top = publicCards.at(-1);` / `topCardLabel` block), `cardIdentityVisible`, `BoardStackView`.
- `src/field/zone-list.ts` — `zoneListEntries`, its `deck` branch, `zoneListsForBoard`.
- `src/app/components/duel-field/ZoneListDialog.svelte` — the `aria-label` expression only.
- `src/duel/card-visibility.ts` — `isCardIdentityVisible(viewer, controller, location, position)`; for `location === "deck"` it returns `controller === viewer || isFaceUpPosition(position)`. **Note the first disjunct:** it would make *every* own-deck card visible. Do **not** use it for deck entries. Use `card.faceUp === true && card.code !== undefined` instead, and add a comment saying why.
- `src/duel/contracts/public-duel-state.ts` — `PublicPlayerState.deck`, `PublicCard`.
- `tests/unit/zone-list.test.ts`, `tests/unit/duel-field.test.ts`, `tests/component/ZoneListDialog.test.ts`, `tests/component/DuelField.test.ts`, `tests/fixtures/board-public-states.ts`.
- **From Depends:** listed in Context above.

## TDD

1. **Red** — rewrite the `synthesises face-down deck entries` case in `tests/unit/zone-list.test.ts` into the four deck cases below, and add the two `board-view-model` cases. Run `npm run test:unit`; they must fail.
2. **Green** — change `stackCollection`, guard `createStacks`, rewrite the `zone-list` deck branch, extend the dialog label.
3. **Refactor** — only if needed. Keep green.

## Test plan

| Test | Input | Expect |
| --- | --- | --- |
| `lists one entry per remaining deck card` | snapshot with `deckCount: 5` and 5 face-down deck slots | 5 entries, positions `1..5`, all `identityVisible: false`, all `label: "Face-down card"` |
| `shows a revealed deck position face up` | slot 0 revealed with code `X` and `position: "faceUpAttack"`, slots 1-4 face-down | entry 1 has `code: X`, `identityVisible: true`, label from `cardTexts`; entries 2-5 stay hidden |
| `never leaks an unrevealed own deck card` | own deck slot with no `code` and `faceDownAttack` | `identityVisible: false` and `code === undefined`, **even though the card's controller is the viewer** |
| `lists the opponent deck face-down` | `players[1].deck` of 40 face-down slots | 40 hidden entries |
| `reflects an empty deck` | `deckCount: 0`, `deck: []` | zero entries |
| `deck stacks still report their count` | `mapSnapshotToBoard` over a snapshot with `deckCount: 40` and one revealed slot | the `p0:deck` stack `count` is `40` and `publicCount` is `1` |
| `deck stacks never expose a top card` | same snapshot | the `p0:deck` stack has no `topCardLabel` and no `topCardCode` |
| `graveyard stacks still expose their top card` | snapshot with two face-up graveyard cards | the `p0:graveyard` stack still carries `topCardLabel` and `topCardCode` |
| `deck dialog explains its numbering` | render `ZoneListDialog` with a deck stack | the dialog's accessible name ends with `position 1 is the top of the deck` |

## Impl steps

- [x] 1. Replace the deck case in `tests/unit/zone-list.test.ts` with the five deck cases from the table.
- [x] 2. Add the three `mapSnapshotToBoard` cases to `tests/unit/duel-field.test.ts`.
- [x] 3. Add the deck-label case to `tests/component/ZoneListDialog.test.ts`.
- [x] 4. Run `npm run test:unit && npm run test:component`; confirm the new cases fail.
- [x] 5. In `src/field/board-view-model.ts`, change `stackCollection`'s `case "deck":` to `return player.deck;`.
- [x] 6. In `createStacks`, compute `top` as `zone === "deck" ? undefined : publicCards.at(-1)` and leave the rest of the block as it is, so a deck stack keeps `publicCount` but gains neither `topCardLabel` nor `topCardCode`.
- [x] 7. In `src/field/zone-list.ts`, delete the synthetic deck branch and read `snapshot.players[stack.player].deck`, deriving `identityVisible` from `card.faceUp === true && card.code !== undefined` with the explanatory comment required under Inputs.
- [x] 8. In `src/app/components/duel-field/ZoneListDialog.svelte`, extend the `aria-label` expression with the deck wording.
- [x] 9. Run `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run test:component`, `npm run test:integration`.

## Outputs

- Edited: `src/field/board-view-model.ts`, `src/field/zone-list.ts`, `src/app/components/duel-field/ZoneListDialog.svelte`, `tests/unit/zone-list.test.ts`, `tests/unit/duel-field.test.ts`, `tests/component/ZoneListDialog.test.ts`.
- Public contract for successors: `stackCollection(player, "deck")` returns `player.deck`; a deck `BoardStackView` never carries `topCardLabel`/`topCardCode`; `zoneListEntries` for a deck reads real slots, `position 1 = top`.
- No migration, no config change.

## Validation

- [x] `npm run format:check` exits 0
- [x] `npm run lint` exits 0
- [x] `npm run typecheck` exits 0
- [x] `npm run test:unit` exits 0
- [x] `npm run test:component` exits 0
- [x] `npm run test:integration` exits 0
- [ ] manual check: `npm run dev`; click your deck — the list shows one face-down entry per remaining card numbered from the top; click the opponent's deck — the same, all face-down. If the preset deck contains an excavate effect, resolve it and confirm the revealed positions come back face-up and go face-down again after a shuffle.
- [x] app functional — the deck pile on the board still shows only its name and count, never card art
- [x] commit msg draft: `feat(field): list real deck contents and revealed positions`
</content>

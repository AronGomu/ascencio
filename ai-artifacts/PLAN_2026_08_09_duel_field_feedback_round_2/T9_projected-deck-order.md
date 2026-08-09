# T9: Projected deck order and reveals

**Plan:** `./ai-artifacts/PLAN_2026_08_09_duel_field_feedback_round_2.md`
**Depends:** none
**Commit outcome:** `PublicDuelState` carries an ordered `deck` list per player — one entry per remaining card, top first — and the projector marks the positions the local player has legitimately been shown as public, clearing them the moment the deck is disturbed.

## Context (self-contained)

- Goal: ship 17 duel-field feedback items. This slice is the last part of item 13: *"whenever you update information that reveals the position of a card within the deck … that information should become public, just like a visible card in the graveyard."*
- This slice: `src/worker/projection/DuelStateProjector.ts` tracks a deck as a **number** — `MutablePlayer.deckCount` — and nothing else. `stackCollection(player, "deck")` in `src/field/board-view-model.ts` returns `[]` for exactly that reason. The engine already sends everything needed: `MSG_CONFIRM_DECKTOP` (30) after an excavate, `MSG_DECK_TOP` (38) when a specific position changes, `MSG_SHUFFLE_DECK` (32) when the order is destroyed. `src/worker/protocol/message-classification.ts` already classifies 30, 31, 32, 35, 37, 38 and 42 as `"event"`, so they already reach `DuelStateProjector.apply()` — they just fall into its `default: break;`.
- Out of scope here: any UI. Nothing renders the new field in this ticket — T10 does. Also out: `MSG_CONFIRM_CARDS`, `MSG_CONFIRM_EXTRATOP`, extra-deck ordering (already reconciled by `reconcileExtraDeck`), opponent AI.
- Assumptions in force:
  - **A5** deck order tracking is in scope.
  - **A6** reveals are stored as an **offset from the top**, never as an engine deck sequence. Only `DRAW`, `CONFIRM_DECKTOP` and `DECK_TOP` write reveals. `SHUFFLE_DECK`, `SWAP_GRAVE_DECK`, `REVERSE_DECK` and any `MOVE` whose `from` or `to` is a deck clear every reveal for that player. `CONFIRM_CARDS` is ignored. The projection may forget a reveal; it must never invent one.
  - **A7** a reveal is only stored when the message's cards all belong to the deck named by `message.player`; anything else is skipped rather than guessed.
  - **A8** a revealed slot projects as `position: "faceUpAttack"`, `faceUp: true`. That is what makes it identity-visible downstream and what keeps the `state.players[1]` face-down-implies-no-code privacy invariant in `src/duel/contracts/duel-worker-event.ts` intact.

## Requirements

1. `src/worker/engine/engine-constants.ts` — add to `EngineMessageType`, keeping numeric order:
   ```ts
   CONFIRM_DECKTOP: 30,
   SWAP_GRAVE_DECK: 35,
   REVERSE_DECK: 37,
   DECK_TOP: 38,
   ```
   Do **not** add `CONFIRM_CARDS: 31` — nothing consumes it and an unused constant would be dead code. `SHUFFLE_DECK: 32` and `MOVE: 50` already exist.
2. `src/duel/contracts/public-duel-state.ts` — `PublicPlayerState` gains
   ```ts
   readonly deck: readonly PublicCard[];
   ```
   placed immediately after `deckCount`. Its length always equals `deckCount`. Index 0 is the **top** of the deck.
3. `src/worker/projection/DuelStateProjector.ts`:
   - `MutablePlayer` gains `deckReveals: Map<number, CardCode>;`, initialised to an empty `Map` in `mutablePlayer(...)`. `checkpoint()`/`restore()` already `structuredClone` the whole player array and `Map` is clone-safe, so they need no change.
   - New private methods:
     ```ts
     #clearDeckReveals(player: PlayerIndex): void
     #shiftDeckRevealsAfterDraw(player: PlayerIndex, drawn: number): void
     #revealDeckTop(player: PlayerIndex, codes: readonly CardCode[]): void
     #revealDeckPosition(player: PlayerIndex, offset: number, code: CardCode): void
     #truncateDeckReveals(player: PlayerIndex): void
     ```
     - `#clearDeckReveals` → `state.deckReveals.clear()`.
     - `#shiftDeckRevealsAfterDraw` → build a new `Map` from the old one keeping only `offset >= drawn`, remapped to `offset - drawn`; assign it.
     - `#revealDeckTop` → for each `i`, `state.deckReveals.set(i, codes[i])`.
     - `#revealDeckPosition` → `state.deckReveals.set(offset, code)` when `offset >= 0 && offset < state.deckCount`, otherwise no-op.
     - `#truncateDeckReveals` → delete every key `>= state.deckCount` or `< 0`.
   - New cases in `apply()`'s `switch`:
     - `EngineMessageType.CONFIRM_DECKTOP`: let `owner = asPlayer(message.player)`. Skip the whole message unless **every** entry of `message.cards` satisfies `entry.controller === owner && (entry.location & ~EngineLocation.OVERLAY) === EngineLocation.DECK && entry.code > 0`. Otherwise call `#revealDeckTop(owner, message.cards.map((entry) => cardCode(entry.code)))`. Push no presentation event.
     - `EngineMessageType.DECK_TOP`: `#revealDeckPosition(asPlayer(message.player), message.count, cardCode(message.code))` when `message.code > 0`; otherwise no-op. Push no presentation event.
     - `EngineMessageType.SWAP_GRAVE_DECK` and `EngineMessageType.REVERSE_DECK`: `#clearDeckReveals(asPlayer(message.player))`. Push no presentation event.
   - Extend existing cases:
     - `EngineMessageType.DRAW`: after `this.#draw(...)`, call `this.#shiftDeckRevealsAfterDraw(asPlayer(message.player), message.drawn.length)`.
     - `EngineMessageType.SHUFFLE_DECK`: add `this.#clearDeckReveals(player)` inside the existing `SHUFFLE_DECK` branch (the branch is shared with `SHUFFLE_HAND`; guard on `message.type === EngineMessageType.SHUFFLE_DECK`).
     - `EngineMessageType.MOVE`: after the move is applied, call `#clearDeckReveals` for `from.controller` when `engineLocation(message.from.location) === "deck"`, and for `to.controller` when `engineLocation(message.to.location) === "deck"`.
   - Immediately before the `this.#revision += 1` line at the end of `apply()`, call `this.#truncateDeckReveals(0)` and `this.#truncateDeckReveals(1)`.
   - `snapshot()` builds `deck` for each player through a new module-private function:
     ```ts
     function projectDeck(
       player: MutablePlayer,
       index: PlayerIndex,
     ): readonly PublicCard[] {
       const slots: PublicCard[] = [];
       for (let offset = 0; offset < player.deckCount; offset += 1) {
         const code = player.deckReveals.get(offset);
         slots.push(
           Object.freeze({
             instanceId: cardInstanceId(`deck-p${index}-${offset}`),
             ...(code === undefined ? {} : { code }),
             owner: index,
             controller: index,
             location: "deck" as const,
             sequence: offset,
             position: (code === undefined
               ? "faceDownAttack"
               : "faceUpAttack") as CardPosition,
             faceUp: code !== undefined,
             counters: Object.freeze([]),
             overlayMaterials: Object.freeze([]),
           }),
         );
       }
       return Object.freeze(slots);
     }
     ```
     and adds `deck: projectDeck(value, index)` to the frozen player object. **Do not** add the deck slots to `allVisibleCards`: they are synthetic, they would inflate the existing 256-instance guard, and they are already position-unique by construction.
4. `src/duel/contracts/duel-worker-event.ts`:
   - add `"deck"` to the `requireExactKeys(player, [...])` list, immediately after `"deckCount"`.
   - add `"deck"` to the zone loop array and to the `validLocation` disjunction as `(zone === "deck" && record.location === "deck")`.
   - after the loop, add:
     ```ts
     const deck = requireArray(player.deck, `${label}.deck`, MAXIMUM_PUBLIC_CARDS);
     if (deck.length !== player.deckCount) throw invalid(`${label}.deck count`);
     ```
     and inside the loop, for `zone === "deck"`, assert `record.sequence === cardIndex` and `record.owner === index`.
5. Every existing fixture that builds a `PublicPlayerState` gains a matching `deck`. Add a helper to `tests/fixtures/board-public-states.ts`:
   ```ts
   export function deckSlots(
     player: PlayerIndex,
     count: number,
   ): readonly PublicCard[];
   ```
   producing `count` face-down slots exactly as `projectDeck` does, and use it in every fixture whose `deckCount` is non-zero.
6. No presentation event, no duel-log entry and no reconciliation request is added by any of this. Deck reveals are state, not narrative.

## Inputs

- `src/worker/engine/engine-constants.ts` — `EngineMessageType`, `EngineLocation.DECK = 1`, `EngineLocation.OVERLAY = 128`.
- `vendor/ocgcore-wasm/0.1.2/dist/index.d.ts` — the message shapes:
  ```ts
  interface OcgMessageConfirmDeckTop { type: CONFIRM_DECKTOP; player: number; cards: OcgCardLoc[] }
  interface OcgMessageDeckTop { type: DECK_TOP; player: number; count: number; code: number; position: OcgPosition; overlay_sequence?: number }
  interface OcgMessageShuffleDeck { type: SHUFFLE_DECK; player: number }
  interface OcgCardLoc { code: number; controller: 0 | 1; location: OcgLocation; sequence: number }
  ```
  `SWAP_GRAVE_DECK` and `REVERSE_DECK` both carry `player: number`.
- `src/worker/protocol/message-classification.ts` — 30, 31, 32, 35, 37, 38, 42 are already `"event"`; no change needed. `tests/unit/message-classification.test.ts` pins that inventory — do not disturb it.
- `src/worker/projection/DuelStateProjector.ts` — `MutablePlayer`, `mutablePlayer(deckCount, extraDeckCount)`, `apply()`'s switch (the `DRAW`, `SHUFFLE_DECK`/`SHUFFLE_HAND`, `MOVE` cases and the trailing `default: break;`), `#draw`, `snapshot()`'s `allVisibleCards` guards and its frozen player mapping around line 1288, `immutableCard`, `cardInstanceId`, `cardCode`, `engineLocation`, `asPlayer`, `checkpoint`/`restore`.
- `src/duel/contracts/public-duel-state.ts` — `PublicPlayerState`, `PublicCard`, `CardPosition`.
- `src/duel/contracts/duel-worker-event.ts` — the `state.players[i]` validator around lines 505-592, `MAXIMUM_PUBLIC_CARDS = 256`, `requireArray`, `invalid`, `PublicInstanceValidation`.
- Files that build a `PublicPlayerState` literal and therefore need `deck`: `tests/fixtures/board-public-states.ts`, `tests/fixtures/board-view-model.ts`, `tests/unit/contracts.test.ts`, `tests/unit/duel-state-projector.test.ts`, `tests/unit/duel-store.test.ts`, `tests/unit/headless-reconciliation.test.ts`, `tests/unit/opponent-policy.test.ts`, `tests/unit/placement-candidates.test.ts`.
- **From Depends:** none.

## TDD

1. **Red** — add `tests/unit/deck-order-projection.test.ts` with the ten cases below, plus the contract case in `tests/unit/contracts.test.ts`. Run `npm run test:unit`; they must fail.
2. **Green** — add the constants, the contract field, the projector state and cases, the validator changes and the fixture helper.
3. **Refactor** — only if needed. Keep green.

## Test plan

Drive the projector directly, the way `tests/unit/duel-state-projector.test.ts` already does.

| Test | Input | Expect |
| --- | --- | --- |
| `projects one deck slot per remaining card` | fresh projector, `deckCounts: [40, 40]` | `snapshot().players[0].deck.length === 40`; every slot `code === undefined`, `faceUp === false`, `position === "faceDownAttack"`, `sequence === index` |
| `reveals the excavated top cards` | `CONFIRM_DECKTOP` with `player: 0` and three deck-located cards `[a, b, c]` | slots 0, 1, 2 carry codes `a`, `b`, `c` with `faceUp === true` and `position === "faceUpAttack"`; slot 3 is still face-down |
| `skips a confirm whose cards are not all in that deck` | `CONFIRM_DECKTOP` with `player: 0` and one card whose `controller` is 1 | no slot is revealed |
| `reveals a single deck position` | `DECK_TOP` with `player: 0`, `count: 2`, `code: X` | slot 2 carries `X`; slots 0 and 1 stay face-down |
| `ignores a deck-top with no code` | `DECK_TOP` with `code: 0` | no slot is revealed |
| `shifts reveals down on draw` | reveal slots 0..2, then `DRAW` with one card | old slot 1 becomes slot 0 and old slot 2 becomes slot 1; the list is one shorter |
| `forgets everything on shuffle` | reveal slots 0..2, then `SHUFFLE_DECK` with `player: 0` | every slot is face-down |
| `forgets everything when a card enters the deck` | reveal slots 0..2, then `MOVE` with `to.location = EngineLocation.DECK` for player 0 | every slot is face-down |
| `forgets everything on swap-grave-deck and reverse-deck` | reveal, then each message in turn | every slot is face-down |
| `never leaks the opponent deck` | reveal on player 1's deck through `DECK_TOP`, snapshot | `players[1].deck` slot carries the code **and** `faceUp === true` — this is a legitimate reveal to the viewer; assert the validator accepts it |
| `truncates reveals past the deck size` | reveal slot 5, then draw the deck down to 3 cards | `players[0].deck.length === 3` and no slot carries a code |
| `contract validator rejects a mismatched deck length` (in `tests/unit/contracts.test.ts`) | a state whose `deckCount` is 40 but whose `deck` has 39 entries | the validator throws with a message containing `deck count` |

## Impl steps

- [ ] 1. Create `tests/unit/deck-order-projection.test.ts` with the eleven projector cases, copying the projector construction style from `tests/unit/duel-state-projector.test.ts`.
- [ ] 2. Add the `deck count` case to `tests/unit/contracts.test.ts`.
- [ ] 3. Run `npm run test:unit`; confirm the new cases fail.
- [ ] 4. In `src/worker/engine/engine-constants.ts`, add `CONFIRM_DECKTOP: 30`, `SWAP_GRAVE_DECK: 35`, `REVERSE_DECK: 37`, `DECK_TOP: 38` to `EngineMessageType` in numeric order.
- [ ] 5. In `src/duel/contracts/public-duel-state.ts`, add `readonly deck: readonly PublicCard[];` to `PublicPlayerState` after `deckCount`.
- [ ] 6. In `src/worker/projection/DuelStateProjector.ts`, add `deckReveals: Map<number, CardCode>` to `MutablePlayer` and initialise it in `mutablePlayer`.
- [ ] 7. Add the five private deck-reveal methods.
- [ ] 8. Add the `CONFIRM_DECKTOP`, `DECK_TOP`, `SWAP_GRAVE_DECK` and `REVERSE_DECK` cases to `apply()`.
- [ ] 9. Extend the `DRAW`, `SHUFFLE_DECK` and `MOVE` cases as specified.
- [ ] 10. Call `#truncateDeckReveals(0)` and `#truncateDeckReveals(1)` just before the revision bump at the end of `apply()`.
- [ ] 11. Add `projectDeck` and wire `deck: projectDeck(value, index)` into `snapshot()`'s frozen player object.
- [ ] 12. In `src/duel/contracts/duel-worker-event.ts`, add `"deck"` to the exact-keys list, to the zone loop, to `validLocation`, and add the length/sequence/owner assertions.
- [ ] 13. Add `deckSlots(player, count)` to `tests/fixtures/board-public-states.ts` and add `deck:` to every fixture in the eight files listed under Inputs.
- [ ] 14. Run `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run test:component`, `npm run test:integration`, `npm run test:legacy`.

## Outputs

- Added: `tests/unit/deck-order-projection.test.ts`; `deckSlots` helper in `tests/fixtures/board-public-states.ts`.
- Edited: `src/worker/engine/engine-constants.ts`, `src/duel/contracts/public-duel-state.ts`, `src/worker/projection/DuelStateProjector.ts`, `src/duel/contracts/duel-worker-event.ts`, plus the eight fixture/test files.
- Public contract for successors:
  - `PublicPlayerState.deck: readonly PublicCard[]`, length always `deckCount`, index 0 = top of deck, `sequence === index`, `owner === controller === player`.
  - An unrevealed slot: no `code`, `position: "faceDownAttack"`, `faceUp: false`, `instanceId: \`deck-p${player}-${offset}\``.
  - A revealed slot: `code` present, `position: "faceUpAttack"`, `faceUp: true`.
  - `deckSlots(player, count)` fixture helper.
  - **T10 consumes this and nothing else changes shape.**
- No migration. No config change. The worker/UI message contract gains one field; both sides ship in the same commit.

## Validation

- [ ] `npm run format:check` exits 0
- [ ] `npm run lint` exits 0
- [ ] `npm run typecheck` exits 0
- [ ] `npm run test:legacy` exits 0
- [ ] `npm run test:unit` exits 0
- [ ] `npm run test:component` exits 0
- [ ] `npm run test:integration` exits 0 — including `tests/integration/real-wasm-smoke.test.ts`, which is the only place the real engine actually emits these messages
- [ ] manual check: none possible yet (no UI renders `deck`); instead assert in a node REPL or a temporary log that a completed duel's final snapshot has `players[0].deck.length === players[0].deckCount`
- [ ] app functional — the duel still runs end to end and the worker/UI contract validator does not throw
- [ ] commit msg draft: `feat(worker): project deck order and track legitimate deck reveals`
</content>

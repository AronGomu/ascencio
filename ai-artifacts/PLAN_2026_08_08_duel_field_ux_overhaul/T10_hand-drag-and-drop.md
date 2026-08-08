# T10: Drag and drop from hand

**Plan:** `./ai-artifacts/PLAN_2026_08_08_duel_field_ux_overhaul.md`
**Depends:** T9
**Commit outcome:** Dragging an actionable hand card halos the zones it could go to; dropping on one sends the card's action and then auto-answers the engine's follow-up zone prompt with the dropped zone, in a single gesture.

## Context (self-contained)

- Goal: turn the app from a panel stack into a field-first duel client. Feedback item 13.
- Engine reality: `ocgcore` does not reveal legal zones at idle-command time. It emits `SELECT_IDLE_COMMAND` (mapped to prompt kind `idleCommand`, spec kind `cardAction`), and only **after** it receives the chosen action does it emit `SELECT_PLACE` (prompt kind `selectPlace`, spec kind `placeSelection`, choices carrying `place: { player, location, sequence }`). One drop therefore becomes: dispatch the action, remember the zone, auto-answer the follow-up prompt.
- This slice: drag gesture, non-authoritative candidate halo, and the pending-placement handshake with a safe fallback.
- Out of scope here: preview panel (T11). Do not change chip behaviour beyond adding the drag gesture.
- Assumptions in force: A5 (pointer events, injectable hit test), A6 (drop picks the primary action per zone kind), A7 (the field-spell zone is never a drag candidate), A8.

## Requirements

- Drag starts only from a card in `p0:hand` that is actionable under a `cardAction` spec, and only after the pointer moves more than 8px — the existing click-suppression threshold in `CardControl.svelte`.
- While dragging, candidate zones show an orange drop halo, visually distinct from the actionable halo by a filled tint.
- Candidate zones are computed locally and are presentation only. They never gate a response.
- Dropping on a candidate zone dispatches one `chooseChoice` for the action, and arms a pending placement for that zone.
- When the next prompt is `selectPlace` with `minimum === 1 && maximum === 1` and exactly one choice resolving to the armed zone, the store answers it automatically with that single choice.
- Any other next prompt clears the intent and is shown normally, with its real zone highlights. A wrong guess costs nothing.
- Dropping outside a candidate zone cancels the drag with no dispatch.
- Pending placement is cleared on every prompt, result and error, so it can never leak into a later turn.
- The keyboard path is unchanged: chips still work, and drag is pointer-only.

## Inputs

- Create: `src/field/placement-candidates.ts`, `src/app/prompts/drop-target.ts`, `src/app/prompts/pending-placement.ts`, `tests/unit/placement-candidates.test.ts`, `tests/unit/drop-target.test.ts`, `tests/unit/pending-placement.test.ts`.
- Edit: `src/app/stores/duel-store.ts`, `src/app/components/DuelField.svelte`, `src/app/components/duel-field/FieldBoard.svelte`, `src/app/components/duel-field/CardControl.svelte`, `src/app/components/duel-field/ZoneControl.svelte`, `src/app/components/duel-field/DuelFieldErrorBoundary.svelte`, `src/app/App.svelte`, `src/styles/app.css`, `tests/unit/duel-store.test.ts`, `tests/component/DuelField.test.ts`, `e2e/duel-smoke.spec.ts`.
- **From Depends (T9):** `CardControl.svelte` has props `card`, `imageUrl`, `imageLibrary`, `interactionKind`, `actionable`, `selected`, `active`, `disabled`, `choices`, `pinned`, `onactivate`, `onchoose`, `ondismiss`, and already tracks `pointerOrigin` / `pointerMoved` with an 8px threshold in `pointerDown` / `pointerMove`. `FieldBoard.svelte` forwards `pinnedTarget`, `oncardchoose`, `oncarddismiss`. `DuelField.svelte` has no menu anchor logic and no `oninspect`. `.duel-field-card.is-actionable .duel-field-card__art` already wears the orange halo. `cardActionLabel` lives in `src/app/presentation/card-action-label.ts`.
- Read only: `src/field/duel-field-layout.ts` (`PhysicalZoneId` union; `mapEngineFieldAddress({ player, location, sequence })` returns `{ ok: true, zoneId }` or an unsupported error; monster sequences 0–4 map to `p{n}:mainMonster:{seq}`, 5 and 6 map to the two `shared:extraMonster:*` zones, spellTrap 0–4 map to `p{n}:spellTrap:{seq}`), `src/field/board-view-model.ts` (`BoardViewModel.zones`, `BoardViewModel.cards[n].zoneId`, `BoardZoneView.kind` is one of `hand | monster | spellTrap | field | deck | extra | graveyard | banished`), `src/duel/contracts/player-prompt.ts` (`PromptChoice.place`, `PlayerPrompt.minimum` / `.maximum`).

## Exact API to create

```ts
// src/field/placement-candidates.ts
export function placementZoneCandidates(
  action: ChoiceAction,
  board: BoardViewModel,
): readonly PhysicalZoneId[];
```

Player 0 only. `summon` and `setMonster` → the unoccupied members of `p0:mainMonster:0..4`. `specialSummon` → those plus unoccupied `shared:extraMonster:left` and `shared:extraMonster:right`. `activate` and `setSpellTrap` → the unoccupied members of `p0:spellTrap:0..4`. Every other action → `[]`. "Unoccupied" means no entry of `board.cards` has that `zoneId`. `p0:field` is never returned (assumption A7).

```ts
// src/app/prompts/drop-target.ts
export function dropChoiceForZone(
  zone: BoardZoneView,
  choices: readonly InteractionChoice[],
): InteractionChoice | null;
```

`zone.kind === "monster"` → first choice whose action is `summon`, else `specialSummon`, else `setMonster`. `zone.kind === "spellTrap"` → first `activate`, else `setSpellTrap`. Any other kind → `null`.

```ts
// src/app/prompts/pending-placement.ts
export interface PendingPlacement {
  readonly zoneId: PhysicalZoneId;
  readonly armedAtPromptId: PromptId;
}

export function resolvePendingPlacementChoice(
  prompt: PlayerPrompt,
  pending: PendingPlacement | null,
): ChoiceId | null;
```

Returns a choice id only when all hold: `pending !== null`; `prompt.id !== pending.armedAtPromptId`; `prompt.kind === "selectPlace"`; `prompt.minimum === 1`; `prompt.maximum === 1`; exactly one `prompt.choices` entry has a `place` that `mapEngineFieldAddress` maps to `pending.zoneId`. Otherwise `null`.

Store additions in `src/app/stores/duel-store.ts`:

```ts
// DuelViewState
readonly pendingPlacement: PendingPlacement | null;

// DuelStore
armPlacementIntent(zoneId: PhysicalZoneId): boolean;
```

New `DuelField.svelte` props:

```ts
export let hitTest: (x: number, y: number) => Element | null =
  (x, y) => document.elementFromPoint(x, y);
export let onplacementintent: (zoneId: PhysicalZoneId) => unknown = () => false;
```

New `CardControl.svelte` props:

```ts
export let draggable = false;
export let ondragstart: () => void = () => undefined;
export let ondragmove: (x: number, y: number) => void = () => undefined;
export let ondragend: (x: number, y: number) => void = () => undefined;
```

New `ZoneControl.svelte` prop:

```ts
export let dropCandidate = false;
```

## data-cy contract added here

No new static values. `ZoneControl` gains `data-drop-candidate={dropCandidate ? "true" : undefined}`; `CardControl` gains `data-dragging={dragging ? "true" : undefined}`.

## TDD

1. **Red** — write the three new unit test files, the store rows and the DuelField drag rows; record failures.
2. **Green** — pure modules first, then the store, then the components.
3. **Refactor** — none.

## Test plan

| Test | Input | Expect |
| --- | --- | --- |
| `summon offers empty monster zones` | board with `p0:mainMonster:2` occupied | four ids, `p0:mainMonster:2` absent |
| `special summon adds the extra monster zones` | empty board | seven ids including both `shared:extraMonster:*` |
| `activate offers empty spell zones` | board with `p0:spellTrap:0` occupied | four `p0:spellTrap:*` ids |
| `field zone is never a candidate` | any action, empty board | no result contains `p0:field` |
| `attack yields nothing` | `attack` | `[]` |
| `monster zone prefers summon` | choices `setMonster` then `summon` | the `summon` choice |
| `monster zone falls back to set` | only `setMonster` | the `setMonster` choice |
| `spell zone prefers activate` | choices `setSpellTrap` then `activate` | the `activate` choice |
| `graveyard zone is not a drop target` | `zone.kind: "graveyard"` | `null` |
| `pending resolves a matching place prompt` | `selectPlace`, min 1, max 1, one choice for `p0:mainMonster:1`, pending on that zone | that choice id |
| `pending ignores a non-place prompt` | `yesNo` prompt | `null` |
| `pending ignores a multi-count place prompt` | `selectPlace` with `minimum: 2` | `null` |
| `pending ignores a zone the engine did not offer` | choices for `p0:mainMonster:0` only, pending on `p0:mainMonster:1` | `null` |
| `pending ignores an ambiguous match` | two choices mapping to the same zone | `null` |
| `pending ignores the arming prompt itself` | `prompt.id === pending.armedAtPromptId` | `null` |
| `arming requires an active prompt` | store with `prompt: null`, `armPlacementIntent("p0:mainMonster:0")` | returns `false`, state unchanged |
| `arming records the zone` | store with an active prompt | `pendingPlacement.zoneId` equals the argument |
| `matching place prompt is auto-answered` | armed store, then a `selectPlace` client event that matches | `client.respond` called once with the single matching choice id; `pendingPlacement` back to `null` |
| `non-matching place prompt is left alone` | armed store, then a `selectPlace` event with other zones | `client.respond` not called; prompt visible; `pendingPlacement` back to `null` |
| `result clears the intent` | armed store, then a `result` event | `pendingPlacement` is `null` |
| `drag halos the candidates` | render `DuelField`, `pointerdown` then `pointermove` 20px on an actionable hand card | every candidate zone has `data-drop-candidate="true"` |
| `no drag from a non-hand card` | same gesture on a monster-zone card | no zone gains `data-drop-candidate` |
| `drop on a candidate dispatches once` | drag then `pointerup` with `hitTest` returning the zone element | `onplacementintent` called once with that zone id and one `{ type: "chooseChoice" }` dispatched |
| `drop outside cancels` | `hitTest` returns `null` | no dispatch, no intent, halos cleared |
| `drop on a non-candidate cancels` | `hitTest` returns an occupied zone | no dispatch, no intent |
| e2e `dragging a hand card summons it` | production build, own Main Phase | after a mouse drag from a hand card with a `Summon` chip onto a highlighted monster zone, that zone holds a card and exactly one extra response was sent |

## Impl steps

- [ ] 1. Create `tests/unit/placement-candidates.test.ts` with rows one to five; record failure; create `src/field/placement-candidates.ts`; re-run to green.
- [ ] 2. Create `tests/unit/drop-target.test.ts` with rows six to nine; record failure; create `src/app/prompts/drop-target.ts`; re-run to green.
- [ ] 3. Create `tests/unit/pending-placement.test.ts` with rows ten to fifteen; record failure; create `src/app/prompts/pending-placement.ts`; re-run to green.
- [ ] 4. Add rows sixteen to twenty to `tests/unit/duel-store.test.ts` using the existing fake client harness in that file; record failures.
- [ ] 5. In `src/app/stores/duel-store.ts`, add `pendingPlacement: PendingPlacement | null` to `DuelViewState` and `pendingPlacement: null` to `createInitialDuelViewState`.
- [ ] 6. In `reduceDuelViewState`, set `pendingPlacement: null` in the `prompt`, `result` and `error` cases. Leave `state`, `event`, `loading`, `ready`, `diagnostics` and `disposed` untouched so an intent survives the state and event traffic that precedes the follow-up prompt.
- [ ] 7. In `createDuelStore`, change the client subscription to capture the previous state before reducing: `const previous = current; const next = reduceDuelViewState(previous, received); set(next); if (received.event.type === "prompt") { const choiceId = resolvePendingPlacementChoice(received.event.prompt, previous.pendingPlacement); if (choiceId !== null) acceptResponse([choiceId]); }`.
- [ ] 8. In `createDuelStore`, add `armPlacementIntent: (zoneId) => { if (current.prompt === null || current.responsePending) return false; set(freezeState({ ...current, pendingPlacement: Object.freeze({ zoneId, armedAtPromptId: current.prompt.id }) })); return true; }` and expose it on the returned object and on the `DuelStore` interface.
- [ ] 9. Run `npx vitest run tests/unit/duel-store.test.ts` to green.
- [ ] 10. In `src/app/components/duel-field/CardControl.svelte`, add the four drag props and `let dragging = false;`. In `pointerDown`, when `draggable` is true call `event.currentTarget.setPointerCapture(event.pointerId)`.
- [ ] 11. In `CardControl.svelte`'s `pointerMove`, once the 8px threshold trips and `draggable` is true and `dragging` is false, set `dragging = true` and call `ondragstart()`; while `dragging`, call `ondragmove(event.clientX, event.clientY)` on every move.
- [ ] 12. In `CardControl.svelte`, add an `onpointerup` handler on the same button: when `dragging`, call `ondragend(event.clientX, event.clientY)`, set `dragging = false`, release pointer capture. The existing `activate` click guard already suppresses the click that follows a moved pointer.
- [ ] 13. In `CardControl.svelte`, add `onpointercancel` clearing `dragging` and calling `ondragend(Number.NaN, Number.NaN)`; the field treats a `NaN` coordinate as a cancel.
- [ ] 14. In `CardControl.svelte`, add `data-dragging={dragging ? "true" : undefined}` and `class:is-dragging={dragging}` to the article.
- [ ] 15. In `src/app/components/duel-field/ZoneControl.svelte`, add `export let dropCandidate = false;`, `class:is-drop-candidate={dropCandidate}` and `data-drop-candidate={dropCandidate ? "true" : undefined}`.
- [ ] 16. In `src/app/components/duel-field/FieldBoard.svelte`, add `export let dropCandidates: ReadonlySet<PhysicalZoneId> = new Set();`, `export let oncarddragstart`, `export let oncarddragmove`, `export let oncarddragend`, pass `dropCandidate={dropCandidates.has(zone.id)}` to each `ZoneControl`, and pass `draggable`, `ondragstart`, `ondragmove`, `ondragend` to each `CardControl` with `draggable={actionable && card.zoneId === "p0:hand" && spec?.kind === "cardAction"}`.
- [ ] 17. In `src/app/components/DuelField.svelte`, add the `hitTest` and `onplacementintent` props plus `let dragCard: BoardCardView | null = null;` and `let dropCandidates: ReadonlySet<PhysicalZoneId> = new Set();`.
- [ ] 18. In `DuelField.svelte`, implement `startCardDrag(card)`: return early unless `spec?.kind === "cardAction"` and `card.zoneId === "p0:hand"`; set `dragCard = card`; set `dropCandidates` to the union of `placementZoneCandidates(choice.action, board)` over `spec.cardChoices.get(card.targetId) ?? []`.
- [ ] 19. In `DuelField.svelte`, implement `endCardDrag(x, y)`: always clear `dragCard` and `dropCandidates` at the end; do nothing else when `dragCard === null` or `Number.isNaN(x)`; otherwise resolve `const zoneId = hitTest(x, y)?.closest("[data-zone-id]")?.getAttribute("data-zone-id")`, bail unless `dropCandidates.has(zoneId)`, find the `BoardZoneView` with that id, call `dropChoiceForZone(zone, spec.cardChoices.get(dragCard.targetId) ?? [])`, bail on `null`, then call `onplacementintent(zoneId)` followed by `dispatch({ type: "chooseChoice", choiceId: choice.id })`.
- [ ] 20. In `DuelField.svelte`, implement `moveCardDrag(x, y)` as a no-op placeholder that keeps the signature stable — the halo does not follow the pointer in this ticket. Do not add per-move DOM work.
- [ ] 21. In `DuelField.svelte`, pass `dropCandidates`, `oncarddragstart={startCardDrag}`, `oncarddragmove={moveCardDrag}`, `oncarddragend={endCardDrag}` to `FieldBoard`.
- [ ] 22. In `src/app/components/duel-field/DuelFieldErrorBoundary.svelte`, add `onplacementintent` (default `() => false`) and forward it. Do not forward `hitTest`; the default is correct in the app.
- [ ] 23. In `src/app/App.svelte`, pass `onplacementintent={duel.armPlacementIntent}` to `DuelFieldErrorBoundary`.
- [ ] 24. In `src/styles/app.css`, add `.duel-field-zone.is-drop-candidate { border-color: var(--warning); background: rgb(255 213 128 / .14); box-shadow: 0 0 0 3px rgb(255 213 128 / .7); }` and `.duel-field-card.is-dragging { opacity: .72; }`.
- [ ] 25. Add rows twenty-one to twenty-five to `tests/component/DuelField.test.ts`, passing a stub `hitTest` that returns a queried zone element. Fire `pointerdown`, `pointermove` with a 20px delta, then `pointerup` through `fireEvent`.
- [ ] 26. Run `npx vitest run tests/component/DuelField.test.ts` to green.
- [ ] 27. In `e2e/duel-smoke.spec.ts`, add `test("dragging a hand card onto a highlighted zone plays it", …)`: locate the first `[data-cy^="field-card-"]` inside the `p0:hand` row that exposes a chip whose text is `Summon` (fall back to `Set`); read its box and a candidate zone's box; drive `page.mouse.move`, `page.mouse.down`, two intermediate `page.mouse.move` steps, `page.mouse.up`; assert the target zone ends up holding a card and that the capture recorded exactly the expected number of responses. If no hand card offers `Summon` or `Set`, call `test.skip(true, "preset opening hand offers no placement action")`.
- [ ] 28. Run `npm run test:e2e` to green.
- [ ] 29. Run `npx vitest run tests/unit/data-cy-coverage.test.ts` to green.

## Outputs

- Files created: `src/field/placement-candidates.ts`, `src/app/prompts/drop-target.ts`, `src/app/prompts/pending-placement.ts`, three unit test files.
- Files edited: `src/app/stores/duel-store.ts`, `src/app/components/DuelField.svelte`, `src/app/components/duel-field/FieldBoard.svelte`, `src/app/components/duel-field/CardControl.svelte`, `src/app/components/duel-field/ZoneControl.svelte`, `src/app/components/duel-field/DuelFieldErrorBoundary.svelte`, `src/app/App.svelte`, `src/styles/app.css`, `tests/unit/duel-store.test.ts`, `tests/component/DuelField.test.ts`, `e2e/duel-smoke.spec.ts`.
- Public API: `armPlacementIntent` on `DuelStore`; `pendingPlacement` on `DuelViewState`.
- Migrate / config: none.

## Validation

- [ ] `npx vitest run tests/unit/placement-candidates.test.ts tests/unit/drop-target.test.ts tests/unit/pending-placement.test.ts` passes
- [ ] `npx vitest run tests/unit/duel-store.test.ts tests/component/DuelField.test.ts` passes
- [ ] `npm run test:unit && npm run test:component` passes
- [ ] `npm run typecheck && npm run lint` passes
- [ ] `npm run format` then `npm run format:check` passes
- [ ] `npm run test:e2e` passes
- [ ] manual check: `npm run dev`, drag a monster from hand — candidate monster zones light orange, dropping on one summons it without a second click; drag onto an occupied zone and confirm nothing happens; drag a spell and confirm only spell/trap zones light up
- [ ] app functional — chips, action bar and keyboard play all still work; a mis-guessed zone falls back to the engine's own zone prompt
- [ ] commit msg draft: `feat(field): play hand cards by dragging them onto a zone`

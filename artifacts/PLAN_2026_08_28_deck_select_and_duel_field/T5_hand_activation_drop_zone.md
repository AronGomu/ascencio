# T5: Hand activation drop zone with cancel (item 4)

**Plan:** `./artifacts/PLAN_2026_08_28_deck_select_and_duel_field.md`  
**Depends:** T2  
**Commit outcome:** Dragging activatable hand card shows dashed centered zone left of hand; drop → confirm/cancel dialog; hand activate chips removed

## Context (self-contained)

- Goal: implement the 2026-08-27 owner feedback round on the duel field. This ticket is item 4 (owner wording, binding): "When I'm dragging a card that has an effect that can be activated, generate a zone on top of the field where a zone appears next to my hand on the left, with a centered, dashed border around it. If I drag and drop the card in that zone, it will activate the effect. Remove for monster and for any card effect that can be activated from the hand; use that zone. Also, if I activate an effect by dragging the card, I must be able to cancel the action and go back."
- This slice: three coupled changes to the duel-field drag/chip surfaces. (1) A new dashed drop zone, mounted only during a hand-card drag whose card has ≥1 `activate` choice; dropping there opens the existing `DropConfirmDialog` with the activate choice(s). (2) Broad cancel: any drag-drop that resolves to a single `activate` choice — including a spell dropped on an S/T field zone, which today commits instantly — now opens `DropConfirmDialog` instead of dispatching. Non-activate single-choice drops (summon/set) keep immediate dispatch. (3) `activate` chips are filtered out of the pointer hover surfaces for hand cards (card hover chips + `HandZoomOverlay`) but kept in the pinned (keyboard-opened) menu.
- Out of scope here: no chip re-anchoring CSS (T2 finished that), no selection-prompt styling (that is T6), never edit `feedback.md` or any `feedback*.md`. Field-card (non-hand) activate chips are unchanged. The single-activate keyboard path (`activateCard` direct dispatch) is unchanged. Do not touch `placementZoneCandidates` or `dropChoicesForZone` signatures/behaviour.
- Assumptions in force:
  - T2 is merged: `CardActionChips` is a card-mounted, bottom-anchored stack; its component API (`choices`, `layout`, `dataCyScope`) and the `.card-action-chips` class names are unchanged; the duplicate pinned-hand-row bug is fixed. This ticket only changes *which choices* flow into that component for hand cards, never the component itself.
  - Zone availability is gated on activate-choice EXISTENCE only — never on zone occupancy or `placementZoneCandidates`. A full backrow must not kill activation (red-team occupancy hole).
  - Confirming an activation-zone drop dispatches `chooseChoice` without arming `onplacementintent` — the engine's follow-up `SELECT_PLACE` prompt (if any) is answered by the player on the field. Arming a placement intent with `p0:hand` would be wrong. (Decision made here; see Interface contract.)
  - Test gates for this ticket: `npm run check:headless` and `npm run test:component` green (plan A11). E2E is updated for correctness but is not the merge gate.

## Requirements

- R1: While a drag of a `p0:hand` card is active AND that card has at least one choice with `action === "activate"` in the live `cardAction` spec, a drop zone element with `data-cy="hand-activation-drop-zone"` and class `duel-hand-activation-zone` is mounted, positioned at the left end of the hand band, vertically centered with the hand, with a dashed border and a centered "Activate" label. It unmounts the moment the drag ends or is cancelled.
- R2: The zone mounts regardless of board occupancy. With all five `p0:spellTrap` zones occupied it still mounts.
- R3: Releasing the drag over that zone opens `DropConfirmDialog` carrying exactly the card's `activate` choices (1 or more), the card, and the player's hand zone view. Nothing is dispatched and no placement intent is armed until the player answers.
- R4: Confirming an activation-zone drop dispatches exactly one `chooseChoice` with the chosen choice id and does NOT call `onplacementintent`. Cancelling (Cancel button, Escape, backdrop click — all already wired in `DropConfirmDialog`) sets the held drop to null, dispatches nothing, arms nothing; the drag ghost has already sprung the card home behind the modal.
- R5 (broad cancel, plan A5): a drop on a regular candidate zone whose `dropChoicesForZone` result is exactly one choice with `action === "activate"` opens `DropConfirmDialog` (with that one choice and the real zone) instead of dispatching immediately. On confirm, `onplacementintent(zone.id)` fires followed by the `chooseChoice` dispatch — the same pair the old immediate path sent. Non-activate single-choice drops keep the existing immediate dispatch.
- R6 (chip removal, plan A6): for hand cards, `activate` choices are filtered out of the choices passed to the card-mounted `CardActionChips` while the card is NOT the pinned menu target, and always filtered out of the choices passed to `HandZoomOverlay`. When the card IS the pinned menu target (`session.menuTarget`, reached by keyboard Enter on a multi-action hand card), the full unfiltered list is passed, so keyboard users still reach activate. The filter lives in exactly one exported function used by both call sites.
- R7: keyboard single-activate path unchanged: `activateCard` with one choice still dispatches `chooseChoice` directly (`DuelField.svelte`, the `case "cardAction"` branch with `choices.length === 1`).
- R8: a prompt replacement while the activation-zone confirm dialog is open closes it without dispatching (existing `cancelDragGhostOnPromptChange` already nulls `dropConfirm`; must keep working for the new source).
- R9: every new HTML element carries a unique kebab-case `data-cy`; `tests/unit/data-cy-coverage.test.ts` (a static scan of Svelte files) must pass.

## Inputs

- `src/battle/app/components/DuelField.svelte` — drag state (`dragCard`, `dropCandidates`, `ghost*` at ~lines 177–200), `dropConfirm` state (~line 225), `startCardDrag` (~line 574, gated `spec.kind === "cardAction"` + `card.zoneId === "p0:hand"`), `endCardDrag` (~line 825: NaN coords = cancelled; hit test via `zoneIdAtPoint`; 1 choice → immediate `onplacementintent` + `chooseChoice`; >1 → `dropConfirm`), `cancelDragGhostOnPromptChange` (~line 646, nulls `dropConfirm`), `activateCard` (~line 460, keyboard single-choice direct dispatch), the `HandZoomOverlay` render block (~line 1155, `choices={spec?.cardChoices.get(handZoom.card.targetId) ?? []}`), the `DropConfirmDialog` render block (~line 1173, `onconfirm` calls `onplacementintent(confirmed.zone.id)` then dispatch), markup `.duel-field-stage` containing `<FieldBoard/>` then `<PhaseStrip/>` (~line 1085).
- `src/battle/app/components/duel-field/HandBand.svelte` — per-card `CardControl` props, notably `choices={spec?.cardChoices.get(card.targetId) ?? []}` and `pinnedTarget` (prop `pinnedTarget: BoardTargetId | null`, compared per card as `pinned={pinnedTarget === card.targetId}` is done in `CardControl` via the `pinned` prop it receives).
- `src/battle/app/components/duel-field/CardControl.svelte` — pointer handlers (8px threshold, `buildDragOrigin`), renders `CardActionChips` when `actionable && choices.length > 0`. Not edited.
- `src/battle/app/components/duel-field/HandZoomOverlay.svelte` — takes `choices` prop, renders scoped `CardActionChips` (`dataCyScope="hand-zoom-overlay"`). Not edited.
- `src/battle/app/components/duel-field/DropConfirmDialog.svelte` — props `card`, `zone`, `choices`, `disabled`, `onconfirm`, `oncancel`. Not edited.
- `src/battle/app/prompts/interaction-spec.ts` — `InteractionChoice` (`{ id: ChoiceId; label: string; action: ChoiceAction; … }`), `ActiveInteractionSpec`.
- `src/battle/app/prompts/drop-target.ts` — `dropChoicesForZone(zone, choices)`, S/T preference `["activate", "setSpellTrap"]`. Not edited.
- `src/battle/field/placement-candidates.ts` — occupancy-filtered halo candidates. Not edited.
- `src/battle/field/duel-field-geometry.ts` — `FieldRenderLayout.zones: ReadonlyMap<PhysicalZoneId, FieldPlacement>`; `p0:hand` placement is stored center-addressed: `x = geometry.width / 2`, `y = rowY[hand row]`, `width = geometry.width - 2 * geometry.margin`, `height = geometry.box`. `FieldPlacement = { x, y, width, height }`.
- `src/styles/app.css` — `.duel-field-hand-band` (~line 2223: `position: absolute; left/top: var(--field-x/-y); transform: translate(-50%,-50%); z-index: var(--duel-field-layer-menu)`), `.duel-field-zone.is-drop-candidate` green halo (~line 1416), `.drop-confirm-backdrop` (~line 1480).
- `src/styles/tokens.css` — layer tokens: `--duel-field-layer-menu: 100`, `--duel-field-layer-drag-ghost: 150`, `--duel-field-layer-drop-confirm: 160`.
- `tests/component/DuelField.test.ts` — helpers `renderDraggableHand(options)` (~line 4447; options `occupiedZoneId`, `singleChoice`, `spellChoices`, `reducedMotion`, `imageLibrary`; injectable `hitTest` via `setHit`), `startHandDrag()` (~4583), `dropAt(harness, element)` (~4590), `dropConfirmDialog()` (~4546), `zoneElement(id)` (~4600), `clickHandCard()` (~4568), `handZoomOverlay()` (~4578), `handChoice(id, label, overrides)` (~4401), `HAND_CARD_ID`; existing drag/modal tests at ~2032–2330.
- `tests/component/HandBand.test.ts` — `renderBand(props)` (~line 77), `handCard(player, sequence)` (~line 37), spec-cast pattern at ~line 182 (`{ kind: "cardAction", cardChoices: new Map(...), … } as unknown as ActiveInteractionSpec`).
- `tests/unit/data-cy-coverage.test.ts` — static Svelte scan; literal `data-cy` on the new elements is sufficient.
- `e2e/duel-smoke.spec.ts` — `locateDraggablePlacement` walker with the activate-chip DOM probe at ~lines 2097–2130; `setHandMonsterWithKeyboard` at ~lines 4162–4210.
- **From Depends (T2):** card-mounted `CardActionChips` stack with unchanged API: props `cardId: string`, `cardLabel: string`, `layout: "row" | "stack"` (default `"row"`), `dataCyScope: string` (default `""`), `choices: readonly InteractionChoice[]`, `disabled`, `onchoose`, `ondismiss`; `data-cy` scheme `${scope}card-action-chips-${cardId}` / `${scope}card-action-chip-${choice.id}`; class names `.card-action-chips` unchanged; chips are mounted whenever the card is actionable with `choices.length > 0` and are revealed by CSS on hover/focus/pin. This ticket changes only the `choices` arrays flowing in for hand cards.

## Interface contract (level 5)

**Produces — new module `src/battle/app/prompts/hand-activation-choices.ts`:**

```ts
import type { InteractionChoice } from "./interaction-spec.ts";

/** The subset of a card's choices that activate its effect from the hand. */
export function activateChoices(
  choices: readonly InteractionChoice[],
): readonly InteractionChoice[];
// = choices.filter((choice) => choice.action === "activate")

/**
 * Item 4: the choices a hand card's pointer chip surfaces may show. Activation
 * is answered by the drag-to-zone gesture, so `activate` is hidden from the
 * hover chips and the zoom overlay — but the pinned (keyboard-opened) menu
 * keeps the full list, or a keyboard user could never reach activate on a
 * multi-action hand card. One function feeds both surfaces so they never drift.
 */
export function handChipChoices(
  choices: readonly InteractionChoice[],
  pinned: boolean,
): readonly InteractionChoice[];
// = pinned ? choices : choices.filter((choice) => choice.action !== "activate")
```

**Produces — DOM contract (DuelField.svelte):**

```html
<!-- Mounted iff dragCard !== null AND activateChoices(spec.cardChoices.get(dragCard.targetId) ?? []).length > 0.
     Sibling of <FieldBoard/> inside .duel-field-stage (position: relative), so
     it shares the board's coordinate space and sits outside the board's
     overflow-hidden stacking context. -->
<div
  class="duel-hand-activation-zone"
  data-cy="hand-activation-drop-zone"
  style="--field-x: {bandLeft}px; --field-y: {handCenterY}px; --field-width: {w}px; --field-height: {h}px;"
>
  <span class="duel-hand-activation-zone__label" data-cy="hand-activation-drop-zone-label">Activate</span>
</div>
```

Position values, computed by a new private fn in `DuelField.svelte`:

```ts
function handActivationZoneStyle(layout: FieldRenderLayout): string {
  const placement = layout.zones.get("p0:hand");
  if (placement === undefined) return "display: none;";
  const height = placement.height;                       // one zone box tall = hand height
  const width = Math.round(height * 1.5);                // 1.5 boxes wide: an easy target
  const left = placement.x - placement.width / 2;        // band's left edge (placement is center-addressed)
  return `--field-x: ${left}px; --field-y: ${placement.y}px; --field-width: ${width}px; --field-height: ${height}px;`;
}
```

CSS (append to `src/styles/app.css` near the drag/drop block at ~line 1416):

```css
/* Item 4: the drag-to-activate target. Mounted only mid-drag, at the left end
   of the hand band, vertically centered on the hand row. It must catch the
   release hit test, so it never gets pointer-events: none — the drag's pointer
   capture keeps it from swallowing anything else. Availability is a fact about
   the card's choices, never about zone occupancy. */
.duel-hand-activation-zone {
  position: absolute;
  left: var(--field-x);
  top: var(--field-y);
  z-index: var(--duel-field-layer-menu);
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--field-width);
  height: var(--field-height);
  transform: translate(0, -50%);
  border: 2px dashed var(--success);
  border-radius: 8px;
  background: color-mix(in srgb, var(--legal) 12%, transparent);
}

.duel-hand-activation-zone__label {
  color: var(--success);
  font-size: 0.75rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  pointer-events: none;
}
```

**Produces — widened internal state (DuelField.svelte, private):**

```ts
let dropConfirm: {
  readonly card: BoardCardView;
  readonly zone: BoardZoneView;
  readonly choices: readonly InteractionChoice[];
  /* "zone": a field-zone drop — confirm arms onplacementintent(zone.id).
     "handActivation": the dashed zone — confirm dispatches only, no intent. */
  readonly source: "zone" | "handActivation";
} | null = null;
```

`DropConfirmDialog` `onconfirm` handler becomes:

```ts
onconfirm={(choice) => {
  const confirmed = dropConfirm;
  dropConfirm = null;
  if (confirmed === null) return;
  if (confirmed.source === "zone") onplacementintent(confirmed.zone.id);
  dispatch({ type: "chooseChoice", choiceId: choice.id });
}}
```

**Produces — endCardDrag drop resolution (replaces the `if (!cancelled) { … }` body's inner logic):**

```ts
if (!cancelled) {
  const hit = hitTest(x, y);
  const overActivationZone =
    hit !== null &&
    hit.closest('[data-cy="hand-activation-drop-zone"]') !== null;
  const cardChoices = spec.cardChoices.get(card.targetId) ?? [];
  const activation = activateChoices(cardChoices);
  if (overActivationZone && activation.length > 0) {
    const handZone = board.zones.find((value) => value.id === "p0:hand");
    if (handZone !== undefined)
      dropConfirm = {
        card,
        zone: handZone,
        choices: activation,
        source: "handActivation",
      };
    /* target stays null → the ghost springs the card home behind the modal */
  } else {
    const zoneId = zoneIdAtPoint(x, y);
    if (zoneId !== null && candidates.has(zoneId)) {
      const zone = board.zones.find((value) => value.id === zoneId);
      const choices =
        zone === undefined ? [] : dropChoicesForZone(zone, cardChoices);
      /* Item 4 broad cancel: an activation is always a question — even alone.
         Summon/set stay a statement and commit on release as before. */
      const needsConfirm =
        choices.length > 1 ||
        (choices.length === 1 && choices[0]!.action === "activate");
      if (zone !== undefined && needsConfirm)
        dropConfirm = { card, zone, choices, source: "zone" };
      else if (zone !== undefined && choices.length === 1) {
        onplacementintent(zone.id);
        dispatch({ type: "chooseChoice", choiceId: choices[0]!.id });
        /* …existing settle-target rect read, unchanged… */
      }
    }
  }
}
```

**Consumes (binding, unchanged):**

- `dropChoicesForZone(zone: BoardZoneView, choices: readonly InteractionChoice[]): readonly InteractionChoice[]` — S/T preference order `["activate", "setSpellTrap"]` (`src/battle/app/prompts/drop-target.ts:38`).
- `DropConfirmDialog` props: `card: BoardCardView; zone: BoardZoneView; choices: readonly InteractionChoice[]; disabled: boolean; onconfirm: (choice: InteractionChoice) => void; oncancel: () => void`. Buttons: `data-cy="drop-confirm-action-${choice.id}"`, `data-cy="drop-confirm-cancel"`; Escape and backdrop click call `oncancel`.
- `CardActionChips` API from T2 (see Inputs → From Depends). Not edited.
- `InteractionChoice.action: ChoiceAction` where `"activate"` is the activation action id.

**Errors:** none new. `layout.zones.get("p0:hand") === undefined` → zone renders `display: none;` (zero-geometry board). `board.zones` missing `p0:hand` at drop time → no `dropConfirm`, drag ends as a miss (card springs home) — same as today's `zone === undefined` path.

**Invariants:**

- The dashed zone's mount condition reads ONLY `dragCard` and the spec's choices — never `dropCandidates`, never occupancy.
- While `dropConfirm !== null`: zero dispatches, zero placement intents. Cancel restores the exact pre-drag state.
- `source === "handActivation"` never calls `onplacementintent`. `source === "zone"` calls it exactly once, on confirm, with `zone.id`.
- A drop is resolved against the activation zone FIRST (it overlaps the band area; the hit element decides), then against `zoneIdAtPoint`.
- `cancelDragGhostOnPromptChange` nulls `dropConfirm` on prompt replacement — both sources.
- `handChipChoices` is referentially transparent; called from exactly two render sites (HandBand per-card, DuelField overlay), both importing the one function.
- Filtering never touches `spec.cardChoices` itself: `activateCard`, `startCardDrag`, `endCardDrag` keep reading the unfiltered map.

**Integration links:** none — this slice stays inside the main-thread Svelte field. Dispatch trigger `DuelField.svelte` `dispatch()` → existing `oninteraction` seam → observe: component-test `vi.fn` call args (`{ type: "chooseChoice", choiceId }`), asserted in the Test plan.

## TDD

1. **Red** — add the unit tests for `hand-activation-choices.ts` and the DuelField/HandBand component tests named below; run `npm run test:component` and the unit runner, watch them fail (module and zone missing).
2. **Green** — create the module, wire DuelField (zone element + endCardDrag + dropConfirm source + overlay filter), wire HandBand filter, add CSS.
3. **Refactor** — only if `endCardDrag` grows unreadable; keep every listed test green.

## Test plan

Run: `npm run test:component` (component), `npm run check:headless` (types/lint/unit/data-cy/boundaries).

| Test | Input | Expect |
| ---- | ----- | ------ |
| `tests/unit/hand-activation-choices.test.ts` › "activateChoices keeps only activate actions" | list with actions `activate`, `setSpellTrap`, `summon` | returns only the `activate` entry, original order |
| same file › "handChipChoices hides activate while unpinned" | same list, `pinned: false` | `activate` absent, others present, order kept |
| same file › "handChipChoices keeps the full list for the pinned menu" | same list, `pinned: true` | identical array contents |
| DuelField › "dragging an activatable hand card mounts the dashed activation zone" | `renderDraggableHand({ spellChoices: true })`; `startHandDrag()` | `document.querySelector('[data-cy="hand-activation-drop-zone"]')` not null; `harness.dispatch` not called |
| DuelField › "a drag with no activate choice mounts no activation zone" | `renderDraggableHand()` (summon+setMonster); `startHandDrag()` | selector returns null |
| DuelField › "the activation zone survives a fully occupied backrow" | `renderDraggableHand({ spellChoices: true, occupiedZoneIds: ["p0:spellTrap:0"…"p0:spellTrap:4"] })` (new option, see 4.1); `startHandDrag()` | zone element present; `candidateZoneIds()` contains no `p0:spellTrap:*` |
| DuelField › "dropping on the activation zone asks before activating" | spellChoices; `dropAt(harness, activationZoneElement())` | `dropConfirmDialog()` not null; action buttons texts `["Activate"]`; `dispatch` and `onplacementintent` not called |
| DuelField › "confirming an activation drop dispatches activate without a placement intent" | continue previous; click `[data-cy="drop-confirm-action-activate"]` | `dispatch` called once with `{ type: "chooseChoice", choiceId: "activate" }`; `onplacementintent` never called; dialog gone |
| DuelField › "cancelling an activation drop returns the card with nothing sent" | spellChoices; drop on activation zone; click `[data-cy="drop-confirm-cancel"]` | dialog gone; `dispatch` and `onplacementintent` not called |
| DuelField › "a single-activate backrow drop opens the confirm dialog instead of committing" | `renderDraggableHand({ activateOnly: true })` (new option, see 4.1); `dropAt(harness, zoneElement("p0:spellTrap:2"))` | dialog with `["Activate"]`; nothing dispatched; then click `drop-confirm-action-activate` → `onplacementintent` `[["p0:spellTrap:2"]]`, one `chooseChoice` |
| DuelField › "a single summon drop still commits immediately" (existing "a single-action drop dispatches immediately", unchanged) | `singleChoice: true`; drop on `p0:mainMonster:3` | no dialog; intent + dispatch fired — regression guard for the broad-cancel edit |
| DuelField › "hand hover chips omit activate; the pinned menu keeps it" | spellChoices; assert card-mounted chips: `[data-cy="card-action-chip-setspelltrap"]` present, `[data-cy="card-action-chip-activate"]` absent; then `rerender({ session: { ...createInteractionSession(spec), menuTarget: \`card:${HAND_CARD_ID}\` } })` | after rerender `[data-cy="card-action-chip-activate"]` present |
| DuelField › "the hand zoom overlay never offers an activate chip" | spellChoices; `clickHandCard()` | overlay mounted; `[data-cy="hand-zoom-overlay-card-action-chip-setspelltrap"]` present; `hand-zoom-overlay-card-action-chip-activate` absent |
| HandBand › "filters activate from an unpinned card's chips and restores it when pinned" | `renderBand` with spec-cast `cardChoices: new Map([[card.targetId, [{ id: "activate", label: "Activate", action: "activate" }, { id: "setmonster", label: "Set", action: "setMonster" }]]])`, `pinnedTarget: null`, then rerender `pinnedTarget: card.targetId` | unpinned: chip `card-action-chip-activate` absent, `card-action-chip-setmonster` present; pinned: both present |
| data-cy coverage (`npm run check:headless`) | static scan | new `div`/`span` pass — both carry literal `data-cy` |

Component-test helper for the zone element (add beside `dropConfirmDialog()` in `DuelField.test.ts`):

```ts
function activationZoneElement(): HTMLElement {
  const zone = document.querySelector<HTMLElement>(
    '[data-cy="hand-activation-drop-zone"]',
  );
  if (zone === null) throw new Error("Missing hand activation drop zone");
  return zone;
}
```

`dropAt(harness, activationZoneElement())` works as-is: the harness's injected `hitTest` returns the element and `endCardDrag` resolves it via `closest('[data-cy="hand-activation-drop-zone"]')`.

`HandZoomOverlay.test.ts`: no edits — the overlay's API and behaviour are untouched; the filter runs at the DuelField call site and is proven by the DuelField overlay test above. (The plan brief listed this file; recording the deviation here instead of adding a vacuous test.)

## Impl steps

- [x] 1. Filter module + unit tests
  - [x] 1.1 Create `src/battle/app/prompts/hand-activation-choices.ts` with exactly the two exported functions from the Interface contract (`activateChoices`, `handChipChoices`), bodies as given in the contract comments, importing `InteractionChoice` from `./interaction-spec.ts`.
  - [x] 1.2 Create `tests/unit/hand-activation-choices.test.ts` with the three unit tests from the Test plan, importing from `../../src/battle/app/prompts/hand-activation-choices.ts`; build choices inline as `{ id: choiceId("activate"), label: "Activate", action: "activate" }` etc. using `choiceId` from `../../src/battle/duel/contracts/ids.ts` (pattern: `tests/unit/drop-target.test.ts`).
- [x] 2. DuelField: dashed activation zone
  - [x] 2.1 In `src/battle/app/components/DuelField.svelte` script imports, add `import { activateChoices, handChipChoices } from "../prompts/hand-activation-choices.ts";`.
  - [x] 2.2 Below the `$: actionBarVisible` reactive block, add `$: dragActivateChoices = dragCard === null || spec === null ? [] : activateChoices(spec.cardChoices.get(dragCard.targetId) ?? []);`.
  - [x] 2.3 Add the private fn `handActivationZoneStyle(layout: FieldRenderLayout): string` exactly as written in the Interface contract, next to `measuredRenderLayout`.
  - [x] 2.4 In the markup, inside `.duel-field-stage`, between `<FieldBoard … />` and `<PhaseStrip … />`, add the zone block guarded by `{#if dragCard !== null && dragActivateChoices.length > 0}` with the exact element/`data-cy` shape from the Interface contract, `style={handActivationZoneStyle(renderLayout)}`.
- [x] 3. DuelField: drop resolution + confirm source
  - [x] 3.1 Widen the `dropConfirm` state declaration with `readonly source: "zone" | "handActivation";` per the Interface contract (keep the existing comment, extend it with the source meaning).
  - [x] 3.2 Replace the drop-resolution body inside `endCardDrag`'s `if (!cancelled) { … }` with the contract's version: activation-zone hit checked first via `hitTest(x, y)` + `closest('[data-cy="hand-activation-drop-zone"]')`, then the existing zone path with the `needsConfirm` broad-cancel condition; both `dropConfirm` assignments carry `source`. Keep the existing settle-target rect read inside the immediate-dispatch branch byte-identical.
  - [x] 3.3 Update the `DropConfirmDialog` `onconfirm` handler to gate `onplacementintent(confirmed.zone.id)` on `confirmed.source === "zone"` (exact handler in the Interface contract).
- [x] 4. DuelField component tests
  - [x] 4.1 In `tests/component/DuelField.test.ts`, extend `renderDraggableHand` options with `readonly activateOnly?: boolean;` (choices: `[handChoice("activate", "Activate The Legendary Fisherman", { action: "activate" })]`) and `readonly occupiedZoneIds?: readonly string[];` (generalises `occupiedZoneId`: map each id to an occupant card `{ ...occupant, id: \`drag-occupant-${index}\`, targetId: \`card:drag-occupant-${index}\`, zoneId }`; keep `occupiedZoneId` working by folding it into the list).
  - [x] 4.2 Add the `activationZoneElement()` helper (code above) beside `dropConfirmDialog()`.
  - [x] 4.3 Add the eight new DuelField tests from the Test plan in the drag/modal region (after the existing "Escape cancels the modal" block), using `renderDraggableHand`, `startHandDrag`, `dropAt`, `clickHandCard`, `activationZoneElement`, `dropConfirmDialog`.
- [x] 5. Chip filtering on both hand surfaces
  - [x] 5.1 In `src/battle/app/components/duel-field/HandBand.svelte`, add `import { handChipChoices } from "../../prompts/hand-activation-choices.ts";`. The component already declares `export let pinnedTarget: BoardTargetId | null = null;` (line 29) and passes `pinned={pinnedTarget === card.targetId}` to `CardControl` (line 104). Change only the per-card choices prop from `choices={spec?.cardChoices.get(card.targetId) ?? []}` to `choices={handChipChoices(spec?.cardChoices.get(card.targetId) ?? [], pinnedTarget === card.targetId)}`.
  - [x] 5.2 In `DuelField.svelte`, change the `HandZoomOverlay` prop to `choices={handChipChoices(spec?.cardChoices.get(handZoom.card.targetId) ?? [], false)}` — the overlay is a pointer surface, always filtered.
  - [x] 5.3 Add the HandBand component test from the Test plan to `tests/component/HandBand.test.ts` (spec-cast pattern from line ~182, with real `action` fields).
- [x] 6. CSS
  - [x] 6.1 Append the `.duel-hand-activation-zone` + `__label` rules from the Interface contract to `src/styles/app.css`, directly after the `.duel-field-zone.is-drop-candidate` block (~line 1434), comment included.
- [x] 7. E2E updates (`e2e/duel-smoke.spec.ts`)
  - [x] 7.1 In `locateDraggablePlacement` (~2097–2130): the sibling-activate-chip DOM probe is dead — unpinned hand cards no longer mount an activate chip. Replace the `if (placement.action === "setSpellTrap" && (await chip.evaluate(…activate chip…)))` skip with a probe drag: read the chip's card id, locate `[data-cy="field-card-target-${cardId}"]`, `boundingBox()`, `mouse.move(center)`, `mouse.down()`, `mouse.move(center.x + 24, center.y - 24, { steps: 3 })` (clears the 8px threshold), then `const offersActivate = (await page.locator('[data-cy="hand-activation-drop-zone"]').count()) > 0;`, then `mouse.move(8, 8)` + `mouse.up()` (release over no zone = harmless cancel, nothing dispatched). Skip the candidate when `placement.action === "setSpellTrap" && offersActivate` — the drop would now open the confirm dialog and break the one-gesture-one-response assertions.
  - [x] 7.2 In `setHandMonsterWithKeyboard` (~4162–4210): the chip count no longer equals the choice count (a `[activate, setMonster]` hand card shows one chip but pins on Enter instead of dispatching). Merge the two branches: `if (chipButtonCount === 0) continue;` `if ((await chips.locator(MONSTER_SET_CHIP).count()) === 0) continue;` `await keyboardActivate(page, opener);` then poll `await expect(async () => { const visible = await chips.isVisible(); const pinned = visible && (await chips.evaluate((el) => el.contains(document.activeElement))); expect(!visible || pinned).toBe(true); }).toPass();`; if `!(await chips.isVisible())` → the single real choice dispatched → `return true;`; otherwise fall into the existing arrow-walk-to-`MONSTER_SET_CHIP`-and-Enter code (previously the `> 1` branch), unchanged.
  - [x] 7.3 Add one new e2e test after "dragging a hand card onto a highlighted zone plays it": `test("dragging an activatable hand card into the dashed zone asks and can cancel", …)` — walk hand cards with a probe drag (as 7.1) for one where the zone mounts; if none, `test.skip(true, "opening hand offers no activatable effect")`; else drag the card over `[data-cy="hand-activation-drop-zone"]` (via its `boundingBox()` center), `mouse.up()`, `await expect(page.locator('[data-cy="drop-confirm-dialog"]')).toBeVisible()`, assert a `[data-cy^="drop-confirm-action-"]` button exists, click `[data-cy="drop-confirm-cancel"]`, assert the dialog is gone and the captured `respond` command count is unchanged (reuse the `readCapture(page)` before/after pattern from the existing drag test). Cancel-only: the duel state stays untouched, so the test is seed-safe.
- [x] 8. Checklist + gates
  - [x] 8.1 Append to `artifacts/manual_test_checklist.md` under the duel-field section: "Drag a hand card with an activatable effect — a dashed 'Activate' box appears at the left end of your hand; drop the card on it → a confirm dialog offers Activate + Cancel; Cancel returns the card with nothing played; confirm activates. Hovering the same card shows no Activate chip; keyboard Enter on it still opens a menu containing Activate."
  - [x] 8.2 Run `npm run test:component` — all green.
  - [x] 8.3 Run `npm run check:headless` — all green (types, ESLint boundary zones, unit incl. data-cy coverage + domain boundaries).

## Outputs

- New: `src/battle/app/prompts/hand-activation-choices.ts`, `tests/unit/hand-activation-choices.test.ts`.
- Edited: `src/battle/app/components/DuelField.svelte` (zone element + style fn, `dragActivateChoices`, `dropConfirm.source`, `endCardDrag` resolution, overlay choices filter), `src/battle/app/components/duel-field/HandBand.svelte` (chip filter only; `pinnedTarget` prop already exists), `src/styles/app.css` (zone rules), `tests/component/DuelField.test.ts`, `tests/component/HandBand.test.ts`, `e2e/duel-smoke.spec.ts`, `artifacts/manual_test_checklist.md`.
- Behavior change: drag-to-activate zone; every activate-resolving drop confirms before committing; hand hover/zoom surfaces stop offering activate chips (keyboard pinned menu keeps them). No public module API of any domain widens; `tests/unit/domain-boundaries.test.ts` untouched.
- No migrations, no config.

## Validation

- [x] `npm run test:component` → exit 0, including the 9 new/updated DuelField tests and 1 new HandBand test.
- [x] `npm run check:headless` → exit 0 (tsc, eslint, unit suite with `hand-activation-choices.test.ts`, `data-cy-coverage.test.ts`, `domain-boundaries.test.ts`).
- [ ] Manual (Chromium, `npm run dev`): follow the new `artifacts/manual_test_checklist.md` entry; also verify the dashed zone does NOT appear when dragging a monster with only summon/set, and DOES appear with a full backrow.
- [x] No silent-failure swallow added: the only tolerated no-op paths are `layout.zones.get("p0:hand") === undefined → display: none` and `board.zones` missing `p0:hand` → drop resolves as a miss; both are pre-existing zero-geometry/miss conventions in `DuelField.svelte`, listed here on purpose. No `|| true`, no empty catch, no output redirection added.
- [x] App functional: a drag with no activate choice behaves byte-identically to before (guarded by the retained "single summon drop commits immediately" test).
- [x] Commit msg draft: `feat(duel): drag-to-activate zone beside the hand with confirm/cancel, hide hand activate chips (#4)`

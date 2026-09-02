# T6: Selected hand card escapes the viewport like a hovered one

**Plan:** `./artifacts/PLAN_2026_09_02_duel_field_feedback.md`
**Depends:** T5 (same clip region; arc/headroom must be final before overlay geometry is tuned)
**Commit outcome:** A hand card selected in a prompt renders enlarged over the duel field via the fixed-position overlay path, exactly like a hovered card, halo unclipped.

## Context (self-contained)

- Goal: owner feedback `feedback.md` § Duel Field item 1 — selected hand card cannot overflow; make it like hover: over the actual field.
- This slice: drive the hand zoom overlay (or equivalent fixed escape) from selection state, not only pointer hover.
- Out of scope here: fan math (T5), selection lifecycle (T7 — orthogonal: T7 decides WHEN selection shows; this ticket decides HOW a shown selection renders).
- Assumptions in force: red-team finding — nothing inside `.duel-field-hand-band__viewport` can escape `overflow-y: hidden` whatever its z-index (`app.css:2335` comment); the only escape is the `position: fixed` `HandZoomOverlay` (`app.css:1671-1674`) mounted outside the band (`DuelField.svelte:1407`), which already accepts a `selected` prop (`HandZoomOverlay.svelte:101`).

## Requirements

- Hand card whose `targetId ∈ selectedTargets` and zone is a hand zone → overlay shown over the field for that card with `selected` styling (orange halo, `app.css:1744-1750` treatment on the overlay art), regardless of pointer position.
- Hover overlay behavior unchanged; hover on a different card wins over a passive selected display (pointer intent beats state display) — selected overlay re-appears when hover ends.
- Multiple selected hand cards (multi-select prompts): overlay serves the most recently selected one; the in-band cards keep their (clipped) halo as secondary cue.
- Keyboard path: pinned card (`pinnedHandTarget`, `DuelField.svelte:951-958`) already routes through the overlay for keyboard — do not regress it.

## Inputs

- **From T5:** band headroom CSS only — T5 touches `HandBand.svelte` math (`--hand-card-height` now emitted on band root) + viewport padding; it does NOT change `HandZoomOverlay` props or clamp math (those are as on trunk, tested in `tests/component/HandZoomOverlay.test.ts`).
- `DuelField.svelte`: `handZoom` state driving overlay (`:1407-1427`), `selectedTargets` (`:283-286`), `withPinnedHandTarget` (`:951-958`).
- `HandZoomOverlay.svelte`: props incl. `selected`; `is-zoom-served` chip suppression `app.css:2652-2659`.

## Interface contract (level 5)

- **Produces:**
  - `DuelField.svelte` derived value (exact shape):
    ```ts
    $: selectedHandCard = latestSelectedHandCard(board, selectedTargets, handZoom);
    // returns BoardCardView | null: null when a hover/pin zoom is active (hover wins),
    // else the most recently toggled selected hand card of player 0
    ```
    Overlay mount renders when `handZoom !== null || selectedHandCard !== null`, feeding `HandZoomOverlay` with `selected={true}` in the selection-driven case.
  - Recency: track order via `session.selectedChoiceIds` insertion order (it is an ordered array in `interaction-session.ts` — verify; if a Set, derive recency by diffing previous value in a small helper, unit-tested).
  - `HandZoomOverlay` gains selected-halo styling on its art container: reuse `.is-selected` class contract.
- **Consumes:** `selectedTargets: ReadonlySet<BoardTargetId>` (T7 may gate what's inside it — consume as-is); `BoardCardView`; overlay props as they exist post-T5.
- **Errors:** none.
- **Invariants:** overlay never reveals a concealed card (hand cards of player 0 always have `code` — opponent hand never enters `selectedTargets` as selectable hand target; assert defensively: only player 0 hand zone ids qualify).
- **Integration links:** trigger click selecting hand card → dispatch session `toggleChoice` → receive `selectedTargets` recompute (`DuelField.svelte:283`) → observe `[data-cy="hand-zoom-overlay"]`-equivalent visible with `is-selected` while pointer is elsewhere.

## TDD

1. **Red** — component test on DuelField: cardSelection spec with hand choice, select via click, move pointer away → overlay present with selected class; hover other card → hover card served; unhover → selected card served again.
2. **Green** — derived state + overlay wiring.
3. **Refactor** — keep green.

## Test plan

| Test | Input | Expect |
| ---- | ----- | ------ |
| component DuelField | select hand card, no hover | overlay shows that card, selected halo |
| component DuelField | selected + hover other | overlay shows hovered card |
| component DuelField | deselect | overlay gone |
| component DuelField | multi-select 2 cards | overlay shows most recent |
| component HandZoomOverlay | `selected: true` | halo class on art |
| e2e | selection prompt | overlay over field zone rect, unclipped |

## Impl steps

- [ ] 1. Verify `selectedChoiceIds` container type (array vs set) → recency helper accordingly.
- [ ] 2. Red tests.
- [ ] 3. `latestSelectedHandCard` helper + overlay mount condition + selected styling.

## Validation

- [ ] `npm run check:headless`; component gate (NOT in check:headless): `npx vitest run tests/component/DuelField.test.ts tests/component/HandZoomOverlay.test.ts`
- [ ] manual check: tribute/cost selection over hand — selected card floats over field
- [ ] silent-failure sites: none
- [ ] app functional
- [ ] commit msg draft: `feat(duel-field): selected hand cards float over the field like hovered ones`

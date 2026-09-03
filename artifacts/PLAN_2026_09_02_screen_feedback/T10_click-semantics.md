# T10: Align click, double-click and removal semantics

**Plan:** `./artifacts/PLAN_2026_09_02_screen_feedback.md`  
**Depends:** T9  
**Commit outcome:** Single click pins preview, hover peeks, double-click adds/removes, main removal deletes instead of sideboarding.

## Context (self-contained)

Goal: DB6/DB7. Existing intent logic is centralized in `layout/click-intent.ts`; editor also tracks selected/hovered preview. Out of scope: drag/drop and context-menu explicit move actions.

## Requirements

R1. Catalog single click selects and pins card preview; double-click adds to canonical zone or selected sideboard target.
R2. Deck-zone single click selects/pins; double-click removes from deck entirely.
R3. Main-deck double-click never auto-moves to side.
R4. Hover temporarily displays hovered card; pointer leave restores pinned selection.
R5. Duplicate browser click events from `dblclick` must not add/remove twice.
R6. Touch tap-menu behavior remains unchanged where double-click unavailable.

## Inputs

I1. Read `DeckEditor.svelte` click/tap/hover methods, `layout/click-intent.ts`, `CardTile.svelte`, `DeckWorkspace.svelte`, interaction tests.
I2. From T9: current header/sort mutation shape.

## Interface contract (level 5)

P1. Preview derivation: `previewCard = hovered ?? selected`; `selected` persists after `mouseleave`.
P2. Pointer action contract: `click` only selects; `dblclick` calls one mutation and suppresses paired single-click mutation (selection may remain).
P3. Catalog mutation: `{ type:"add", cardCode, zone: toSideboard ? "side" : card.canonicalZone }`.
P4. Deck mutation: `{ type:"remove", cardCode, zone, index }`; never emits move-to-side for double-click.
E1. Add blocked by ownership/copy/zone limits uses existing warning toast/announcement; removal impossible index is existing no-op/error contract.
N1. One double-click = at most one deck history entry.

## TDD

1. **Red** — pointer event sequence tests, soft-pin restoration, main removal/delete, touch regression.
2. **Green** — adjust click-intent and event handlers.
3. **Refactor** — remove obsolete click-to-side logic only.

## Test plan

| Test | Input | Expect |
| --- | --- | --- |
| Catalog click | card A | preview pins A, deck unchanged |
| Hover B then leave | A pinned | preview B then A |
| Catalog dblclick | A | one copy added |
| Main dblclick | existing A | removed; side unchanged |
| Touch tap | tile | existing target menu behavior |

## Impl steps

- [ ] 1. Add failing intent/component tests.
- [ ] 2. Separate select from dblclick mutation.
- [ ] 3. Make removal delete from source zone; retain explicit context moves.
- [ ] 4. Verify soft-pin preview priority.

## Validation

- [ ] `npx vitest run tests/component/deck-editor tests/unit/deck-editor/click-intent.test.ts`
- [ ] `npm run typecheck && npm run lint`
- [ ] Manual: click/hover/dblclick catalog + every zone; test touch emulation.
- [ ] No silent-failure swallow: blocked mutations surface existing warning.
- [ ] App functional: drag/drop/context/tap remain functional.
- [ ] Commit msg draft: `fix(deck-editor): make pointer gestures predictable`

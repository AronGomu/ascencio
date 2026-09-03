# T11: Apply small deck-editor polish

**Plan:** `./artifacts/PLAN_2026_09_02_screen_feedback.md`  
**Depends:** T10  
**Commit outcome:** Unlimited cards lose redundant 3 badge, catalog breathes, side deck starts collapsed.

## Context (self-contained)

Goal: DB1, DB2, DB8. Out of scope: legality borders (T12). All changes presentation/default-state only.

## Requirements

R1. `CardTile` renders limit badge only for 0, 1, 2; accessible label still says current limit/copies.
R2. Add visible margin between `deck-catalog-filters` and `deck-catalog-results-region`, including active-filter summary/notice states.
R3. Side deck collapsed on initial editor mount; main/extra expanded.
R4. User toggle still expands/collapses side; deck changes do not unexpectedly reset current collapse state unless component remounts.

## Inputs

I1. Read `CardTile.svelte`, `CardCatalog.svelte`, `DeckWorkspace.svelte`, related component tests.
I2. From T10: current editor interaction handlers.

## Interface contract (level 5)

P1. Limit badge DOM exists iff `limit < 3`; values/text unchanged for 0/1/2.
P2. Initial `collapsedZones = { main:false, extra:false, side:true }`.
P3. Results spacing uses existing spacing tokens; no fixed viewport units.
E1. None.
N1. Hidden visual badge does not hide limit from card `aria-label`.

## TDD

1. **Red** — badge threshold, initial side collapse, spacing class/layout tests.
2. **Green** — three surgical changes.
3. **Refactor** — none unless dead selector created.

## Test plan

| Test | Input | Expect |
| --- | --- | --- |
| Limit 3 | catalog tile | no badge, aria label says maximum 3 |
| Limit 0/1/2 | tile | matching badge visible |
| Workspace mount | deck with side cards | side content collapsed |
| Toggle side | click header | content visible |

## Impl steps

- [ ] 1. Add red component tests.
- [ ] 2. Conditionalize limit badge.
- [ ] 3. Add catalog spacing using token.
- [ ] 4. Flip side initial collapse only.

## Validation

- [ ] `npx vitest run tests/component/deck-editor`
- [ ] `npx vitest run tests/unit/data-cy-coverage.test.ts`
- [ ] `npm run typecheck && npm run lint`
- [ ] Manual: catalog 0–3 limits, filter states, side expand/collapse.
- [ ] No silent-failure swallow added: none.
- [ ] App functional: card selection/add remains functional.
- [ ] Commit msg draft: `style(deck-editor): remove redundant chrome`

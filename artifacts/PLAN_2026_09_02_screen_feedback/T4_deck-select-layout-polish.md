# T4: Polish deck-select layout

**Plan:** `./artifacts/PLAN_2026_09_02_screen_feedback.md`  
**Depends:** T3  
**Commit outcome:** Result count sits by filter, Create copy is clean, sparse grids grow tiles without giant single tiles.

## Context (self-contained)

Goal: DS2, DS3, DS6. Out of scope: tile contents (T2), bundled behavior (T5). Assumption: tile cap ~420px.

## Requirements

R1. Remove count from title cluster; render `${shown.length}/${tiles.length}` immediately right of filter input in full + compact layouts.
R2. Rename both `+ Create` strings (live + sizing probe) to `Create`.
R3. Use CSS grid `auto-fit/minmax` so sparse deck sets grow; cap tile at ~420px; center unused row width.
R4. Dense grid and mobile layout retain no horizontal overflow.
R5. Resize measurement/probe logic remains stable after count/Create movement.

## Inputs

I1. Read all `DeckSelectScreen.svelte` titlebar/filter/grid/probe markup and CSS; `mobile-layout.test.ts`, `deck-select-screen.test.ts`.
I2. From T3: same component includes hover float; do not regress it.

## Interface contract (level 5)

P1. Count text stays `${shown.length}/${tiles.length}` and retains one unique `data-cy="deck-select-count"` beside `data-cy="deck-select-filter"`.
P2. Create control text exactly `Create`; accessible name exactly `Create`.
P3. Grid declaration uses `repeat(auto-fit, minmax(min(100%, <minimum>), 1fr))`; child max-width `420px`; sparse row centered.
E1. Zero results still reads `0/{total}` and existing empty state remains.
N1. No JS deck-count size tiers.

## TDD

1. **Red** — DOM-order/copy tests + sparse/dense layout assertions.
2. **Green** — markup/CSS/probe edits.
3. **Refactor** — remove obsolete title-count CSS only.

## Test plan

| Test | Input | Expect |
| --- | --- | --- |
| Filter | 2 shown / 8 total | `2/8` adjacent after input |
| Create | desktop + compact | `Create`, never `+ Create` |
| Sparse | 1–4 tiles | larger centered tiles, max 420px |
| Dense/mobile | many tiles | wrapping, no x-overflow |

## Impl steps

- [ ] 1. Add failing component/layout tests.
- [ ] 2. Move count, update probes, rename Create.
- [ ] 3. Apply auto-fit/cap CSS; verify responsive branches.

## Validation

- [ ] `npx vitest run tests/component/deck-select/deck-select-screen.test.ts tests/component/deck-select/mobile-layout.test.ts`
- [ ] `npx vitest run tests/unit/data-cy-coverage.test.ts`
- [ ] `npm run typecheck && npm run lint`
- [ ] Manual: 1, 2, 4, 20 decks at desktop/mobile widths.
- [ ] No silent-failure swallow added: none.
- [ ] App functional: filter/sort/create still work.
- [ ] Commit msg draft: `style(deck-select): give sparse libraries room to breathe`

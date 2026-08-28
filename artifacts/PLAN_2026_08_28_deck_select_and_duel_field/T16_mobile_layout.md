# T16: Mobile layout

**Plan:** `./artifacts/PLAN_2026_08_28_deck_select_and_duel_field.md`
**Depends:** T15
**Commit outcome:** `DeckSelectScreen` renders the phone layout — single column, opponent card under header, selected deck pinned first, sticky Start-only footer, permanent ⇄ badge. Component-tested. No app screen consumes yet.

## Context (self-contained)

- Goal: implement validated deck-selection design (`docs/deck-selection-screen-design.md` §Mobile layout) in shared lib `src/deck-select/`.
- This slice: responsive variant of the T14+T15 screen. One component, CSS + one list transform — no separate mobile component.
- Out of scope here: hover previews (T17 — desktop-only), consumers, real device testing (Chromium viewport only per plan assumption).
- Assumptions in force: T14/T15 `DeckSelectScreen` props incl. `seat`, `opponent`, `opponentDeck`, `playerDeck`, `selectedKey`, `canStart`, `startLabel`; grid uses `orderDeckTiles`; product = Chromium PWA family.

## Requirements

- Breakpoint: narrow layout at container/viewport width `< 40rem` (design phone frame 430px). Wide = T14/T15 layout unchanged.
- Narrow layout order: header (back icon + eyebrow + title + count) → opponent card block → tools → one-column deck list → sticky footer.
  - Back icon button `data-cy="deck-select-back-icon"` appears in header on narrow (footer Back hidden there); fires `onback`. Wide keeps footer Back (both elements exist in DOM once each — icon hidden by CSS on wide; data-cy uniqueness holds because both always rendered exactly once).
  - Opponent block = same T15 markup relocated by CSS (`order`/grid areas), not duplicated. Portrait's `⇄` chip permanently visible on narrow (`@media (pointer: coarse), (max-width: 40rem)`) — no hover on phones.
  - Deck list: grid becomes one column.
  - **Pinned-first transform** (design §List ordering last ¶): currently selected deck for the active seat (`seat==="player" ? selectedKey : opponentDeck?.key`) moves to visible slot 1, ahead of default/favourite rank. Implement as pure fn in `src/deck-select/order-deck-tiles.ts`:

```ts
export function pinSelectedFirst(
  tiles: readonly DeckTileModel[],
  selectedKey: string | null,
): readonly DeckTileModel[];
```

  Applied only in narrow mode (screen tracks narrowness via one `matchMedia("(max-width: 40rem)")` listener; test override prop `export let forceNarrow: boolean | null = null` — null = follow media query; component tests set it).
  - Sticky footer narrow: only `deck-select-start` visible (design: footer's only job is Start; management lives on kebabs). Back/Delete/Rename/Duplicate/Open hidden by CSS. `library` mode narrow footer: nothing but Back icon in header → footer hidden entirely.
- Dblclick/double-tap open: `dblclick` already wired (T14) — browsers synthesize it for double-tap; nothing new.
- `pinSelectedFirst` exported from `src/deck-select/index.ts` → frozen boundary list widened.

## Inputs

- `src/deck-select/order-deck-tiles.ts`, `src/deck-select/DeckSelectScreen.svelte` (T14/T15).
- **From Depends:** T15 seat props (`seat`, `opponentDeck`); T14 footer data-cy names (`deck-select-start`, `deck-select-back`).

## TDD

1. **Red** — unit tests for `pinSelectedFirst`; component tests with `forceNarrow=true`; fail.
2. **Green** — implement.
3. **Refactor** — keep green.

## Test plan

| Test | Input | Expect |
| ---- | ----- | ------ |
| `pinSelectedFirst moves selection to slot 1` | ordered [k1,k2,k3], selected k3 | [k3,k1,k2] |
| `pinSelectedFirst no-op when selection absent or null` | selected "kX" / null | order unchanged, same-content array |
| `pinSelectedFirst result frozen, input untouched` | any | `Object.isFrozen`, input intact |
| `narrow pins active-seat selection first in DOM` | forceNarrow, selected k3 non-default | first grid tile is `deck-tile-k3` |
| `narrow opponent seat pins opponent pick` | forceNarrow, seat="opponent", opponentDeck k2 | first grid tile `deck-tile-k2` |
| `narrow shows back icon` | forceNarrow | `deck-select-back-icon` present, fires `onback` |
| `wide does not pin` | forceNarrow=false, selected k3 | rank order preserved |

Run: `npx vitest run tests/unit/deck-select tests/component/deck-select`

## Impl steps

- [x] 1. Write failing unit tests in `tests/unit/deck-select/order-deck-tiles.test.ts` (pin cases). — red: 3 × `TypeError: pinSelectedFirst is not a function`
- [x] 2. Write failing component tests in `tests/component/deck-select/mobile-layout.test.ts`. — red: 4 of 5 fail (pin order, back icon absent)
- [x] 3. Implement `pinSelectedFirst` in `src/deck-select/order-deck-tiles.ts`; export from index; widen frozen list in `tests/unit/domain-boundaries.test.ts`. — `domain-boundaries.test.ts` green with the widened list
- [x] 4. Add `forceNarrow` prop + `matchMedia` tracking to `DeckSelectScreen.svelte`; apply pin transform when narrow. — 4 pin/back-icon component tests green
- [x] 5. Add narrow CSS: single column, relocation of opponent block, sticky Start footer, back icon, permanent chip. — `@media (max-width: 40rem)` + `@media (pointer: coarse), (max-width: 40rem)` in `DeckSelectScreen.svelte`; svelte-check 0 errors, no unused-selector warning
- [x] 6. `npx vitest run tests/unit/deck-select tests/component/deck-select tests/unit/domain-boundaries.test.ts tests/unit/data-cy-coverage.test.ts` → green. — `Test Files  9 passed (9)` / `Tests  107 passed (107)`
- [x] 7. `npm run lint && npm run typecheck` → green. — eslint clean; `svelte-check found 0 errors and 2 warnings in 2 files` (both pre-existing, in `CardCatalog.svelte` and `ShopSellScreen.svelte`)

## Outputs

- New: `tests/component/deck-select/mobile-layout.test.ts`.
- Edited: `src/deck-select/order-deck-tiles.ts` (+`pinSelectedFirst`), `src/deck-select/DeckSelectScreen.svelte` (+`forceNarrow`), `src/deck-select/index.ts`, boundary test, unit test file.
- Public API: `pinSelectedFirst(tiles, selectedKey)`; screen prop `forceNarrow` — T20/T24 e2e rely on real media query, tests on the prop.

## Validation

- [x] `npx vitest run tests/unit/deck-select tests/component/deck-select tests/unit/domain-boundaries.test.ts tests/unit/data-cy-coverage.test.ts` green — `Tests  107 passed (107)`
- [x] `npm run lint && npm run typecheck && npm run build` green — `build:verify` `{"status": "ok", "snapshotId": "a562f5ad…"}`; also `npm run check:headless` (`1749 passed`) and `npm run test:component` (`1008 passed`)
- [x] app functional — no consumer yet — `grep -rn "DeckSelectScreen" src` outside `src/deck-select/` returns nothing, so no app screen mounts it
- [x] commit msg draft: `feat(deck-select): fold the screen into the phone layout with the pick pinned first`

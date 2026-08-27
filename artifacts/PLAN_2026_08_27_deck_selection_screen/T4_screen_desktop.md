# T4: DeckSelectScreen desktop layout

**Plan:** `./artifacts/PLAN_2026_08_27_deck_selection_screen.md`
**Depends:** T3
**Commit outcome:** `DeckSelectScreen.svelte` renders header/tools/grid/footer (left column of design's desktop layout), hosts kebab menu + dialogs state machine, keyboard shortcuts, dblclick-open. Component-tested. Right seat panel comes in T5; no app screen consumes yet.

## Context (self-contained)

- Goal: implement validated deck-selection design (`docs/deck-selection-screen-design.md` §Two screens, one shell / §Desktop layout / §Keyboard & a11y) in shared lib `src/deck-select/`.
- This slice: screen skeleton + grid interaction. Serves both modes: `duel-start` (footer has Open + Start) and `library` (footer Back + Delete/Rename/Duplicate only).
- Out of scope here: right opponent/seat panel + opponent-seat picking (T5), mobile layout (T6), hover previews (T7), any data loading.
- Assumptions in force: T1 contracts (`DeckTileModel`, `DeckSort`, `orderDeckTiles`, `DeckSelectMode`); T2 `DeckTile` props `tile,halo,selected,yours,showFavourite,showMenu,disabled,onpress,ondblpress,onfavourite,onmenu`; T3 `DeckTileMenu` props `tile,anchor,onclose,onopen,onrename,onduplicate,ondelete`, `RenameDeckDialog` props `deckName,maxLength,oncancel,onsubmit`, `DeleteDeckConfirm` props `deckName,oncancel,onconfirm`.

## Requirements

- New `src/deck-select/DeckSelectScreen.svelte`. Props:

```ts
export let mode: DeckSelectMode;              // "duel-start" | "library"
export let eyebrow: string;                   // e.g. "Free play" / "Pre-battle briefing" / "Deck builder"
export let title: string;                     // e.g. "Choose your deck" / "Deck library"
export let tiles: readonly DeckTileModel[];   // unordered; screen orders + filters
export let sort: DeckSort = "modified";
export let selectedKey: string | null;        // active pick (duel-start) or focus (library)
export let startLabel = "Start the duel";
export let canStart = false;                  // duel-start only
export let blockNotice: string | null = null; // footer notice (story block reason etc.)
export let onselect: (key: string) => void = () => undefined;
export let onstart: () => void = () => undefined;
export let onback: () => void = () => undefined;
export let onopen: (key: string) => void = () => undefined;
export let onrename: (key: string, name: string) => void = () => undefined;
export let onduplicate: (key: string) => void = () => undefined;
export let ondelete: (key: string) => void = () => undefined;
export let onfavourite: (key: string, favourite: boolean) => void = () => undefined;
```

(T5 appends opponent props; T7 appends preview resolvers. Each ticket edits the frozen boundary list once.)

- Derived state: `filter` (internal string), `shown = orderDeckTiles(tiles.filter(name-includes-filter, case-insensitive), sort)`.
- Header: root `data-cy="deck-select-screen"`; eyebrow `deck-select-eyebrow`; `<h1 data-cy="deck-select-title">`; live count `data-cy="deck-select-count"` text exactly `` `${shown.length}/${tiles.length}` `` (design: `shown/total`).
- Tools row `deck-select-tools`: filter `<input type="search" data-cy="deck-select-filter">`; sort `<select data-cy="deck-select-sort">` options `modified` ("Last modified") / `name` ("Name").
- Grid `deck-select-grid`: `DeckTile` per shown tile. `selected = tile.key === selectedKey`. Halo: `"you"` on selected in duel-start, `"focus"` in library (T5 switches to `"opponent"` mid-opponent-pick). Press → `onselect(key)` (illegal tiles: DeckTile already disables press). Dblpress → `onopen(key)` (design: preceding single click already selected).
- Kebab state machine hosted here: `onmenu` from a tile stores `{key, anchor}` → renders `DeckTileMenu`; menu `onopen→onopen(key)`, `onrename→` open `RenameDeckDialog` (prefilled `tile.name`, submit → `onrename(key, name)`), `onduplicate→onduplicate(key)`, `ondelete→` open `DeleteDeckConfirm` (confirm → `ondelete(key)`).
- Footer `deck-select-footer`, left→right (design §Desktop layout):
  - `deck-select-back` "Back" → `onback`
  - management cluster (acts on `selectedKey`; disabled when null): `deck-select-delete` (also disabled when selected tile `!deletable`), `deck-select-rename`, `deck-select-duplicate` — same dialogs as kebab (two paths, one operation)
  - `duel-start` mode only: `deck-select-open` "Open" → `onopen(selectedKey)`; `deck-select-start` `{startLabel}` disabled `!canStart` → `onstart`
  - `blockNotice !== null` → `<p role="status" data-cy="deck-select-block-notice">{blockNotice}</p>`
- Keyboard (design §Keyboard & a11y), window-level handler active while screen mounted, inert while a dialog/menu open or focus inside `<input>/<select>`:
  - `/` → focus filter (preventDefault)
  - `ArrowUp`/`ArrowDown` → move `onselect` among **legal** tiles in shown order
  - `Enter` → duel-start: `onstart()` if `canStart`; library: `onopen(selectedKey)`
  - `f` → `onfavourite(selectedKey, !selected tile.favourite)`
- Layout: left column of the 16:9 two-column stage — header→tools→scrolling grid→footer; grid `repeat(auto-fill, minmax(16rem, 1fr))`. (Column split arrives with the panel in T5.)
- Every element unique role-describing `data-cy` (`tests/unit/data-cy-coverage.test.ts` enforces).

## Inputs

- `src/deck-select/index.ts` exports from T1-T3 (names quoted in Assumptions).
- Testing setup precedent: `tests/component/deck-editor/deck-library.test.ts`.
- **From Depends:** T3 component props quoted verbatim above.

## TDD

1. **Red** — `tests/component/deck-select/deck-select-screen.test.ts`; fails (component absent).
2. **Green** — implement, export, widen frozen list.
3. **Refactor** — keep green.

## Test plan

| Test | Input | Expect |
| ---- | ----- | ------ |
| `orders and filters tiles with live count` | 3 tiles (1 illegal), filter to 1 | grid order per rank fn, count text `1/3` |
| `press selects, dblclick opens` | click then dblclick tile k2 | `onselect("k2")`, `onopen("k2")` |
| `kebab flow reaches rename with new name` | open menu k1, Rename, type "Renamed", submit | `onrename("k1","Renamed")` |
| `kebab delete goes through confirm` | menu k1, Delete, confirm | `ondelete("k1")` only after confirm |
| `footer management disabled without selection` | `selectedKey=null` | delete/rename/duplicate disabled |
| `footer delete disabled for undeletable pick` | selected bundled tile | `deck-select-delete` disabled |
| `library mode hides Open and Start` | `mode="library"` | `deck-select-open`/`deck-select-start` absent |
| `start disabled until canStart` | `canStart=false→true` | disabled → enabled, click fires `onstart` |
| `slash focuses filter` | keydown "/" | filter input has focus |
| `arrows skip illegal decks` | tiles legal k1, illegal k2, legal k3; selected k1; ArrowDown | `onselect("k3")` |
| `f toggles favourite of selection` | selected unfavourited k1, keydown "f" | `onfavourite("k1", true)` |
| `block notice renders` | `blockNotice="No decks yet"` | role=status with text |

Run: `npx vitest run tests/component/deck-select/deck-select-screen.test.ts`

## Impl steps

- [ ] 1. Write failing `tests/component/deck-select/deck-select-screen.test.ts` (builder `tile()` reused from T2 tests — extract shared builder to `tests/component/deck-select/tile-builder.ts`).
- [ ] 2. Create `src/deck-select/DeckSelectScreen.svelte`: markup (header/tools/grid/footer), derived `shown`, menu+dialog state machine.
- [ ] 3. Add keyboard handler (`<svelte:window onkeydown>`), guard for open dialog/menu/input focus.
- [ ] 4. Styles: grid, footer, notice; reuse token vars.
- [ ] 5. Export `DeckSelectScreen`; extend frozen list in `tests/unit/domain-boundaries.test.ts`.
- [ ] 6. `npx vitest run tests/component/deck-select tests/unit/domain-boundaries.test.ts tests/unit/data-cy-coverage.test.ts` → green.
- [ ] 7. `npm run lint && npm run typecheck` → green.

## Outputs

- New: `src/deck-select/DeckSelectScreen.svelte`, `tests/component/deck-select/deck-select-screen.test.ts`, `tests/component/deck-select/tile-builder.ts`.
- Edited: `src/deck-select/index.ts`, `tests/unit/domain-boundaries.test.ts`, T2 test (builder import).
- Public API: `DeckSelectScreen` props above — T5/T6/T7 extend, T10/T12/T14 consume; all quote names verbatim.

## Validation

- [ ] `npx vitest run tests/component/deck-select tests/unit/domain-boundaries.test.ts tests/unit/data-cy-coverage.test.ts` green
- [ ] `npm run lint && npm run typecheck && npm run build` green
- [ ] app functional — no consumer yet
- [ ] commit msg draft: `feat(deck-select): compose the shared selection screen grid, footer and shortcuts`

# T22: Deck-editor library swap

**Plan:** `./artifacts/PLAN_2026_08_28_deck_select_and_duel_field.md`
**Depends:** T17
**Commit outcome:** The deck-editor library route (`#/free-play/decks`, `#/story/decks`) renders the shared `DeckSelectScreen` in `library` mode — tile grid, docked decklist panel, kebab management, teal focus halo — replacing the old row list inside `DeckLibrary.svelte`. Create/Import/Collection tools preserved. Component + e2e tests green.

## Context (self-contained)

- Goal: implement validated deck-selection design (`docs/deck-selection-screen-design.md` §Two screens, one shell — Library row of the table, §Desktop hover previews — Library) — library shares tile/shell grammar with duel start; grid press focuses (no seat), footer Back · Delete/Rename/Duplicate, dblclick opens.
- This slice: deck-editor domain swap. Independent of the free-play swap (T20/T21 touch shell; this touches `src/deck-editor/`).
- Out of scope here: free-play/story duel-start screens, editor page itself (`DeckEditor.svelte` untouched), YDK import/export modals (kept as-is, still hosted by `DeckEditorApp.svelte`).
- Assumptions in force: `src/deck-select/index.ts` (T11-T17) exports `DeckSelectScreen` (props: `mode,eyebrow,title,tiles,sort,selectedKey,blockNotice,manageable,decklistFor,cardImageFor,onselect,onback,onopen,onrename,onduplicate,ondelete,onfavourite`, plus duel-start-only props left at defaults) and type `DeckTileModel`; deck-editor may import it (T11 registered the boundary zone). Editor store (`src/deck-editor/deck-editor-store.ts`) already has by-id ops `duplicate(id)`, `deleteDeck(id, revision)`, `toggleFavourite(id)`, `setDefaultDeck(id)`; `rename(name)` works only on the opened deck.

## Requirements

- Store: add `renameDeck(id: DeckId, name: string): Promise<void>` to `src/deck-editor/deck-editor-store.ts` — library-context rename by id. Same queue/`normalizeDeckName`/message pattern as `rename(name)` (~line 421) but loads the record by id: `#repository.load(id)` → save with new name → `#refreshLibrary()` (find the exact private refresh used by `duplicate`; mirror it). Invalid name → same message path as `rename`.
- Rewrite `src/deck-editor/components/DeckLibrary.svelte` to host `DeckSelectScreen`:
  - Keep file name and every existing prop (`decks,message,oncreate,onopen,onimport,oncollection,defaultDeckId,favouriteDeckIds,onfavourite`) so `DeckEditorApp.svelte` (~line 329) wiring survives; add `onrename: (id: DeckId, name: string) => void`, `onduplicate: (id: DeckId) => void`, `ondelete: (id: DeckId, revision: number) => void`, `onback: () => void`, `catalog: ReadonlyMap<number, DeckBuilderCardView>` (for tiles/cover/decklists — `DeckEditorApp` already holds `catalog`; pass it through).
  - Map `DeckRecord` → `DeckTileModel` in new `src/deck-editor/components/deck-library-tiles.ts` (pure, tested):
    - `key = record.id`, `name`, counts from list lengths, cover code `record.extra[0] ?? record.main[0] ?? null` → `catalog.get(code)?.imageUrl ?? null`.
    - `legal = record.validation.status !== "errors"`; `blockReason`/`meta` for illegal rows: reuse the existing `illegalLabel(validation)` logic (move it into this module verbatim — "Cards not owned" vs "Illegal" distinction per ADR-050); legal rows `meta = "Updated " + new Date(updatedAt).toLocaleString()`.
    - `bundled=false`, `lockedBy=null`, `deletable=true`, `favourite`/`isDefault` from props, `updatedAt` passthrough.
  - Screen usage: `mode="library"`, `eyebrow="Deck builder"`, `title="Deck library"`, `manageable=true`, internal `selectedKey` (focus only, teal halo — screen does this in library mode per T14/T15), `onopen(key)` → existing `onopen(id)` prop (navigates to deck page), `onselect` → local focus, `decklistFor(key)` → find record, map codes via catalog names; `cardImageFor(code)` → `catalog.get(code)?.imageUrl ?? null`.
  - Tools that the shared screen lacks stay as a toolbar row above/beside it: Create deck (dialog — keep existing create dialog markup + `data-cy` names `deck-library-create*`), Import (`onimport`), Collection (`oncollection`), message strip (`deck-library-message`). Filter/sort now come from the shared screen — delete the old local search/sort controls (`deck-library-search-input`, `deck-library-sort-select`) and update every test that used them (`git grep -ln "deck-library-search\|deck-library-sort" tests/ e2e/`).
  - Old row-list markup (`deck-library-list`, `deck-library-row-*`, `deck-library-open-*`, halo classes) deleted; grid tiles carry `deck-tile-${id}` from the shared component.
  - Empty states: keep `deck-library-empty` (no decks → create CTA); no-matches state now the shared screen's empty grid + count `0/N`.
- `DeckEditorApp.svelte`: pass `catalog`, wire `onrename={(id, name) => void controller?.renameDeck(id, name)}`, `onduplicate={(id) => void controller?.duplicate(id)}`, `ondelete={(id, revision) => void controller?.deleteDeck(id, revision)}`, `onback` → existing route-back the host already exposes for the library context (find the current back/exit affordance in `DeckEditorApp.svelte`/`AppShell.svelte`; if none exists for the library screen, `onback` navigates home via a new optional prop `onexit` wired in AppShell to `store.navigate(HOME_ROUTE)`).
  - Delete needs `revision`: `deck-library-tiles.ts` exposes `deckRevision(decks, id)` or the callback closes over `decks` to look it up — decide: callback in `DeckLibrary.svelte` looks up `decks.find(d => d.id === key)!.revision` and calls `ondelete(id, revision)`.
- Update tests: `tests/component/deck-editor/deck-library.test.ts`, `deck-library-order.test.ts`, `deck-library-toolbar.test.ts`, `deck-favourites.test.ts`, `default-deck.test.ts`, `deck-page-actions.test.ts` (whichever touch removed selectors — `git grep -ln "deck-library-" tests/component/deck-editor/`), and `e2e/deck-editor.spec.ts`.

## Inputs

- `src/deck-editor/components/DeckLibrary.svelte` — current impl (tools, create dialog, `illegalLabel`, halo rows) to port/replace.
- `src/deck-editor/DeckEditorApp.svelte` ~line 329 — mount site; `catalog` variable in scope.
- `src/deck-editor/deck-editor-store.ts` — `rename` (~421), `duplicate` (~452), `deleteDeck` (~500), `toggleFavourite` (~517), `#refreshLibrary` pattern.
- `src/decks/deck-contracts.ts` — `DeckRecord` fields (`id,name,main,extra,side,updatedAt,revision,validation`).
- **From Depends (T17):** `DeckSelectScreen` + `DeckTileModel` + resolvers from `src/deck-select/index.ts`; library mode = teal focus halo, docked decklist panel, card-art float — all inside the screen already.

## TDD

1. **Red** — `tests/unit/deck-editor/deck-library-tiles.test.ts` + store test for `renameDeck` + updated component tests; fail.
2. **Green** — implement.
3. **Refactor** — keep green.

## Test plan

| Test | Input | Expect |
| ---- | ----- | ------ |
| `record maps to tile with cover from first extra` | record extra [111], main [222] | coverImageUrl = catalog url of 111 |
| `errors record maps illegal with ownership-aware label` | validation errors all `not-owned` | `legal=false`, meta/blockReason "Cards not owned" |
| `renameDeck renames without opening the deck` | seeded store, `renameDeck(id, "New")` | library state shows "New", current editor deck unchanged |
| `renameDeck invalid name posts message` | empty name | state message set, record untouched |
| `library renders tiles and focuses on press` | 2 records | `deck-tile-${id}` present; press → teal focus halo, no navigation |
| `dblclick opens the deck` | dblclick tile | `onopen(id)` called |
| `kebab rename/duplicate/delete reach store callbacks` | via menu + dialogs | `onrename(id,"X")`, `onduplicate(id)`, `ondelete(id, revision)` |
| `create dialog still creates` | open dialog, submit name | `oncreate(name)` |
| `e2e deck-editor` | full library flow via new selectors | green |

Run: `npx vitest run tests/unit/deck-editor tests/component/deck-editor && npx playwright test e2e/deck-editor.spec.ts`

## Impl steps

- [x] 1. Write failing `tests/unit/deck-editor/deck-library-tiles.test.ts`.
- [x] 2. Write failing store test for `renameDeck` (beside existing store tests — `git grep -ln "deck-editor-store" tests/`).
- [x] 3. Implement `renameDeck` in `deck-editor-store.ts`; implement `src/deck-editor/components/deck-library-tiles.ts`.
- [x] 4. Rewrite `DeckLibrary.svelte` hosting `DeckSelectScreen` per Requirements.
- [x] 5. Wire new props in `DeckEditorApp.svelte` (+ AppShell `onexit` only if no back affordance exists).
- [x] 6. Update every test/e2e touching removed selectors (`git grep -ln "deck-library-" tests/ e2e/`).
- [x] 7. `npx vitest run tests/unit tests/component` → green; `npx playwright test e2e/deck-editor.spec.ts` → green.
- [x] 8. `npm run lint && npm run typecheck && npm run build` → green.

## Outputs

- New: `src/deck-editor/components/deck-library-tiles.ts`, `tests/unit/deck-editor/deck-library-tiles.test.ts`.
- Edited: `src/deck-editor/components/DeckLibrary.svelte` (rewritten), `src/deck-editor/DeckEditorApp.svelte`, `src/deck-editor/deck-editor-store.ts` (+`renameDeck`), component/e2e tests.
- Public API: none cross-domain (deck-editor internals + its existing entry untouched).

## Validation

- [x] `npx vitest run tests/unit tests/component` green — unit 1761 passed, component 1026 passed
- [x] `npx playwright test e2e/deck-editor.spec.ts` green — 13 passed; also admin-console 4, story-duel 8, duel-smoke `-g "a local deck"` 2
- [x] `npm run lint && npm run typecheck && npm run build` green — svelte-check 0 errors, build:verify status ok
- [ ] manual: `#/free-play/decks` shows tile grid, docked decklist on hover, rename/duplicate/delete work, create/import/collection intact — owner-run, not agent-verifiable
- [x] commit msg draft: `feat(deck-editor): run the library on the shared deck-selection grid`

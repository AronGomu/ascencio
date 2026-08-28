# T20: Free-play duel start swap

**Plan:** `./artifacts/PLAN_2026_08_28_deck_select_and_duel_field.md`
**Depends:** T17, T18, T19
**Commit outcome:** `#/free-play` renders the new `DeckSelectScreen` — grid pick, opponent personas, seat toggling, favourites, keyboard, start — replacing the two-`<select>` UI. `FreePlayDeckSeat.svelte` deleted. Component tests + e2e updated and green. Management ops (rename/duplicate/delete/open) land in T21.

## Context (self-contained)

- Goal: implement validated deck-selection design (`docs/deck-selection-screen-design.md`) — this slice swaps the free-play duel-start screen onto the shared component.
- This slice: read + pick + start path only. Management (rename/duplicate/delete) is T21; dead buttons in between are not acceptable, so this ticket adds one screen prop `export let manageable = true;` to `DeckSelectScreen` — `false` hides every kebab and the footer management cluster. Free play passes `manageable=false` in this commit; T21 flips it to `true` and wires the ops. `onopen` IS wired now (deck-editor route already exists via `ondecks`).
- Out of scope here: rename/duplicate/delete wiring (T21), library/story swaps.
- Assumptions in force: T18 `SelectableDeck` has `lists` + `updatedAt`; T19 roster + settings API; free play never lists illegal local decks (`listSelectableDecks` drops them — design agrees); presets favouritable via settings.

## Requirements

- Keep `FreePlayMatchSetup.svelte` file name + props (`settings`, `loadBattle`, `onstart`, `onback`, `ondecks`) so `src/shell/AppShell.svelte` wiring (dynamic import ~line 560) stays; rewrite internals to host `DeckSelectScreen`.
- Data flow on mount (preserve existing pattern: cached listing first, then revalidate):
  1. `freePlayBattleModule(loadBattle)` + `listedFreePlayDecks() ?? presetSelectableDecks(...)` then `refreshFreePlayDecks(loadBattle)` — as today (`src/shell/screens/free-play-deck-listing.ts`).
  2. Catalog for names/art: `catalogByCode(await runtimeCatalog())` (`src/decks/catalog/runtime-catalog.ts`, `src/decks/catalog/pinned-ruleset.ts` — shell may import decks modules; decks is the shared library).
  3. Library flags: open `IndexedDbDeckRepository`, read `listFavourites()` + `getDefaultDeck()`, close (pattern: `loadFreePlayDecks` in `free-play-deck-listing.ts`). Failure → empty favourites/null default, screen still works.
- Mapping `SelectableDeck` → `DeckTileModel` in new module `src/shell/screens/free-play-deck-tiles.ts` (pure, tested):

```ts
export function freePlayDeckTile(
  deck: SelectableDeck,
  context: Readonly<{
    catalog: ReadonlyMap<number, DeckBuilderCardView>;
    favouriteDeckIds: readonly string[];      // repository favourites (local DeckId strings)
    presetFavouriteIds: readonly string[];    // settings favourites (full preset keys)
    defaultDeckId: string | null;             // repository default (local DeckId)
    aiOwnerByDeckKey: ReadonlyMap<string, string>; // deckKey -> persona name, from FREE_PLAY_OPPONENTS
  }>,
): DeckTileModel;
```

  - `key` = `deck.key`; `name` = `deck.label`; `counts` from `deck.lists` lengths.
  - cover code = `deck.lists.extra[0] ?? deck.lists.main[0] ?? null`; `coverImageUrl = catalog.get(code)?.imageUrl ?? null`.
  - `legal: true`, `blockReason: null` (illegal locals never listed in free play).
  - `bundled = deck.source === "preset"`; `meta` = `bundled ? "Bundled" : `Updated ${new Date(deck.updatedAt).toLocaleDateString()}``.
  - `lockedBy = aiOwnerByDeckKey.get(deck.key) ?? null`; `deletable = deck.source === "local"` (T21 uses it; this commit passes tiles through with `deletable:false` override at call site — see Context resolution).
  - `favourite`: preset → `presetFavouriteIds.includes(deck.key)`; local → `favouriteDeckIds.includes(<deckId part of key>)` (key format `local:${deckId}:${revision}` — split on `:` from index 1 to length-2 is wrong for ids containing `:`? `deckId` charset forbids `\0` only — ids come from `crypto.randomUUID()` style; check one real creation site `git grep -n "deckId(" src/deck-editor | head` before assuming; if ambiguous, match by prefix `local:${favId}:`).
  - `isDefault` = local && deckId part === `defaultDeckId`; `updatedAt` passthrough.
- Screen wiring in rewritten `FreePlayMatchSetup.svelte`:
  - `mode="duel-start"`, `eyebrow="Free play"`, `title="Choose your deck"`, `manageable=false` (this commit).
  - `seat` state local; `selectedKey`/`opponentDeckKey` seeded like today's `adoptDecks` (remembered `settings.freePlayPairing`, fallback defaults `preset:${DEFAULT_PLAYER_DECK_ID}` / persona deck), revalidated per listing exactly per current `seatKey` logic — port that fn.
  - Opponent: `freePlayOpponent($settings.freePlayOpponentId ?? DEFAULT_FREE_PLAY_OPPONENT_ID)` → `OpponentView {id,name,line,locked:false}`; `opponents` = all three mapped. `onpickopponent(id)` → `settings.rememberFreePlayOpponent(id)` + set opponent pick to persona `deckKey` (design: picking an AI brings its deck along) + `seat="player"`.
  - `onselect(key)`: seat==="player" → player pick; else opponent pick (one-duel override of persona deck), then stay in opponent seat until card toggled back (design: press card again to return).
  - `onfavourite(key, fav)`: preset → `settings.setPresetDeckFavourite(key, fav)`; local → open repository, `setFavourite(deckId, fav)`, close, refresh flags.
  - `decklistFor(key)` → find deck, map `lists` codes → `DecklistRow{code, name: catalog.get(code)?.name ?? String(code)}`; `cardImageFor(code)` → `catalog.get(code)?.imageUrl ?? null`.
  - `onstart` = today's `start()` verbatim (find both, `parseBattleRequest`, `rememberFreePlayPairing`, `onstart(request)`); `startError` → `blockNotice`.
  - `onopen(key)` + `onback` → `ondecks()` / `onback()` as today.
- Delete `src/shell/screens/FreePlayDeckSeat.svelte` (sole consumer was this screen); remove its data-cy references everywhere (`git grep -n "free-play-match-.*seat\|free-play-match-.*picker"`).
- Update `tests/component/FreePlayMatchSetup.test.ts` to the new surface (keep its load/error/remembered-pairing behaviors; interactions now via `deck-tile-*`). Update `e2e/duel-smoke.spec.ts` (and any other spec using `free-play-match-*` selectors: `git grep -ln "free-play-match" e2e/`) to select via `deck-tile-${key}` + `deck-select-start`.
- `manageable` prop: add to `DeckSelectScreen` + component test (`manageable=false hides kebab and management cluster`); no frozen-list change (prop only).

## Inputs

- `src/shell/screens/FreePlayMatchSetup.svelte` — current logic to port: `adoptDecks`, `seatKey`, `start`, load/error states.
- `src/shell/screens/free-play-deck-listing.ts` — `freePlayBattleModule`, `listedFreePlayDecks`, `refreshFreePlayDecks`, `resetFreePlayDeckCacheForTests`.
- `src/shell/AppShell.svelte` ~line 560 — dynamic import + props (unchanged).
- **From T17:** `DeckSelectScreen` props `mode,eyebrow,title,tiles,sort,selectedKey,startLabel,canStart,blockNotice,opponent,opponents,opponentDeck,playerDeck,seat,onseat,onpickopponent,decklistFor,cardImageFor,onselect,onstart,onback,onopen,onfavourite,forceNarrow` from `src/deck-select/index.ts`.
- **From T18:** `SelectableDeck.lists` + `.updatedAt`; cover rule `lists.extra[0] ?? lists.main[0] ?? null`.
- **From T19:** `FREE_PLAY_OPPONENTS`, `DEFAULT_FREE_PLAY_OPPONENT_ID`, `freePlayOpponent(id)` from `src/shell/screens/free-play-opponents.ts`; store methods `rememberFreePlayOpponent(id)`, `setPresetDeckFavourite(id, favourite)`; settings fields `freePlayOpponentId`, `freePlayPresetFavouriteIds`.

## TDD

1. **Red** — rewrite `tests/component/FreePlayMatchSetup.test.ts` against new surface + new `tests/unit/shell/free-play-deck-tiles.test.ts`; fail.
2. **Green** — implement mapping module + screen rewrite.
3. **Refactor** — keep green.

## Test plan

| Test | Input | Expect |
| ---- | ----- | ------ |
| `freePlayDeckTile maps preset` | shaddoll preset, aiOwner map has it | bundled=true, meta "Bundled", lockedBy "Vault Warden", cover from first extra |
| `freePlayDeckTile maps local` | local deck updatedAt X, favourited, default | meta contains date, favourite, isDefault |
| `screen renders tiles from cached listing then revalidates` | cached bundled-only, refresh adds local | local tile appears |
| `remembered pairing reselects` | settings pairing player preset:nekroz | `deck-tile-preset:nekroz` selected |
| `picking a persona brings its deck` | open picker, pick blaze-circuit | opponent deck tile = burning-abyss, `rememberFreePlayOpponent("blaze-circuit")` |
| `opponent seat override for one duel` | toggle opponent card, select preset:spellbook | opponent pick = spellbook, persona unchanged |
| `start builds request and remembers pairing` | both seats valid, press start | `onstart` with parsed request, pairing remembered |
| `vanished deck blocks with notice` | stale selected key | `deck-select-block-notice` text as today's error copy |
| `manageable=false hides kebab and cluster` (deck-select test) | prop false | no `deck-tile-menu-*`, no `deck-select-delete` |
| e2e `duel-smoke` | full flow via new selectors | duel starts |

Run: `npx vitest run tests/unit/shell tests/component/FreePlayMatchSetup.test.ts tests/component/deck-select && npx playwright test e2e/duel-smoke.spec.ts`

## Impl steps

- [x] 1. Add `manageable` prop + test to `DeckSelectScreen` (component test file from T14). — red first (`deck-tile-menu-k1` still rendered), then green; `tests/component/deck-select` 63 passed.
- [x] 2. Write failing `tests/unit/shell/free-play-deck-tiles.test.ts`. — red: `Cannot find module '../../../src/shell/screens/free-play-deck-tiles.ts'`.
- [x] 3. Create `src/shell/screens/free-play-deck-tiles.ts` (check local key deckId extraction against a real `deckId` creation site first). — checked `src/decks/deck-contracts.ts:3`: `deckId` forbids only `\0`, so a key cannot be parsed back apart; the id is read from `selection.deck.ref.deckId` instead. 5 passed.
- [x] 4. Rewrite `tests/component/FreePlayMatchSetup.test.ts` (red). — 11 failed against the old `<select>` surface before the screen was rewritten.
- [x] 5. Rewrite `src/shell/screens/FreePlayMatchSetup.svelte` per Requirements; delete `src/shell/screens/FreePlayDeckSeat.svelte`. — `git rm`'d; 17 passed.
- [x] 6. `git grep -ln "free-play-match" e2e/ tests/` → update every selector (`duel-smoke`, others found). — `duel-smoke`, `duel-portrait`, `AppShell.test.ts`; the grep now returns only `AppShell.svelte:570`, which is the chunk-load error label rather than a seat.
- [x] 7. `npx vitest run tests/unit tests/component` → green. — unit 1754 passed, component 1024 passed.
- [ ] 8. `npm run dev` + manual: pick decks, change opponent, start duel. — NOT RUN: needs a human at a browser. The same path is covered automatically by `duel-smoke` "the match setup persists a chosen pair" (pick both seats, start, reload, still seated) plus the persona-pick and one-duel-override component tests.
- [x] 9. `npx playwright test e2e/duel-smoke.spec.ts` → green. — 36 passed. 3 failures remain and are pre-existing: they reproduce identically on the clean baseline with these changes stashed, and all three are duel-field drag/hand-band tests unrelated to deck selection.
- [x] 10. `npm run lint && npm run typecheck && npm run build` → green. — lint clean, svelte-check 0 errors, `build:verify` status ok (shell chunk 93,007 B).

## Defect found and fixed during this slice

The seat cards were dead to a pointer in Chromium. `DeckSelectScreen` renders each
seat card as a wrapper `<button>` around a `DeckTile` marked `disabled`, and that
tile's own full-bleed press `<button>` is what the pointer actually lands on — a
disabled control neither fires a click nor lets one through, so the wrapper never
heard the press and the opponent seat could not be filled at all. jsdom does not
model this, so every component test passed while the real browser could not switch
seats. Fixed at the source with `.seat-card :global(.deck-tile) { pointer-events: none; }`;
the wrapper keeps both the click and the keyboard, and the tile inside has no
focusable children (`showFavourite={false}`, `showMenu={false}`). Pinned by
`duel-smoke` "the match setup persists a chosen pair", which dispatched
`bundled-v1:nekroz:vs:shaddoll` before the fix and the expected
`bundled-v1:burning-abyss:vs:nekroz` after.

## Outputs

- New: `src/shell/screens/free-play-deck-tiles.ts`, `tests/unit/shell/free-play-deck-tiles.test.ts`.
- Edited: `src/shell/screens/FreePlayMatchSetup.svelte` (rewritten), `src/deck-select/DeckSelectScreen.svelte` (+`manageable`), component/e2e tests.
- Deleted: `src/shell/screens/FreePlayDeckSeat.svelte`.
- Public API: `freePlayDeckTile` signature above — T21 reuses it and flips `manageable` to true.

## Validation

- [x] `npx vitest run tests/unit tests/component` green — unit 1754 passed, component 1024 passed
- [x] `npx playwright test e2e/duel-smoke.spec.ts` green — 36 passed; 3 pre-existing failures reproduced on the clean baseline
- [x] `npm run lint && npm run typecheck && npm run build` green
- [ ] manual: `#/free-play` → new screen, start works, opponent persona persists across reload — NOT RUN (needs a human at a browser); `duel-smoke` covers the equivalent path automatically
- [x] commit msg draft: `feat(shell): run free-play duel start on the shared deck-selection screen`

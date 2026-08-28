# T6b — Restore the catalog-ordering guarantee the F19 removal dropped (repair of `db91860`)

## Context

Commit `db91860` removed the unreachable `supportedCodes` gate (audit F19, issue #19). That part is correct
and stays. But it also removed this line from `listDecksOrBundledOnly` in `src/battle/app/App.svelte:950`:

```ts
      const supportedCodes = await supportedDuelCardCodes();
```

That await was doing a second, undocumented job: it made the listing wait on the `runtimeCatalog()` memo
before resolving local decks against `deckBuilderCatalog`. An independent review proved the ordering was not
incidental — `loadCatalog` registers its `.then` on the same memoised promise at mount
(`App.svelte:574`), so it always ran first and had assigned `deckBuilderCatalog` at `:579` by the time the
awaiting listing resumed:

```
$ node -e 'const P=Promise.resolve("catalog");let landed=false;
P.then(()=>{landed=true;console.log("cb1 (loadCatalog.then) ran, landed=",landed)});
(async()=>{await P;console.log("awaiting listing resumed, landed=",landed)})()'
cb1 (loadCatalog.then) ran, landed= true
awaiting listing resumed, landed= true
```

Post-commit the listing does only IndexedDB work, which finishes far inside the window of 129 digest-verified
shard fetches, so it now completes against the empty `Map` at `:160`.

### Finding 1 (should-fix) — permanently rewritten deck choice

A returning player whose `decks.playerKey` is `local:<id>:<rev>`, with the picker open while the catalog is
still in flight (story `duel-session` whose request could not be rebuilt, `src/shell/AppShell.svelte:66`–`:70`;
or a start the Worker refused, `App.svelte:1050`–`:1055`), presses Start. The key does not resolve against the
presets-only list → `:1107`–`:1109` re-lists → the listing completes with an empty catalog → every local deck
fails `resolveDeck` → `reconcilePersistedDeckKeys` raises `pickerFallbackNotice` (`:1013`) and writes the
bundled default to `localStorage` (`:1019`). Seconds later the catalog lands, the local deck reappears in the
list — but the selection is now a bundled deck, and the stale notice stays up because
`pickerFallbackNotice` is only ever set `true`. The original choice is not restored, in that session or any
later one. `changeDecks` (`:1136`–`:1141`) is the same path. This was impossible before `db91860`.

### Finding 2 (note) — starter deck seeded against an empty catalog

On the catalog-failure path (`:590` re-lists after `loadCatalog` rejects), the old code threw at the removed
await before `IndexedDbDeckRepository.open()` and wrote nothing. The new code reaches
`ensureStarterDeck(repository, new Map(), …)` and persists a `Starter Deck` record whose stored `validation`
is 40 × `missing-card` errors (`src/decks/deck-validation.ts:107`–`:118`), marked default; the later
catalog-backed call short-circuits at `src/decks/starter-deck.ts:47` and never repairs it. No wrong render
today — every reader recomputes validation (`src/decks/deck-resolver.ts:30`–`:41`,
`src/deck-editor/deck-editor-store.ts:108`,`:799`) — so this is wrong-data-at-rest.

## Requirements

- R1. `listDecksOrBundledOnly` waits for the catalog read before it opens the repository, restoring the
  pre-`db91860` ordering: when it resolves local decks, `deckBuilderCatalog` is populated whenever the catalog
  is going to land at all.
- R2. Do **not** reintroduce `supportedCodes`, `supportedDuelCardCodes`, the battle-index export, the frozen
  list entry, or the loader field. F19 stays fixed.
- R3. Catalog failure keeps its pre-`db91860` shape: the listing gives up before any write, so finding 2
  disappears with finding 1. Confirm the bundled-deck fallback still reaches the player on that path.
- R4. Replace the comment added at `:950`–`:952` — it currently documents the behaviour this ticket reverses.
  The new comment must say why the wait exists, so the next reader does not delete it again as a redundant
  await. That is the whole reason this repair is needed.
- R5. Nothing else from `db91860` is touched.

## Inputs

- `src/battle/app/App.svelte` — `:160` (empty catalog seed), `:574`–`:590` (`loadCatalog` and its re-list),
  `:912`–`:913` (preset seeding), `:933`–`:938` (generation guard, reconcile), `:950`–`:970`
  (`listDecksOrBundledOnly`), `:1013`/`:1019` (notice + persist), `:1050`–`:1055`, `:1107`–`:1109`, `:1136`–`:1141`
- `src/decks/catalog/runtime-catalog.ts` (`:225`–`:230` memo and its rejection behaviour)
- `src/decks/starter-deck.ts` (`:47`, `:78`–`:79`)
- `src/shell/AppShell.svelte` (`:66`–`:70`)
- `tests/component/AppLocalDecks.test.ts` (`:212`–`:231` covers but does not assert this)
- `git show db91860` — the commit being repaired

## TDD

Red first, component test, both cases currently pass wrongly:

- `a local deck choice survives a listing that runs while the catalog is still loading` — persisted
  `decks.playerKey` pointing at a local deck, catalog promise held unresolved, force the re-list path, assert
  `localStorage` still holds the local key and no fallback notice is raised; then resolve the catalog and
  assert the local deck is both listed and still selected.
- `a failed catalog seeds no starter deck` — catalog rejects, assert the repository received no write and the
  player still gets the bundled decks.

Both must fail against `db91860` and pass after the repair. Quote both failures.

## Test plan

- The two tests above.
- `npm run test:component`, `npm run test:unit`, `npm run check:headless` green.
- Confirm the F19 removal is still in force: `grep -rn "supportedCodes\|supportedDuelCardCodes" src/ tests/`
  stays empty.

## Impl steps

- [x] Write both failing tests against current HEAD. verify: both fail, quote the assertions
      → `AssertionError: expected 'preset:mvp-player' to be 'local:built-deck:1'`
      and `AssertionError: expected [ { schemaVersion: 1, …(10) } ] to deeply equal []`
- [x] Restore the ordering in `listDecksOrBundledOnly`. verify: both tests green
      → `await runtimeCatalog();` before `IndexedDbDeckRepository.open()`; 12/12 in the file
- [x] Rewrite the comment per R4. verify: diff
- [x] Re-check the catalog-failure path writes nothing. verify: second test green
      → `repository.list()` is `[]`, 6 preset options still offered
- [x] Confirm F19 stays fixed. verify: grep output empty
      → `grep -rn "supportedCodes\|supportedDuelCardCodes" src/ tests/` exit 1, no output

## Outputs

- Ordering restored without the dead gate; report quotes both red failures and the final grep.

## Validation

- [x] `npm run test:component` exit 0 → `Test Files  102 passed (102)` / `Tests  921 passed (921)`
- [x] `npm run test:unit` exit 0 → `Test Files  146 passed (146)` / `Tests  1692 passed (1692)`
- [x] `npm run check:headless` exit 0 → `EXIT=0`, ending `{"status": "ok", "snapshotId": "a562f5ad…"}`
- [x] `grep -rn "supportedCodes\|supportedDuelCardCodes" src/ tests/` empty
- [x] `git diff db91860..HEAD --stat` limited to `src/battle/app/App.svelte` + the test file

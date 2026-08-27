# ADR-055: One shared deck-select domain serves duel start and the library

> Status: accepted; planned
> Decided: 2026-08-27
> Owners: shell, deck-editor, story, integration
> Relates: ADR-022 (modular monolith import boundaries — this adds a domain to that model), ADR-054 (free play opens on the seats — its screen is the first consumer), ADR-049 (save-owned decks — story tiles read the save, not IndexedDB)

## Context

The validated deck-selection design (`docs/deck-selection-screen-design.md`, prototype snapshot `7c34d05`) replaces four screens with one visual grammar: `src/shell/screens/FreePlayMatchSetup.svelte`, `src/shell/screens/FreePlayDeckSeat.svelte`, `src/story/screens/PreBattleScreen.svelte`, `src/deck-editor/components/DeckLibrary.svelte`. Those four live in three different domains, and ADR-022's boundary rules — machine-enforced by `eslint.config.js` and `tests/unit/domain-boundaries.test.ts` — forbid any of them importing another domain's internals. A deck tile rendered identically in all three worlds therefore has no legal home in any of them.

The three worlds also disagree about data: free play reads `SelectableDeck` off the battle entry plus IndexedDB flags, the library reads `DeckRecord` rows, the story reads save-owned `StoryDeck`s with live re-validation (ADR-050). One screen cannot read three storages without becoming a fourth place that knows all of them.

## Decision

1. A new domain `src/deck-select/` holds the shared screen, tiles, menus and ordering. It is registered in both boundary checks exactly like the existing domains: cross-domain imports target `src/deck-select/index.ts` only, and its export names are frozen in `tests/unit/domain-boundaries.test.ts`.
2. The domain is **presentational and storage-blind**. It imports nothing from `src/shell/`, `src/battle/`, `src/story/`, `src/deck-editor/` or `src/decks/`. Its input is a plain view model (`DeckTileModel` and siblings); every host maps its own records into that shape and receives callbacks out. Data reading and mutation stay in the host domains.
3. The design's ordering rule (illegal sinks, default, favourites, sort) lives in this domain as `orderDeckTiles` over view models. `src/decks/deck-library-order.ts` (`orderDeckLibrary`) is left untouched: it orders `DeckRecord`s and belongs to the deck-data library, not to a screen.
4. Seat colour tokens `--seat-you: #4ea3ff` and `--seat-opponent: var(--danger)` join `src/styles/tokens.css`, the integration-owned token source, rather than living inside the component.

## Consequences

- Every host now writes a mapping layer (record → `DeckTileModel`) that a single-domain screen would not need. Three small mapping modules exist where zero did. That is the price of one tile meaning the same thing in three worlds.
- The frozen export list grows a whole domain's worth of names, and widening it is a deliberate test edit every time — including during the build-out, where nearly every slice touches it.
- Bytes of the shared chunk count into each consuming domain's `build:verify` closure; a fat shared component charges three budgets at once.
- The screen cannot "just read the repository" even when that would be one line; convenience shortcuts now fail lint and a unit test instead of shipping.

## Alternatives rejected

- **Host the shared screen in `src/shell/`.** The shell may compose domains, but deck-editor and story would then import shell UI, inverting the dependency direction ADR-022 fixed: domains must not reach into the shell that mounts them.
- **Host it in `src/decks/`.** That library is deliberately data-only ("the shared deck-data library rather than a lazy UI domain" — `tests/unit/domain-boundaries.test.ts`). Putting Svelte components there makes every data consumer pull UI.
- **Duplicate the markup per domain.** Three copies of a tile whose halo semantics must stay byte-identical across worlds is the drift machine the design exists to kill; the prototype round already proved the grammar is one thing.
- **Let the shared screen read storages itself.** One component knowing IndexedDB, shell settings and the story save would be a fourth storage client with three masters, and untestable without all three.

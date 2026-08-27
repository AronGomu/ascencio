# ADR-056: Favourites and defaults live with the deck they mark

> Status: accepted; planned
> Decided: 2026-08-27
> Owners: shell, decks, story
> Relates: ADR-049 (save-owned decks — story decks and their marks belong to the save), ADR-051 (route contexts — the two deck worlds never share state), ADR-055 (shared deck-select domain — the screen that renders these marks)

## Context

The deck-selection design puts a favourite star on every tile and a gold default hairline on one, in both worlds. The marks need storage, and the decks they mark live in three different places:

- Free-play local decks: IndexedDB, where `DeckRepository` already carries `listFavourites`/`setFavourite` and `getDefaultDeck`/`setDefaultDeck` (`src/decks/deck-repository.ts`), used today by the deck editor.
- Bundled preset decks: compiled into the build (`src/battle/duel/presets/deck-catalog.ts`), present in every profile, never rows in any repository.
- Story decks: owned by the save (ADR-049), mutated only through reducer commands, exported/imported with it.

A mark stored away from its deck breaks on exactly the operations the design cares about: a favourite in localStorage pointing at an IndexedDB deck survives the deck's deletion; a story favourite outside the save vanishes on save import.

## Decision

1. **Local free-play decks** keep their favourites and default in the deck repository, the fields the editor already writes. The duel-start screen reads and writes the same rows — one star, one badge, two screens, zero divergence.
2. **Bundled preset decks** get their favourites in shell settings (`freePlayPresetFavouriteIds`, full `preset:` keys, beside `freePlayPairing` in `src/shell/settings/shell-settings.ts`). Presets are per-profile constants, so a per-profile preference store is the only storage that matches their lifetime. Presets are never the repository default.
3. **Story decks** get `favouriteDeckIds` on `StoryState`, persisted with the save, mutated by a `deck-set-favourite` reducer command, pruned by `deck-delete`. The story default stays the existing `defaultDeckId` on the save.
4. The shared screen never knows any of this: it renders `favourite`/`isDefault` booleans off the view model and reports a toggle; each host writes to its own store (ADR-055 §2).

## Consequences

- Favourites are split across three stores, and the free-play screen must merge two of them (repository + settings) to paint one grid. A reader looking for "the favourites list" finds three.
- Preset favourites do not follow a profile across browsers — shell settings are localStorage, unexported. A story favourite does travel, because the save does. The same star has two portabilities, and that asymmetry is accepted: it mirrors where the decks themselves live.
- Deleting a local deck leaves its repository favourite to the repository's own pruning (`listFavourites` prunes against existing decks); the story reducer prunes explicitly. Two mechanisms, same invariant.

## Alternatives rejected

- **One flat favourites list in shell settings for everything.** Story favourites would not survive save export/import, and local-deck favourites would dangle after IndexedDB deletion with no pruner; ADR-049 exists precisely because save-owned things must live in the save.
- **Preset favourites as repository rows.** Would require inventing repository records for decks that are not records, and every repository consumer would need to learn to skip them.
- **No preset favourites.** The design's grid ranks favourites above the rest in both groups; bundled decks are most of a fresh profile's grid, and a rank that ignores them makes the star useless exactly where a new player lives.

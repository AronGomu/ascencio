# ADR-069: Default is the only deck mark

> Status: accepted; planned
> Decided: 2026-09-02
> Owners: shell, decks, story
> Supersedes: ADR-056 (favourite ownership across three stores)
> Amends: ADR-040 §3–§4 (favourites and favourite rank), ADR-055 §3 (favourite rank in shared selection)
> Relates: ADR-049 (save-owned decks), ADR-051 (route-context ownership)

## Context

Deck tiles carried two stars with different meanings: favourite and default. Favourite state then required three persistence paths because decks live in three places: IndexedDB for local decks, shell settings for bundled presets, and `StoryState` for save-owned decks. `src/decks/deck-repository.ts`, `src/shell/settings/shell-settings.ts`, and `src/story/model/story-state.ts` each owned part of one visual mark.

Users need one clear answer to “which deck starts?” The default already provides that answer and already has storage in both deck worlds. Bundled presets cannot be repository defaults because they are compiled assets, not deck records.

## Decision

1. Default is the only persisted mark on a deck.
2. Local free-play default remains in `DeckRepository`; story default remains `StoryState.defaultDeckId`.
3. Favourite fields, mutations, controls, and favourite-first ordering are removed from current models.
4. Legacy story saves and shell settings containing favourite fields remain readable. Readers ignore/drop those fields. Existing IndexedDB favourite-key data is left orphaned and unread rather than destructively migrated.
5. Editable non-default tiles expose an outline star that sets default. Current default renders a filled gold disabled star. Setting another default moves the filled state. Bundled preset tiles expose no default star.

## Consequences

- Three favourite stores and their merge/prune logic disappear.
- Existing favourite choices are intentionally lost; they do not migrate into defaults.
- Old IndexedDB preference bytes may remain indefinitely. Avoiding a destructive schema migration is worth that small orphan.
- Bundled presets cannot become default without a future decision adding ownership/persistence for that capability.

## Alternatives rejected

- Keep favourites beside default: preserves old behavior but retains two stars and three storage paths for one secondary ordering hint.
- Convert one favourite into default: multiple favourites make the choice ambiguous, and migration would silently change duel-start behavior.
- Let bundled presets become defaults through shell settings: creates a second default authority beside `DeckRepository` and complicates free-play resolution.
- Delete the old IndexedDB key during migration: unnecessary data mutation for bytes the runtime can safely ignore.

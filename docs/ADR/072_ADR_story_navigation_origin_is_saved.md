# ADR-072: Story navigation origin is saved

> Status: accepted; planned
> Decided: 2026-09-02
> Owners: story state, story saves
> Relates: ADR-033 (economy in `StoryState`), ADR-049 (save-owned decks), ADR-023 (shell route ownership)

## Context

The map needs a contextual “Return to X” control. Story screens are internal states under one shell hash route, so browser history cannot identify whether the player arrived from dialogue, reward, shop, or another story screen. Hardcoding map back to narrative loses that origin.

`StoryState` is persisted. Navigation state that must survive save/load and the temporary unmount during duel handoff cannot live only in a Svelte component. Existing saves have no origin field and must remain readable.

## Decision

1. `StoryState` stores `previousScreen: StoryScreen | null`.
2. Every distinct internal screen transition A→B records A before publishing B. Same-screen state updates preserve the prior value.
3. Story saves persist the field. Legacy saves missing it normalize to `null`; invalid values also normalize to `null` without rejecting otherwise-valid state.
4. Map return uses `previousScreen`; `null` falls back to narrative/dialogue.
5. Shell route history remains separate. Shell previous-route memory serves cross-route deck-editor returns; story previous-screen memory serves internal story returns.

## Consequences

- Save/load and duel unmounts preserve contextual return copy and destination.
- Save schema gains one optional-compatible field, plus normalization/tests.
- Two navigation memories exist at different boundaries. They must not be merged: one speaks `AppRoute`, one speaks `StoryScreen`.
- A transition back to the origin records the map as the new previous screen, forming a one-step toggle rather than an unbounded stack.

## Alternatives rejected

- `history.back()`: all story screens share one hash route, so browser back exits story instead of returning to dialogue.
- Component-local variable: lost on unmount, save/load, and duel handoff.
- Full internal navigation stack: more persistence/migration complexity than one-step return requires.
- Put StoryScreen values in shell history: crosses domain boundary and makes shell understand story internals.

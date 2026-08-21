# ADR-049: Save-owned decks (save schema v3)

Status: accepted · 2026-08-20 · Commit: `9d8b8a7` — T18, T19, T20, T21
Relates: ADR-033 (story economy in `StoryState`), ADR-038 (deck DB v2), ADR-050 (ownership invariant)

## Context

ADR-033 put the wallet, boosters and collection inside `StoryState`, so a save carries the whole economy and a load rolls it back as one snapshot.

Decks stayed outside, in the global `ygo-story-decks` database (v2, with history, favourites and a default-deck pointer). That produced an asymmetry the player can feel: two saves share one deck list while owning different cards. A deck built with the cards of save A is visible — and illegal — in save B.

Product direction settles it: a story save owns its own decks and its own collection; free play has every card and its own decks.

## Decision

Decks live **inside `StoryState`**, beside the wallet and collection.

- `StoryState` gains `decks: readonly StoryDeck[]` (`StoryDeck extends DeckRecord`) and `defaultDeckId: string | null`.
- Mutation goes through reducer commands — `deck-create`, `deck-save`, `deck-delete`, `deck-set-default` — like every other economy change.
- Save schema bumps 2 → 3. A v2 record migrates in memory by defaulting to an empty deck list and a null default; writes are always v3; versions above 3 stay `incompatible`.
- The existing `ygo-story-decks` database becomes the **free-play** library. Nothing is copied or moved: decks that existed before this plan are free-play decks.
- `createStoryDeckRepository` implements the deck domain's own `DeckRepository` over the save, so the editor works against either world unchanged.
- A new save is granted the starter deck (`player.ydk`) **and** the cards behind it, so it is legal under ADR-050 from the first duel.

## Consequences

- Saving snapshots decks; loading rolls them back with progress and wallet. Loading an old save reverts decks built after it — the honest reading of "belongs to that save", and the same rule ADR-033 already applies to money.
- Deleting a save deletes its decks with it. No orphans, no cross-save editing.
- Saves grow by their deck lists. A deck is ~60 numbers plus a validation summary; a dozen decks is kilobytes. Acceptable.
- Two repositories now exist behind one interface. The editor binds one per context (ADR-051's routes decide which), and the editor's own components stay ignorant of the choice.
- `resolveDeckRepository` in `src/decks/deck-repository-context.ts` is that one binding point: a free-play context opens the `ygo-story-decks` database under its existing name and schema, a story context uses the adapter its caller hands over. Nothing is copied into a save and no database is renamed, so every deck a player built before this plan is a free-play deck that stays exactly where the previous build wrote it. The story adapter arrives as a factory on the context rather than as an import, because `src/decks/` may not reach into the story domain — `src/story/index.ts` exports the whole visual novel, and importing it here would drag that chunk into the deck editor's build budget.
- The editing conveniences that describe a session rather than a save — last-opened deck, the autosave log — stay in memory for the story context instead of bloating every snapshot.

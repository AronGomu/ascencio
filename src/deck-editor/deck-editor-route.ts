import type { DeckId } from "../decks/index.ts";

/** The slice of the app route the deck editor owns. `null` is the library at
    `#/decks`; a deck id is the single deck at `#/decks/{deckId}`. The shell
    owns the URL, so the domain reads this as a controlled prop and reports
    every navigation back through `onnavigate`. */
export type DeckEditorRoute = { readonly deckId: DeckId | null };

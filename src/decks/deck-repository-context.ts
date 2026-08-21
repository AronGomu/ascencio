/* Which deck library a context edits. Free play reads the database every deck
   ever built already lives in; a story save reads its own deck list (ADR-049).

   Nothing moves between the two. The split is this choice and nothing else, so
   the free-play branch names no database of its own: it opens
   `DECK_DATABASE_NAME` at the schema that is already on the player's disk.

   The story adapter arrives as a factory the context carries rather than as an
   import. `src/decks/` is the shared deck-data library every domain reads, and
   `src/story/index.ts` exports the whole visual novel behind it — importing it
   from here would pull the story chunk into the deck editor's closure and blow
   its build budget. The caller that knows it is in a story already holds the
   adapter, so it hands it over. */

import type { DeckRepository } from "./deck-repository.ts";
import { IndexedDbDeckRepository } from "./indexeddb-deck-repository.ts";

export type DeckContext =
  | { readonly kind: "free-play" }
  /** `createRepository` is `createStoryDeckRepository` bound to the save the
      context is running against; see `src/story/index.ts`. */
  | { readonly kind: "story"; createRepository(): DeckRepository };

export interface DeckRepositoryHandle {
  readonly repository: DeckRepository;
  /** Releases whatever the context holds open. The free-play library holds an
      IndexedDB connection, which has to go on unmount or the next reset finds
      the database still in use; a save-backed context holds nothing. */
  close(): void;
}

/** The one way to reach a deck repository from a context. */
export async function resolveDeckRepository(
  context: DeckContext,
): Promise<DeckRepositoryHandle> {
  if (context.kind === "story")
    return Object.freeze({
      repository: context.createRepository(),
      close: () => undefined,
    });
  const repository = await IndexedDbDeckRepository.open();
  return Object.freeze({
    repository,
    close: () => {
      repository.close();
    },
  });
}

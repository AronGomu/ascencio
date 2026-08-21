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

import {
  unlimitedCardOwnership,
  type CardOwnership,
} from "./card-ownership.ts";
import type { DeckRepository } from "./deck-repository.ts";
import { IndexedDbDeckRepository } from "./indexeddb-deck-repository.ts";

/* Ownership travels with the repository rather than beside it (T23). They were
   two independent discriminators for one ticket, and a story repository paired
   with `unlimitedCardOwnership()` type-checked — a story player building from
   every printed card, with nothing to catch it. Free play's half is now derived
   in the resolver rather than supplied, so it cannot be got wrong at all, and
   the story half has exactly one constructor: `openStoryDeckContext` in
   `src/story/decks/story-deck-context.ts`, which reads both from the one save.

   The label rides along for the same reason. The editor names its context on
   screen, and a name resolved separately from the repository is a third thing
   that can disagree with the decks the player is looking at. */
export type DeckContext =
  | { readonly kind: "free-play" }
  /** `createRepository` is `createStoryDeckRepository` bound to the save the
      context is running against, `ownership` is that save's collection and
      `label` names it on screen; see `src/story/index.ts`. */
  | {
      readonly kind: "story";
      readonly label: string;
      createRepository(): DeckRepository;
      readonly ownership: CardOwnership;
    };

export interface DeckRepositoryHandle {
  readonly repository: DeckRepository;
  /** What the player editing through `repository` owns, resolved from the same
      context so the two can never describe different worlds (ADR-050). */
  readonly ownership: CardOwnership;
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
      ownership: context.ownership,
      close: () => undefined,
    });
  const repository = await IndexedDbDeckRepository.open();
  return Object.freeze({
    repository,
    ownership: unlimitedCardOwnership(),
    close: () => {
      repository.close();
    },
  });
}

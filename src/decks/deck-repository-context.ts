/* Contexts use only the caller's injected repository. Free play shares Shell's
   SQLite client; Story supplies its save-owned adapter without importing Story
   into this shared deck-data library. */

import {
  unlimitedCardOwnership,
  type CardOwnership,
} from "./card-ownership.ts";
import type { DeckRepository } from "./deck-repository.ts";

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
  | {
      readonly kind: "free-play";
      createRepository(): DeckRepository;
    }
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
  /** Releases context-owned resources. SQLite repositories share Shell's
      lifetime client, so current contexts hold no independent connection. */
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
  return Object.freeze({
    repository: context.createRepository(),
    ownership: unlimitedCardOwnership(),
    close: () => undefined,
  });
}

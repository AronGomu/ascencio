import type { Component } from "svelte";

/** Each UI domain root is code-split, so the shell only holds a loader. */
export type DomainLoader = () => Promise<{
  default: Component<Record<string, never>>;
}>;

export interface DomainLoaders {
  readonly duel: DomainLoader;
  readonly decks: DomainLoader;
  readonly story: DomainLoader;
}

export const DEFAULT_DOMAIN_LOADERS: DomainLoaders = {
  duel: async () => await import("../app/App.svelte"),
  decks: async () =>
    await import("../prototypes/deck-builder/DeckBuilderPrototype.svelte"),
  /* The story domain is reached through its public entry, never by deep
     import of `StoryApp.svelte`. */
  story: async () => await import("../story/index.ts"),
};

import type { Component } from "svelte";

/** Each UI domain root is code-split, so the shell only holds a loader. */
export type DomainLoader = () => Promise<{
  default: Component<Record<string, never>>;
}>;

export interface DomainLoaders {
  readonly duel: DomainLoader;
  readonly decks: DomainLoader;
}

export const DEFAULT_DOMAIN_LOADERS: DomainLoaders = {
  duel: async () => await import("../app/App.svelte"),
  decks: async () =>
    await import("../prototypes/deck-builder/DeckBuilderPrototype.svelte"),
};

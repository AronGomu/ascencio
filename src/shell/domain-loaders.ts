import type { Component } from "svelte";
import type { DeckEditorRoute } from "../deck-editor/index.ts";

/** Each UI domain root is code-split, so the shell only holds a loader. */
export type DomainLoader<
  Props extends Record<string, unknown> = Record<string, never>,
> = () => Promise<{
  default: Component<Props>;
}>;

/** The deck editor is the one domain the route addresses past its own name,
    so the shell hands it the deck id and takes navigation back. */
export type DeckEditorDomainProps = DeckEditorRoute & {
  readonly onnavigate: (route: DeckEditorRoute) => void;
};

export interface DomainLoaders {
  readonly duel: DomainLoader;
  readonly decks: DomainLoader<DeckEditorDomainProps>;
  readonly story: DomainLoader;
}

export const DEFAULT_DOMAIN_LOADERS: DomainLoaders = {
  duel: async () => await import("../app/App.svelte"),
  /* Both the deck editor and the story domain are reached through their
     public entry, never by deep import of their root component. */
  decks: async () => await import("../deck-editor/index.ts"),
  story: async () => await import("../story/index.ts"),
};

import type { Component } from "svelte";
import type { BattleFacade } from "../battle/index.ts";
import type { DeckEditorRoute } from "../deck-editor/index.ts";
import type {
  StoryDuelResolution,
  StoryEncounterRequest,
  StoryHandoffOutcome,
  StoryState,
} from "../story/index.ts";
import type { StoryEntryIntent } from "./shell-store.ts";

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

/** The duel is reached through the battle facade, which its public entry
    names rather than exporting as a default. */
export type BattleDomainLoader = () => Promise<{
  readonly BattleFacade: typeof BattleFacade;
}>;

/** The visual novel's half of the duel handoff. It asks for an encounter and
    is handed back the checkpointed state plus the one result that encounter
    produced; the shell owns the handoff id, the route and the duel itself. */
export type StoryDomainProps = {
  /** Which main-menu entry sent the player here, so the story can open on that
      screen rather than repeating a title the shell already showed. `null`
      when the route was reached any other way. */
  readonly storyEntryIntent?: StoryEntryIntent | null;
  readonly onencounter?: (
    request: StoryEncounterRequest,
  ) => Promise<StoryHandoffOutcome>;
  readonly resumeState?: StoryState | null;
  readonly resolution?: StoryDuelResolution | null;
  readonly onhandled?: () => void;
};

export interface DomainLoaders {
  readonly duel: BattleDomainLoader;
  readonly decks: DomainLoader<DeckEditorDomainProps>;
  readonly story: DomainLoader<StoryDomainProps>;
}

export const DEFAULT_DOMAIN_LOADERS: DomainLoaders = {
  /* Every domain is reached through its public entry, never by deep import of
     its root component. */
  duel: async () => await import("../battle/index.ts"),
  decks: async () => await import("../deck-editor/index.ts"),
  story: async () => await import("../story/index.ts"),
};

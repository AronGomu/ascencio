import type { DeckRecord } from "../../decks/deck-contracts.ts";

export const STORY_SCREENS = [
  "title",
  "load",
  "narrative",
  "map",
  "pre-battle",
  "battle-mock",
  "outcome",
  "reward",
  "end",
  "shop-greeting",
  "shop-browse",
  "shop-cards",
  "shop-sell",
  "shop-opening",
  "shop-results",
] as const;

export type StoryScreen = (typeof STORY_SCREENS)[number];
export type ChoiceId = "trust-rin" | "challenge-rin" | "observe-first";
export type BattleResult = "win" | "loss" | "abort" | "failure";
export type MapAccess = "available" | "locked" | "hidden";
export type LocationId = "old-arena" | "archive" | "hidden-gate" | "card-shop";
export type EncounterId = Exclude<LocationId, "card-shop">;

/** How rare a pulled card is. Ordered from the commonest pull to the rarest,
    which is also the order a pack reveals them in. */
export type ShopRarity =
  | "common"
  | "rare"
  | "super-rare"
  | "ultra-rare"
  | "secret-rare"
  | "ultimate-rare"
  | "ghost-rare";

/** One card as a booster produced it. The rarity belongs to the pull rather
    than to the card, so the same code can appear at two rarities. */
export interface OpenedCard {
  readonly code: number;
  readonly rarity: ShopRarity;
}

/** One deck a story save owns. The deck domain's own record, reused rather
    than restated, so the editor reads a save-owned deck without translating it
    and a deck moved between the two worlds keeps its shape (ADR-049). */
export type StoryDeck = DeckRecord;

export interface StoryLocationState {
  readonly id: LocationId;
  readonly access: MapAccess;
  readonly completed: boolean;
}

export interface StoryState {
  readonly screen: StoryScreen;
  readonly previousScreen: StoryScreen | null;
  readonly savedScreen: StoryScreen;
  readonly progressExists: boolean;
  readonly narrativeIndex: number;
  readonly lastInputId: number | null;
  readonly choice: ChoiceId | null;
  readonly choiceResponse: string | null;
  readonly laterAcknowledgment: string | null;
  readonly locations: readonly StoryLocationState[];
  readonly outcome: BattleResult | null;
  readonly outcomeScene: string | null;
  readonly rewardGranted: boolean;
  readonly rewardAcknowledged: boolean;
  readonly objective: string;
  /* Which map node the current briefing, duel and outcome belong to. Part of
     the state rather than a screen-local variable because a duel handoff
     outlives this component: the story is unmounted while the duel runs, and
     what comes back has to know which encounter it was. */
  readonly encounterId: EncounterId | null;
  /* Non-null only inside the pre-duel checkpoint, where it names the handoff
     the shell is waiting on. A checkpoint whose id does not match the route
     being resumed belongs to a duel this session is not running. */
  readonly pendingHandoffId: string | null;
  /* The economy rides inside the story rather than in a store beside it, so a
     save, a checkpoint and a load carry progress and wallet as one snapshot:
     loading rolls both back together and neither can outlive the other
     (ADR-033). */
  readonly dp: number;
  /** Unopened packs per shop set id. */
  readonly boosters: Readonly<Record<string, number>>;
  /** Owned count per card code. Counts only, so a large collection stays a
      small record. */
  readonly collection: Readonly<Record<number, number>>;
  /* The decks belong to the save for the same reason the collection does: a
     deck built out of one save's cards is not a deck another save may duel
     with. Saving snapshots them, loading rolls them back, and deleting a save
     deletes them with it (ADR-049). The global deck database is free play's
     library and is never read from here. */
  readonly decks: readonly StoryDeck[];
  /** Which of `decks` a duel starts from, by id. Null until one is chosen, and
      cleared again if that deck is deleted. */
  readonly defaultDeckId: string | null;
  /* The four fields below describe one shop visit rather than what the player
     owns. They are still part of the saved state: a save taken mid-visit has
     to resume the visit rather than strand the player on a shop screen with
     no way back. */
  /** Where Leave Shop lands. */
  readonly shopReturnScreen: StoryScreen | null;
  /** The set whose card list is open. */
  readonly shopSetId: string | null;
  /** The result of the last booster opening. */
  readonly openedCards: readonly OpenedCard[] | null;
  readonly openingMode: "sequential" | "all" | null;
}

export function createInitialStoryState(): StoryState {
  return {
    screen: "title",
    previousScreen: null,
    savedScreen: "narrative",
    progressExists: false,
    narrativeIndex: 0,
    lastInputId: null,
    choice: null,
    choiceResponse: null,
    laterAcknowledgment: null,
    locations: [
      { id: "old-arena", access: "available", completed: false },
      { id: "archive", access: "locked", completed: false },
      { id: "hidden-gate", access: "hidden", completed: false },
      { id: "card-shop", access: "available", completed: false },
    ],
    outcome: null,
    outcomeScene: null,
    rewardGranted: false,
    rewardAcknowledged: false,
    objective: "Meet Rin at the Old Arena",
    encounterId: null,
    pendingHandoffId: null,
    dp: 1000,
    boosters: {},
    collection: {},
    decks: [],
    defaultDeckId: null,
    shopReturnScreen: null,
    shopSetId: null,
    openedCards: null,
    openingMode: null,
  };
}

const STORY_SCREEN_LABELS: Readonly<Record<StoryScreen, string>> =
  Object.freeze({
    title: "Title",
    load: "Load",
    narrative: "Dialog",
    map: "Map",
    "pre-battle": "Duel Setup",
    "battle-mock": "Duel",
    outcome: "Duel Result",
    reward: "Duel Result",
    end: "End",
    "shop-greeting": "Shop",
    "shop-browse": "Shop",
    "shop-cards": "Shop",
    "shop-sell": "Shop",
    "shop-opening": "Shop",
    "shop-results": "Shop",
  });

export function storyScreenLabel(screen: StoryScreen): string {
  return STORY_SCREEN_LABELS[screen];
}

function rememberStoryScreenTransition(
  current: StoryState,
  next: StoryState,
): StoryState {
  return next.screen === current.screen
    ? next
    : { ...next, previousScreen: current.screen };
}

export function transitionStoryScreen(
  state: StoryState,
  screen: StoryScreen,
): StoryState {
  return rememberStoryScreenTransition(state, { ...state, screen });
}

export function rememberStoryStateTransition(
  current: StoryState,
  next: StoryState,
): StoryState {
  return rememberStoryScreenTransition(current, next);
}

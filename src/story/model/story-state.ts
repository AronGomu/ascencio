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
export type LocationId = "old-arena" | "archive" | "hidden-gate";

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

export interface StoryLocationState {
  readonly id: LocationId;
  readonly access: MapAccess;
  readonly completed: boolean;
}

export interface StoryState {
  readonly screen: StoryScreen;
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
  readonly encounterId: LocationId | null;
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
    shopReturnScreen: null,
    shopSetId: null,
    openedCards: null,
    openingMode: null,
  };
}

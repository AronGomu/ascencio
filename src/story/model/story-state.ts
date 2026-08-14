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
] as const;

export type StoryScreen = (typeof STORY_SCREENS)[number];
export type ChoiceId = "trust-rin" | "challenge-rin" | "observe-first";
export type BattleResult = "win" | "loss" | "abort" | "failure";
export type MapAccess = "available" | "locked" | "hidden";
export type LocationId = "old-arena" | "archive" | "hidden-gate";

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
  };
}

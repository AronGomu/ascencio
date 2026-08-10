import {
  cardCode,
  cardInstanceId,
  choiceId,
  promptId,
  snapshotId,
} from "../../src/duel/contracts/ids.ts";
import type {
  PlayerPrompt,
  PromptChoice,
} from "../../src/duel/contracts/player-prompt.ts";
import type {
  CardPosition,
  PlayerIndex,
  PublicCard,
  PublicDuelState,
  PublicPlayerState,
} from "../../src/duel/contracts/public-duel-state.ts";

export const BOARD_CARD_TEXTS = new Map([
  [97590747, { name: "The Legendary Fisherman" }],
  [89631139, { name: "Blue-Eyes White Dragon" }],
  [5053103, { name: "Axe Raider" }],
  [46986414, { name: "Dark Magician" }],
]);

function card(
  id: string,
  code: number,
  controller: PlayerIndex,
  location: PublicCard["location"],
  sequence: number,
  position: CardPosition = "faceUpAttack",
  additions: Partial<PublicCard> = {},
): PublicCard {
  return {
    instanceId: cardInstanceId(id),
    code: cardCode(code),
    owner: controller,
    controller,
    location,
    sequence,
    position,
    faceUp: position === "faceUpAttack" || position === "faceUpDefense",
    counters: [],
    overlayMaterials: [],
    ...additions,
  };
}

function player(player: PlayerIndex): PublicPlayerState {
  return {
    player,
    lifePoints: 8000,
    deckCount: 35,
    extraDeckCount: 0,
    handCount: 0,
    hand: [],
    extraDeck: [],
    monsters: [],
    spellsAndTraps: [],
    graveyard: [],
    banished: [],
  };
}

function state(
  id: string,
  player0: Partial<PublicPlayerState> = {},
  player1: Partial<PublicPlayerState> = {},
  chain: PublicDuelState["chain"] = [],
): PublicDuelState {
  return {
    snapshotId: snapshotId(id.padEnd(64, id.at(-1) ?? "0").slice(0, 64)),
    revision: 1,
    turn: 1,
    turnPlayer: 0,
    phase: "main1",
    players: [
      { ...player(0), ...player0, player: 0 },
      { ...player(1), ...player1, player: 1 },
    ],
    chain,
  };
}

const ownHand = card(
  "st01-own-hand",
  97590747,
  0,
  "hand",
  0,
  "faceDownDefense",
);
const hiddenOpponentHand = card(
  "st01-private-opponent-hand",
  46986414,
  1,
  "hand",
  0,
  "faceDownDefense",
);
const mainZero = card("st02-main-zero", 97590747, 0, "monster", 0);
const mainFour = card("st02-main-four", 5053103, 0, "monster", 4);
const sharedLeft = card("st03-shared-left", 97590747, 0, "monster", 5);
const sharedRight = card("st03-shared-right", 89631139, 1, "monster", 5);
const chainSource = card("st08-chain-source", 46986414, 0, "monster", 2);

export const BOARD_VIEW_MODEL_FIXTURES = Object.freeze({
  "ST-01": state(
    "1",
    { handCount: 1, hand: [ownHand] },
    { handCount: 2, hand: [hiddenOpponentHand] },
  ),
  "ST-02": state("2", { monsters: [mainZero, mainFour] }),
  "ST-03": state("3", { monsters: [sharedLeft] }, { monsters: [sharedRight] }),
  "ST-04": state("4", {
    monsters: [
      card("st04-up-attack", 97590747, 0, "monster", 0, "faceUpAttack"),
      card("st04-up-defense", 5053103, 0, "monster", 1, "faceUpDefense"),
      card("st04-down-attack", 46986414, 0, "monster", 2, "faceDownAttack"),
      card("st04-down-defense", 89631139, 0, "monster", 3, "faceDownDefense"),
    ],
  }),
  "ST-05": state("5", { monsters: [mainZero] }),
  "ST-06": state("6", { monsters: [mainZero, mainFour] }),
  "ST-07": state("7", {
    monsters: [
      card("st07-host", 97590747, 0, "monster", 1, "faceUpAttack", {
        counters: [{ type: 1, name: "Spell Counter", count: 3 }],
        overlayMaterials: [
          {
            instanceId: cardInstanceId("st07-visible-material"),
            code: cardCode(5053103),
            identityVisible: true,
            sequence: 0,
          },
          {
            instanceId: cardInstanceId("st07-private-material"),
            code: cardCode(46986414),
            identityVisible: false,
            sequence: 1,
          },
        ],
      }),
    ],
  }),
  "ST-08": state(
    "8",
    {
      monsters: [chainSource],
      extraDeckCount: 2,
      extraDeck: [
        card("st08-extra-one", 97590747, 0, "extra", 0, "faceDownDefense"),
        card("st08-extra-two", 5053103, 0, "extra", 1, "faceDownDefense"),
      ],
      graveyard: [card("st08-gy", 89631139, 0, "graveyard", 0)],
    },
    { deckCount: 31, extraDeckCount: 1 },
    [
      {
        index: 1,
        controller: 0,
        sourceIdentityVisible: true,
        sourceInstanceId: chainSource.instanceId,
        sourceCard: cardCode(46986414),
        label: "Dark Magic Attack",
        description: "Destroy opposing Spell and Trap Cards.",
        phase: "solving",
        outcome: "normal",
      },
      {
        index: 2,
        controller: 1,
        sourceIdentityVisible: false,
        label: "Card effect",
        phase: "pending",
        outcome: "negated",
      },
    ],
  ),
} satisfies Readonly<
  Record<`ST-0${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}`, PublicDuelState>
>);

export const BOARD_TARGET_PROMPT: PlayerPrompt = {
  id: promptId("board-target-prompt"),
  kind: "selectCard",
  player: 0,
  title: "Choose",
  choices: [
    {
      id: choiceId("mounted-card"),
      label: "Mounted card",
      action: "select",
      card: {
        instanceId: cardInstanceId("positional-mounted-card"),
        code: cardCode(46986414),
        controller: 0,
        location: "monster",
        sequence: 2,
        position: "faceUpAttack",
      },
    },
    {
      id: choiceId("closed-stack-card"),
      label: "Closed stack card",
      action: "select",
      card: {
        instanceId: cardInstanceId("positional-stack-card"),
        code: cardCode(89631139),
        controller: 0,
        location: "graveyard",
        sequence: 0,
        position: "faceUpAttack",
      },
    },
    {
      id: choiceId("physical-zone"),
      label: "Field Zone",
      action: "select",
      place: { player: 0, location: "field", sequence: 0 },
    },
    {
      id: choiceId("unsupported-zone"),
      label: "Unsupported Zone",
      action: "select",
      place: { player: 0, location: "field", sequence: 1 },
    },
    {
      id: choiceId("non-field"),
      label: "Pass",
      action: "pass",
    },
  ],
  minimum: 1,
  maximum: 1,
  cancelable: false,
  ordered: false,
};

export const TWO_CARD_GRAVEYARD_STATE = state("gy2", {
  graveyard: [
    card("gy2-first", 97590747, 0, "graveyard", 0),
    card("gy2-second", 89631139, 0, "graveyard", 1),
  ],
});

export const DUPLICATE_SHARED_OCCUPANCY = state(
  "d",
  { monsters: [card("duplicate-left-a", 97590747, 0, "monster", 5)] },
  { monsters: [card("duplicate-left-b", 89631139, 1, "monster", 6)] },
);

export function promptChoice(id: string): PromptChoice {
  const choice = BOARD_TARGET_PROMPT.choices.find((value) => value.id === id);
  if (choice === undefined) throw new Error(`Missing prompt choice: ${id}`);
  return choice;
}

import {
  cardCode,
  cardInstanceId,
  snapshotId,
} from "../../src/duel/contracts/ids.ts";
import type {
  CardPosition,
  PlayerIndex,
  PublicCard,
  PublicDuelState,
  PublicPlayerState,
} from "../../src/duel/contracts/public-duel-state.ts";

export const PUBLIC_STATE_CARD_TEXTS = new Map([
  [
    97590747,
    {
      name: "The Legendary Fisherman",
      description: "A public monster description.",
    },
  ],
  [
    89631139,
    {
      name: "Blue-Eyes White Dragon",
      description: "A public dragon description.",
    },
  ],
  [
    5053103,
    { name: "Axe Raider", description: "A public warrior description." },
  ],
  [
    46986414,
    {
      name: "Dark Magician",
      description: "A private identity that must not render.",
    },
  ],
]);

export function deckSlots(
  player: PlayerIndex,
  count: number,
): readonly PublicCard[] {
  return Object.freeze(
    Array.from({ length: count }, (_, offset): PublicCard =>
      Object.freeze({
        instanceId: cardInstanceId(`deck-p${player}-${offset}`),
        owner: player,
        controller: player,
        location: "deck",
        sequence: offset,
        position: "faceDownAttack",
        faceUp: false,
        counters: Object.freeze([]),
        overlayMaterials: Object.freeze([]),
      }),
    ),
  );
}

export function publicStateCard(
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
    lifePoints: player === 0 ? 6200 : 3400,
    deckCount: player === 0 ? 28 : 31,
    deck: deckSlots(player, player === 0 ? 28 : 31),
    extraDeckCount: player === 0 ? 2 : 2,
    handCount: player === 0 ? 1 : 2,
    hand: [],
    extraDeck: [],
    monsters: [],
    spellsAndTraps: [],
    graveyard: [],
    banished: [],
  };
}

const richHost = publicStateCard(
  "rich-host",
  97590747,
  0,
  "monster",
  0,
  "faceUpAttack",
  {
    counters: [{ type: 1, name: "Spell Counter", count: 3 }],
    overlayMaterials: [
      {
        instanceId: cardInstanceId("visible-material"),
        code: cardCode(5053103),
        identityVisible: true,
        sequence: 0,
      },
      {
        instanceId: cardInstanceId("hidden-material"),
        code: cardCode(46986414),
        identityVisible: false,
        sequence: 1,
      },
    ],
  },
);

const privateOpponentExtra = publicStateCard(
  "private-opponent-extra",
  46986414,
  1,
  "extra",
  0,
  "faceDownDefense",
);
const publicOpponentExtra = publicStateCard(
  "public-opponent-extra",
  89631139,
  1,
  "extra",
  1,
  "faceUpAttack",
);

export const RICH_PUBLIC_DUEL_STATE: PublicDuelState = {
  snapshotId: snapshotId("7".repeat(64)),
  revision: 7,
  turn: 4,
  turnPlayer: 1,
  phase: "battleStep",
  players: [
    {
      ...player(0),
      hand: [
        publicStateCard("own-hand", 5053103, 0, "hand", 0, "faceDownDefense"),
      ],
      extraDeck: [
        publicStateCard(
          "own-extra-one",
          97590747,
          0,
          "extra",
          0,
          "faceDownDefense",
        ),
        publicStateCard(
          "own-extra-two",
          5053103,
          0,
          "extra",
          1,
          "faceDownDefense",
        ),
      ],
      monsters: [richHost],
      graveyard: [publicStateCard("own-gy", 89631139, 0, "graveyard", 0)],
    },
    {
      ...player(1),
      hand: [
        publicStateCard(
          "private-opponent-hand",
          46986414,
          1,
          "hand",
          0,
          "faceDownDefense",
        ),
      ],
      extraDeck: [privateOpponentExtra, publicOpponentExtra],
      banished: [
        publicStateCard(
          "private-opponent-banished",
          46986414,
          1,
          "banished",
          0,
          "faceDownDefense",
        ),
      ],
    },
  ],
  chain: [
    {
      index: 1,
      controller: 0,
      sourceIdentityVisible: true,
      sourceInstanceId: richHost.instanceId,
      sourceCard: cardCode(97590747),
      label: "The Legendary Fisherman effect",
      description: "Resolve public effect.",
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
};

export const SIXTY_PUBLIC_CARDS = Object.freeze(
  Array.from({ length: 60 }, (_, sequence) =>
    publicStateCard(
      `public-tray-${sequence}`,
      sequence % 2 === 0 ? 97590747 : 5053103,
      0,
      "graveyard",
      sequence,
    ),
  ),
);

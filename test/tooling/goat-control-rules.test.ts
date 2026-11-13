import test from "node:test";
import assert from "node:assert/strict";
import { createGoatControlBotModule } from "../../assets/ai-bots/goat-control/ai/index.ts";
import type { BotDecisionInput } from "../../src/battle/worker/bot/bot-contract.ts";
import type {
  PlayerIndex,
  PublicPlayerState,
} from "../../src/battle/duel/contracts/public-duel-state.ts";
import {
  cardCode,
  cardInstanceId,
  choiceId,
  promptId,
  snapshotId,
} from "../../src/battle/duel/contracts/ids.ts";
function input(
  actor: PlayerIndex,
  enemyPosition?: "faceUpAttack" | "faceDownDefense",
): BotDecisionInput {
  const makePlayer = (player: PlayerIndex): PublicPlayerState => ({
    player,
    lifePoints: 8000,
    deckCount: 30,
    deck: [],
    extraDeckCount: 0,
    handCount: 1,
    hand: [],
    extraDeck: [],
    monsters:
      player !== actor && enemyPosition
        ? [
            {
              instanceId: cardInstanceId("enemy"),
              owner: player,
              controller: player,
              location: "monster" as const,
              sequence: 0,
              position: enemyPosition,
              faceUp: enemyPosition === "faceUpAttack",
              counters: [],
              overlayMaterials: [],
            },
          ]
        : [],
    spellsAndTraps: [],
    graveyard: [],
    banished: [],
  });
  const players: [PublicPlayerState, PublicPlayerState] = [
    makePlayer(0),
    makePlayer(1),
  ];
  const summarize = (p: PublicPlayerState) => ({
    player: p.player,
    lifePoints: 8000,
    deckCount: 30,
    extraDeckCount: 0,
    handCount: 1,
    monsterCount: p.monsters.length,
    spellTrapCount: 0,
    graveyardCount: 0,
    banishedCount: 0,
  });
  return {
    prompt: {
      id: promptId("nobleman"),
      player: actor,
      kind: "idleCommand",
      title: "Choose",
      minimum: 1,
      maximum: 1,
      ordered: false,
      cancelable: false,
      choices: [
        {
          id: choiceId("activate"),
          action: "activate",
          label: "Activate Nobleman",
          card: {
            instanceId: cardInstanceId("nobleman"),
            code: cardCode(71044499),
            controller: actor,
            location: "hand",
            sequence: 0,
          },
        },
        { id: choiceId("end"), action: "endPhase", label: "End" },
      ],
    },
    observation: {
      revision: 1,
      turn: 1,
      turnPlayer: actor,
      phase: "main1",
      chainSize: 0,
      players: [summarize(players[0]), summarize(players[1])],
      publicState: {
        snapshotId: snapshotId("test"),
        revision: 1,
        turn: 1,
        turnPlayer: actor,
        phase: "main1",
        layout: { extraMonsterZones: true },
        players,
        chain: [],
      },
    },
  };
}
for (const actor of [0, 1] as const) {
  test(`actor ${actor}: decline Nobleman with no opposing monster or only face-up monsters`, () => {
    for (const position of [undefined, "faceUpAttack"] as const) {
      const bot = createGoatControlBotModule({ cards: new Map() }).create({});
      assert.deepEqual(bot.decide(input(actor, position)).choiceIds, ["end"]);
    }
  });
  test(`actor ${actor}: allow Nobleman against a concealed opposing face-down monster`, () => {
    const bot = createGoatControlBotModule({ cards: new Map() }).create({});
    assert.deepEqual(bot.decide(input(actor, "faceDownDefense")).choiceIds, [
      "activate",
    ]);
  });
}
test("missing public state preserves the existing legal fallback", () => {
  const decision = input(0);
  const { publicState: omitted, ...observation } = decision.observation;
  void omitted;
  const bot = createGoatControlBotModule({ cards: new Map() }).create({});
  assert.deepEqual(bot.decide({ ...decision, observation }).choiceIds, [
    "activate",
  ]);
});

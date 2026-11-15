import test from "node:test";
import assert from "node:assert/strict";
import { createGoatControlBotModule } from "../../assets/ai-bots/goat-control/ai/index.ts";
import { toOpponentVisibleState } from "../../src/battle/worker/opponent/OpponentPolicy.ts";
import type {
  PublicCard,
  PublicPlayerState,
  PublicChainLink,
  PublicDuelState,
  PlayerIndex,
} from "../../src/battle/duel/contracts/public-duel-state.ts";
import type {
  PromptChoice,
  PromptKind,
  ChoiceAction,
} from "../../src/battle/duel/contracts/player-prompt.ts";
import type { EngineCardData } from "../../src/battle/worker/engine/OcgCoreAdapter.ts";
import type { BotObservedEvent } from "../../src/battle/worker/bot/observed-events.ts";
import {
  cardCode,
  cardInstanceId,
  choiceId,
  promptId,
  snapshotId,
} from "../../src/battle/duel/contracts/ids.ts";
const definitions = new Map<number, EngineCardData>();
function define(code: number, type: number, attack = 0, defense = 0) {
  definitions.set(code, {
    code,
    type,
    attack,
    defense,
    alias: 0,
    setcodes: [],
    level: 1,
    attribute: 1,
    race: 1n,
    lscale: 0,
    rscale: 0,
    link_marker: 0,
  });
}
for (const code of [5318639, 19613556, 71044499, 70828912]) define(code, 2);
define(53582587, 4);
define(31560081, 0x200021, 300, 400);
define(33508719, 0x200021, 700, 600);
define(8131171, 0x21, 300, 250);
define(70074904, 0x21, 1700, 1600);
define(77585513, 0x21, 2400, 1500);
define(26202165, 0x21, 1000, 600);
function card(
  code: number,
  controller: PlayerIndex,
  location: PublicCard["location"] = "spellTrap",
  position: PublicCard["position"] = "faceUpAttack",
): PublicCard {
  return {
    instanceId: cardInstanceId(`${controller}-${location}-${code}`),
    code: cardCode(code),
    owner: controller,
    controller,
    location,
    position,
    faceUp: position.startsWith("faceUp"),
    sequence: 0,
    counters: [],
    overlayMaterials: [],
  };
}
function choice(
  id: string,
  action: ChoiceAction,
  shown?: PublicCard,
): PromptChoice {
  return {
    id: choiceId(id),
    action,
    label: id,
    ...(shown
      ? {
          card: {
            instanceId: shown.instanceId,
            ...(shown.code === undefined ? {} : { code: shown.code }),
            controller: shown.controller,
            location: shown.location,
            sequence: shown.sequence,
            position: shown.position,
          },
        }
      : {}),
  };
}
function player(
  index: PlayerIndex,
  patch: Partial<PublicPlayerState> = {},
): PublicPlayerState {
  return {
    player: index,
    lifePoints: 8000,
    deckCount: 30,
    deck: [],
    extraDeckCount: 0,
    handCount: 3,
    hand: [],
    extraDeck: [],
    monsters: [],
    spellsAndTraps: [],
    graveyard: [],
    banished: [],
    ...patch,
  };
}
function effect(
  code: number,
  phase: PublicChainLink["phase"] = "pending",
): PublicChainLink {
  return {
    index: 1,
    controller: 0,
    sourceIdentityVisible: true,
    sourceCard: cardCode(code),
    label: "effect",
    phase,
    outcome: "normal",
  };
}
function decide(
  kind: PromptKind,
  choices: PromptChoice[],
  own: Partial<PublicPlayerState> = {},
  enemy: Partial<PublicPlayerState> = {},
  chain: PublicChainLink[] = [],
  events: BotObservedEvent[] = [],
  turn = 1,
) {
  const state: PublicDuelState = {
    snapshotId: snapshotId("test"),
    revision: 1,
    turn,
    turnPlayer: 0,
    phase: "main1",
    layout: { extraMonsterZones: true },
    players: [player(0, own), player(1, enemy)],
    chain,
  };
  const bot = createGoatControlBotModule({ cards: definitions }).create({});
  return bot.decide({
    prompt: {
      id: promptId("p"),
      kind,
      player: 0,
      title: "Choose",
      minimum: 1,
      maximum: 1,
      ordered: false,
      cancelable: false,
      choices,
    },
    observation: toOpponentVisibleState(state, 0, events),
  }).choiceIds;
}
test("MST targeting prefers an opposing concealed card only for our visible pending effect", () => {
  const own = card(53582587, 0);
  const enemy = card(53582587, 1, "spellTrap", "faceDownAttack");
  const { code: omitted, ...concealed } = enemy;
  void omitted;
  const choices = [
    choice("ours", "select", own),
    choice("theirs", "select", concealed),
  ];
  assert.deepEqual(decide("selectCard", choices, {}, {}, [effect(5318639)]), [
    "theirs",
  ]);
  assert.deepEqual(decide("selectCard", choices), ["ours"]);
});
test("MST is held without opposing backrow and remains usable against a concealed target", () => {
  const options = [
    choice("activate", "activate", card(5318639, 0, "hand")),
    choice("end", "endPhase"),
  ];
  assert.deepEqual(decide("idleCommand", options), ["end"]);
  assert.deepEqual(
    decide(
      "idleCommand",
      options,
      {},
      { spellsAndTraps: [card(53582587, 1, "spellTrap", "faceDownAttack")] },
    ),
    ["activate"],
  );
});

test("Heavy Storm avoids clearing only our backrow but remains available against opposing backrow", () => {
  const options = [
    choice("storm", "activate", card(19613556, 0, "hand")),
    choice("end", "endPhase"),
  ];
  assert.deepEqual(
    decide("idleCommand", options, { spellsAndTraps: [card(53582587, 0)] }),
    ["end"],
  );
  assert.deepEqual(
    decide(
      "idleCommand",
      options,
      { spellsAndTraps: [card(53582587, 0)] },
      { spellsAndTraps: [card(53582587, 1, "spellTrap", "faceDownAttack")] },
    ),
    ["storm"],
  );
});

test("Faith preserves opening or visible spell recovery value, while useful Jar is set", () => {
  const faith = card(31560081, 0, "hand");
  const faithOptions = [
    choice("summon", "summon", faith),
    choice("set", "setMonster", faith),
  ];
  const enemy = { monsters: [card(70074904, 1, "monster")] };
  assert.deepEqual(
    decide(
      "idleCommand",
      faithOptions,
      { graveyard: [card(5318639, 0, "graveyard")] },
      enemy,
    ),
    ["set"],
  );
  assert.deepEqual(decide("idleCommand", faithOptions, {}, enemy), ["set"]);
  assert.deepEqual(decide("idleCommand", faithOptions, {}, enemy, [], [], 3), [
    "summon",
  ]);
  assert.deepEqual(
    decide(
      "idleCommand",
      faithOptions,
      { graveyard: [card(5318639, 0, "graveyard")] },
      enemy,
      [],
      [],
      3,
    ),
    ["set"],
  );
  const jar = card(33508719, 0, "hand");
  assert.deepEqual(
    decide(
      "idleCommand",
      [choice("summon", "summon", jar), choice("set", "setMonster", jar)],
      { handCount: 2 },
      { ...enemy, handCount: 4 },
    ),
    ["set"],
  );
});

test("Torrential preserves only our non-token board, but permits opposing threats and a Sangan-only search", () => {
  const options = [
    choice("tribute", "activate", card(53582587, 0)),
    choice("pass", "pass"),
  ];
  assert.deepEqual(
    decide("chain", options, { monsters: [card(77585513, 0, "monster")] }),
    ["pass"],
  );
  assert.deepEqual(
    decide(
      "chain",
      options,
      { monsters: [card(77585513, 0, "monster")] },
      { monsters: [card(70074904, 1, "monster")] },
    ),
    ["tribute"],
  );
  assert.deepEqual(
    decide("chain", options, { monsters: [card(26202165, 0, "monster")] }),
    ["tribute"],
  );
});

test("Nobleman selection targets the opposing face-down monster only in its effect context", () => {
  const ours = card(31560081, 0, "monster", "faceDownDefense");
  const theirs = card(31560081, 1, "monster", "faceDownDefense");
  const { code: omitted, ...concealed } = theirs;
  void omitted;
  const options = [
    choice("ours", "select", ours),
    choice("theirs", "select", concealed),
  ];
  assert.deepEqual(decide("selectCard", options, {}, {}, [effect(71044499)]), [
    "theirs",
  ]);
  assert.deepEqual(decide("selectCard", options), ["ours"]);
});

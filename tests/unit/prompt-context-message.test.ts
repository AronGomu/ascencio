import { describe, expect, it } from "vitest";
import {
  promptContextMessage,
  promptContextPlainText,
  type PromptMessageSegment,
} from "../../src/battle/app/presentation/prompt-context-message.ts";
import type { DuelPresentationEvent } from "../../src/battle/duel/contracts/duel-presentation-event.ts";
import {
  cardCode,
  cardInstanceId,
  choiceId,
  promptId,
  snapshotId,
} from "../../src/battle/duel/contracts/ids.ts";
import type { PlayerPrompt } from "../../src/battle/duel/contracts/player-prompt.ts";
import type {
  PlayerIndex,
  PublicChainLink,
  PublicChainTarget,
  PublicDuelState,
} from "../../src/battle/duel/contracts/public-duel-state.ts";

const CARD_TEXTS = new Map([
  [89631139, { name: "Blue-Eyes White Dragon" }],
  [97590747, { name: "The Legendary Fisherman" }],
  [5053103, { name: "Axe Raider" }],
]);

function chainPrompt(overrides: Partial<PlayerPrompt> = {}): PlayerPrompt {
  return {
    id: promptId("prompt-1"),
    kind: "chain",
    player: 0,
    title: "Choose a chain response",
    choices: [
      { id: choiceId("choice-pass"), label: "Pass", action: "pass" },
      { id: choiceId("choice-chain"), label: "Chain", action: "activate" },
    ],
    minimum: 1,
    maximum: 1,
    cancelable: true,
    ordered: false,
    ...overrides,
  } as PlayerPrompt;
}

function link(overrides: Partial<PublicChainLink> = {}): PublicChainLink {
  return {
    index: 1,
    controller: 1,
    sourceIdentityVisible: true,
    sourceInstanceId: cardInstanceId("chain-source"),
    sourceCard: cardCode(89631139),
    label: "Mystical Space Typhoon",
    phase: "pending",
    outcome: "normal",
    ...overrides,
  };
}

function target(overrides: Partial<PublicChainTarget> = {}): PublicChainTarget {
  return {
    identityVisible: true,
    controller: 0,
    location: "monster",
    instanceId: cardInstanceId("target-1"),
    card: cardCode(89631139),
    ...overrides,
  };
}

function snapshot(chain: readonly PublicChainLink[] = []): PublicDuelState {
  return {
    snapshotId: snapshotId("b".repeat(64)),
    revision: 1,
    turn: 2,
    turnPlayer: 1 as PlayerIndex,
    phase: "main1",
    layout: { extraMonsterZones: true },
    players: [emptyPlayer(0), emptyPlayer(1)],
    chain,
  };
}

function emptyPlayer(player: PlayerIndex) {
  return {
    player,
    lifePoints: 8000,
    handCount: 5,
    deckCount: 35,
    extraDeckCount: 0,
    graveyardCount: 0,
    banishedCount: 0,
    deck: [],
    hand: [],
    extraDeck: [],
    monsters: [],
    spellsAndTraps: [],
    graveyard: [],
    banished: [],
  };
}

function messageFor(input: {
  readonly chain?: readonly PublicChainLink[];
  readonly events?: readonly DuelPresentationEvent[];
  readonly prompt?: PlayerPrompt;
}): readonly PromptMessageSegment[] | null {
  return promptContextMessage({
    prompt: input.prompt ?? chainPrompt(),
    snapshot: snapshot(input.chain ?? []),
    events: input.events ?? [],
    cardTexts: CARD_TEXTS,
  });
}

function textFor(input: Parameters<typeof messageFor>[0]): string {
  const segments = messageFor(input);
  return segments === null ? "" : promptContextPlainText(segments);
}

describe("prompt context message — chain is open", () => {
  it("1.1 names the activating seat and the card", () => {
    const segments = messageFor({ chain: [link()] });
    expect(segments).toEqual([
      { kind: "actor", value: "Opponent" },
      { kind: "text", value: " has activated " },
      { kind: "card", value: "Mystical Space Typhoon" },
      { kind: "text", value: "." },
    ]);
  });

  it("1.1 swaps actor and auxiliary for the local seat", () => {
    expect(textFor({ chain: [link({ controller: 0 })] })).toBe(
      "You have activated Mystical Space Typhoon.",
    );
  });

  it("1.2 names a single target and its zone", () => {
    const segments = messageFor({ chain: [link({ targets: [target()] })] });
    expect(segments).toEqual([
      { kind: "actor", value: "Opponent" },
      { kind: "text", value: " has activated " },
      { kind: "card", value: "Mystical Space Typhoon" },
      { kind: "text", value: ", targeting " },
      { kind: "card", value: "Blue-Eyes White Dragon" },
      { kind: "text", value: " in the " },
      { kind: "zone", value: "Monster Zone" },
      { kind: "text", value: "." },
    ]);
  });

  it("1.3 joins two targets with and", () => {
    expect(
      textFor({
        chain: [
          link({
            targets: [
              target(),
              target({
                instanceId: cardInstanceId("target-2"),
                card: cardCode(5053103),
                location: "graveyard",
              }),
            ],
          }),
        ],
      }),
    ).toBe(
      "Opponent has activated Mystical Space Typhoon, targeting Blue-Eyes White Dragon in the Monster Zone and Axe Raider in the Graveyard.",
    );
  });

  it("1.4 caps the list at two targets and counts the rest", () => {
    expect(
      textFor({
        chain: [
          link({
            targets: [
              target(),
              target({
                instanceId: cardInstanceId("target-2"),
                card: cardCode(5053103),
                location: "graveyard",
              }),
              target({
                instanceId: cardInstanceId("target-3"),
                card: cardCode(97590747),
                location: "hand",
              }),
              target({
                instanceId: cardInstanceId("target-4"),
                card: cardCode(97590747),
                location: "hand",
              }),
            ],
          }),
        ],
      }),
    ).toBe(
      "Opponent has activated Mystical Space Typhoon, targeting Blue-Eyes White Dragon in the Monster Zone, Axe Raider in the Graveyard and 2 more.",
    );
  });

  it("1.5 keeps a hidden target anonymous", () => {
    expect(
      textFor({
        chain: [
          link({
            targets: [
              {
                identityVisible: false,
                controller: 1,
                location: "spellTrap",
              },
            ],
          }),
        ],
      }),
    ).toBe(
      "Opponent has activated Mystical Space Typhoon, targeting a face-down card in the Spell/Trap Zone.",
    );
  });

  it("1.6 keeps a hidden source anonymous", () => {
    expect(
      textFor({
        chain: [
          {
            index: 1,
            controller: 1,
            sourceIdentityVisible: false,
            label: "Card effect",
            phase: "pending",
            outcome: "normal",
          },
        ],
      }),
    ).toBe("Opponent has activated a face-down card.");
  });

  it("1.7 names the link number from the second link on", () => {
    expect(
      textFor({ chain: [link(), link({ index: 2, controller: 0 })] }),
    ).toBe("You have activated Mystical Space Typhoon. Chain link 2.");
  });

  it("3.3 falls back to the code when no card text exists", () => {
    expect(
      textFor({
        chain: [link({ targets: [target({ card: cardCode(424242) })] })],
      }),
    ).toBe(
      "Opponent has activated Mystical Space Typhoon, targeting Card 424242 in the Monster Zone.",
    );
  });
});

describe("prompt context message — chain is empty", () => {
  it("2.1 reads a Normal Summon", () => {
    expect(
      textFor({
        events: [{ type: "summon", player: 1, card: cardCode(89631139) }],
      }),
    ).toBe("Opponent has summoned Blue-Eyes White Dragon.");
  });

  it("2.2 reads a Special Summon", () => {
    expect(
      textFor({
        events: [
          { type: "specialSummon", player: 1, card: cardCode(89631139) },
        ],
      }),
    ).toBe("Opponent has Special Summoned Blue-Eyes White Dragon.");
  });

  it("2.3 reads a Flip Summon", () => {
    expect(
      textFor({
        events: [{ type: "flipSummon", player: 0, card: cardCode(5053103) }],
      }),
    ).toBe("You have Flip Summoned Axe Raider.");
  });

  it("2.4 names your own Set card", () => {
    expect(
      textFor({
        events: [{ type: "set", player: 0, card: cardCode(5053103) }],
      }),
    ).toBe("You have set Axe Raider.");
  });

  it("2.5 keeps the opponent's Set card anonymous", () => {
    expect(textFor({ events: [{ type: "set", player: 1 }] })).toBe(
      "Opponent has set a card.",
    );
  });

  it("2.6 and 2.7 distinguish attack declarations", () => {
    expect(
      textFor({ events: [{ type: "attack", player: 1, direct: false }] }),
    ).toBe("Opponent has declared an attack.");
    expect(
      textFor({ events: [{ type: "attack", player: 1, direct: true }] }),
    ).toBe("Opponent has declared a direct attack.");
  });

  it("2.8 and 2.9 count drawn cards", () => {
    expect(
      textFor({ events: [{ type: "cardDrawn", player: 1, count: 1 }] }),
    ).toBe("Opponent has drawn a card.");
    expect(
      textFor({ events: [{ type: "cardDrawn", player: 1, count: 3 }] }),
    ).toBe("Opponent has drawn 3 cards.");
  });

  it("2.10 and 2.11 read life point changes", () => {
    expect(
      textFor({ events: [{ type: "damage", player: 1, amount: 800 }] }),
    ).toBe("Opponent has taken 800 damage.");
    expect(
      textFor({ events: [{ type: "recover", player: 0, amount: 500 }] }),
    ).toBe("You have recovered 500 LP.");
  });

  it("2.12 and 2.13 read position changes", () => {
    expect(
      textFor({
        events: [
          {
            type: "positionChanged",
            card: cardCode(5053103),
            position: "faceUpDefense",
          },
        ],
      }),
    ).toBe("Axe Raider changed to face-up Defense Position.");
    expect(
      textFor({
        events: [{ type: "positionChanged", position: "faceDownDefense" }],
      }),
    ).toBe("A card changed position.");
  });

  it("2.14 reads a card movement", () => {
    expect(
      textFor({
        events: [
          {
            type: "cardMoved",
            card: cardCode(5053103),
            from: "hand",
            to: "graveyard",
          },
        ],
      }),
    ).toBe("Axe Raider moved from the Hand to the Graveyard.");
  });

  it("2.15 stays silent when nothing since the turn start qualifies", () => {
    expect(
      messageFor({
        events: [
          { type: "summon", player: 1, card: cardCode(89631139) },
          { type: "turnStarted", player: 0, turn: 3 },
          { type: "phaseChanged", phase: "main1" },
        ],
      }),
    ).toBeNull();
  });

  it("2.15 ignores bookkeeping events and reads the newest action", () => {
    expect(
      textFor({
        events: [
          { type: "summon", player: 1, card: cardCode(89631139) },
          { type: "chainChanged", size: 0 },
          { type: "lifePointsChanged", player: 1, lifePoints: 7200 },
        ],
      }),
    ).toBe("Opponent has summoned Blue-Eyes White Dragon.");
  });
});

describe("prompt context message — guards", () => {
  it("3.1 stays silent for prompts other than chain windows", () => {
    expect(
      messageFor({
        chain: [link()],
        prompt: chainPrompt({ kind: "selectCard", title: "Select card(s)" }),
      }),
    ).toBeNull();
  });

  it("3.2 stays silent without a snapshot", () => {
    expect(
      promptContextMessage({
        prompt: chainPrompt(),
        snapshot: null,
        events: [],
        cardTexts: CARD_TEXTS,
      }),
    ).toBeNull();
  });

  it("3.4 prefixes a forced window", () => {
    expect(
      textFor({
        chain: [link()],
        prompt: chainPrompt({ cancelable: false }),
      }),
    ).toBe("You must respond. Opponent has activated Mystical Space Typhoon.");
  });
});

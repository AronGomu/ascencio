import { describe, expect, it } from "vitest";
import {
  cardInstanceId,
  choiceId,
  promptId,
  type ChoiceId,
} from "../../src/duel/contracts/ids.ts";
import type {
  PlayerPrompt,
  PromptChoice,
} from "../../src/duel/contracts/player-prompt.ts";
import type {
  PublicDuelState,
  PublicLocation,
} from "../../src/duel/contracts/public-duel-state.ts";
import { mapPromptToInteractionSpec } from "../../src/app/prompts/interaction-spec.ts";
import { mapSnapshotToBoard } from "../../src/field/board-view-model.ts";
import {
  offFieldTargetEntries,
  offFieldZoneBadge,
} from "../../src/field/off-field-target-list.ts";
import {
  concealedStateCard,
  deckSlots,
  publicStateCard,
  PUBLIC_STATE_CARD_TEXTS,
} from "../fixtures/board-public-states.ts";
import { snapshotId } from "../../src/duel/contracts/ids.ts";

const CONTEXT = { workerGeneration: 1, sessionGeneration: 1 } as const;

const SNAPSHOT: PublicDuelState = {
  snapshotId: snapshotId("f".repeat(64)),
  revision: 3,
  turn: 2,
  turnPlayer: 0,
  phase: "main1",
  layout: { extraMonsterZones: true },
  players: [
    {
      player: 0,
      lifePoints: 8000,
      deckCount: 3,
      deck: deckSlots(0, 3),
      extraDeckCount: 2,
      handCount: 2,
      hand: [
        publicStateCard("own-hand-0", 97590747, 0, "hand", 0),
        publicStateCard("own-hand-1", 5053103, 0, "hand", 1),
      ],
      extraDeck: [
        publicStateCard("own-extra-0", 89631139, 0, "extra", 0),
        publicStateCard("own-extra-1", 5053103, 0, "extra", 1),
      ],
      monsters: [publicStateCard("own-monster", 97590747, 0, "monster", 0)],
      spellsAndTraps: [],
      graveyard: [
        publicStateCard("own-gy-0", 89631139, 0, "graveyard", 0),
        publicStateCard("own-gy-1", 5053103, 0, "graveyard", 1),
      ],
      banished: [publicStateCard("own-banished-0", 97590747, 0, "banished", 0)],
    },
    {
      player: 1,
      lifePoints: 8000,
      deckCount: 3,
      deck: deckSlots(1, 3),
      extraDeckCount: 0,
      handCount: 1,
      hand: [concealedStateCard("opponent-hand-0", 1, "hand", 0)],
      extraDeck: [],
      monsters: [],
      spellsAndTraps: [],
      graveyard: [],
      banished: [concealedStateCard("opponent-banished-0", 1, "banished", 0)],
    },
  ],
  chain: [],
};

const BOARD_RESULT = mapSnapshotToBoard(SNAPSHOT, PUBLIC_STATE_CARD_TEXTS);
if (!BOARD_RESULT.ok) throw new Error("Expected a valid target-list board");
const BOARD = BOARD_RESULT.value;

function targetChoice(
  id: string,
  location: PublicLocation,
  sequence: number,
  controller: 0 | 1 = 0,
  label = id,
): PromptChoice {
  return {
    id: choiceId(id),
    label,
    action: "select",
    card: {
      instanceId: cardInstanceId(`choice-${id}`),
      controller,
      location,
      sequence,
      position: "faceDownDefense",
    },
  };
}

function entriesFor(
  choices: readonly PromptChoice[],
  overrides: Partial<PlayerPrompt> = {},
) {
  const prompt: PlayerPrompt = {
    id: promptId("off-field-target-prompt"),
    kind: "selectCard",
    player: 0,
    title: "Select card(s)",
    choices,
    minimum: 1,
    maximum: choices.length,
    cancelable: false,
    ordered: false,
    ...overrides,
  };
  const spec = mapPromptToInteractionSpec(prompt, SNAPSHOT, BOARD, CONTEXT);
  if (spec.kind === "inactive") throw new Error("Expected an active spec");
  return offFieldTargetEntries(spec, SNAPSHOT, PUBLIC_STATE_CARD_TEXTS);
}

describe("offFieldZoneBadge", () => {
  it("names the five off-field zones and nothing else", () => {
    expect(offFieldZoneBadge("hand")).toBe("HAND");
    expect(offFieldZoneBadge("graveyard")).toBe("GY");
    expect(offFieldZoneBadge("deck")).toBe("DECK");
    expect(offFieldZoneBadge("banished")).toBe("BAN");
    expect(offFieldZoneBadge("extra")).toBe("EXTRA");
    expect(offFieldZoneBadge("monster")).toBeNull();
    expect(offFieldZoneBadge("spellTrap")).toBeNull();
    expect(offFieldZoneBadge("field")).toBeNull();
  });
});

describe("offFieldTargetEntries", () => {
  it("aggregates every zone once, in raw prompt order", () => {
    const entries = entriesFor([
      targetChoice("gy", "graveyard", 1),
      targetChoice("hand", "hand", 0),
      targetChoice("deck", "deck", 2),
      targetChoice("ban", "banished", 0),
      targetChoice("extra", "extra", 1),
    ]);

    expect(entries.map(({ zoneBadge }) => zoneBadge)).toEqual([
      "GY",
      "HAND",
      "DECK",
      "BAN",
      "EXTRA",
    ]);
    expect(entries.map(({ id }) => id)).toEqual([
      "target:0:graveyard:1",
      "target:0:hand:0",
      "target:0:deck:2",
      "target:0:banished:0",
      "target:0:extra:1",
    ]);
  });

  it("joins an engine deck sequence onto the top-relative list slot", () => {
    const [top, bottom] = entriesFor([
      targetChoice("deck-top", "deck", 2),
      targetChoice("deck-bottom", "deck", 0),
    ]);

    // Three-card deck: engine sequence 2 is the top card, sequence 0 the last.
    expect(top?.position).toBe(1);
    expect(bottom?.position).toBe(3);
  });

  it("takes the name and code from the projection only", () => {
    const [entry] = entriesFor([targetChoice("gy", "graveyard", 0)]);

    expect(entry?.identityVisible).toBe(true);
    expect(entry?.code).toBe(89631139);
    expect(entry?.label).toBe("Blue-Eyes White Dragon");
    expect(entry?.position).toBe(1);
  });

  it("keeps an unattested opponent target answerable and unnamed", () => {
    const [hand, banished] = entriesFor([
      targetChoice("opp-hand", "hand", 0, 1),
      targetChoice("opp-ban", "banished", 0, 1),
    ]);

    for (const entry of [hand, banished]) {
      expect(entry?.identityVisible).toBe(false);
      expect(entry?.code).toBeUndefined();
      expect(entry?.label).toBe("Face-down card");
      expect(entry?.choices).toHaveLength(1);
    }
    expect(hand?.zoneLabel).toBe("Opponent Hand");
    expect(banished?.zoneLabel).toBe("Opponent Banished");
  });

  it("keeps an address the projection does not carry as a hidden legal target", () => {
    const [entry] = entriesFor([targetChoice("ghost", "graveyard", 9)]);

    expect(entry?.identityVisible).toBe(false);
    expect(entry?.code).toBeUndefined();
    expect(entry?.label).toBe("Face-down card");
    expect(entry?.sequence).toBe(9);
  });

  it("groups duplicate choices for one address under a single entry", () => {
    const entries = entriesFor([
      targetChoice("gy-a", "graveyard", 0, 0, "Banish"),
      targetChoice("gy-b", "graveyard", 0, 0, "Shuffle back"),
    ]);

    expect(entries).toHaveLength(1);
    expect(entries[0]?.choices.map(({ id }) => id)).toEqual([
      choiceId("gy-a"),
      choiceId("gy-b"),
    ]);
  });

  it("lists only off-field choices, never a mounted or global one", () => {
    const entries = entriesFor([
      {
        id: choiceId("mounted"),
        label: "Mounted monster",
        action: "select",
        card: {
          instanceId: cardInstanceId("own-monster"),
          controller: 0,
          location: "monster",
          sequence: 0,
          position: "faceUpAttack",
        },
      },
      { id: choiceId("pass"), label: "Pass", action: "pass" },
      targetChoice("gy", "graveyard", 0),
    ]);

    expect(entries.map(({ id }) => id)).toEqual(["target:0:graveyard:0"]);
  });

  it("owner-aware zone labels expand the badge text", () => {
    const entries = entriesFor([
      targetChoice("gy", "graveyard", 0),
      targetChoice("ban", "banished", 0),
      targetChoice("extra", "extra", 0),
    ]);

    expect(entries.map(({ zoneLabel }) => zoneLabel)).toEqual([
      "Your Graveyard",
      "Your Banished",
      "Your Extra Deck",
    ]);
  });

  it("freezes the list and each entry's choices", () => {
    const entries = entriesFor([targetChoice("gy", "graveyard", 0)]);

    expect(Object.isFrozen(entries)).toBe(true);
    expect(Object.isFrozen(entries[0])).toBe(true);
    expect(Object.isFrozen(entries[0]?.choices)).toBe(true);
  });

  it("returns nothing for a prompt without off-field targets", () => {
    const spec = mapPromptToInteractionSpec(
      {
        id: promptId("no-off-field"),
        kind: "selectCard",
        player: 0,
        title: "Select card(s)",
        choices: [
          {
            id: choiceId("mounted") as ChoiceId,
            label: "Mounted monster",
            action: "select",
            card: {
              instanceId: cardInstanceId("own-monster"),
              controller: 0,
              location: "monster",
              sequence: 0,
              position: "faceUpAttack",
            },
          },
        ],
        minimum: 1,
        maximum: 1,
        cancelable: false,
        ordered: false,
      },
      SNAPSHOT,
      BOARD,
      CONTEXT,
    );
    if (spec.kind === "inactive") throw new Error("Expected an active spec");

    expect(
      offFieldTargetEntries(spec, SNAPSHOT, PUBLIC_STATE_CARD_TEXTS),
    ).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import type { DuelPresentationEvent } from "../../src/battle/duel/contracts/duel-presentation-event.ts";
import {
  cardCode,
  cardInstanceId,
} from "../../src/battle/duel/contracts/ids.ts";
import { formatDuelLogEntry } from "../../src/battle/app/presentation/format-duel-log-entry.ts";
import { formatDuelPresentationEvent } from "../../src/battle/app/presentation/format-duel-presentation-event.ts";

const EVENTS: readonly DuelPresentationEvent[] = [
  { type: "duelStarted" },
  { type: "turnStarted", player: 0, turn: 2 },
  { type: "phaseChanged", phase: "main1" },
  { type: "cardDrawn", player: 1, count: 2 },
  { type: "cardsShuffled", player: 0, location: "deck" },
  {
    type: "cardMoved",
    card: cardCode(123),
    instanceId: cardInstanceId("ignored-instance"),
    from: "hand",
    to: "monster",
  },
  { type: "summon", player: 0, card: cardCode(123) },
  { type: "specialSummon", player: 1, card: cardCode(123) },
  { type: "flipSummon", player: 0, card: cardCode(123) },
  { type: "set", player: 1 },
  { type: "positionChanged", position: "faceUpDefense" },
  { type: "attack", player: 0, direct: true },
  { type: "damage", player: 1, amount: 500 },
  { type: "recover", player: 0, amount: 300 },
  { type: "lifePointsChanged", player: 1, lifePoints: 7500 },
  { type: "chainChanged", size: 2 },
  { type: "hint", message: "Transient engine hint" },
];

describe("duel presentation formatting", () => {
  it("makes an explicit durable-log decision for every presentation variant", () => {
    expect(EVENTS.map(({ type }) => type)).toEqual([
      "duelStarted",
      "turnStarted",
      "phaseChanged",
      "cardDrawn",
      "cardsShuffled",
      "cardMoved",
      "summon",
      "specialSummon",
      "flipSummon",
      "set",
      "positionChanged",
      "attack",
      "damage",
      "recover",
      "lifePointsChanged",
      "chainChanged",
      "hint",
    ]);
    for (const event of EVENTS) {
      const formatted = formatDuelLogEntry(event);
      if (event.type === "hint") expect(formatted).toBeNull();
      else {
        expect(formatted).toEqual({
          sourceType: event.type,
          text: formatDuelPresentationEvent(event),
        });
        expect(Object.isFrozen(formatted)).toBe(true);
      }
    }
  });

  it("uses concealed card fallbacks without retaining instance identity", () => {
    const formatted = formatDuelLogEntry({
      type: "cardMoved",
      instanceId: cardInstanceId("private-instance"),
      from: "hand",
      to: "monster",
    });
    expect(formatted).toEqual({
      sourceType: "cardMoved",
      text: "A card moved from hand to monster.",
    });
    expect(JSON.stringify(formatted)).not.toContain("private-instance");
  });

  it.each([
    [0, "The chain resolved."],
    [1, "The chain now has 1 link."],
    [3, "The chain now has 3 links."],
  ] as const)("formats chain size %i", (size, text) => {
    expect(formatDuelLogEntry({ type: "chainChanged", size })).toEqual({
      sourceType: "chainChanged",
      text,
    });
  });
});

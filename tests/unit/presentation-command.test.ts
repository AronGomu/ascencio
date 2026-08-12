import { describe, expect, it, vi } from "vitest";
import type { DuelPresentationEvent } from "../../src/duel/contracts/duel-presentation-event.ts";
import {
  PresentationScheduler,
  presentationCommandForDomEvent,
  presentationCommandForEvent,
} from "../../src/app/presentation/presentation-command.ts";
import { cardCode, cardInstanceId } from "../../src/duel/contracts/ids.ts";
import type {
  BoardCardView,
  BoardViewModel,
} from "../../src/field/board-view-model.ts";

const events: readonly DuelPresentationEvent[] = [
  { type: "duelStarted" },
  { type: "turnStarted", player: 0, turn: 1 },
  { type: "phaseChanged", phase: "main1" },
  { type: "cardDrawn", player: 0, count: 1 },
  { type: "cardsShuffled", player: 1, location: "deck" },
  { type: "cardMoved", from: "hand", to: "monster" },
  { type: "summon", player: 0 },
  { type: "specialSummon", player: 0 },
  { type: "flipSummon", player: 0 },
  { type: "set", player: 0 },
  { type: "positionChanged", position: "faceUpDefense" },
  { type: "attack", player: 0, direct: true },
  { type: "damage", player: 1, amount: 1200 },
  { type: "recover", player: 0, amount: 500 },
  { type: "lifePointsChanged", player: 1, lifePoints: 6800 },
  { type: "chainChanged", size: 2 },
  { type: "hint", message: "Resolve effect" },
];

const MOVED_CARD: BoardCardView = {
  id: "moved-card",
  targetId: "card:moved-card",
  instanceId: cardInstanceId("moved-card"),
  code: cardCode(97590747),
  player: 0,
  owner: 0,
  zoneId: "p0:mainMonster:0",
  sequence: 0,
  position: "faceUpAttack",
  orientation: "upright",
  facing: "self",
  hidden: false,
  label: "Moved card",
  x: 0.5,
  y: 0.5,
  width: 0.1,
  height: 0.15,
  counters: [],
  materials: [],
  chainLinks: [],
  image: { kind: "face", code: cardCode(97590747) },
};

const BOARD: BoardViewModel = {
  zones: [],
  cards: [MOVED_CARD],
  stacks: [],
  nav: new Map(),
};

const PREVIOUS_BOARD: BoardViewModel = {
  ...BOARD,
  cards: [{ ...MOVED_CARD, zoneId: "p0:hand" }],
};

describe("presentation commands", () => {
  it("classifies every presentation event without affecting engine state", () => {
    expect(
      events.map((event) => presentationCommandForEvent(event).kind),
    ).toEqual([
      "notice",
      "notice",
      "notice",
      "notice",
      "notice",
      "card-move",
      "summon",
      "summon",
      "summon",
      "set",
      "position",
      "attack",
      "life-points",
      "life-points",
      "life-points",
      "chain",
      "notice",
    ]);
  });

  it("maps resolved DOM move, summon, set, position, and attack endpoints", () => {
    const context = {
      currentBoard: BOARD,
      previousBoard: PREVIOUS_BOARD,
      attackEndpoints: {
        fromTargetId: "card:moved-card" as const,
        toTargetId: "zone:p1:hand" as const,
      },
    };
    expect(
      presentationCommandForDomEvent(
        {
          type: "cardMoved",
          instanceId: cardInstanceId("moved-card"),
          from: "hand",
          to: "monster",
        },
        context,
      ),
    ).toMatchObject({
      kind: "card-move",
      fromTargetId: "zone:p0:hand",
      toTargetId: "card:moved-card",
    });
    for (const event of [
      { type: "summon", player: 0, card: cardCode(97590747) },
      { type: "set", player: 0, card: cardCode(97590747) },
      {
        type: "positionChanged",
        card: cardCode(97590747),
        position: "faceUpDefense",
      },
    ] satisfies readonly DuelPresentationEvent[]) {
      expect(presentationCommandForDomEvent(event, context)).toMatchObject({
        targetId: "card:moved-card",
      });
    }
    expect(
      presentationCommandForDomEvent(
        { type: "attack", player: 0, direct: false },
        context,
      ),
    ).toMatchObject({
      kind: "attack",
      fromTargetId: "card:moved-card",
      toTargetId: "zone:p1:hand",
    });
  });

  it("keeps LP and chain feedback while unknown DOM endpoints degrade to notices", () => {
    expect(
      presentationCommandForDomEvent(
        { type: "damage", player: 1, amount: 1200 },
        { currentBoard: BOARD },
      ),
    ).toMatchObject({ kind: "life-points", durationMs: 420 });
    expect(
      presentationCommandForDomEvent(
        { type: "chainChanged", size: 2 },
        { currentBoard: BOARD },
      ),
    ).toMatchObject({ kind: "chain", durationMs: 420 });
    expect(
      presentationCommandForDomEvent(
        {
          type: "cardMoved",
          instanceId: cardInstanceId("unknown"),
          from: "hand",
          to: "monster",
        },
        { currentBoard: BOARD, previousBoard: PREVIOUS_BOARD },
      ),
    ).toMatchObject({ kind: "notice", label: /moved/i });
    expect(
      presentationCommandForDomEvent(
        { type: "attack", player: 0, direct: false },
        { currentBoard: BOARD },
      ),
    ).toMatchObject({ kind: "notice", label: "Attack declared" });
  });

  it("removes animation duration for reduced-motion users", () => {
    expect(
      events.map(
        (event) => presentationCommandForEvent(event, true).durationMs,
      ),
    ).toEqual(Array.from({ length: events.length }, () => 0));
  });

  it("cancels queued feedback on reset without delaying callers", async () => {
    const scheduler = new PresentationScheduler();
    const present = vi.fn();
    scheduler.run(presentationCommandForEvent(events[0]!), present);
    scheduler.cancel();
    await Promise.resolve();
    expect(present).not.toHaveBeenCalled();
  });
});

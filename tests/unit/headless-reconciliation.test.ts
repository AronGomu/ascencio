import { describe, expect, it, vi } from "vitest";
import { DuelOperationError } from "../../src/duel/contracts/duel-error.ts";
import { cardCode, snapshotId } from "../../src/duel/contracts/ids.ts";
import type { ParsedDeck } from "../../src/duel/presets/deck-parser.ts";
import { HeadlessDuelController } from "../../src/worker/HeadlessDuelController.ts";
import { routineLogError } from "../../src/worker/duel-errors.ts";
import { DuelSession } from "../../src/worker/engine/DuelSession.ts";
import type {
  EngineCardQuery,
  EngineCardQueryResult,
  EngineLocationQuery,
  EngineLocationQueryResult,
  EngineMessage,
} from "../../src/worker/engine/OcgCoreAdapter.ts";
import {
  EngineLocation,
  EngineMessageType,
  EnginePosition,
  EngineProcess,
} from "../../src/worker/engine/engine-constants.ts";
import {
  createFakeOcgCoreAdapter,
  EMPTY_DECK,
  FAKE_DEPENDENCIES,
} from "../fixtures/fake-ocgcore-adapter.ts";

const EXTRA_CODE = cardCode(97590747);
const EXTRA_DECK: ParsedDeck = Object.freeze({
  main: Object.freeze([]),
  extra: Object.freeze([EXTRA_CODE]),
  side: Object.freeze([]),
});

function moveExtraToMonster() {
  return {
    type: EngineMessageType.MOVE,
    card: EXTRA_CODE,
    from: {
      controller: 0 as const,
      location: EngineLocation.EXTRA as never,
      sequence: 0,
      position: EnginePosition.FACE_DOWN_DEFENSE,
    },
    to: {
      controller: 0 as const,
      location: EngineLocation.MONSTER as never,
      sequence: 0,
      position: EnginePosition.FACE_UP_ATTACK,
    },
  } as const;
}

function win() {
  return {
    type: EngineMessageType.WIN,
    player: 0 as const,
    reason: 1,
  } as const;
}

async function controllerWithQuery(
  queryLocation: (query: EngineLocationQuery) => EngineLocationQueryResult,
) {
  const harness = await createFakeOcgCoreAdapter(
    () => ({
      steps: [
        {
          status: EngineProcess.END,
          messages: [moveExtraToMonster(), win()],
        },
      ],
    }),
    { queryLocation },
  );
  const session = DuelSession.create({
    adapter: harness.adapter,
    dependencies: FAKE_DEPENDENCIES,
    playerDeck: EXTRA_DECK,
    opponentDeck: EMPTY_DECK,
    configuration: {
      mode: "programmed",
      seed: [1n, 2n, 3n, 4n],
      playerDeckOrder: [],
      opponentDeckOrder: [],
    },
  });
  return {
    harness,
    session,
    controller: new HeadlessDuelController({
      session,
      dependencies: FAKE_DEPENDENCIES,
      snapshotId: snapshotId("reconcile"),
      presetId: "reconcile",
      deckCounts: [0, 0],
      extraDeckCounts: [1, 0],
    }),
  };
}

async function controllerWithOverlayQuery(
  queryCard: (query: EngineCardQuery) => unknown,
  player: 0 | 1 = 0,
  materialPosition:
    | typeof EnginePosition.FACE_UP_ATTACK
    | typeof EnginePosition.FACE_DOWN_DEFENSE = EnginePosition.FACE_UP_ATTACK,
) {
  const harness = await createFakeOcgCoreAdapter(
    () => ({
      steps: [
        {
          status: EngineProcess.WAITING,
          messages: [
            {
              type: EngineMessageType.MOVE,
              card: 97590747,
              from: {
                controller: player,
                location: EngineLocation.DECK as never,
                sequence: 0,
                position: EnginePosition.FACE_DOWN_DEFENSE,
              },
              to: {
                controller: player,
                location: EngineLocation.MONSTER as never,
                sequence: 0,
                position: EnginePosition.FACE_UP_ATTACK,
              },
            },
            {
              type: EngineMessageType.MOVE,
              card: 5053103,
              from: {
                controller: player,
                location: EngineLocation.DECK as never,
                sequence: 0,
                position: EnginePosition.FACE_DOWN_DEFENSE,
              },
              to: {
                controller: player,
                location: EngineLocation.MONSTER as never,
                sequence: 0,
                position: materialPosition,
                overlay_sequence: 0,
              },
            },
            {
              type: EngineMessageType.SELECT_YES_NO,
              player: 0,
              description: 0n,
            },
          ],
        },
      ],
    }),
    {
      queryCard: queryCard as (query: EngineCardQuery) => EngineCardQueryResult,
    },
  );
  const session = DuelSession.create({
    adapter: harness.adapter,
    dependencies: FAKE_DEPENDENCIES,
    playerDeck: EMPTY_DECK,
    opponentDeck: EMPTY_DECK,
    configuration: {
      mode: "programmed",
      seed: [1n, 2n, 3n, 4n],
      playerDeckOrder: [],
      opponentDeckOrder: [],
    },
  });
  return {
    harness,
    session,
    controller: new HeadlessDuelController({
      session,
      dependencies: FAKE_DEPENDENCIES,
      snapshotId: snapshotId("overlay-failure"),
      presetId: "overlay-failure",
      deckCounts: player === 0 ? [2, 0] : [0, 2],
      extraDeckCounts: [0, 0],
    }),
  };
}

describe("HeadlessDuelController reconciliation", () => {
  it("queries Extra synchronously before publishing the final snapshot", async () => {
    let queryCount = 0;
    const { controller, harness } = await controllerWithQuery(() =>
      queryCount++ === 0
        ? [
            {
              code: EXTRA_CODE,
              owner: 0,
              position: EnginePosition.FACE_DOWN_DEFENSE,
              isPublic: false,
              isHidden: true,
            },
          ]
        : [],
    );

    const advance = controller.advance();

    expect(harness.locationQueries).toHaveLength(2);
    expect(harness.locationQueries[0]).toMatchObject({
      controller: 0,
      location: EngineLocation.EXTRA,
    });
    expect(advance.state.players[0]).toMatchObject({
      extraDeckCount: 0,
      extraDeck: [],
      monsters: [{ code: EXTRA_CODE, sequence: 0 }],
    });
  });

  it("adopts reversed authoritative Extra order before the first MOVE", async () => {
    const first = cardCode(10_000_001);
    const second = cardCode(10_000_002);
    const extraDeck: ParsedDeck = Object.freeze({
      main: Object.freeze([]),
      extra: Object.freeze([first, second]),
      side: Object.freeze([]),
    });
    let queryCount = 0;
    const harness = await createFakeOcgCoreAdapter(
      () => ({
        steps: [
          {
            status: EngineProcess.END,
            messages: [
              {
                type: EngineMessageType.MOVE,
                card: second,
                from: {
                  controller: 0,
                  location: EngineLocation.EXTRA as never,
                  sequence: 0,
                  position: EnginePosition.FACE_DOWN_DEFENSE,
                },
                to: {
                  controller: 0,
                  location: EngineLocation.MONSTER as never,
                  sequence: 0,
                  position: EnginePosition.FACE_UP_ATTACK,
                },
              },
              win(),
            ],
          },
        ],
      }),
      {
        queryLocation: () =>
          queryCount++ === 0
            ? [
                {
                  code: second,
                  owner: 0,
                  position: EnginePosition.FACE_DOWN_DEFENSE,
                  isPublic: false,
                  isHidden: true,
                },
                {
                  code: first,
                  owner: 0,
                  position: EnginePosition.FACE_DOWN_DEFENSE,
                  isPublic: false,
                  isHidden: true,
                },
              ]
            : [
                {
                  code: first,
                  owner: 0,
                  position: EnginePosition.FACE_DOWN_DEFENSE,
                  isPublic: false,
                  isHidden: true,
                },
              ],
      },
    );
    const session = DuelSession.create({
      adapter: harness.adapter,
      dependencies: FAKE_DEPENDENCIES,
      playerDeck: extraDeck,
      opponentDeck: EMPTY_DECK,
      configuration: {
        mode: "programmed",
        seed: [1n, 2n, 3n, 4n],
        playerDeckOrder: [],
        opponentDeckOrder: [],
      },
    });
    const controller = new HeadlessDuelController({
      session,
      dependencies: FAKE_DEPENDENCIES,
      snapshotId: snapshotId("reversed-extra"),
      presetId: "reversed-extra",
      deckCounts: [0, 0],
      extraDeckCounts: [2, 0],
    });

    const state = controller.advance().state.players[0];
    expect(state.monsters[0]).toMatchObject({
      code: second,
      instanceId: "card-2",
    });
    expect(state.extraDeck[0]).toMatchObject({
      code: first,
      instanceId: "card-1",
      sequence: 0,
    });
  });

  it("queries overlay host and materials before publishing", async () => {
    const harness = await createFakeOcgCoreAdapter(
      () => ({
        steps: [
          {
            status: EngineProcess.END,
            messages: [
              {
                type: EngineMessageType.MOVE,
                card: 97590747,
                from: {
                  controller: 0,
                  location: EngineLocation.DECK as never,
                  sequence: 0,
                  position: EnginePosition.FACE_DOWN_DEFENSE,
                },
                to: {
                  controller: 0,
                  location: EngineLocation.MONSTER as never,
                  sequence: 0,
                  position: EnginePosition.FACE_UP_ATTACK,
                },
              },
              {
                type: EngineMessageType.MOVE,
                card: 5053103,
                from: {
                  controller: 0,
                  location: EngineLocation.DECK as never,
                  sequence: 0,
                  position: EnginePosition.FACE_DOWN_DEFENSE,
                },
                to: {
                  controller: 0,
                  location: EngineLocation.GRAVEYARD as never,
                  sequence: 0,
                  position: EnginePosition.FACE_UP_ATTACK,
                },
              },
              {
                type: EngineMessageType.MOVE,
                card: 5053103,
                from: {
                  controller: 0,
                  location: EngineLocation.GRAVEYARD as never,
                  sequence: 0,
                  position: EnginePosition.FACE_UP_ATTACK,
                },
                to: {
                  controller: 0,
                  location: EngineLocation.MONSTER as never,
                  sequence: 0,
                  position: EnginePosition.FACE_UP_ATTACK,
                  overlay_sequence: 0,
                },
              },
              win(),
            ],
          },
        ],
      }),
      {
        queryCard: (query) =>
          (Number(query.location) & EngineLocation.OVERLAY) !== 0
            ? {
                code: 5053103,
                owner: 0,
                position: EnginePosition.FACE_UP_ATTACK,
                isPublic: true,
                isHidden: false,
              }
            : { overlayCards: [5053103] },
      },
    );
    const session = DuelSession.create({
      adapter: harness.adapter,
      dependencies: FAKE_DEPENDENCIES,
      playerDeck: EMPTY_DECK,
      opponentDeck: EMPTY_DECK,
      configuration: {
        mode: "programmed",
        seed: [1n, 2n, 3n, 4n],
        playerDeckOrder: [],
        opponentDeckOrder: [],
      },
    });
    const controller = new HeadlessDuelController({
      session,
      dependencies: FAKE_DEPENDENCIES,
      snapshotId: snapshotId("overlay"),
      presetId: "overlay",
      deckCounts: [2, 0],
      extraDeckCounts: [0, 0],
    });

    const advance = controller.advance();
    expect(harness.cardQueries).toHaveLength(2);
    expect(advance.state.players[0].monsters[0]).toMatchObject({
      code: 97590747,
      counters: [],
      overlayMaterials: [{ code: 5053103, sequence: 0 }],
    });
    expect(advance.state.players[0].graveyard).toEqual([]);
  });

  it("categorizes projector reconciliation failures as invariant", async () => {
    const harness = await createFakeOcgCoreAdapter(
      () => ({
        steps: [
          {
            status: EngineProcess.END,
            messages: [
              {
                type: EngineMessageType.MOVE,
                card: EXTRA_CODE,
                from: {
                  controller: 0,
                  location: EngineLocation.DECK as never,
                  sequence: 0,
                  position: EnginePosition.FACE_DOWN_DEFENSE,
                },
                to: {
                  controller: 0,
                  location: EngineLocation.MONSTER as never,
                  sequence: 0,
                  position: EnginePosition.FACE_UP_ATTACK,
                  overlay_sequence: 0,
                },
              },
              win(),
            ],
          },
        ],
      }),
      { queryCard: () => ({ overlayCards: [] }) },
    );
    const session = DuelSession.create({
      adapter: harness.adapter,
      dependencies: FAKE_DEPENDENCIES,
      playerDeck: EMPTY_DECK,
      opponentDeck: EMPTY_DECK,
      configuration: {
        mode: "programmed",
        seed: [1n, 2n, 3n, 4n],
        playerDeckOrder: [],
        opponentDeckOrder: [],
      },
    });
    const controller = new HeadlessDuelController({
      session,
      dependencies: FAKE_DEPENDENCIES,
      snapshotId: snapshotId("overlay-invariant"),
      presetId: "overlay-invariant",
      deckCounts: [1, 0],
      extraDeckCounts: [0, 0],
    });

    expect(() => controller.advance()).toThrow(
      "Unable to reconcile overlayMaterials state",
    );
    expect(session.disposed).toBe(true);
    expect(JSON.stringify(controller.trace())).toContain(
      "reconcile:overlayHost:invariant",
    );
  });

  it.each([
    ["missing", "malformed", () => ({})],
    ["not an array", "malformed", () => ({ overlayCards: "invalid" })],
    ["invalid code", "malformed", () => ({ overlayCards: [0] })],
    [
      "unavailable",
      "unavailable",
      () => {
        throw new Error(`private host query ${EXTRA_CODE}`);
      },
    ],
  ] as const)(
    "fails closed when the authoritative host material list is %s",
    async (_label, category, queryCard) => {
      const { controller, session } =
        await controllerWithOverlayQuery(queryCard);

      expect(() => controller.advance()).toThrow(
        "Unable to reconcile overlayMaterials state",
      );
      expect(session.disposed).toBe(true);
      const serialized = JSON.stringify(controller.trace());
      expect(serialized).toContain(`reconcile:overlayHost:${category}`);
      expect(serialized).not.toContain(String(EXTRA_CODE));
      expect(serialized).not.toContain("overlayCards");
    },
  );

  it("rejects oversized overlay host evidence before detail queries", async () => {
    let detailQueries = 0;
    const { controller, harness } = await controllerWithOverlayQuery(
      (query) => {
        if ((Number(query.location) & EngineLocation.OVERLAY) === 0)
          return {
            overlayCards: Array.from({ length: 257 }, (_, index) => index + 1),
          };
        detailQueries += 1;
        return null;
      },
    );

    expect(() => controller.advance()).toThrow(
      "Unable to reconcile overlayMaterials state",
    );
    expect(detailQueries).toBe(0);
    expect(harness.cardQueries).toHaveLength(1);
    expect(JSON.stringify(controller.trace())).toContain(
      "reconcile:overlayHost:malformed",
    );
  });

  it.each([
    [
      "code mismatch",
      (query: EngineCardQuery) =>
        (Number(query.location) & EngineLocation.OVERLAY) === 0
          ? { overlayCards: [5053103] }
          : {
              code: 97590747,
              owner: 1,
              position: EnginePosition.FACE_UP_ATTACK,
              isPublic: true,
              isHidden: false,
            },
    ],
    [
      "empty detail",
      (query: EngineCardQuery) =>
        (Number(query.location) & EngineLocation.OVERLAY) === 0
          ? { overlayCards: [5053103] }
          : null,
    ],
    ...(
      [
        ["owner", { owner: 2 }],
        ["position", { position: 0 }],
        ["public visibility", { isPublic: undefined }],
        ["hidden visibility", { isHidden: undefined }],
        ["missing code", { code: undefined }],
        ["code", { code: -1 }],
      ] as const
    ).map(
      ([label, override]) =>
        [
          `malformed ${label}`,
          (query: EngineCardQuery) =>
            (Number(query.location) & EngineLocation.OVERLAY) === 0
              ? { overlayCards: [5053103] }
              : {
                  code: 5053103,
                  owner: 1,
                  position: EnginePosition.FACE_UP_ATTACK,
                  isPublic: true,
                  isHidden: false,
                  ...override,
                },
        ] as const,
    ),
    [
      "thrown detail",
      (query: EngineCardQuery) => {
        if ((Number(query.location) & EngineLocation.OVERLAY) !== 0)
          throw new Error("private-overlay-payload-sentinel 5053103");
        return { overlayCards: [5053103] };
      },
    ],
  ] as const)(
    "falls back when optional overlay detail is %s",
    async (_label, queryCard) => {
      const { controller, session } = await controllerWithOverlayQuery(
        queryCard,
        1,
        EnginePosition.FACE_DOWN_DEFENSE,
      );

      const advance = controller.advance();
      expect(advance.prompt).toMatchObject({ player: 0, kind: "yesNo" });
      expect(session.disposed).toBe(false);
      expect(advance.state.players[1].monsters[0]?.overlayMaterials).toEqual([
        expect.objectContaining({
          code: 5053103,
          identityVisible: false,
          sequence: 0,
        }),
      ]);
      const serialized = JSON.stringify(controller.trace());
      expect(serialized).toContain(
        "reconcile:overlayHost:enrichment_unavailable",
      );
      expect(serialized).not.toContain("5053103");
      expect(serialized).not.toContain("private-overlay-payload-sentinel");
      expect(serialized).not.toContain("overlayCards");
    },
  );

  it.each([
    ["public face-up attack", true, EnginePosition.FACE_UP_ATTACK, true],
    ["public face-up defense", true, EnginePosition.FACE_UP_DEFENSE, true],
    ["non-public face-up", false, EnginePosition.FACE_UP_ATTACK, false],
    ["public face-down", true, EnginePosition.FACE_DOWN_DEFENSE, false],
  ] as const)(
    "derives material visibility from valid %s detail",
    async (_label, isPublic, position, expectedVisible) => {
      const { controller } = await controllerWithOverlayQuery(
        (query) =>
          (Number(query.location) & EngineLocation.OVERLAY) === 0
            ? { overlayCards: [5053103] }
            : {
                code: 5053103,
                owner: 1,
                position,
                isPublic,
                isHidden: !isPublic,
              },
        1,
        EnginePosition.FACE_DOWN_DEFENSE,
      );

      expect(
        controller.advance().state.players[1].monsters[0]?.overlayMaterials[0],
      ).toMatchObject({
        code: 5053103,
        identityVisible: expectedVisible,
      });
      expect(JSON.stringify(controller.trace())).not.toContain(
        "reconcile:overlayHost:enrichment_unavailable",
      );
    },
  );

  it("reconciles counter underflow from authoritative COUNTERS query before publication", async () => {
    const harness = await createFakeOcgCoreAdapter(
      () => ({
        steps: [
          {
            status: EngineProcess.WAITING,
            messages: [
              {
                type: EngineMessageType.MOVE,
                card: 97590747,
                from: {
                  controller: 0,
                  location: EngineLocation.DECK as never,
                  sequence: 0,
                  position: EnginePosition.FACE_DOWN_DEFENSE,
                },
                to: {
                  controller: 0,
                  location: EngineLocation.MONSTER as never,
                  sequence: 0,
                  position: EnginePosition.FACE_UP_ATTACK,
                },
              },
              {
                type: EngineMessageType.REMOVE_COUNTER,
                counter_type: 1,
                controller: 0,
                location: EngineLocation.MONSTER as never,
                sequence: 0,
                count: 1,
              },
              {
                type: EngineMessageType.ADD_COUNTER,
                counter_type: 1,
                controller: 0,
                location: EngineLocation.MONSTER as never,
                sequence: 0,
                count: 2,
              },
              {
                type: EngineMessageType.SELECT_YES_NO,
                player: 0,
                description: 0n,
              },
            ],
          },
        ],
      }),
      {
        queryCard: () => ({ counters: { 2: 4, 1: 3 } }),
      },
    );
    const session = DuelSession.create({
      adapter: harness.adapter,
      dependencies: FAKE_DEPENDENCIES,
      playerDeck: EMPTY_DECK,
      opponentDeck: EMPTY_DECK,
      configuration: {
        mode: "programmed",
        seed: [1n, 2n, 3n, 4n],
        playerDeckOrder: [],
        opponentDeckOrder: [],
      },
    });
    const controller = new HeadlessDuelController({
      session,
      dependencies: FAKE_DEPENDENCIES,
      snapshotId: snapshotId("counter-reconcile"),
      presetId: "counter-reconcile",
      deckCounts: [1, 0],
      extraDeckCounts: [0, 0],
    });

    const advance = controller.advance();

    expect(harness.cardQueries).toEqual([
      expect.objectContaining({
        flags: 0x20000,
        controller: 0,
        location: EngineLocation.MONSTER,
        sequence: 0,
      }),
    ]);
    expect(advance.state.players[0].monsters[0]?.counters).toEqual([
      { type: 1, name: "Counter 0x1", count: 3 },
      { type: 2, name: "Counter 0x2", count: 4 },
    ]);
    expect(advance.events).toHaveLength(1);
  });

  it("reconciles independent dirty counter addresses once each", async () => {
    const messages: EngineMessage[] = [
      ...([0, 1] as const).map((sequence) => ({
        type: EngineMessageType.MOVE,
        card: 97590747 + sequence,
        from: {
          controller: 0 as const,
          location: EngineLocation.DECK as never,
          sequence: 0,
          position: EnginePosition.FACE_DOWN_DEFENSE,
        },
        to: {
          controller: 0 as const,
          location: EngineLocation.MONSTER as never,
          sequence,
          position: EnginePosition.FACE_UP_ATTACK,
        },
      })),
      ...([0, 1] as const).map((sequence) => ({
        type: EngineMessageType.REMOVE_COUNTER,
        counter_type: sequence + 1,
        controller: 0 as const,
        location: EngineLocation.MONSTER as never,
        sequence,
        count: 1,
      })),
      {
        type: EngineMessageType.ADD_COUNTER,
        counter_type: 1,
        controller: 0 as const,
        location: EngineLocation.MONSTER as never,
        sequence: 0,
        count: 9,
      },
      {
        type: EngineMessageType.SELECT_YES_NO,
        player: 0 as const,
        description: 0n,
      },
    ];
    const harness = await createFakeOcgCoreAdapter(
      () => ({
        steps: [{ status: EngineProcess.WAITING, messages }],
      }),
      {
        queryCard: (query) =>
          query.sequence === 0
            ? { counters: { 1: 3 } }
            : { counters: { 2: 4 } },
      },
    );
    const session = DuelSession.create({
      adapter: harness.adapter,
      dependencies: FAKE_DEPENDENCIES,
      playerDeck: EMPTY_DECK,
      opponentDeck: EMPTY_DECK,
      configuration: {
        mode: "programmed",
        seed: [1n, 2n, 3n, 4n],
        playerDeckOrder: [],
        opponentDeckOrder: [],
      },
    });
    const controller = new HeadlessDuelController({
      session,
      dependencies: FAKE_DEPENDENCIES,
      snapshotId: snapshotId("counter-multi-address"),
      presetId: "counter-multi-address",
      deckCounts: [2, 0],
      extraDeckCounts: [0, 0],
    });

    const advance = controller.advance();

    expect(harness.cardQueries).toHaveLength(2);
    expect(harness.cardQueries.map((query) => query.sequence)).toEqual([0, 1]);
    expect(
      advance.state.players[0].monsters.map((card) => card?.counters),
    ).toEqual([
      [{ type: 1, name: "Counter 0x1", count: 3 }],
      [{ type: 2, name: "Counter 0x2", count: 4 }],
    ]);
  });

  it.each([
    [
      "host remains absent",
      "invariant",
      (): unknown => ({ counters: { 1: 1 } }),
    ],
    ["missing counters", "malformed", (): unknown => ({})],
    ["null host", "malformed", (): unknown => null],
    ["zero count", "malformed", (): unknown => ({ counters: { 1: 0 } })],
    ["unsafe type", "malformed", (): unknown => ({ counters: { 65536: 1 } })],
    ["unsafe count", "malformed", (): unknown => ({ counters: { 1: 65536 } })],
    [
      "oversized record",
      "malformed",
      (): unknown => ({
        counters: Object.fromEntries(
          Array.from({ length: 257 }, (_, index) => [index + 1, 1]),
        ),
      }),
    ],
    [
      "thrown counter query",
      "unavailable",
      (): unknown => {
        throw new Error("private-counter-query-5053103");
      },
    ],
  ] as const)(
    "fails counter reconciliation terminally for %s",
    async (_label, category, queryCard) => {
      const harness = await createFakeOcgCoreAdapter(
        () => ({
          steps: [
            {
              status: EngineProcess.WAITING,
              messages: [
                {
                  type: EngineMessageType.REMOVE_COUNTER,
                  counter_type: 1,
                  controller: 0,
                  location: EngineLocation.MONSTER as never,
                  sequence: 0,
                  count: 1,
                },
                {
                  type: EngineMessageType.SELECT_YES_NO,
                  player: 1,
                  description: 0n,
                },
              ],
            },
          ],
        }),
        { queryCard: queryCard as never },
      );
      const session = DuelSession.create({
        adapter: harness.adapter,
        dependencies: FAKE_DEPENDENCIES,
        playerDeck: EMPTY_DECK,
        opponentDeck: EMPTY_DECK,
        configuration: {
          mode: "programmed",
          seed: [1n, 2n, 3n, 4n],
          playerDeckOrder: [],
          opponentDeckOrder: [],
        },
      });
      const choose = vi.fn(() => {
        throw new Error("opponent policy must not observe failed batch");
      });
      const controller = new HeadlessDuelController({
        session,
        dependencies: FAKE_DEPENDENCIES,
        snapshotId: snapshotId("counter-failure"),
        presetId: "counter-failure",
        deckCounts: [0, 0],
        extraDeckCounts: [0, 0],
        opponentPolicy: { choose },
      });

      let failure: unknown;
      try {
        controller.advance();
      } catch (error) {
        failure = error;
      }
      expect(failure).toBeInstanceOf(DuelOperationError);
      expect((failure as Error).message).toBe(
        "Unable to reconcile counters state",
      );
      expect((failure as DuelOperationError).duelError.detail).toBeUndefined();
      expect(JSON.stringify(routineLogError(failure))).not.toContain(
        "private-counter-query",
      );
      expect(session.disposed).toBe(true);
      expect(choose).not.toHaveBeenCalled();
      const trace = JSON.stringify(controller.trace());
      expect(trace).toContain(`reconcile:counterHost:${category}`);
      expect(trace).not.toContain("5053103");
      expect(trace).not.toContain("private-counter-query");
    },
  );

  it.each([
    ["missing fields", "malformed", () => [{}]],
    [
      "owner mismatch",
      "malformed",
      () => [
        {
          code: EXTRA_CODE,
          owner: 1,
          position: EnginePosition.FACE_DOWN_DEFENSE,
          isPublic: false,
          isHidden: true,
        },
      ],
    ],
    [
      "thrown query",
      "unavailable",
      () => {
        throw new Error(`private query ${EXTRA_CODE}`);
      },
    ],
  ] as const)(
    "fails terminally with sanitized evidence for %s",
    async (_label, category, queryLocation) => {
      const { controller, session } = await controllerWithQuery(queryLocation);

      let failure: unknown;
      try {
        controller.advance();
      } catch (error) {
        failure = error;
      }
      expect(failure).toBeInstanceOf(DuelOperationError);
      expect((failure as Error).message).toBe(
        "Unable to reconcile extraDeck state",
      );
      expect((failure as DuelOperationError).duelError.detail).toBeUndefined();
      expect((failure as Error).cause).toBeDefined();
      expect(session.disposed).toBe(true);
      const serialized = JSON.stringify(controller.trace());
      expect(serialized).toContain(`reconcile:extraDeck:${category}`);
      expect(serialized).not.toContain(String(EXTRA_CODE));
    },
  );
});

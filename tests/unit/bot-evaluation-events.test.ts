import { describe, expect, it } from "vitest";
import { eventDetails } from "../../scripts/bot-evaluation/host-events.ts";
import type { EngineMessage } from "../../src/battle/worker/engine/OcgCoreAdapter.ts";
import {
  EngineLocation as L,
  EngineMessageType as M,
} from "../../src/battle/worker/engine/engine-constants.ts";
import type {
  PlayerIndex,
  PublicDuelState,
} from "../../src/battle/duel/contracts/public-duel-state.ts";
import {
  cardCode,
  cardInstanceId,
} from "../../src/battle/duel/contracts/ids.ts";
import {
  publicStateCard,
  RICH_PUBLIC_DUEL_STATE,
} from "../fixtures/board-public-states.ts";

function stateFor(owner: PlayerIndex): PublicDuelState {
  const players = [...RICH_PUBLIC_DUEL_STATE.players] as [
    PublicDuelState["players"][0],
    PublicDuelState["players"][1],
  ];
  players[owner] = {
    ...players[owner],
    hand: [
      publicStateCard("hidden-hand", 100, owner, "hand", 0, "faceDownDefense"),
    ],
    extraDeck: [
      publicStateCard(
        "hidden-extra",
        101,
        owner,
        "extra",
        0,
        "faceDownDefense",
      ),
    ],
    banished: [
      publicStateCard(
        "hidden-banished",
        102,
        owner,
        "banished",
        0,
        "faceDownDefense",
      ),
    ],
    monsters: [
      publicStateCard(
        "hidden-monster",
        103,
        owner,
        "monster",
        0,
        "faceDownDefense",
      ),
      publicStateCard(
        "public-monster",
        104,
        owner,
        "monster",
        1,
        "faceUpAttack",
        {
          overlayMaterials: [
            {
              instanceId: cardInstanceId("hidden-material"),
              code: cardCode(105),
              sequence: 0,
              identityVisible: false,
            },
            {
              instanceId: cardInstanceId("public-material"),
              code: cardCode(106),
              sequence: 1,
              identityVisible: true,
            },
          ],
        },
      ),
    ],
  };
  return { ...RICH_PUBLIC_DUEL_STATE, players };
}
type ProtocolLocation = Extract<
  EngineMessage,
  { type: typeof M.BECOME_TARGET }
>["cards"][number]["location"];
const loc = (controller: PlayerIndex, location: number, sequence = 0) => ({
  controller,
  // The wire format also combines base locations with the OVERLAY bit.
  location: location as ProtocolLocation,
  sequence,
  position: 8 as const,
});

for (const actor of [0, 1] as const) {
  const opponent: PlayerIndex = actor === 0 ? 1 : 0;
  describe(`evaluation event evidence for actor ${actor}`, () => {
    it("retains own knowledge but omits opponent hidden pile tracking", () => {
      for (const owner of [actor, opponent]) {
        const message: EngineMessage = {
          type: M.BECOME_TARGET,
          cards: [
            loc(owner, L.HAND),
            loc(owner, L.EXTRA),
            loc(owner, L.BANISHED),
          ],
        };
        expect(eventDetails(message, stateFor(owner), actor)).toEqual([
          {
            type: "observed_targets",
            cards: [L.HAND, L.EXTRA, L.BANISHED].map((location, index) => ({
              controller: owner,
              location,
              ...(owner === actor
                ? {
                    sequence: 0,
                    instanceId: [
                      "hidden-hand",
                      "hidden-extra",
                      "hidden-banished",
                    ][index],
                    code: String(100 + index),
                  }
                : {}),
            })),
          },
        ]);
      }
    });

    it("records target relations and combat without identifying a face-down opponent", () => {
      for (const type of [93, 96, 97, M.ATTACK] as const) {
        const result = eventDetails(
          {
            type,
            card: loc(opponent, L.MONSTER, 1),
            target: loc(opponent, L.MONSTER),
          },
          stateFor(opponent),
          actor,
        );
        expect(result).toEqual([
          {
            type: type === M.ATTACK ? "combat_participants" : "target_relation",
            card: {
              controller: opponent,
              location: L.MONSTER,
              sequence: 1,
              instanceId: "public-monster",
              code: "104",
            },
            target: {
              controller: opponent,
              location: L.MONSTER,
              sequence: 0,
              instanceId: "hidden-monster",
            },
          },
        ]);
      }
      expect(
        eventDetails(
          {
            type: M.BATTLE,
            card: {
              ...loc(opponent, L.MONSTER, 1),
              attack: 2000,
              defense: 1000,
              destroyed: false,
            },
            target: null,
          },
          stateFor(opponent),
          actor,
        ),
      ).toEqual([
        {
          type: "combat_participants",
          card: {
            controller: opponent,
            location: L.MONSTER,
            sequence: 1,
            instanceId: "public-monster",
            code: "104",
          },
          target: null,
        },
      ]);
    });

    it("resolves overlay material identities instead of leaking the host identity", () => {
      const result = eventDetails(
        {
          type: 80,
          cards: [0, 1].map((overlay_sequence) => ({
            ...loc(opponent, L.MONSTER | L.OVERLAY, 1),
            overlay_sequence,
          })),
        },
        stateFor(opponent),
        actor,
      );
      expect(result).toEqual([
        {
          type: "observed_targets",
          cards: [
            {
              controller: opponent,
              location: L.MONSTER | L.OVERLAY,
              sequence: 1,
            },
            {
              controller: opponent,
              location: L.MONSTER | L.OVERLAY,
              sequence: 1,
              overlaySequence: 1,
              instanceId: "public-material",
              code: "106",
            },
          ],
        },
      ]);
    });

    it("records random targets, chain progression, costs and terminal outcomes", () => {
      const state = stateFor(opponent);
      expect(
        eventDetails(
          { type: 81, player: opponent, cards: [loc(opponent, L.HAND)] },
          state,
          actor,
        ),
      ).toEqual([
        {
          type: "observed_targets",
          cards: [{ controller: opponent, location: L.HAND }],
        },
      ]);
      for (const type of [
        M.CHAINED,
        M.CHAIN_SOLVING,
        M.CHAIN_NEGATED,
        M.CHAIN_DISABLED,
      ] as const) {
        expect(eventDetails({ type, chain_size: 2 }, state, actor)).toEqual([
          { type: "chain_progress", chainIndex: 2 },
        ]);
      }
      expect(
        eventDetails(
          { type: M.PAY_LIFE_POINTS, player: opponent, amount: 800 },
          state,
          actor,
        ),
      ).toEqual([{ type: "life_point_cost", player: opponent, amount: 800 }]);
      expect(
        eventDetails({ type: M.WIN, player: 2, reason: 1 }, state, actor),
      ).toEqual([{ type: "terminal_result", player: 2, reason: "1" }]);
    });

    it("records successful, negated and disabled resolutions using permitted identities", () => {
      for (const outcome of ["normal", "negated", "disabled"] as const) {
        for (const sourceIdentityVisible of [false, true]) {
          const state: PublicDuelState = {
            ...stateFor(opponent),
            chain: [
              {
                index: 2,
                controller: opponent,
                phase: "solved",
                outcome,
                sourceIdentityVisible,
                sourceCard: cardCode(999),
                label: "effect",
              },
            ],
          };
          expect(
            eventDetails({ type: M.CHAIN_SOLVED, chain_size: 2 }, state, actor),
          ).toEqual([
            { type: "chain_progress", chainIndex: 2 },
            {
              type:
                outcome === "normal"
                  ? "effect_resolved"
                  : "effect_not_resolved",
              player: opponent,
              cardCode: sourceIdentityVisible ? "999" : null,
              outcome,
            },
          ]);
        }
      }
      expect(
        eventDetails(
          { type: M.CHAIN_SOLVED, chain_size: 99 },
          stateFor(opponent),
          actor,
        ),
      ).toEqual([{ type: "chain_progress", chainIndex: 99 }]);
    });

    it("records material attachment and detachment without hidden identities or raw message codes", () => {
      const state = stateFor(opponent);
      for (const location of [L.MONSTER, L.MONSTER | L.OVERLAY]) {
        for (const overlay_sequence of [0, 1]) {
          expect(
            eventDetails(
              {
                type: M.MOVE,
                card: 999999,
                from: loc(opponent, L.HAND),
                to: { ...loc(opponent, location, 1), overlay_sequence },
              },
              state,
              actor,
            ),
          ).toEqual([
            {
              type: "material_attached",
              card: {
                controller: opponent,
                location,
                sequence: 1,
                ...(overlay_sequence === 1
                  ? {
                      instanceId: "public-material",
                      code: "106",
                      overlaySequence: 1,
                    }
                  : {}),
              },
            },
          ]);
        }
      }
      const from = {
        ...loc(opponent, L.MONSTER | L.OVERLAY, 1),
        overlay_sequence: 1,
      };
      expect(
        eventDetails(
          { type: M.MOVE, card: 999999, from, to: loc(opponent, L.HAND) },
          state,
          actor,
        ),
      ).toEqual([
        {
          type: "material_detached",
          card: { controller: opponent, location: L.HAND },
        },
      ]);
      const players: [
        PublicDuelState["players"][0],
        PublicDuelState["players"][1],
      ] = [...state.players];
      players[opponent] = {
        ...players[opponent],
        graveyard: [
          publicStateCard("detached-material", 106, opponent, "graveyard", 0),
        ],
      };
      const graveyardState: PublicDuelState = { ...state, players };
      expect(
        eventDetails(
          { type: M.MOVE, card: 999999, from, to: loc(opponent, L.GRAVEYARD) },
          graveyardState,
          actor,
        ),
      ).toEqual([
        {
          type: "material_detached",
          card: {
            controller: opponent,
            location: L.GRAVEYARD,
            sequence: 0,
            instanceId: "detached-material",
            code: "106",
          },
        },
      ]);
      expect(
        eventDetails(
          {
            type: M.MOVE,
            card: 999999,
            from: loc(opponent, L.HAND),
            to: loc(opponent, L.MONSTER),
          },
          state,
          actor,
        ),
      ).toEqual([]);
    });

    it("allows explicit public top reveals and rejects unrelated private cards", () => {
      const state = stateFor(opponent);
      for (const [type, location] of [
        [M.CONFIRM_DECKTOP, L.DECK],
        [42, L.EXTRA],
      ] as const) {
        const card = { controller: opponent, location, sequence: 0, code: 999 };
        expect(
          eventDetails({ type, player: opponent, cards: [card] }, state, actor),
        ).toEqual([
          {
            type: "public_reveal",
            cards: [{ controller: opponent, location, code: "999" }],
          },
        ]);
        expect(
          eventDetails({ type, player: actor, cards: [card] }, state, actor),
        ).toEqual([]);
        expect(
          eventDetails(
            { type, player: opponent, cards: [{ ...card, location: L.HAND }] },
            state,
            actor,
          ),
        ).toEqual([]);
        expect(
          eventDetails(
            { type, player: opponent, cards: [{ ...card, code: 0 }] },
            state,
            actor,
          ),
        ).toEqual([]);
      }
      expect(
        eventDetails(
          {
            type: M.CONFIRM_CARDS,
            player: opponent,
            cards: [
              {
                controller: opponent,
                location: L.HAND,
                sequence: 0,
                code: 999,
              },
            ],
          },
          state,
          actor,
        ),
      ).toEqual([]);
    });
  });
}

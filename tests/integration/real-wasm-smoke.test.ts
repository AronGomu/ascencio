import { describe, expect, it } from "vitest";
import { snapshotId } from "../../src/battle/duel/contracts/ids.ts";
import { loadVendoredCoreNode } from "../../src/battle/worker/engine/load-vendored-core-node.ts";

import {
  EngineDuelFlag,
  EngineMessageType,
} from "../../src/battle/worker/engine/engine-constants.ts";
import { DuelStateProjector } from "../../src/battle/worker/projection/DuelStateProjector.ts";
import { parseDuelWorkerEvent } from "../../src/battle/duel/contracts/duel-worker-event.ts";
import { battleResultForDuelResult } from "../../src/battle/battle-contracts.ts";

describe("vendored synchronous ocgcore", () => {
  it.each([0, 1, 2])(
    "projects real Duel.Win(%i, 1) through the result boundary",
    async (player) => {
      const adapter = await loadVendoredCoreNode();
      const team = {
        startingLP: 8000,
        startingDrawCount: 0,
        drawCountPerTurn: 0,
      };
      const handle = adapter.createDuel({
        flags: EngineDuelFlag.MODE_MR5,
        seed: [1n, 2n, 3n, 4n],
        team1: team,
        team2: team,
        cardReader: () => null,
        scriptReader: () => null,
      });
      if (handle === null) throw new Error("No duel handle");
      try {
        expect(
          adapter.loadScript(handle, "test-win.lua", `Duel.Win(${player}, 1)`),
        ).toBe(true);
        adapter.startDuel(handle);
        for (let step = 0; step < 4; step += 1) {
          adapter.process(handle);
          const win = adapter
            .getMessages(handle)
            .find((message) => message.type === EngineMessageType.WIN);
          if (win === undefined) continue;
          expect(win).toEqual({
            type: EngineMessageType.WIN,
            player,
            reason: 1,
          });
          const projector = new DuelStateProjector(
            snapshotId("a".repeat(64)),
            [0, 0],
            [0, 0],
            { extraMonsterZones: true },
          );
          const event = parseDuelWorkerEvent(
            structuredClone({
              type: "result",
              result: projector.apply(win).result,
            }),
          );
          if (event.type !== "result") throw new Error("Missing result event");
          expect(event.result).toEqual({
            type: "completed",
            winner: player === 2 ? null : player,
            loser: player === 2 ? null : player === 0 ? 1 : 0,
            reason: 1,
          });
          expect(battleResultForDuelResult(event.result)).toEqual({
            kind: "resolved",
            outcome:
              player === 2
                ? "draw"
                : player === 0
                  ? "player-win"
                  : "player-loss",
          });
          return;
        }
        throw new Error("Core did not emit WIN");
      } finally {
        adapter.destroyDuel(handle);
      }
    },
  );

  it("loads the real local WASM and exposes the pinned core version", async () => {
    const adapter = await loadVendoredCoreNode({ timeoutMs: 15_000 });
    expect(adapter.getVersion()).toEqual([11, 0]);
  });
});

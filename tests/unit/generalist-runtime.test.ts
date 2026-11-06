import { expect, it } from "vitest";
import {
  createFakeOcgCoreAdapter,
  EMPTY_DECK,
  FAKE_DEPENDENCIES,
  FAKE_SNAPSHOT_ID,
} from "../fixtures/fake-ocgcore-adapter.ts";
import { DuelSession } from "../../src/battle/worker/engine/DuelSession.ts";
import { HeadlessDuelController } from "../../src/battle/worker/HeadlessDuelController.ts";
import {
  EngineMessageType,
  EngineProcess,
} from "../../src/battle/worker/engine/engine-constants.ts";
import { createGeneralistBotPolicy } from "../../src/battle/worker/bot/generalist-bot.ts";

it("runs the shared generalist through the actual runtime controller and response encoder", async () => {
  const harness = await createFakeOcgCoreAdapter(() => ({
    steps: [
      {
        status: EngineProcess.WAITING,
        messages: [
          { type: EngineMessageType.SELECT_YES_NO, player: 1, description: 0n },
        ],
      },
      {
        status: EngineProcess.END,
        messages: [{ type: EngineMessageType.WIN, player: 1, reason: 1 }],
      },
    ],
  }));
  const session = DuelSession.create({
    adapter: harness.adapter,
    dependencies: FAKE_DEPENDENCIES,
    playerDeck: EMPTY_DECK,
    opponentDeck: EMPTY_DECK,
    configuration: { mode: "production", rules: "mr5" },
  });
  const policy = createGeneralistBotPolicy(FAKE_DEPENDENCIES);
  let calls = 0;
  const controller = new HeadlessDuelController({
    session,
    dependencies: FAKE_DEPENDENCIES,
    snapshotId: FAKE_SNAPSHOT_ID,
    presetId: "generalist-test",
    deckCounts: [0, 0],
    extraDeckCounts: [0, 0],
    extraMonsterZones: true,
    opponentPolicy: {
      choose(prompt, observation) {
        calls++;
        const decision = policy.choose(prompt, observation);
        expect(decision.reason).toBe("try_offered_effect");
        return decision;
      },
    },
  });
  try {
    expect(controller.advance().result).toMatchObject({
      type: "completed",
      winner: 1,
    });
    expect(calls).toBe(1);
    expect(session.disposed).toBe(true);
  } finally {
    controller.dispose();
  }
});

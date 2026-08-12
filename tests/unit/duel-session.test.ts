import { describe, expect, it } from "vitest";
import { OcgDuelMode } from "../../vendor/ocgcore-wasm/0.1.2/dist/index.js";
import { DuelSession } from "../../src/worker/engine/DuelSession.ts";
import { EngineDuelFlag } from "../../src/worker/engine/engine-constants.ts";
import {
  createFakeOcgCoreAdapter,
  EMPTY_DECK,
  FAKE_DEPENDENCIES,
} from "../fixtures/fake-ocgcore-adapter.ts";

async function createdFlags(
  rules: "mr3" | "mr5",
  mode: "production" | "programmed",
): Promise<bigint> {
  const harness = await createFakeOcgCoreAdapter(() => ({ steps: [] }));
  const session = DuelSession.create({
    adapter: harness.adapter,
    dependencies: FAKE_DEPENDENCIES,
    playerDeck: EMPTY_DECK,
    opponentDeck: EMPTY_DECK,
    configuration:
      mode === "production"
        ? { mode, rules, seed: [1n, 2n, 3n, 4n] }
        : {
            mode,
            rules,
            seed: [1n, 2n, 3n, 4n],
            playerDeckOrder: EMPTY_DECK.main,
            opponentDeckOrder: EMPTY_DECK.main,
          },
  });
  try {
    const options = harness.createdDuelOptions[0];
    if (options === undefined)
      throw new Error("Core was never asked to create a duel");
    return options.flags;
  } finally {
    session.dispose();
  }
}

describe("duel session master rule flags", () => {
  it("matches the pinned adapter's own duel-mode exports", () => {
    expect(EngineDuelFlag.MODE_MR3).toBe(OcgDuelMode.MODE_MR3);
    expect(EngineDuelFlag.MODE_MR5).toBe(OcgDuelMode.MODE_MR5);
    expect(EngineDuelFlag.MODE_MR3).toBe(0xd1800n);
    expect(EngineDuelFlag.MODE_MR5).toBe(0x2e800n);
  });

  it("passes the exact MR3 flag for a Link-free profile", async () => {
    expect(await createdFlags("mr3", "production")).toBe(0xd1800n);
  });

  it("passes the exact MR5 flag for a Link profile", async () => {
    expect(await createdFlags("mr5", "production")).toBe(0x2e800n);
  });

  it("keeps programmed-only flags unchanged under either rule set", async () => {
    expect(await createdFlags("mr3", "programmed")).toBe(
      0xd1800n | EngineDuelFlag.PSEUDO_SHUFFLE,
    );
    expect(await createdFlags("mr5", "programmed")).toBe(
      0x2e800n | EngineDuelFlag.PSEUDO_SHUFFLE,
    );
  });
});

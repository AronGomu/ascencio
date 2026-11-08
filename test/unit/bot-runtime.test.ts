import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { guardedBot } from "../../src/battle/worker/bot-runtime/loaded-bot.ts";
import { validateWasmLimits } from "../../src/battle/worker/bot-runtime/wasm-limits.ts";
import { parseBotManifest } from "../../src/battle/duel/contracts/bot-package.ts";
import { parseBotSelection } from "../../src/battle/duel/contracts/bot-selection.ts";
import { createBasicBotModule } from "../../src/battle/worker/bot/basic-bot.ts";
import { FAKE_DEPENDENCIES } from "../fixtures/fake-ocgcore-adapter.ts";
import { choiceId, promptId } from "../../src/battle/duel/contracts/ids.ts";
import type { BotDecisionInput } from "../../src/battle/worker/bot/bot-contract.ts";
const input: BotDecisionInput = {
  prompt: {
    id: promptId("p"),
    player: 1,
    kind: "yesNo",
    title: "Choose",
    minimum: 1,
    maximum: 1,
    cancelable: false,
    ordered: false,
    choices: [{ id: choiceId("no"), action: "no", label: "No" }],
  },
  observation: {
    revision: 0,
    turn: 1,
    turnPlayer: 1,
    phase: "main1",
    chainSize: 0,
    players: [] as unknown as BotDecisionInput["observation"]["players"],
  },
};
const manifest = {
  id: "test.ai",
  packageVersion: "1.2.3",
  contractVersion: 1,
  source: "ai/Cargo.toml",
  wasm: "dist/ai.wasm",
  policies: ["basic"],
};
describe("bot package and recovery boundary", () => {
  it("validates portable package paths and supported versions", () => {
    expect(parseBotManifest(manifest)).toEqual(manifest);
    for (const wasm of [
      "../ai.wasm",
      "/tmp/ai.wasm",
      "dist/../../x",
      "dist\\ai.wasm",
    ])
      expect(() => parseBotManifest({ ...manifest, wasm })).toThrow();
    expect(() =>
      parseBotManifest({ ...manifest, contractVersion: 2 }),
    ).toThrow();
    expect(() =>
      parseBotSelection({
        runtime: "native",
        packageId: "../bad",
        policy: "basic",
      }),
    ).toThrow();
  });
  it("accepts bounded import-free reference WASM and rejects absent/unbounded memory", () => {
    expect(() =>
      validateWasmLimits(readFileSync("docs/archive/rust-bot-experiment/reference/dist/ai.wasm")),
    ).not.toThrow();
    expect(() =>
      validateWasmLimits(Uint8Array.from([0, 97, 115, 109, 1, 0, 0, 0])),
    ).toThrow(/memory/);
    expect(() =>
      validateWasmLimits(
        Uint8Array.from([0, 97, 115, 109, 1, 0, 0, 0, 5, 3, 1, 0, 1]),
      ),
    ).toThrow();
  });
  it.each(["trap", "timeout", "invalid"])(
    "validates fallback and permanently closes failed %s runtime",
    async (kind) => {
      const close = vi.fn();
      const request = vi.fn(async () => {
        if (kind === "invalid")
          return {
            choiceIds: ["invented"],
            reason: { code: "bad", explanation: "bad" },
          };
        throw new Error(kind);
      });
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const bot = guardedBot(
        { request, close },
        createBasicBotModule(FAKE_DEPENDENCIES).create({}),
        "pinned-v1",
        false,
      );
      expect((await bot.decide(input)).choiceIds).toEqual(["no"]);
      expect((await bot.decide(input)).choiceIds).toEqual(["no"]);
      expect(request).toHaveBeenCalledTimes(1);
      expect(close).toHaveBeenCalledTimes(1);
      expect(bot.fallbackCount).toBe(1);
      expect(bot.failures).toEqual([]);
      expect(warn).not.toHaveBeenCalled();
      bot.dispose();
      await expect(bot.decide(input)).rejects.toThrow(/disposed/);
      warn.mockRestore();
    },
  );
  it("records a detailed development trace and warns", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const bot = guardedBot(
      {
        request: async () => {
          throw new Error("trap");
        },
        close() {},
      },
      createBasicBotModule(FAKE_DEPENDENCIES).create({}),
      "v1",
      true,
    );
    await bot.decide(input);
    expect(warn).toHaveBeenCalledOnce();
    expect(bot.failures[0]).toMatchObject({
      version: "v1",
      message: "trap",
      input,
    });
    warn.mockRestore();
  });
  it("does not turn disposal during a pending decision into a fallback", async () => {
    let resolve!: (value: unknown) => void;
    const bot = guardedBot(
      {
        request: () =>
          new Promise((r) => {
            resolve = r;
          }),
        close() {},
      },
      createBasicBotModule(FAKE_DEPENDENCIES).create({}),
      "v1",
      false,
    );
    const pending = bot.decide(input);
    bot.dispose();
    resolve({ choiceIds: ["no"], reason: { code: "ok", explanation: "ok" } });
    await expect(pending).rejects.toThrow(/disposed/);
    expect(bot.fallbackCount).toBe(0);
  });
  it("rejects invalid sideboard exchanges and retains the original deck", async () => {
    const bot = guardedBot(
      {
        request: async () => ({
          exchanges: [{ from: "main", to: "side", cardCode: "1", copies: 1 }],
          reason: { code: "bad", explanation: "bad" },
        }),
        close() {},
      },
      createBasicBotModule(FAKE_DEPENDENCIES).create({}),
      "v1",
      false,
    );
    const result = await bot.sideboard({
      deck: { main: [], extra: [], side: [] },
      preSideGames: [
        { gameId: "a", decisions: [] },
        { gameId: "b", decisions: [] },
      ],
    });
    expect(result.exchanges).toEqual([]);
    expect(bot.fallbackCount).toBe(1);
  });
});

it("rejects an unbounded function table before instantiation", () => {
  const bytes = Uint8Array.from([
    0, 97, 115, 109, 1, 0, 0, 0, 4, 4, 1, 112, 0, 1, 5, 4, 1, 1, 1, 2,
  ]);
  expect(() => validateWasmLimits(bytes)).toThrow(/table/);
});

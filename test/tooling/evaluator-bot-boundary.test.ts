import test from "node:test";
import assert from "node:assert/strict";
import {
  nativeTransport,
  wasmTransport,
} from "../../scripts/bot-experiment/transport.ts";
import { instantiateHostBot } from "../../scripts/bot-experiment/host-bot.ts";
import { fixture } from "../helpers/bot-experiment/failures.ts";
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
for (const kind of [
  "native-stall",
  "wasm-loop",
  "wasm-trap",
  "invalid",
] as const) {
  test(
    `${kind}: bounded evaluator recovers legally and reports failure`,
    { timeout: 5000 },
    async () => {
      const events: unknown[] = [];
      const bot = await instantiateHostBot(
        {
          module: "experiment:wasm:basic",
          config: {},
          source: "",
          dependencies: [],
        },
        FAKE_DEPENDENCIES,
        {
          development: false,
          onFallback: (event) => events.push(event),
          transport: async () => {
            if (kind === "native-stall")
              return nativeTransport({
                executable: process.execPath,
                args: ["-e", "setInterval(()=>{},1000)"],
                setupMs: 50,
              });
            if (kind === "invalid")
              return {
                request: async () => ({
                  choiceIds: ["illegal"],
                  reason: { code: "bad", explanation: "bad" },
                }),
                close() {},
              };
            return wasmTransport({
              bytes: fixture(kind === "wasm-loop"),
              deadlineMs: 50,
              setupMs: 500,
            });
          },
        },
      );
      try {
        assert.deepEqual((await bot.decide(input)).choiceIds, ["no"]);
        assert.equal(bot.fallbackCount, 1);
        assert.equal(events.length, 1);
        assert.deepEqual((await bot.decide(input)).choiceIds, ["no"]);
        assert.equal(events.length, 1);
        assert.deepEqual(
          (
            await bot.sideboard({
              deck: { main: [], extra: [], side: [] },
              preSideGames: [] as never,
            })
          ).exchanges,
          [],
        );
      } finally {
        bot.close?.();
      }
    },
  );
}
test(
  "native raw transport timeout and close reject promptly",
  { timeout: 2000 },
  async () => {
    const transport = await nativeTransport({
      executable: process.execPath,
      args: ["-e", "setInterval(()=>{},1000)"],
      deadlineMs: 30,
    });
    await assert.rejects(transport.request({ op: "decide" }), /timed out/);
    await assert.rejects(transport.request({ op: "sideboard" }), /closed/);
    transport.close();
  },
);
for (const op of ["decide", "sideboard"] as const) {
  test(
    `native ${op} stall after successful setup recovers`,
    { timeout: 2000 },
    async () => {
      const code =
        'require("node:readline").createInterface({input:process.stdin}).on("line",line=>{if(JSON.parse(line).op==="create")console.log(JSON.stringify({ok:{contractVersion:1},computeNs:0}));});';
      const events: unknown[] = [];
      const bot = await instantiateHostBot(
        {
          module: "experiment:native:basic",
          config: {},
          source: "",
          dependencies: [],
        },
        FAKE_DEPENDENCIES,
        {
          development: false,
          onFallback: (e) => events.push(e),
          transport: () =>
            nativeTransport({
              executable: process.execPath,
              args: ["-e", code],
              deadlineMs: 30,
            }),
        },
      );
      try {
        if (op === "decide")
          assert.deepEqual((await bot.decide(input)).choiceIds, ["no"]);
        else
          assert.deepEqual(
            (
              await bot.sideboard({
                deck: { main: [], extra: [], side: [] },
                preSideGames: [] as never,
              })
            ).exchanges,
            [],
          );
        assert.equal(bot.fallbackCount, 1);
        assert.equal(events.length, 1);
      } finally {
        bot.close?.();
      }
    },
  );
}
test("native oversized/malformed output terminates instead of buffering indefinitely", async () => {
  for (const output of ['"x".repeat(1024*1024+1)', '"invalid\\n"']) {
    const transport = await nativeTransport({
      executable: process.execPath,
      args: [
        "-e",
        `process.stdin.once("data",()=>process.stdout.write(${output}));`,
      ],
      deadlineMs: 500,
    });
    try {
      await assert.rejects(transport.request({ op: "decide" }), /output/);
    } finally {
      transport.close();
    }
  }
});
for (const op of ["decide", "sideboard"] as const) {
  test(
    `WASM ${op} infinite loop after setup is preempted`,
    { timeout: 2000 },
    async () => {
      const bot = await instantiateHostBot(
        {
          module: "experiment:wasm:basic",
          config: {},
          source: "",
          dependencies: [],
        },
        FAKE_DEPENDENCIES,
        {
          development: false,
          transport: async () => {
            const raw = await wasmTransport({
              bytes: fixture(true),
              deadlineMs: 30,
            });
            return {
              request: async (value) =>
                (value as { op: string }).op === "create"
                  ? {}
                  : raw.request(value),
              close: () => raw.close(),
            };
          },
        },
      );
      try {
        if (op === "decide")
          assert.deepEqual((await bot.decide(input)).choiceIds, ["no"]);
        else
          assert.deepEqual(
            (
              await bot.sideboard({
                deck: { main: [], extra: [], side: [] },
                preSideGames: [] as never,
              })
            ).exchanges,
            [],
          );
        assert.equal(bot.fallbackCount, 1);
      } finally {
        bot.close?.();
      }
    },
  );
}

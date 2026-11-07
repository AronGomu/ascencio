import type { EvidenceRecord } from "./evidence.ts";
/** Replay the immutable reference; report the first divergence, never fallback. */
import { createReadStream } from "node:fs";
import { createGunzip } from "node:zlib";
import { createInterface } from "node:readline";
import { writeFile } from "node:fs/promises";
import { nativeTransport, wasmTransport } from "./transport.ts";
const target = process.argv[2] ?? "native";
if (!["native", "wasm"].includes(target))
  throw new Error("Expected native or wasm");
const transports = await Promise.all(
  [0, 1].map(() => (target === "native" ? nativeTransport() : wasmTransport())),
);
const input = createInterface({
  input: createReadStream(
    "docs/evidence/bot-experiment/typescript-baseline.jsonl.gz",
  ).pipe(createGunzip()),
});
let metadata: EvidenceRecord | undefined;
let decisions = 0,
  games = 0,
  sideboards = 0;
const start = performance.now();
try {
  for await (const line of input) {
    const record = JSON.parse(line) as EvidenceRecord;
    if (record.type === "metadata") metadata = record;
    if (record.type === "game") {
      const policies = [record.policy, "basic"];
      for (const actor of [0, 1] as const)
        await transports[actor]!.request({
          op: "create",
          contractVersion: 1,
          policy: policies[record.request.bot_order[actor]!],
          configuration: {},
          cards: metadata!.cards.map((c) => c[1]),
          seed: 1,
        });
      for (const message of record.messages) {
        if (message.type !== "captured_decision") continue;
        const result = await transports[message.actor]!.request({
          op: "decide",
          input: message.input,
        });
        if (
          JSON.stringify(result.choiceIds) !==
          JSON.stringify(message.decision.choiceIds)
        ) {
          const divergence = {
            target,
            game: record.request.game_id,
            decision: decisions,
            input: message.input,
            expected: message.decision,
            actual: result,
          };
          await writeFile(
            `.tmp/${target}-divergence.json`,
            JSON.stringify(divergence, null, 2),
          );
          throw new Error(
            `First divergence in ${record.request.game_id} at decision ${decisions}: .tmp/${target}-divergence.json`,
          );
        }
        if (result.randomDraws.length)
          throw new Error("Unexpected random consumption");
        decisions++;
      }
      games++;
      console.error(`${target}: ${record.request.game_id} matches`);
    }
    if (record.type === "sideboarding") {
      for (const actor of [0, 1] as const) {
        const result = await transports[actor]!.request({
          op: "sideboard",
          input: {
            deck: record.request.decks[actor],
            preSideGames: record.request.histories[actor],
          },
        });
        const expected = record.messages.find(
          (m) => m.type === "sideboard_done",
        )!.decisions[actor]!;
        if (
          JSON.stringify(result.exchanges) !==
          JSON.stringify(expected!.exchanges)
        )
          throw new Error("Sideboard divergence");
        sideboards++;
      }
    }
  }
  const summary = {
    target,
    games,
    decisions,
    sideboards,
    unexpectedFallbacks: 0,
    elapsedMs: performance.now() - start,
    node: process.version,
  };
  if (games !== 40 || sideboards !== 20)
    throw new Error("Incomplete reference workload");
  await writeFile(
    `docs/evidence/bot-experiment/${target}-parity.json`,
    JSON.stringify(summary, null, 2) + "\n",
  );
  console.log(JSON.stringify(summary));
} finally {
  for (const transport of transports) transport.close();
  input.close();
}

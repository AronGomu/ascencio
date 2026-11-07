/** C3 live smoke: complete saved seeded flows; no action-parity or timing gate. */
import type { EvidenceRecord, HostMessage } from "./evidence.ts";
import type { BotGameObservation } from "../../src/battle/worker/bot/bot-contract.ts";
import type { ParsedDeck } from "../../src/battle/duel/presets/deck-parser.ts";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { createReadStream } from "node:fs";
import { createGunzip } from "node:zlib";
import { writeFile } from "node:fs/promises";
const [target, root] = process.argv.slice(2);
if (!["native", "wasm"].includes(target!) || !root)
  throw new Error("Usage: live.ts native|wasm <critical-content-root>");
const child = spawn(
  process.execPath,
  ["--experimental-vm-modules", "scripts/bot-evaluation/host.ts"],
  { stdio: ["pipe", "pipe", "inherit"] },
);
const messages = createInterface({ input: child.stdout })[
  Symbol.asyncIterator
]();
async function command(request: unknown, terminal: string) {
  child.stdin.write(JSON.stringify(request) + "\n");
  const result: HostMessage[] = [];
  for (;;) {
    const line = await messages.next();
    if (line.done) throw new Error("Host exited");
    const message = JSON.parse(line.value) as HostMessage;
    if (["failure", "host_error", "fallback"].includes(message.type))
      throw new Error(JSON.stringify(message));
    result.push(message);
    if (message.type === terminal) return result;
  }
}
const reference = createInterface({
  input: createReadStream(
    "docs/evidence/bot-experiment/typescript-baseline.jsonl.gz",
  ).pipe(createGunzip()),
});
let metadata: EvidenceRecord | undefined;
let games = 0,
  decisions = 0,
  sideboards = 0;
let histories: [BotGameObservation[], BotGameObservation[]] = [[], []];
let decks: ParsedDeck[] = [];
const completed = [];
try {
  for await (const line of reference) {
    const record = JSON.parse(line) as EvidenceRecord;
    if (record.type === "metadata") metadata = record;
    if (record.type === "ready") {
      const actual = await command(
        {
          type: "initialize",
          critical: true,
          snapshot: root,
          codes: [],
          bots: [
            { module: `experiment:${target}:${record.policy}`, config: {} },
            { module: `experiment:${target}:basic`, config: {} },
          ],
        },
        "ready",
      );
      if (actual.at(-1)!.manifest.snapshotId !== metadata!.content.snapshotId)
        throw new Error("Content identity differs from baseline");
    }
    if (record.type === "game") {
      if (record.game === 0) {
        histories = [[], []];
        decks = [...record.request.decks];
      }
      // Preserve the saved seed and seat order, but feed live sideboarding output
      // into games 3/4. No expected action or expected winner is used here.
      const request = {
        ...record.request,
        decks: record.request.bot_order.map((i) => decks[i]),
      };
      const actual = await command(request, "cleanup");
      const observed = actual.filter((m) => m.type === "captured_decision");
      const done = actual.find((m) => m.type === "done");
      if (!done)
        throw new Error(`Game did not complete: ${record.request.game_id}`);
      for (const actor of [0, 1] as const) {
        histories[record.request.bot_order[actor]].push({
          gameId: record.request.game_id,
          initial: actual.find((m) => m.type === "initial" && m.actor === actor)
            ?.initial,
          events: actual
            .filter((m) => m.type === "event" && m.actor === actor)
            .map((m) => m.entry),
          decisions: observed
            .filter((m) => m.actor === actor)
            .map((m) => ({ ...m.input, decision: m.decision })),
          outcome:
            done.winner === null
              ? "draw"
              : done.winner === actor
                ? "win"
                : "loss",
        });
      }
      games++;
      decisions += observed.length;
      completed.push({
        gameId: record.request.game_id,
        winner: done.winner,
        reason: done.engine_reason,
        turns: done.turns,
        decisions: observed.length,
      });
      console.error(`${target} smoke: ${record.request.game_id} completed`);
    }
    if (record.type === "sideboarding") {
      const actual = await command(
        { ...record.request, histories },
        "sideboard_done",
      );
      decks = actual.at(-1)!.decks;
      if (decks.length !== 2 || actual.at(-1)!.decisions.length !== 2)
        throw new Error("Incomplete sideboarding");
      sideboards += 2;
    }
  }
  if (games !== 40 || sideboards !== 20)
    throw new Error("Incomplete smoke workload");
  const result = {
    target,
    games,
    decisions,
    sideboards,
    completed,
    crashes: 0,
    illegalDecisions: 0,
    unexpectedFallbacks: 0,
    node: process.version,
    environment: "Node evaluator host; not Tauri or browser",
    criterion:
      "C3 complete-flow smoke; no action-ID parity or performance gate",
  };
  await writeFile(
    `docs/evidence/bot-experiment/${target}-live.json`,
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log({
    target,
    games,
    decisions,
    sideboards,
    crashes: 0,
    illegalDecisions: 0,
    unexpectedFallbacks: 0,
  });
} finally {
  child.stdin.end();
  child.kill();
  reference.close();
}

/** One-time reference acquisition. Never overwrites an existing baseline. */
import { spawn, execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { createGzip } from "node:zlib";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { createHash } from "node:crypto";
import { parseYdk } from "../../src/battle/duel/presets/deck-parser.ts";
import { loadCriticalInputs } from "../bot-evaluation/critical-inputs.ts";
import type { BotGameObservation } from "../../src/battle/worker/bot/bot-contract.ts";

const root = process.argv[2];
if (!root)
  throw new Error(
    "Usage: node scripts/bot-experiment/capture.ts <readable-content-root>",
  );
const output = "docs/evidence/bot-experiment/typescript-baseline.jsonl.gz";
const base = "2e9489fb33b4d60cd4c9a541154362059c8f4bb7";
// All transitive bot sources must remain at the reference revision.
execFileSync("git", [
  "diff",
  "--exit-code",
  base,
  "--",
  "src/battle/worker/bot",
  "src/battle/worker/opponent",
  "vendor",
]);
const deckPath = "test/fixtures/decks/pre-gx-2005/pre-gx-2005-goat-control.ydk";
const deckBytes = await readFile(deckPath);
const deck = parseYdk(deckBytes.toString());
const loaded = await loadCriticalInputs(root);
const child = spawn(
  process.execPath,
  ["--experimental-vm-modules", "scripts/bot-evaluation/host.ts"],
  { stdio: ["pipe", "pipe", "inherit"] },
);
const lines = createInterface({ input: child.stdout })[Symbol.asyncIterator]();
async function command(value: unknown, terminal: string) {
  child.stdin.write(JSON.stringify(value) + "\n");
  const messages: any[] = [];
  for (;;) {
    const line = await lines.next();
    if (line.done) throw new Error("Host exited before " + terminal);
    const message = JSON.parse(line.value);
    if (["failure", "host_error"].includes(message.type))
      throw new Error(JSON.stringify(message));
    messages.push(message);
    if (message.type === terminal) return messages;
  }
}
const compressed = createGzip();
const completion = pipeline(
  compressed,
  createWriteStream(output, { flags: "wx" }),
);
async function save(value: unknown) {
  const line =
    JSON.stringify(value, (_k, v) =>
      typeof v === "bigint" ? { $bigint: String(v) } : v,
    ) + "\n";
  if (!compressed.write(line))
    await new Promise<void>((resolve) => compressed.once("drain", resolve));
}
try {
  const evidence = {
    type: "metadata",
    schemaVersion: 1,
    capturedAt: new Date().toISOString(),
    base,
    node: process.version,
    lifecycle:
      "Fresh bot per game and sideboard hook, matching evaluator; no cross-match memory",
    opponent: "builtin:basic",
    random: {
      engine: "frozen ocgcore RNG; four uint64 seed words recorded per game",
      bots: "Basic/Generalist deterministic; zero draws",
      draws: [],
    },
    deck: {
      path: deckPath,
      sha256: createHash("sha256").update(deckBytes).digest("hex"),
      contents: deck,
    },
    content: loaded.manifest,
    cards: [...loaded.dependencies.cards],
    vendor: JSON.parse(
      await readFile("vendor/ocgcore-wasm/0.1.2/vendor-manifest.json", "utf8"),
    ),
  };
  await save(evidence);
  for (const policy of ["basic", "generalist"]) {
    const ready = await command(
      {
        type: "initialize",
        critical: true,
        snapshot: root,
        codes: [...deck.main, ...deck.extra, ...deck.side],
        bots: [
          { module: `builtin:${policy}`, config: {} },
          { module: "builtin:basic", config: {} },
        ],
      },
      "ready",
    );
    await save({ type: "ready", policy, messages: ready });
    for (let match = 0; match < 5; match++) {
      let decks = [deck, deck];

      const histories: BotGameObservation[][] = [[], []];
      for (let game = 0; game < 4; game++) {
        const bot_order = game % 2 === 0 ? [0, 1] : [1, 0];
        const seed = [
          String(14000 + match * 4 + game),
          "271828",
          "314159",
          "161803",
        ];
        const request = {
          type: "game",
          capture: true,
          game_id: `${policy}-${match}-${game}`,
          seed,
          decks: bot_order.map((i) => decks[i]),
          profile: "mr5",
          orders: null,
          bot_order,
          limits: { max_turns_per_game: 1000, max_decisions_per_game: 100000 },
        };
        const messages = await command(request, "cleanup");
        const done = messages.find((m) => m.type === "done");
        if (!done) throw new Error("Incomplete game");
        await save({ type: "game", policy, match, game, request, messages });
        for (const actor of [0, 1]) {
          histories[bot_order[actor]!]!.push({
            gameId: request.game_id,
            initial: messages.find(
              (m) => m.type === "initial" && m.actor === actor,
            )?.initial,
            events: messages
              .filter((m) => m.type === "event" && m.actor === actor)
              .map((m) => m.entry),
            decisions: messages
              .filter(
                (m) => m.type === "captured_decision" && m.actor === actor,
              )
              .map((m) => ({ ...m.input, decision: m.decision })),
            outcome:
              done.winner === null
                ? "draw"
                : done.winner === actor
                  ? "win"
                  : "loss",
          });
        }
        console.error(
          `${request.game_id}: ${done.turns} turns, ${messages.filter((m) => m.type === "captured_decision").length} decisions`,
        );
        if (game === 1) {
          const request = { type: "sideboard", decks: [deck, deck], histories };
          const messages = await command(request, "sideboard_done");
          await save({
            type: "sideboarding",
            policy,
            match,
            request,
            messages,
          });
          decks = messages.at(-1).decks;
        }
      }
    }
  }
  compressed.end();
  await completion;
  console.error(`Saved ${output}`);
} finally {
  compressed.destroy();
  child.stdin.end();
  child.kill();
}

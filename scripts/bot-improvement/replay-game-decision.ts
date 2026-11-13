import type {
  BotConfiguration,
  DeckSection,
} from "../../src/battle/worker/bot/bot-contract.ts";
import type {
  ReplayEntry,
  ReplayRecord,
} from "../bot-evaluation/decision-replay.ts";
import type { RuntimeSnapshotManifest } from "../../src/battle/worker/assets/runtime-manifest.ts";
interface DeckRecord {
  [section: string]: { card: { card_code: string; copies: number }[] };
}
interface GameRecord extends ReplayRecord {
  initial: { own_configuration: DeckRecord };
}
interface SourceManifest {
  configuration: {
    content: { snapshot: string };
    starting_orders: { mode: string };
    limits: Record<string, string | number>;
    deck: { path: string };
    opponent_deck?: { path: string };
  };
  content: { snapshot_id: string };
  engine: { sha256: string };
  rules: { profile: string };
  bots: Record<
    string,
    {
      module: string;
      artifact_source: string;
      artifact_sha256: string;
      config: BotConfiguration;
      dependencies: { dependency: unknown[] };
    }
  >;
}
interface Neutral {
  status: string;
  game_id: string;
  starter: string;
  stage: string;
  winner: string | null;
  draw: boolean;
}
interface SideReport {
  sideboarding: {
    exchanges: {
      exchange: {
        from_section: DeckSection;
        to_section: DeckSection;
        card_code: string;
        copies: number;
        reason_code?: string;
        explanation?: string;
      }[];
    };
  };
}
interface Frame {
  type: string;
  actor: number;
  entry: ReplayEntry;
  winner: number | null;
  turns: number;
  prompt: { choices: { choice: { id: string; label: string }[] } };
}
import { parseYdk } from "../../src/battle/duel/presets/deck-parser.ts";
import { validateSideboard } from "../../src/battle/worker/bot/sideboard.ts";
/** Replay retained machine logs and compare an original-policy control with an AI takeover. */
import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { createHash } from "node:crypto";
import { parseArgs } from "node:util";
import { build } from "esbuild";
import {
  buildRuntimeSnapshotManifest,
  verifyRuntimeSnapshotFiles,
} from "../../src/battle/worker/assets/runtime-snapshot-node.ts";
import { loadCriticalInputs } from "../bot-evaluation/critical-inputs.ts";
const { values: v } = parseArgs({
  options: {
    game: { type: "string" },
    decision: { type: "string" },
    actor: { type: "string" },
    bot: { type: "string" },
    strategy: { type: "string" },
    pairing: { type: "string" },
    out: { type: "string" },
    help: { type: "boolean" },
  },
});
if (v.help) {
  console.log(`Usage: node --experimental-vm-modules scripts/bot-improvement/replay-game-decision.ts --game GAME_DIRECTORY --actor a|b --decision 0-decision-N --pairing PAIRING_JSON (--bot BOT_MODULE | --strategy SCORING_MODULE) --out NEW_DIRECTORY
Replays BOTH actors' retained a.json/b.json records with the original seed and decks. Strictly verifies every prefix event and prompt. At the named actor decision, the replacement takes over with a fresh bot instance; the original opponent continues with its warmed state. --strategy exports createStrategy (optional selectCounts/sideboard); --bot exports the normal bot contract. Runs an original-policy control and a replacement branch. Keeps protocol logs and a Markdown comparison. Does not change the improvement run, decks or sideboarding. Requires retained machine action records, original manifest, matching content/engine and paired schedule. Refuses existing output directories. Both continuations have the original game wall timeout.`);
  process.exit(0);
}
for (const k of ["game", "decision", "actor", "pairing", "out"] as const)
  if (!v[k]) throw Error(`Missing --${k}`);
if (v.actor !== "a" && v.actor !== "b") throw Error("Actor must be a or b");
if (Boolean(v.bot) === Boolean(v.strategy))
  throw Error("Supply exactly one of --bot and --strategy");
const project = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const game = path.resolve(v.game!);
const run = path.resolve(game, "../../../..");
const out = path.resolve(v.out!);
const sha = (b: string | Uint8Array) =>
  createHash("sha256").update(b).digest("hex");
async function read<T>(file: string, stack = new Set<string>()): Promise<T> {
  const absolute = path.resolve(file);
  if (stack.has(absolute)) throw Error("Cyclic record reference");
  const next = new Set(stack).add(absolute);
  const raw = JSON.parse(await readFile(absolute, "utf8"));
  async function resolve(x: unknown): Promise<unknown> {
    if (Array.isArray(x)) return Promise.all(x.map(resolve));
    if (x && typeof x === "object") {
      if ("$ref" in x && typeof x.$ref === "string") {
        const [name, fragment] = x.$ref.split("#");
        let target: unknown = await read(
          path.resolve(path.dirname(absolute), name!),
          next,
        );
        if (fragment)
          for (const key of fragment.slice(1).split("/"))
            target = (target as Record<string, unknown>)[
              key.replaceAll("~1", "/").replaceAll("~0", "~")
            ];
        return target;
      }
      return Object.fromEntries(
        await Promise.all(
          Object.entries(x).map(async ([k, z]) => [k, await resolve(z)]),
        ),
      );
    }
    return x;
  }
  return (await resolve(raw.data ?? raw)) as T;
}
const manifest = await read<SourceManifest>(path.join(run, "manifest.json"));
const neutral = await read<Neutral>(path.join(game, "game.json"));
const records = await Promise.all(
  ["a", "b"].map((a) => read<GameRecord>(path.join(game, `${a}.json`))),
);
if (neutral.status !== "completed" || records.some((r) => !r.timeline?.entry))
  throw Error("Completed unpruned game records required");
const pairing = await read<{ schedule: string }>(path.resolve(v.pairing!));
const schedule = pairing.schedule;
if (typeof schedule !== "string") throw Error("Missing pairing schedule");
const seedHash = sha(`${schedule}:${JSON.stringify(neutral.game_id)}`);
const seed = [0, 1, 2, 3].map((i) =>
  BigInt(`0x${seedHash.slice(i * 16, i * 16 + 16)}`).toString(),
);
if (manifest.configuration.starting_orders.mode !== "normal")
  throw Error(
    "Fixture starting orders are not supported by this replay command",
  );
const snapshot = manifest.configuration.content.snapshot;
const legacy = await access(
  path.join(snapshot, "card-library/critical.json"),
).then(
  () => false,
  () => true,
);
const contentManifest = legacy
  ? await buildRuntimeSnapshotManifest(
      snapshot,
      path.join(project, "vendor/ocgcore-wasm/0.1.2"),
    )
  : (await loadCriticalInputs(snapshot)).manifest;
if (legacy)
  await verifyRuntimeSnapshotFiles(
    contentManifest as RuntimeSnapshotManifest,
    snapshot,
  );
if (contentManifest.snapshotId !== manifest.content.snapshot_id)
  throw Error("Content identity changed");
const engine = path.join(
  project,
  "vendor/ocgcore-wasm/0.1.2/lib/ocgcore.sync.wasm",
);
if (sha(await readFile(engine)) !== manifest.engine.sha256)
  throw Error("Engine identity changed");
const replacementPath = path.resolve(v.bot ?? v.strategy!);
const source = v.strategy
  ? `import {createStrategyBotModule} from ${JSON.stringify(path.join(project, "src/battle/worker/bot/strategy-bot.ts"))};import * as strategy from ${JSON.stringify(replacementPath)};export function createBotModule(dependencies){return {contractVersion:1,create(config){const configuration=Object.hasOwn(config,"__campaign_package_json")?JSON.parse(config.__campaign_package_json):config;const base=createStrategyBotModule(dependencies,strategy.createStrategy(dependencies,configuration),strategy.selectCounts).create({});return strategy.sideboard?{...base,sideboard:input=>strategy.sideboard(input,configuration)}:base;}}}`
  : undefined;
const bundle = await build({
  ...(source
    ? {
        stdin: {
          contents: source,
          resolveDir: project,
          sourcefile: "replay-strategy.ts",
        },
      }
    : { entryPoints: [replacementPath] }),
  bundle: true,
  write: false,
  format: "esm",
  platform: "browser",
  target: "es2023",
  logLevel: "silent",
});
const replacement = {
  module: replacementPath,
  source: bundle.outputFiles![0]!.text,
  dependencies: [],
  config: manifest.bots[v.actor]!.config,
};
const artifacts = await Promise.all(
  ["a", "b"].map(async (a) => {
    const b = manifest.bots[a]!;
    const canonical = (x: unknown): unknown =>
      Array.isArray(x)
        ? x.map(canonical)
        : x && typeof x === "object"
          ? Object.fromEntries(
              Object.keys(x)
                .sort()
                .filter(
                  (k) =>
                    !Array.isArray((x as Record<string, unknown>)[k]) ||
                    ((x as Record<string, unknown>)[k] as unknown[]).length,
                )
                .map((k) => [k, canonical((x as Record<string, unknown>)[k])]),
            )
          : x === null
            ? null
            : String(x);
    if (
      sha(
        JSON.stringify(
          canonical({
            source: b.artifact_source,
            dependencies: b.dependencies.dependency,
          }),
        ),
      ) !== b.artifact_sha256
    )
      throw Error("Original bot artifact identity mismatch");
    const file = path.join(out, `original-${a}.mjs`);
    return {
      module: b.module,
      source: file,
      dependencies: [],
      config: b.config,
    };
  }),
);
const expand = (d: DeckRecord) =>
  Object.fromEntries(
    ["main", "extra", "side"].map((s) => [
      s,
      (d[s]?.card ?? []).flatMap((c) =>
        Array<number>(Number(c.copies)).fill(Number(c.card_code)),
      ),
    ]),
  );
const decks = await Promise.all(
  ["a", "b"].map(async (a, i) => {
    let deck = parseYdk(
      await readFile(
        i === 0
          ? manifest.configuration.deck.path
          : (
              manifest.configuration.opponent_deck ??
              manifest.configuration.deck
            ).path,
        "utf8",
      ),
    );
    if (neutral.stage === "post_side") {
      const report = await read<SideReport>(
        path.resolve(game, "../..", `player-${a}.json`),
      );
      deck = validateSideboard(
        deck,
        {
          reason: { code: "replay", explanation: "Recorded sideboarding" },
          exchanges: (report.sideboarding.exchanges.exchange ?? []).map(
            (e) => ({
              from: e.from_section,
              to: e.to_section,
              cardCode: e.card_code,
              copies: Number(e.copies),
              reason: {
                code: e.reason_code ?? "replay",
                explanation: e.explanation ?? "Recorded",
              },
            }),
          ),
        },
        () => {},
      );
    }
    const expected = expand(records[i]!.initial.own_configuration);
    for (const section of ["main", "extra", "side"] as const)
      if (
        JSON.stringify([...deck[section]].sort((a, b) => a - b)) !==
        JSON.stringify([...expected[section]!].sort((a, b) => a - b))
      )
        throw Error("Original deck configuration changed");
    return deck;
  }),
);
await mkdir(out, { recursive: false });
await writeFile(path.join(out, "replacement.mjs"), replacement.source);
await Promise.all(
  artifacts.map((artifact, i) =>
    writeFile(
      artifact.source,
      manifest.bots[i === 0 ? "a" : "b"]!.artifact_source,
    ),
  ),
);
const order = neutral.starter === "a" ? [0, 1] : [1, 0];
const initialize = {
  type: "initialize",
  snapshot,
  codes: [...new Set(decks.flatMap((d) => Object.values(d).flat()))],
  frozen: { legacy, engine, bots: artifacts },
};
const command = {
  type: "game",
  game_id: neutral.game_id,
  profile: manifest.rules.profile,
  decks: order.map((i) => decks[i]),
  orders: null,
  seed,
  bot_order: order,
  limits: Object.fromEntries(
    Object.entries(manifest.configuration.limits).map(([k, z]) => [
      k,
      Number(z),
    ]),
  ),
};
async function branch(name: string, changed: boolean) {
  const child = spawn(
    process.execPath,
    [
      "--experimental-vm-modules",
      "--disable-warning=ExperimentalWarning",
      path.join(project, "scripts/bot-evaluation/host.ts"),
    ],
    { cwd: project, stdio: ["pipe", "pipe", "pipe"] },
  );
  let stderr = "";
  let transportError: unknown;
  child.stderr.on("data", (b) => (stderr = (stderr + b).slice(-65536)));
  child.stdin.on("error", (error) => {
    transportError = error;
    child.kill("SIGKILL");
  });
  const frames: Frame[] = [];
  let done: Frame | undefined;
  let failure: Frame | undefined;
  const timeout = setTimeout(
    () => child.kill("SIGKILL"),
    Number(manifest.configuration.limits.game_wall_time_ms) + 30000,
  );
  const exited = new Promise<number | null>((resolve) =>
    child.on("close", resolve),
  );
  let bytes = 0;
  try {
    child.stdin.write(JSON.stringify(initialize) + "\n");
    for await (const line of createInterface({ input: child.stdout })) {
      bytes += Buffer.byteLength(line);
      if (bytes > 128 * 1024 * 1024)
        throw Error("Replay protocol exceeded 128 MiB");
      const f = JSON.parse(line) as Frame;
      frames.push(f);
      if (f.type === "ready")
        child.stdin.write(
          JSON.stringify({
            ...command,
            replay: {
              actor: v.actor,
              decision: v.decision,
              records,
              ...(changed ? { replacement } : {}),
            },
          }) + "\n",
        );
      if (f.type === "done") done = f;
      if (["failure", "host_error"].includes(f.type)) failure = f;
      if (f.type === "cleanup" || f.type === "host_error") child.stdin.end();
    }
  } catch (error) {
    transportError = error;
    child.kill("SIGKILL");
  } finally {
    child.stdin.end();
  }
  const code = await exited;
  clearTimeout(timeout);
  await writeFile(
    path.join(out, `${name}.jsonl`),
    frames.map((f) => JSON.stringify(f)).join("\n") + "\n",
  );
  const flat = (value: unknown, prefix = ""): string => {
    if (Array.isArray(value))
      return value.map((x, i) => flat(x, `${prefix}.${i}`)).join(" ");
    if (value && typeof value === "object")
      return Object.entries(value)
        .map(([k, x]) => flat(x, prefix ? `${prefix}.${k}` : k))
        .filter(Boolean)
        .join(" ");
    return value === null || value === undefined
      ? ""
      : `${prefix}=${JSON.stringify(value)}`;
  };
  let offered: { id: string; label: string }[] = [];
  const text = [
    `LOG replay-v1 | game=${neutral.game_id} branch=${name} seats=0:${order[0] === 0 ? "a" : "b"},1:${order[1] === 0 ? "a" : "b"}`,
  ];
  for (const f of frames) {
    const actor =
      f.actor === undefined ? "?" : order[f.actor] === 0 ? "a" : "b";
    if (f.type === "decision_started") offered = f.prompt.choices.choice;
    if (f.type === "event")
      text.push(
        `T${f.entry.turn} VIEW ${actor} E${f.entry.sequence} ${f.entry.event} | ${flat(f.entry.changes)} | ${flat(f.entry.details)}`,
      );
    if (f.type === "decision")
      text.push(
        `T${f.entry.turn} ${actor} ${f.entry.phase} D${f.entry.decision_id} CHOOSE ${(f.entry.selected_choice_ids?.choice_id ?? []).map((id) => offered.find((c) => c.id === id)?.label ?? id).join(", ")} | OFFERED ${offered.map((c) => `${c.id}:${c.label}`).join("; ")}`,
      );
    if (f.type === "replay_takeover")
      text.push(`TAKEOVER ${actor} ${v.decision}`);
    if (f.type === "done")
      text.push(
        `RESULT winner=${f.winner === null ? "draw" : order[f.winner] === 0 ? "a" : "b"} turns=${f.turns}`,
      );
    if (["failure", "host_error"].includes(f.type))
      text.push(`FAILURE ${flat(f)}`);
  }
  await writeFile(path.join(out, `${name}.log`), text.join("\n") + "\n");
  await writeFile(path.join(out, `${name}-stderr.log`), stderr);
  if (code !== 0 || failure || !done || transportError)
    throw Error(
      `${name} replay failed: ${JSON.stringify(failure ?? { code, stderr, transportError: String(transportError) })}`,
    );
  return {
    winner:
      done.winner === null ? "draw" : order[done.winner] === 0 ? "a" : "b",
    turns: done.turns,
    frames,
  };
}
try {
  const control = await branch("control", false);
  if (control.winner !== (neutral.draw ? "draw" : neutral.winner))
    throw Error(
      "Original-policy control outcome differs from recorded game; comparison refused",
    );
  const controlChoice = control.frames.find(
    (f) => f.type === "decision" && f.entry.decision_id === v.decision,
  )?.entry.selected_choice_ids?.choice_id;
  const recordedChoice = records[v.actor === "a" ? 0 : 1]!.timeline.entry.find(
    (e) => e.kind === "decision" && e.decision_id === v.decision,
  )?.selected_choice_ids?.choice_id;
  if (JSON.stringify(controlChoice) !== JSON.stringify(recordedChoice))
    throw Error(
      "Original-policy control choice differs from recorded target decision; comparison refused",
    );
  const alternative = await branch("alternative", true);
  const selected = (b: { frames: Frame[] }) =>
    b.frames.find(
      (f) => f.type === "decision" && f.entry.decision_id === v.decision,
    )?.entry.selected_choice_ids?.choice_id;
  const report = `# Decision replay comparison\n\nGame: ${neutral.game_id} · actor: ${v.actor} · takeover: ${v.decision}\n\n- Prefix: events and prompts verified against both actor records.\n- Recorded outcome: ${neutral.draw ? "draw" : neutral.winner}.\n- Original-policy control: ${control.winner}, ${control.turns} turns; choices: ${JSON.stringify(selected(control))}.\n- Replacement continuation: ${alternative.winner}, ${alternative.turns} turns; choices: ${JSON.stringify(selected(alternative))}.\n- Replacement: [frozen source](replacement.mjs), SHA-256 ${sha(replacement.source)}.\n- Logs: [control](control.log), [alternative](alternative.log); machine protocol: [control](control.jsonl), [alternative](alternative.jsonl).\n- Source: [game records](${game}/game.json); [paired schedule](${path.resolve(v.pairing!)}).\n\nReplacement starts fresh at takeover; original policies are warmed through the prefix. Both policies respond normally afterward. This tests one continuation, not a general win-rate gain. Logs are retained.\n`;
  await writeFile(path.join(out, "comparison.md"), report);
  console.log(path.join(out, "comparison.md"));
} catch (error) {
  await writeFile(
    path.join(out, "failure.md"),
    `# Replay failed\n\n${String(error)}\n`,
  );
  throw error;
}

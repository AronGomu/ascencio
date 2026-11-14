import {
  parseGameLog,
  parseMatchLog,
  encodeLogRecord,
  type PreparedMatchJob,
  type PreparedMatchItem,
  type LoggedDeck,
} from "./game-log.ts";
import type { Artifact } from "../bot-evaluation/host-inputs.ts";
import { verifyFrozen } from "./frozen-setup.ts";
import type {
  BotConfiguration,
  DeckSection,
} from "../../src/battle/worker/bot/bot-contract.ts";
import type {
  ReplayEntry,
  ReplayRecord,
} from "../bot-evaluation/decision-replay.ts";
import type { RuntimeSnapshotManifest } from "../../src/battle/worker/assets/runtime-manifest.ts";
type DeckRecord = LoggedDeck;
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
  draw: boolean | null;
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
  /** Game failures carry classification inside failure; host_error has only error text. */
  failure?: { category: string; message: string; stack?: string | null };
  actor: number;
  entry: ReplayEntry;
  winner: number | null;
  turns: number;
  prompt: { choices: { choice: { id: string; label: string }[] } };
}
import { parseYdk } from "../../src/battle/duel/presets/deck-parser.ts";
import { validateSideboard } from "../../src/battle/worker/bot/sideboard.ts";
/** Replay retained machine logs and compare an original-policy control with an AI takeover. */
import { readFile, mkdir, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ReplayHostProcess } from "./replay-host-process.ts";
import { createHash } from "node:crypto";
import { findOutputRoot } from "./output-storage.ts";
import {
  replayWriteOutput as writeFile,
  installReplayWriteGrant,
} from "./replay-output-budget.ts";
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
Replays BOTH actors from the authoritative game.log (legacy a.json/b.json remains readable) with the original seed and decks. Strictly verifies every prefix event and prompt. At the named actor decision, the replacement takes over with a fresh bot instance; the original opponent continues with its warmed state. --strategy exports createStrategy (optional selectCounts/sideboard); --bot exports the normal bot contract. Runs an original-policy control and a replacement branch. Keeps protocol logs and a Markdown comparison. Does not change the improvement run, decks or sideboarding. Requires retained machine action records, original manifest, matching content/engine and paired schedule. Refuses existing output directories. Both continuations have the original game wall timeout.`);
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
const outputRoot = await findOutputRoot(path.join(game, "game.log"));
if (outputRoot) {
  const relative = path.relative(outputRoot, out);
  if (
    !relative ||
    path.isAbsolute(relative) ||
    relative.split(path.sep).includes("..")
  )
    throw Error("Replay output must remain inside its run’s storage scope");
}
if (process.env.ARO2_REPLAY_WRITE_BUDGET)
  await installReplayWriteGrant(
    JSON.parse(process.env.ARO2_REPLAY_WRITE_BUDGET),
  );
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
const logged = await readFile(path.join(game, "game.log"), "utf8").then(
  (text) =>
    text.startsWith("ASCENCIO_GAME_LOG\t2\n") ? parseGameLog(text) : null,
  (error) => {
    if (error.code !== "ENOENT") throw error;
    return null;
  },
);
const pairing = await read<PreparedMatchJob>(path.resolve(v.pairing!));
const loggedMatch = logged
  ? parseMatchLog(
      await readFile(path.resolve(game, "../..", "match.log"), "utf8"),
    )
  : null;
function preparedItem(value: unknown): PreparedMatchItem {
  if (!value || typeof value !== "object")
    throw Error("Missing frozen replay match");
  const item = value as Partial<PreparedMatchItem>;
  if (
    !item.match ||
    typeof item.match.id !== "string" ||
    !Array.isArray(item.match.games) ||
    !Array.isArray(item.bots) ||
    item.bots.length !== 2 ||
    !Array.isArray(item.decks) ||
    item.decks.length !== 2 ||
    !Array.isArray(item.identities) ||
    item.identities.length !== 2 ||
    item.bots.some(
      (bot) =>
        !bot ||
        typeof bot.module !== "string" ||
        typeof bot.source !== "string" ||
        !Array.isArray(bot.dependencies),
    )
  )
    throw Error("Invalid frozen replay match artifacts");
  return item as PreparedMatchItem;
}
const frozenItem = loggedMatch ? preparedItem(loggedMatch.fixture) : null;
if (logged) {
  const frozen = await verifyFrozen(path.dirname(pairing.content));
  if (
    frozen.identity !== pairing.fixtureIdentity ||
    JSON.stringify(
      pairing.matches.find((m) => m.match.id === frozenItem!.match.id),
    ) !== JSON.stringify(frozenItem)
  ) {
    // Property order differs across Rust/TS; compare canonical values below instead.
    const { isDeepStrictEqual } = await import("node:util");
    if (
      frozen.identity !== pairing.fixtureIdentity ||
      !isDeepStrictEqual(
        pairing.matches.find((m) => m.match.id === frozenItem!.match.id),
        frozenItem,
      )
    )
      throw Error("Frozen replay schedule/input mismatch");
  }
  for (let i = 0; i < 2; i++) {
    const artifact = frozenItem!.bots[i]!;
    if (artifact.wasm) throw Error("Retired WASM bot replay is unsupported");
    const descriptorPath = path.join(
      path.dirname(artifact.source),
      "frozen-bot.json",
    );
    const descriptor = await readFile(descriptorPath, "utf8").then(
      JSON.parse,
      (error) => {
        if (error.code !== "ENOENT") throw error;
        return [frozen.target, ...frozen.opponents].find(
          (b) => b.identity === frozenItem!.identities[i],
        );
      },
    );
    if (!descriptor) throw Error("Unknown frozen bot descriptor");
    const { identity: expected, ...body } = descriptor;
    const { identity } = await import("./session-fixtures.ts");
    if (
      expected !== frozenItem!.identities[i] ||
      identity(body) !== expected ||
      sha(await readFile(artifact.source)) !==
        descriptor.files[path.basename(artifact.source)]
    )
      throw Error("Frozen replay bot source mismatch");
  }
}
const manifest: SourceManifest = logged
  ? {
      configuration: {
        content: { snapshot: pairing.content },
        starting_orders: { mode: "fixture" },
        limits: { ...pairing.limits },
        deck: { path: "" },
      },
      content: { snapshot_id: "" },
      engine: { sha256: pairing.engineHash },
      rules: { profile: pairing.profile },
      bots: Object.fromEntries(
        ["a", "b"].map((actor, i) => [
          actor,
          {
            ...frozenItem!.bots[i]!,
            artifact_source: "",
            artifact_sha256: "",
            dependencies: { dependency: [] },
          },
        ]),
      ),
    }
  : await read<SourceManifest>(path.join(run, "manifest.json"));
const neutral: Neutral =
  logged?.neutral ?? (await read<Neutral>(path.join(game, "game.json")));
const sourceRecords =
  logged?.actors ??
  (await Promise.all(
    ["a", "b"].map((a) => read<GameRecord>(path.join(game, `${a}.json`))),
  ));
if (sourceRecords.some((record) => !record.initial?.own_configuration))
  throw Error("Replay requires recorded actor deck configurations");
const records = sourceRecords as GameRecord[];
if (neutral.status !== "completed" || records.some((r) => !r.timeline?.entry))
  throw Error("Completed unpruned game logs required");
const schedule = pairing.schedule;
if (!logged && typeof schedule !== "string")
  throw Error("Missing pairing schedule");
const seedHash = sha(`${schedule}:${JSON.stringify(neutral.game_id)}`);
const gameFixture = logged
  ? frozenItem!.match.games.find(
      (fixture) => fixture.number === Number(logged.neutral.number),
    )
  : undefined;
if (logged && !gameFixture) throw Error("Missing frozen game fixture");
const seed = logged
  ? gameFixture!.engineSeed
  : [0, 1, 2, 3].map((i) =>
      BigInt(`0x${seedHash.slice(i * 16, i * 16 + 16)}`).toString(),
    );
if (!logged && manifest.configuration.starting_orders.mode !== "normal")
  throw Error("Fixture starting orders require log-v2 replay");
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
if (!logged && contentManifest.snapshotId !== manifest.content.snapshot_id)
  throw Error("Content identity changed");
const engine = logged
  ? pairing.engine
  : path.join(project, "vendor/ocgcore-wasm/0.1.2/lib/ocgcore.sync.wasm");
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
const artifacts: Artifact[] = logged
  ? frozenItem!.bots.map((b, i) => ({
      ...b,
      source: path.join(out, `original-${i === 0 ? "a" : "b"}.mjs`),
    }))
  : await Promise.all(
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
                    .map((k) => [
                      k,
                      canonical((x as Record<string, unknown>)[k]),
                    ]),
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
    let deck = logged
      ? frozenItem!.decks[i]!
      : parseYdk(
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
      const report: SideReport = logged
        ? {
            sideboarding: logged.sideboarding[
              i
            ] as unknown as SideReport["sideboarding"],
          }
        : await read<SideReport>(
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
  artifacts.map(async (artifact: Artifact, i: number) =>
    writeFile(
      artifact.source,
      logged
        ? await readFile(frozenItem!.bots[i]!.source, "utf8")
        : manifest.bots[i === 0 ? "a" : "b"]!.artifact_source,
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
  ...(logged ? { fixture: gameFixture! } : {}),
  bot_order: order,
  limits: Object.fromEntries(
    Object.entries(manifest.configuration.limits).map(([k, z]) => [
      k,
      Number(z),
    ]),
  ),
};
const startedBranches: string[] = [];
const host = new ReplayHostProcess<Frame>(
  path.join(project, "scripts/bot-evaluation/host.ts"),
  project,
);
async function branch(name: string, changed: boolean) {
  startedBranches.push(name);
  await writeFile(
    path.join(out, "attempts.json"),
    JSON.stringify({ started: startedBranches }),
  );
  const {
    frames,
    stderr,
    timedOut,
    error: transportError,
  } = await host.run(
    initialize,
    {
      ...command,
      replay: {
        actor: v.actor,
        decision: v.decision,
        records,
        ...(changed ? { replacement } : {}),
      },
    },
    Math.min(
      300000,
      Number(manifest.configuration.limits.game_wall_time_ms) + 30000,
    ),
  );
  const done = frames.findLast((f) => f.type === "done");
  const failure = frames.findLast((f) =>
    ["failure", "host_error"].includes(f.type),
  );
  await writeFile(
    path.join(out, `${name}.log`),
    "ASCENCIO_REPLAY_LOG\t2\n" +
      frames.map((f) => encodeLogRecord("FRAME", f)).join(""),
  );
  await writeFile(path.join(out, `${name}-stderr.log`), stderr);
  if (timedOut || failure?.failure?.category === "timeout")
    throw Object.assign(new Error(`${name} replay timed out`), {
      code: "REPLAY_TIMEOUT",
      branch: name,
    });
  if (failure || !done || transportError)
    throw Error(
      `${name} replay failed: ${JSON.stringify(failure ?? { stderr, transportError: String(transportError) })}`,
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
  const report = `# Decision replay comparison\n\nGame: ${neutral.game_id} · actor: ${v.actor} · takeover: ${v.decision}\n\n- Prefix: events and prompts verified against both actor records.\n- Recorded outcome: ${neutral.draw ? "draw" : neutral.winner}.\n- Original-policy control: ${control.winner}, ${control.turns} turns; choices: ${JSON.stringify(selected(control))}.\n- Replacement continuation: ${alternative.winner}, ${alternative.turns} turns; choices: ${JSON.stringify(selected(alternative))}.\n- Replacement: [frozen source](replacement.mjs), SHA-256 ${sha(replacement.source)}.\n- Logs: [control](control.log), [alternative](alternative.log); complete protocol is retained in those same typed logs.\n- Source: [game log](${game}/game.log); [paired schedule](${path.resolve(v.pairing!)}).\n\nReplacement starts fresh at takeover; original policies are warmed through the prefix. Both policies respond normally afterward. This tests one continuation, not a general win-rate gain. Logs are retained.\n`;
  await writeFile(path.join(out, "comparison.md"), report);
  await writeFile(
    path.join(out, "result.json"),
    JSON.stringify(
      {
        status: "complete",
        game: neutral.game_id,
        actor: v.actor,
        decision: v.decision,
        replacementSha256: sha(replacement.source),
        control: {
          winner: control.winner,
          turns: control.turns,
          choiceIds: selected(control) ?? [],
        },
        alternative: {
          winner: alternative.winner,
          turns: alternative.turns,
          choiceIds: selected(alternative) ?? [],
        },
        choiceChanged:
          JSON.stringify(selected(control)) !==
          JSON.stringify(selected(alternative)),
        convertedLossToWin:
          neutral.winner !== v.actor && alternative.winner === v.actor,
      },
      null,
      2,
    ),
  );
  console.log(path.join(out, "comparison.md"));
} catch (error) {
  await writeFile(
    path.join(out, "failure.md"),
    `# Replay failed\n\n${String(error)}\n`,
  );
  if ((error as NodeJS.ErrnoException).code === "REPLAY_TIMEOUT") {
    await writeFile(
      path.join(out, "bug-report.json"),
      JSON.stringify(
        {
          status: "ignored",
          category: "timeout",
          game: neutral.game_id,
          decision: v.decision,
          message: String(error),
          retry: false,
        },
        null,
        2,
      ) + "\n",
    );
    await writeFile(
      path.join(out, "result.json"),
      JSON.stringify(
        {
          status: "ignored",
          game: neutral.game_id,
          actor: v.actor,
          decision: v.decision,
          replacementSha256: sha(replacement.source),
          branch: (error as { branch?: string }).branch ?? "unknown",
        },
        null,
        2,
      ),
    );
    console.log(
      JSON.stringify({
        status: "ignored",
        bugReport: path.join(out, "bug-report.json"),
      }),
    );
  } else throw error;
} finally {
  await host.close();
  // Branch files snapshot diagnostics; retain the final shared stream after exit.
  await writeFile(path.join(out, "host-stderr.log"), host.stderr);
}

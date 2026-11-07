import { readFile, mkdir, writeFile, rename, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { spawn } from "node:child_process";
import { verifyFrozen } from "./frozen-setup.ts";
import { digest, identity } from "./session-fixtures.ts";
import { resolveWorkers } from "./match-workers.ts";
import type {
  FrozenBot,
  MatchExecutionLimits,
  RunnerSnapshot,
} from "./session-contract.ts";

export const defaultMatchLimits: MatchExecutionLimits = {
  game_wall_time_ms: 60000,
  decision_wall_time_ms: 1000,
  sideboarding_wall_time_ms: 5000,
  max_turns_per_game: 200,
  max_decisions_per_game: 20000,
};
async function json(file: string) {
  return JSON.parse(await readFile(file, "utf8"));
}
async function snapshot(
  file: string | undefined,
  initial: RunnerSnapshot,
  frozen: FrozenBot,
) {
  const ref = file ? ((await json(file)) as RunnerSnapshot) : initial;
  if (ref.schemaVersion !== 1) throw new Error("Unsupported runner snapshot");
  ref.path = path.resolve(
    file ? path.dirname(path.resolve(file)) : ".",
    ref.path,
  );
  const { identity: expected, ...body } = ref.bot;
  if (identity(body) !== expected)
    throw new Error("Snapshot identity mismatch");
  if (
    identity(ref.bot.deck) !== identity(frozen.deck) ||
    identity(ref.bot.configuration) !== identity(frozen.configuration) ||
    ref.bot.policy !== frozen.policy ||
    ref.bot.kind !== frozen.kind ||
    ref.bot.module !== frozen.module
  )
    throw new Error(
      "Runner override changed frozen deck/configuration/policy/module",
    );
  for (const [file, hash] of Object.entries(ref.bot.files)) {
    if (path.isAbsolute(file) || file.split(/[\\/]/).includes(".."))
      throw new Error("Unsafe snapshot file");
    if (digest(await readFile(path.join(ref.path, file))) !== hash)
      throw new Error(`Snapshot file changed: ${file}`);
  }
  return ref;
}
function artifact(ref: RunnerSnapshot) {
  const bot = ref.bot;
  if (bot.kind === "module")
    return {
      module: bot.module,
      source: path.join(ref.path, "bot.mjs"),
      config: bot.configuration,
      dependencies: [],
    };
  return (async () => {
    const manifest = await json(path.join(ref.path, "bot.json"));
    if (!bot.files[manifest.wasm]) throw new Error("Unpinned package WASM");
    return {
      module: `experiment:wasm:${bot.policy}`,
      source: bot.files[manifest.wasm],
      wasm: path.join(ref.path, manifest.wasm),
      config: bot.configuration,
      dependencies: [],
    };
  })();
}
export async function prepareMatches(options: {
  session: string;
  candidate?: string | undefined;
  self?: string | undefined;
  limits?: string | undefined;
  maxGames?: number | undefined;
  maxWallMs?: number | undefined;
}) {
  const config = await json(path.join(options.session, "config.json"));
  if (config.schemaVersion !== 1) throw new Error("Unsupported session");
  const root = path.resolve(config.fixture.path);
  const frozen = await verifyFrozen(root);
  if (frozen.identity !== config.fixture.identity)
    throw new Error("Session fixture identity mismatch");
  const initial: RunnerSnapshot = {
    schemaVersion: 1,
    path: path.join(root, "versions/initial"),
    bot: frozen.target,
  };
  // Setup's initial snapshot always exists. Later stages must pass their explicit archived overrides.
  const candidate = await snapshot(options.candidate, initial, frozen.target);
  const self = await snapshot(options.self, initial, frozen.target);
  const opponents = new Map<string, RunnerSnapshot>([["self", self]]);
  for (const [i, bot] of frozen.opponents.entries())
    opponents.set(`opponent-${i + 1}`, {
      schemaVersion: 1,
      path: path.join(root, `opponents/opponent-${i + 1}`),
      bot,
    });
  const limits = options.limits
    ? ((await json(options.limits)) as MatchExecutionLimits)
    : defaultMatchLimits;
  if (
    Object.keys(limits).sort().join() !==
      Object.keys(defaultMatchLimits).sort().join() ||
    Object.values(limits).some((n) => !Number.isSafeInteger(n) || n <= 0)
  )
    throw new Error("Invalid match execution limits");
  const budget = {
    maxGames: options.maxGames ?? config.limits.stop.maxGames,
    maxWallMs: options.maxWallMs ?? config.limits.stop.maxWallMs,
  };
  for (const n of Object.values(budget))
    if (n !== undefined && (!Number.isSafeInteger(n) || n <= 0))
      throw new Error("Invalid execution budget");
  const matches = [];
  for (const match of frozen.matches) {
    const opponent = opponents.get(match.opponentSlot);
    if (!opponent) throw new Error("Unknown opponent slot");
    matches.push({
      match,
      decks: [candidate.bot.deck, opponent.bot.deck],
      identities: [candidate.bot.identity, opponent.bot.identity],
      bots: await Promise.all([artifact(candidate), artifact(opponent)]),
    });
  }
  const body = {
    schemaVersion: 1,
    fixtureIdentity: frozen.identity,
    candidateIdentity: candidate.bot.identity,
    selfIdentity: self.bot.identity,
    content: path.join(root, "content"),
    engine: path.join(root, "engine/lib/ocgcore.sync.wasm"),
    engineHash: frozen.files["engine/lib/ocgcore.sync.wasm"],
    banlist: path.join(root, "banlist.json"),
    rules: await json(path.join(root, "banlist.json")),
    profile: frozen.profile,
    limits,
    budget,
    matches,
  };
  return {
    job: { ...body, identity: identity(body) },
    bound: config.limits.matchWorkers as number,
  };
}
export async function executeMatches(
  options: Parameters<typeof prepareMatches>[0] & {
    out: string;
    workers: string;
    resume?: boolean | undefined;
    binary?: string | undefined;
  },
) {
  const { job, bound } = await prepareMatches(options);
  const workers = await resolveWorkers(
    options.workers,
    job.matches.length,
    bound,
  );
  const output = path.resolve(options.out);
  // Preparation files have a separate exclusive owner, never collide with pool output/resume.
  await mkdir(path.dirname(output), { recursive: true });
  const lock = `${output}.prepare-lock`;
  await mkdir(lock);
  try {
    const file = `${output}.job.json`;
    if (options.resume) {
      if (identity(await json(file)) !== identity(job))
        throw new Error("Resume preparation identity mismatch");
    } else {
      await writeFile(`${file}.tmp`, JSON.stringify(job), { flag: "wx" });
      await rename(`${file}.tmp`, file);
    }
    const binary =
      options.binary ??
      path.resolve(
        "tools/bot-evaluation/target/release/ascencio-bot-evaluation",
      );
    const code = await runProcess(binary, [
      "frozen",
      "--job",
      file,
      "--out",
      output,
      "--workers",
      String(workers),
      ...(options.resume ? ["--resume"] : []),
    ]);
    const result = await json(path.join(output, "result.json"));
    return { ...result, exitCode: code, output };
  } finally {
    await rm(lock, { recursive: true, force: true });
  }
}
export function runProcess(command: string, args: string[]) {
  return new Promise<number>((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      env: { ...process.env, ARO2_NODE: process.execPath },
    });
    const interrupt = () => child.kill("SIGINT");
    process.on("SIGINT", interrupt);
    process.on("SIGTERM", interrupt);
    child.on("error", reject);
    child.on("close", (code) => {
      process.off("SIGINT", interrupt);
      process.off("SIGTERM", interrupt);
      resolve(code ?? 2);
    });
  });
}
export const matchOptions = {
  session: { type: "string" },
  out: { type: "string" },
  workers: { type: "string", default: "auto" },
  candidate: { type: "string" },
  self: { type: "string" },
  limits: { type: "string" },
  "max-games": { type: "string" },
  "max-wall-ms": { type: "string" },
  resume: { type: "boolean" },
} as const;
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const { values: v } = parseArgs({ options: matchOptions });
  if (!v.session || !v.out)
    throw new Error(
      "--session and --out required; optional --workers auto|N --candidate SNAPSHOT.json --self SNAPSHOT.json --limits LIMITS.json --resume",
    );
  if (
    await runProcess("cargo", [
      "build",
      "--release",
      "--manifest-path",
      "tools/bot-evaluation/Cargo.toml",
    ])
  )
    throw new Error("Evaluator build failed");
  const result = await executeMatches({
    session: v.session,
    out: v.out,
    workers: v.workers,
    candidate: v.candidate,
    self: v.self,
    limits: v.limits,
    resume: v.resume,
    maxGames: v["max-games"] ? Number(v["max-games"]) : undefined,
    maxWallMs: v["max-wall-ms"] ? Number(v["max-wall-ms"]) : undefined,
  });
  console.log(JSON.stringify(result));
  process.exitCode = result.exitCode;
}

import { readFile } from "node:fs/promises";
import path from "node:path";
import { verifyFrozen } from "./frozen-setup.ts";
import { digest, identity } from "./session-fixtures.ts";
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
  accepted?: RunnerSnapshot | undefined;
  matchCount?: number | undefined;
}) {
  const config = await json(path.join(options.session, "config.json"));
  if (config.schemaVersion !== 1) throw new Error("Unsupported session");
  const root = path.resolve(config.fixture.path);
  const frozen = await verifyFrozen(root);
  if (frozen.identity !== config.fixture.identity)
    throw new Error("Session fixture identity mismatch");
  const initial: RunnerSnapshot = options.accepted ?? {
    schemaVersion: 1,
    path: path.join(root, "versions/initial"),
    bot: frozen.target,
  };
  // Setup's initial snapshot always exists. Later stages must pass their explicit archived overrides.
  const candidate = await snapshot(options.candidate, initial, frozen.target);
  const self = await snapshot(
    options.self,
    {
      schemaVersion: 1,
      path: path.join(root, "versions/initial"),
      bot: frozen.target,
    },
    frozen.target,
  );
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
  const count = options.matchCount ?? frozen.matches.length;
  if (
    !Number.isSafeInteger(count) ||
    count < 1 ||
    count > frozen.matches.length
  )
    throw new Error(`Match count must be 1–${frozen.matches.length}`);
  const matches = [];
  for (const match of frozen.matches.slice(0, count)) {
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
    job: {
      ...body,
      identity: identity({
        fixtureIdentity: body.fixtureIdentity,
        candidateIdentity: body.candidateIdentity,
        selfIdentity: body.selfIdentity,
        profile: body.profile,
        limits: body.limits,
        budget: body.budget,
        matches: body.matches.map(({ match, decks, identities }) => ({
          match,
          decks,
          identities,
        })),
      }),
    },
    bound: config.limits.matchWorkers as number,
    totalMatches: frozen.matches.length,
  };
}

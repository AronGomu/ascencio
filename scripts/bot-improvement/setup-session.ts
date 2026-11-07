import {
  mkdir,
  readFile,
  rename,
  rm,
  lstat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { json, resolveBot } from "./setup-inputs.ts";
import { verifyFrozen } from "./frozen-setup.ts";
import { digest, identity, schedule } from "./session-fixtures.ts";
import type { FrozenSetup, SetupOptions } from "./session-contract.ts";

async function absent(file: string) {
  try {
    await lstat(file);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return;
    throw e;
  }
  throw new Error(
    `Already exists; use explicit reuse or a new location: ${file}`,
  );
}
async function save(file: string, value: unknown) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" });
}

export async function setupSession(options: SetupOptions) {
  if (!options.setupSeed || typeof options.setupSeed !== "string")
    throw new Error("Explicit setup seed required");
  const stop = options.stop;
  if (
    !stop ||
    Array.isArray(stop) ||
    !Object.keys(stop).length ||
    Object.entries(stop).some(([k, v]) =>
      k === "ownerStop"
        ? v !== true
        : !["maxIterations", "maxGames", "maxWallMs"].includes(k) ||
          !Number.isSafeInteger(v) ||
          Number(v) <= 0,
    )
  )
    throw new Error("Invalid stopping condition");
  const matchWorkers = options.matchWorkers ?? 6,
    analysisWorkers = options.analysisWorkers ?? 3;
  for (const n of [matchWorkers, analysisWorkers])
    if (!Number.isSafeInteger(n) || n < 1 || n > 64)
      throw new Error("Worker limits must be 1–64");
  const session = path.resolve(options.session);
  await mkdir(path.dirname(session), { recursive: true });
  const sessionLock = `${session}.lock`;
  await mkdir(sessionLock);
  let targetLock: string | undefined;
  let fixtureStage: string | undefined,
    sessionStage: string | undefined,
    configStage: string | undefined;
  let publishedFixture: string | undefined,
    publishedSession = false,
    changedConfig = false;
  let target: Awaited<ReturnType<typeof resolveBot>> | undefined;
  try {
    await absent(session);
    const targetFolder = path.resolve(options.target);
    const lock = path.join(targetFolder, ".evaluation-setup.lock");
    await mkdir(lock);
    targetLock = lock;
    target = await resolveBot(targetFolder);
    const opponents = [];
    for (const folder of options.opponents)
      opponents.push(await resolveBot(folder));
    if (
      new Set(opponents.map((b) => b.folder)).size !== opponents.length ||
      opponents.some((b) => b.folder === target!.folder)
    )
      throw new Error("Duplicate opponent folder; self slot is implicit");
    const shared = (b: typeof target) =>
      identity({
        content: b!.loaded.manifest,
        banlist: digest(b!.banlistBytes),
        profile: b!.config.profile,
      });
    for (const bot of opponents)
      if (shared(bot) !== shared(target))
        throw new Error(`Engine/content/rules mismatch: ${bot.folder}`);
    const bytes: Record<string, Uint8Array> = {};
    for (const [i, bot] of [target, ...opponents].entries()) {
      const prefix = i === 0 ? "versions/initial" : `opponents/opponent-${i}`;
      for (const [file, data] of Object.entries(bot.bytes))
        bytes[`${prefix}/${file}`] = data;
    }
    for (const pkg of ["card-library", "duel-core"]) {
      const data = await readFile(
        path.join(target.content, pkg, "critical.json"),
      );
      const expected = target.loaded.manifest.critical.find(
        (p) => p.id === pkg,
      )!;
      if (digest(data) !== expected.sha256)
        throw new Error(`Content changed during setup: ${pkg}`);
      bytes[`content/${pkg}/critical.json`] = data;
    }
    bytes["banlist-source.json"] = target.banlistBytes;
    bytes["banlist.json"] = Buffer.from(JSON.stringify(target.banlist));
    const vendor = path.resolve("vendor/ocgcore-wasm/0.1.2");
    const manifestBytes = await readFile(
      path.join(vendor, "vendor-manifest.json"),
    );
    const engine = JSON.parse(manifestBytes.toString());
    if (
      engine.schemaVersion !== 1 ||
      engine.version !== "0.1.2" ||
      engine.package !== "ocgcore-wasm"
    )
      throw new Error("Unsupported engine");
    bytes["engine/vendor-manifest.json"] = manifestBytes;
    for (const file of engine.files as {
      path: string;
      sha256: string;
      bytes: number;
    }[]) {
      if (path.isAbsolute(file.path) || file.path.split(/[\\/]/).includes(".."))
        throw new Error("Unsafe engine path");
      const data = await readFile(path.join(vendor, file.path));
      if (digest(data) !== file.sha256 || data.length !== file.bytes)
        throw new Error(`Engine identity mismatch: ${file.path}`);
      bytes[`engine/${file.path}`] = data;
    }
    const files = Object.fromEntries(
      Object.keys(bytes)
        .sort()
        .map((file) => [file, digest(bytes[file]!)]),
    );
    const inputsIdentity = identity({
      target: target.frozen,
      opponents: opponents.map((b) => b.frozen),
      files,
      profile: target.config.profile,
    });
    const body: Omit<FrozenSetup, "identity"> = {
      schemaVersion: 1,
      setupSeed: options.setupSeed,
      inputsIdentity,
      profile: target.config.profile,
      protocol: {
        gamesPerMatch: 4,
        sideboardAfterGame: 2,
        preserveSectionSizes: true,
        preserveTotalMultiset: true,
        shuffle: "sha256-counter-fisher-yates-v1",
        openingHand: "first-five-main-cards; normal-engine-first-turn-draw",
        randomness:
          "engine-u64x4; bot-u32-per-player-per-game; sideboard-u32-per-player",
      },
      target: target.frozen,
      opponents: opponents.map((b) => b.frozen),
      files,
      matches: schedule(
        options.setupSeed,
        target.frozen.deck,
        opponents.map((b) => b.frozen.deck),
      ),
    };
    let frozen: FrozenSetup = { ...body, identity: identity(body) };
    let fixture: string;
    if (options.reuse) {
      fixture = path.resolve(target.folder, options.reuse);
      frozen = await verifyFrozen(fixture);
      if (
        frozen.inputsIdentity !== inputsIdentity ||
        frozen.setupSeed !== options.setupSeed ||
        frozen.identity !== identity(body)
      )
        throw new Error(
          "Reuse identity mismatch: bots, deck, configuration, content, engine, protocol or setup seed changed",
        );
    } else {
      fixture = path.join(
        target.folder,
        "evaluation",
        "fixtures",
        frozen.identity,
      );
      await mkdir(path.dirname(fixture), { recursive: true });
      await absent(fixture);
      fixtureStage = `${fixture}.staging-${randomUUID()}`;
      await mkdir(fixtureStage);
      for (const [file, data] of Object.entries(bytes)) {
        await mkdir(path.dirname(path.join(fixtureStage, file)), {
          recursive: true,
        });
        await writeFile(path.join(fixtureStage, file), data, { flag: "wx" });
      }
      await save(path.join(fixtureStage, "manifest.json"), frozen);
      await verifyFrozen(fixtureStage);
    }
    const config = {
      schemaVersion: 1,
      fixture: { path: fixture, identity: frozen.identity },
      accepted: {
        identity: frozen.target.identity,
        path: path.join(fixture, "versions/initial"),
      },
      opponentSlots: [
        ...frozen.opponents.map((bot, i) => ({
          slot: `opponent-${i + 1}`,
          identity: bot.identity,
          path: path.join(fixture, `opponents/opponent-${i + 1}`),
        })),
        { slot: "self", bindAt: "iteration-boundary" },
      ],
      profile: target.config.profile,
      limits: { matchWorkers, analysisWorkers, stop },
      protocol: frozen.protocol,
    };
    sessionStage = `${session}.staging-${randomUUID()}`;
    await mkdir(sessionStage);
    for (const dir of ["iterations", "versions", "matches", "analyses"])
      await mkdir(path.join(sessionStage, dir));
    await save(path.join(sessionStage, "config.json"), config);
    // Ready is published only after the bot-owned reference commits.
    const state = {
      schemaVersion: 1,
      status: "ready",
      iteration: 0,
      accepted: config.accepted,
      fixtureIdentity: frozen.identity,
      completedMatches: [],
      completedGames: [],
      stoppingReason: null,
    };
    await save(path.join(sessionStage, "state.json"), state);
    if ((await readFile(target.configPath, "utf8")) !== target.original)
      throw new Error("Target configuration changed during setup");
    configStage = `${target.configPath}.staging-${randomUUID()}`;
    await save(configStage, {
      ...target.config,
      fixtures: {
        path: path.relative(target.folder, fixture).split(path.sep).join("/"),
        identity: frozen.identity,
      },
    });
    if (fixtureStage) {
      await rename(fixtureStage, fixture);
      fixtureStage = undefined;
      publishedFixture = fixture;
    }
    await rename(configStage, target.configPath);
    configStage = undefined;
    changedConfig = true;
    await rename(sessionStage, session);
    sessionStage = undefined;
    publishedSession = true;
    return {
      session,
      config: path.join(session, "config.json"),
      fixture,
      identity: frozen.identity,
      matches: 500,
      games: 2000,
    };
  } catch (error) {
    if (changedConfig && target)
      await writeFile(target.configPath, target.original);
    if (publishedSession) await rm(session, { recursive: true, force: true });
    if (publishedFixture)
      await rm(publishedFixture, { recursive: true, force: true });
    throw error;
  } finally {
    for (const dir of [fixtureStage, sessionStage, configStage])
      if (dir) await rm(dir, { recursive: true, force: true });
    if (targetLock) await rm(targetLock, { recursive: true, force: true });
    await rm(sessionLock, { recursive: true, force: true });
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  let request: SetupOptions;
  const input = process.argv[2];
  if (input?.startsWith("--")) {
    const { values } = parseArgs({
      options: {
        target: { type: "string" },
        opponent: { type: "string", multiple: true },
        seed: { type: "string" },
        session: { type: "string" },
        reuse: { type: "string" },
        "max-iterations": { type: "string" },
        "max-games": { type: "string" },
        "max-wall-ms": { type: "string" },
        "owner-stop": { type: "boolean" },
        "match-workers": { type: "string" },
        "analysis-workers": { type: "string" },
      },
    });
    if (!values.target || !values.seed || !values.session)
      throw new Error("--target, --seed and --session are required");
    request = {
      target: values.target,
      opponents: values.opponent ?? [],
      setupSeed: values.seed,
      session: values.session,
      stop: {
        ...(values["max-iterations"] === undefined
          ? {}
          : { maxIterations: Number(values["max-iterations"]) }),
        ...(values["max-games"] === undefined
          ? {}
          : { maxGames: Number(values["max-games"]) }),
        ...(values["max-wall-ms"] === undefined
          ? {}
          : { maxWallMs: Number(values["max-wall-ms"]) }),
        ...(values["owner-stop"] ? { ownerStop: true as const } : {}),
      },
      ...(values.reuse ? { reuse: path.resolve(values.reuse) } : {}),
      ...(values["match-workers"] === undefined
        ? {}
        : { matchWorkers: Number(values["match-workers"]) }),
      ...(values["analysis-workers"] === undefined
        ? {}
        : { analysisWorkers: Number(values["analysis-workers"]) }),
    };
  } else {
    if (!input || process.argv.length !== 3)
      throw new Error(
        "Usage: npm run bot:setup -- setup-request.json OR --target BOT --seed SEED --session PATH --max-iterations N",
      );
    request = (await json(input)) as SetupOptions;
    const base = path.dirname(path.resolve(input));
    request.target = path.resolve(base, request.target);
    request.opponents = request.opponents.map((p) => path.resolve(base, p));
    request.session = path.resolve(base, request.session);
    if (request.reuse) request.reuse = path.resolve(base, request.reuse);
  }
  console.log(JSON.stringify(await setupSession(request)));
}

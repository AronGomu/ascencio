import {
  mkdir,
  readFile,
  writeFile,
  rename,
  rm,
  stat,
  lstat,
} from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { verifyFrozen } from "./frozen-setup.ts";
import { digest, identity } from "./session-fixtures.ts";
import type { FrozenBot } from "./session-contract.ts";
import type {
  BaselineReceipt,
  IterationManifest,
  IterationOptions,
} from "./iteration-contract.ts";

const json = async (file: string) => JSON.parse(await readFile(file, "utf8"));
function localFile(root: string, file: string) {
  if (!file || path.isAbsolute(file) || file.split(/[\\/]/).includes(".."))
    throw new Error("Unsafe archive path");
  return path.join(root, file);
}
async function botBytes(root: string, bot: FrozenBot) {
  const { identity: expected, ...body } = bot;
  if (identity(body) !== expected || !Object.keys(bot.files).length)
    throw new Error("Accepted bot identity mismatch");
  const bytes: Record<string, Uint8Array> = {};
  for (const [file, hash] of Object.entries(bot.files)) {
    bytes[file] = await readFile(localFile(root, file));
    if (digest(bytes[file]!) !== hash)
      throw new Error(`Accepted file mismatch: ${file}`);
  }
  return bytes;
}
async function baselinePlan(
  receipt: string | undefined,
  comparison: string,
  ids: string[],
): Promise<IterationManifest["baseline"]> {
  const result = (
    action: "reuse" | "refresh",
    reason: IterationManifest["baseline"]["reason"],
  ) => ({ receipt: receipt ?? null, action, reason });
  if (!receipt) return result("refresh", "missing");
  try {
    const evidence = (await json(receipt)) as BaselineReceipt;
    if (evidence.schemaVersion !== 1) return result("refresh", "corrupt");
    if (evidence.comparisonIdentity !== comparison)
      return result("refresh", "identity-mismatch");
    if (
      evidence.status !== "complete" ||
      !Array.isArray(evidence.completedMatches) ||
      identity([...evidence.completedMatches].sort()) !==
        identity([...ids].sort()) ||
      identity(Object.keys(evidence.matches).sort()) !==
        identity([...ids].sort()) ||
      new Set(Object.values(evidence.matches).map((match) => match.path))
        .size !== ids.length
    )
      return result("refresh", "incomplete");
    for (const id of ids) {
      const match = evidence.matches[id]!;
      if (
        digest(await readFile(localFile(path.dirname(receipt), match.path))) !==
        match.sha256
      )
        return result("refresh", "corrupt");
    }
    return result("reuse", "verified");
  } catch (error) {
    return result(
      "refresh",
      (error as NodeJS.ErrnoException).code === "ENOENT"
        ? "missing"
        : "corrupt",
    );
  }
}

export async function prepareIteration(options: IterationOptions) {
  if (
    !Number.isSafeInteger(options.iteration) ||
    options.iteration < 1 ||
    !options.runnerIdentity?.trim()
  )
    throw new Error("Positive iteration and explicit runner identity required");
  const session = path.resolve(options.session);
  const lock = path.join(session, ".iteration-preparation.lock");
  await mkdir(lock);
  let stage: string | undefined;
  let manifestStage: string | undefined;
  try {
    const config = await json(path.join(session, "config.json"));
    const state = await json(path.join(session, "state.json"));
    const frozen = await verifyFrozen(config.fixture.path);
    if (
      config.schemaVersion !== 1 ||
      state.schemaVersion !== 1 ||
      config.fixture.identity !== frozen.identity ||
      state.fixtureIdentity !== frozen.identity
    )
      throw new Error("Session fixture identity mismatch");
    const accepted = state.accepted;
    const initial = path.join(config.fixture.path, "versions/initial");
    const bot: FrozenBot =
      path.resolve(accepted.path) === path.resolve(initial)
        ? frozen.target
        : await json(path.join(accepted.path, "frozen-bot.json"));
    if (bot.identity !== accepted.identity)
      throw new Error("Accepted reference identity mismatch");
    for (const field of [
      "kind",
      "deck",
      "configuration",
      "policy",
      "module",
    ] as const)
      if (
        identity({ value: bot[field] }) !==
        identity({ value: frozen.target[field] })
      )
        throw new Error(`Frozen target ${field} changed`);
    const bytes = await botBytes(accepted.path, bot);
    const id = `iteration-${String(options.iteration).padStart(4, "0")}`;
    const destination = path.join(session, "iterations", id);
    const snapshot = path.join(destination, "accepted");
    const reference = { path: snapshot, identity: bot.identity };
    const opponents = [
      ...frozen.opponents.map((opponent, i) => ({
        slot: `opponent-${i + 1}`,
        path: path.join(config.fixture.path, `opponents/opponent-${i + 1}`),
        identity: opponent.identity,
      })),
      { slot: "self", ...reference },
    ];
    const comparisonIdentity = identity({
      fixture: frozen.identity,
      control: bot.identity,
      opponents: opponents.map(({ slot, identity }) => ({ slot, identity })),
      runnerIdentity: options.runnerIdentity,
    });
    const baseline = await baselinePlan(
      options.baseline && path.resolve(options.baseline),
      comparisonIdentity,
      frozen.matches.map((m) => m.id),
    );
    const manifest: IterationManifest = {
      schemaVersion: 1,
      id,
      iteration: options.iteration,
      fixture: config.fixture,
      accepted: { ...reference, bot },
      control: reference,
      self: reference,
      candidate: {
        path: path.join(destination, "candidate"),
        basedOn: bot.identity,
        identity: null,
      },
      opponents,
      runnerIdentity: options.runnerIdentity,
      comparisonIdentity,
      baseline,
      plan: {
        control: baseline.action === "reuse" ? "reuse-baseline" : "evaluate",
        candidate: "validate-then-evaluate",
        matchesPerEvaluation: 500,
        gamesPerEvaluation: 2000,
      },
    };
    if (
      identity((await json(path.join(session, "state.json"))).accepted) !==
      identity(accepted)
    )
      throw new Error("Accepted reference changed during preparation");
    const manifestPath = path.join(destination, "manifest.json");
    let existing: IterationManifest | undefined;
    try {
      existing = await json(manifestPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    if (existing) {
      const bindings = (value: IterationManifest) => ({
        ...value,
        baseline: null,
        plan: null,
      });
      if (identity(bindings(existing)) !== identity(bindings(manifest)))
        throw new Error(
          "Prepared iteration identity mismatch; use a new iteration number",
        );
      await botBytes(snapshot, bot);
      if (
        identity(await json(path.join(snapshot, "frozen-bot.json"))) !==
          identity(bot) ||
        !(await stat(manifest.candidate.path)).isDirectory()
      )
        throw new Error("Prepared iteration archive mismatch");
      manifestStage = `${manifestPath}.staging-${randomUUID()}`;
      await writeFile(manifestStage, `${JSON.stringify(manifest, null, 2)}\n`, {
        flag: "wx",
      });
      await rename(manifestStage, manifestPath);
      manifestStage = undefined;
    } else {
      try {
        await lstat(destination);
        throw new Error(
          "Iteration destination exists without a valid manifest",
        );
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      stage = `${destination}.staging-${randomUUID()}`;
      await mkdir(stage);
      for (const folder of ["accepted", "candidate"]) {
        for (const [file, data] of Object.entries(bytes)) {
          const target = localFile(path.join(stage, folder), file);
          await mkdir(path.dirname(target), { recursive: true });
          await writeFile(target, data, { flag: "wx" });
        }
        await writeFile(
          path.join(stage, folder, "frozen-bot.json"),
          JSON.stringify(bot),
          { flag: "wx" },
        );
      }
      await writeFile(
        path.join(stage, "manifest.json"),
        `${JSON.stringify(manifest, null, 2)}\n`,
        { flag: "wx" },
      );
      await rename(stage, destination);
      stage = undefined;
    }
    return { manifest: manifestPath, ...manifest };
  } finally {
    if (stage) await rm(stage, { recursive: true, force: true });
    if (manifestStage) await rm(manifestStage, { force: true });
    await rm(lock, { recursive: true, force: true });
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const { values } = parseArgs({
      options: {
        session: { type: "string" },
        iteration: { type: "string" },
        "runner-identity": { type: "string" },
        baseline: { type: "string" },
      },
    });
    if (!values.session) throw new Error("--session required");
    console.log(
      JSON.stringify(
        await prepareIteration({
          session: values.session,
          iteration: Number(values.iteration),
          runnerIdentity: values["runner-identity"]!,
          ...(values.baseline ? { baseline: values.baseline } : {}),
        }),
      ),
    );
  } catch (error) {
    console.error((error as Error).message);
    process.exitCode = 1;
  }
}

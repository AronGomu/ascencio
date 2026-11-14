/** Discover every requested loss before admitting work, and freeze each variant once. */
import { readFile, realpath, lstat } from "node:fs/promises";
import path from "node:path";
import { build } from "esbuild";
import { parseGameLog } from "./game-log.ts";
import { digest } from "./session-fixtures.ts";
import { findOutputRoot } from "./output-storage.ts";
import type {
  ReplayPoolRequest,
  PreparedReplayCase,
} from "./replay-pool-contract.ts";
const slug = (value: unknown) =>
  typeof value === "string" && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(value);
export async function prepareReplayPool(requestFile: string, output: string) {
  const bytes = await readFile(requestFile);
  const request = JSON.parse(bytes.toString()) as ReplayPoolRequest;
  if (
    request.schemaVersion !== 1 ||
    !Array.isArray(request.reasons) ||
    !request.reasons.length
  )
    throw Error("Replay request requires schemaVersion 1 and nonempty reasons");
  const base = path.dirname(path.resolve(requestFile));
  output = path.resolve(output);
  const reasons = new Set<string>(),
    jobs: PreparedReplayCase[] = [];
  const sourceRoots = new Set<string>();
  const variants: { file: string; bytes: Uint8Array }[] = [];
  for (const reason of request.reasons) {
    if (
      !reason ||
      !slug(reason.id) ||
      reasons.has(reason.id) ||
      Boolean(reason.bot) === Boolean(reason.strategy) ||
      !Array.isArray(reason.cases) ||
      !reason.cases.length
    )
      throw Error(
        "Each reason needs a unique safe id, one bot/strategy and nonempty cases",
      );
    reasons.add(reason.id);
    const original = await realpath(
      path.resolve(base, reason.bot ?? reason.strategy!),
    );
    const contents = reason.strategy
      ? `import {createStrategyBotModule} from ${JSON.stringify(path.resolve("src/battle/worker/bot/strategy-bot.ts"))};import * as strategy from ${JSON.stringify(original)};export function createBotModule(dependencies){return {contractVersion:1,create(config){const configuration=Object.hasOwn(config,"__campaign_package_json")?JSON.parse(config.__campaign_package_json):config;const base=createStrategyBotModule(dependencies,strategy.createStrategy(dependencies,configuration),strategy.selectCounts).create({});return strategy.sideboard?{...base,sideboard:input=>strategy.sideboard(input,configuration)}:base;}}}`
      : undefined;
    const bundle = await build({
      ...(contents
        ? {
            stdin: {
              contents,
              resolveDir: process.cwd(),
              sourcefile: "replay-pool-strategy.ts",
            },
          }
        : { entryPoints: [original] }),
      bundle: true,
      write: false,
      format: "esm",
      platform: "browser",
      target: "es2023",
      logLevel: "silent",
    });
    const replacement = path.join(
        output,
        "payload",
        "variants",
        `${reason.id}.mjs`,
      ),
      code = bundle.outputFiles![0]!.contents;
    if (/\bimport\s*\(/.test(Buffer.from(code).toString()))
      throw Error("Dynamic replay variant imports are unsupported");
    const ids = new Set<string>(),
      targets = new Set<string>();
    for (const candidate of reason.cases) {
      if (
        !slug(candidate.id) ||
        ids.has(candidate.id) ||
        !["a", "b"].includes(candidate.actor) ||
        typeof candidate.decision !== "string" ||
        !candidate.decision ||
        !(candidate.pairing ?? reason.pairing)
      )
        throw Error(
          "Replay cases require unique safe ids, actor, decision and pairing",
        );
      ids.add(candidate.id);
      const game = await realpath(path.resolve(base, candidate.game)),
        pairing = await realpath(
          path.resolve(base, candidate.pairing ?? reason.pairing!),
        );
      const target = `${game}/${candidate.actor}`;
      if (targets.has(target))
        throw Error("Each reason must name each lost game only once");
      targets.add(target);
      const gameFile = path.join(game, "game.log"),
        gameBytes = await readFile(gameFile),
        log = parseGameLog(gameBytes.toString());
      const actor = log.actors[candidate.actor === "a" ? 0 : 1];
      if (
        log.neutral.status !== "completed" ||
        log.neutral.winner === candidate.actor ||
        log.neutral.draw !== false ||
        actor.result?.outcome !== "loss"
      )
        throw Error(
          "Replay pool accepts only completed losses for the requested actor",
        );
      if (
        !actor.timeline.entry.some(
          (e) => e.kind === "decision" && e.decision_id === candidate.decision,
        )
      )
        throw Error(
          "Critical decision is not present in the losing actor's record",
        );
      const matchFile = await realpath(
        path.resolve(game, "../..", "match.log"),
      );
      const inputRoot = await findOutputRoot(gameFile);
      if (inputRoot) sourceRoots.add(inputRoot);
      jobs.push({
        id: `${reason.id}/${candidate.id}`,
        reason: reason.id,
        caseId: candidate.id,
        game,
        gameId: log.neutral.game_id,
        actor: candidate.actor,
        decision: candidate.decision,
        pairing,
        replacement,
        pins: [
          { path: gameFile, sha256: digest(gameBytes) },
          { path: matchFile, sha256: digest(await readFile(matchFile)) },
          { path: pairing, sha256: digest(await readFile(pairing)) },
          { path: replacement, sha256: digest(code) },
        ],
      });
    }
    // No games are launched during discovery. Freeze variants only after validating this reason.
    variants.push({ file: replacement, bytes: code });
  }
  if (sourceRoots.size > 1)
    throw Error("One experimental pool must use one source storage scope");
  const sourceRoot = [...sourceRoots][0];
  if (sourceRoot) {
    const relative = path.relative(sourceRoot, output);
    if (
      !relative ||
      relative.split(path.sep).includes("..") ||
      path.isAbsolute(relative)
    )
      throw Error(
        "Replay pool output must stay inside the source run storage scope",
      );
  }
  return { requestSha256: digest(bytes), jobs, sourceRoot, variants };
}
export async function verifyReplayPins(job: PreparedReplayCase) {
  for (const pin of job.pins) {
    if (
      (await lstat(pin.path)).isSymbolicLink() ||
      digest(await readFile(pin.path)) !== pin.sha256
    )
      throw Error(`Replay input changed: ${pin.path}`);
  }
}

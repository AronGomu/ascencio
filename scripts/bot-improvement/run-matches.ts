/** Default session runner. Legacy execution is explicitly archived. */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { executeMatches } from "./session-batch-runner.ts";
import { matchOptions } from "./match-process.ts";
export { executeMatches } from "./session-batch-runner.ts";
export { prepareMatches, defaultMatchLimits } from "./prepare-match-job.ts";
export {
  runProcess,
  interruptActiveProcess,
  matchOptions,
} from "./match-process.ts";
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const { values: v } = parseArgs({
    options: {
      ...matchOptions,
      backend: { type: "string", default: "typescript" },
      "batch-size": { type: "string", default: "1" },
    },
  });
  if (!v.session || !v.out)
    throw Error(
      "--session and --out required; workers auto|N; archived legacy runs use archive/run-matches.ts",
    );
  if (v.role && !["control", "candidate"].includes(v.role))
    throw Error("Role must be control or candidate");
  if (!["typescript", "rust"].includes(v.backend))
    throw Error("backend must be typescript or rust");
  const result = await executeMatches({
    backend: v.backend as "typescript" | "rust",
    session: v.session,
    out: v.out,
    workers: v.workers,
    batchSize: Number(v["batch-size"]),
    matchCount: v.matches ? Number(v.matches) : undefined,
    candidate: v.candidate,
    self: v.self,
    limits: v.limits,
    resume: v.resume,
    iteration: v.iteration ? Number(v.iteration) : undefined,
    role: v.role as "control" | "candidate" | undefined,
    maxGames: v["max-games"] ? Number(v["max-games"]) : undefined,
    maxWallMs: v["max-wall-ms"] ? Number(v["max-wall-ms"]) : undefined,
  });
  console.log(JSON.stringify(result));
  process.exitCode = result.exitCode;
}

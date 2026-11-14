import { availableParallelism, cpus, platform, arch, homedir } from "node:os";
import { readFile, mkdir, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { identity } from "./session-fixtures.ts";

export async function machineResources() {
  let logical = availableParallelism();
  try {
    const [quota, period] = (await readFile("/sys/fs/cgroup/cpu.max", "utf8"))
      .trim()
      .split(/\s+/);
    if (quota !== "max")
      logical = Math.min(
        logical,
        Math.max(1, Math.floor(Number(quota) / Number(period))),
      );
  } catch {
    /* Other platforms use availableParallelism's process limit. */
  }
  let physical = logical;
  try {
    const allowedText = (await readFile("/proc/self/status", "utf8")).match(
      /^Cpus_allowed_list:\s*(.+)$/m,
    )![1]!;
    const allowed = new Set<number>();
    for (const range of allowedText.split(",")) {
      const [a, b = a] = range.split("-").map(Number) as [number, number?];
      for (let i = a; i <= b!; i++) allowed.add(i);
    }
    const cores = new Set<string>();
    for (const cpu of (await readFile("/proc/cpuinfo", "utf8")).split(/\n\n/)) {
      const field = (key: string) =>
        cpu.match(new RegExp(`^${key}\\s*:\\s*(.+)$`, "m"))?.[1];
      if (
        allowed.has(Number(field("processor"))) &&
        field("physical id") &&
        field("core id")
      )
        cores.add(`${field("physical id")}/${field("core id")}`);
    }
    if (cores.size) physical = Math.min(logical, cores.size);
  } catch {
    /* Cheap topology information is optional. */
  }
  const environment = {
    platform: platform(),
    arch: arch(),
    cpu: cpus()[0]?.model,
    logical,
    physical,
    node: process.version,
  };
  return {
    ...environment,
    usable: Math.max(1, physical),
    identity: identity(environment),
  };
}
export const recommendationPath = path.resolve(
  process.env.XDG_STATE_HOME ?? path.join(homedir(), ".local/state"),
  "ascencio/bot-evaluation-machine.json",
);
export async function resolveWorkers(
  request: string,
  pending: number,
  bound = 64,
) {
  const resources = await machineResources();
  let requested = request === "auto" ? 1 : Number(request);
  if (request === "auto") {
    try {
      const saved = JSON.parse(await readFile(recommendationPath, "utf8"));
      if (saved.machineIdentity === resources.identity)
        requested = saved.workers;
      else
        throw new Error(
          "Machine settings are stale; calibrate before execution",
        );
    } catch (error) {
      throw new Error(
        "No valid machine-local recommendation; calibrate before execution",
        { cause: error },
      );
    }
  }
  if (!Number.isSafeInteger(requested) || requested < 1 || requested > 64)
    throw new Error("Workers must be auto or 1–64");
  return Math.max(1, Math.min(requested, resources.usable, pending, bound));
}
export async function saveRecommendation(
  workers: number,
  evidence: string,
  preferredWorkers?: number,
) {
  const resources = await machineResources();
  await mkdir(path.dirname(recommendationPath), { recursive: true });
  const measured = await readFile(evidence, "utf8");
  const result = JSON.parse(measured);
  if (
    result.recommendation !== workers ||
    result.resources?.identity !== resources.identity
  )
    throw new Error("Recommendation does not match measured machine results");
  const archive = path.join(
    path.dirname(recommendationPath),
    "worker-calibrations",
    identity(result),
  );
  await mkdir(archive, { recursive: true });
  const savedEvidence = path.join(archive, "benchmark.json");
  await writeFile(savedEvidence, measured);
  const lines = [
    "# Worker calibration",
    "",
    `Selected workers: ${workers}. Preferred workers: ${preferredWorkers ?? "none"}.`,
    "",
    "| Workers | Seconds | Reliable |",
    "|---:|---:|---|",
  ];
  for (const stage of result.stages)
    lines.push(
      `| ${stage.workers} | ${stage.medianMs === undefined ? "—" : (stage.medianMs / 1000).toFixed(2)} | ${stage.reliable ?? false} |`,
    );
  lines.push(
    "",
    `Sample: ${result.matchCount} matches per stage, ${result.repeats} repetition(s). Recommendation applies only to the recorded machine/environment.`,
  );
  await writeFile(path.join(archive, "report.md"), lines.join("\n") + "\n");
  const tmp = `${recommendationPath}.${randomUUID()}.tmp`;
  await writeFile(
    tmp,
    JSON.stringify(
      {
        schemaVersion: 1,
        machineIdentity: resources.identity,
        resources,
        workers,
        preferredWorkers,
        evidence: savedEvidence,
        sourceEvidence: evidence,
      },
      null,
      2,
    ),
  );
  await rename(tmp, recommendationPath);
}

/** Prefer the owner's count only when reliable timings put it in the competitive band. */
export function selectWorkerRecommendation(
  stages: {
    workers: number;
    reliable?: boolean;
    medianMs?: number;
    runs: Record<string, unknown>[];
  }[],
  preferred?: number,
) {
  const reliable = stages.filter(
    (s) =>
      s.reliable &&
      s.medianMs !== undefined &&
      s.medianMs > 0 &&
      s.runs.length &&
      s.runs.every(
        (r) =>
          typeof r.commandWallMs === "number" &&
          Number.isFinite(r.commandWallMs),
      ),
  );
  const noiseFraction = Math.max(
    0.03,
    ...reliable.map((s) => {
      const times = s.runs.map((r) => Number(r.commandWallMs));
      return (Math.max(...times) - Math.min(...times)) / s.medianMs!;
    }),
  );
  const fastest = Math.min(...reliable.map((s) => s.medianMs!));
  const competitive = reliable
    .filter((s) => s.medianMs! <= fastest * (1 + noiseFraction))
    .sort((a, b) => a.workers - b.workers);
  return {
    workers:
      (competitive.find((s) => s.workers === preferred) ?? competitive[0])
        ?.workers ?? null,
    noiseFraction,
  };
}

/** Future sessions permit calibration across the available logical CPUs. */
export async function defaultMatchWorkerBound(explicit?: number) {
  return explicit ?? availableParallelism();
}

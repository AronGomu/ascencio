import { availableParallelism, cpus, platform, arch } from "node:os";
import { readFile, mkdir, writeFile, rename } from "node:fs/promises";
import path from "node:path";
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
  "generated/bot-evaluation-machine.json",
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
        console.error(
          "CPU/environment identity changed; retune with bot:matches:benchmark. Using one worker.",
        );
    } catch {
      console.error(
        "No local measured recommendation; using one worker. Run bot:matches:benchmark to tune.",
      );
    }
  }
  if (!Number.isSafeInteger(requested) || requested < 1 || requested > 64)
    throw new Error("Workers must be auto or 1–64");
  return Math.max(1, Math.min(requested, resources.usable, pending, bound));
}
export async function saveRecommendation(workers: number, evidence: string) {
  const resources = await machineResources();
  await mkdir(path.dirname(recommendationPath), { recursive: true });
  const tmp = `${recommendationPath}.tmp`;
  await writeFile(
    tmp,
    JSON.stringify(
      {
        schemaVersion: 1,
        machineIdentity: resources.identity,
        resources,
        workers,
        evidence,
      },
      null,
      2,
    ),
  );
  await rename(tmp, recommendationPath);
}

import { writeOutput } from "./output-storage.ts";
import {
  calibrationEvidence,
  verifyCalibrationEvidence,
  type CalibrationEvidence,
} from "./calibration-evidence.ts";
import { ownedOperation } from "./operation-status.ts";
/** Crash-resumable measurement journal. Failed and interrupted attempts retain directories. */
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
async function runCalibration<
  T extends { workers: number; wallMs: number; fingerprint: string },
>(options: {
  out: string;
  identity: string;
  counts: number[];
  repeats: number;
  memory?: {
    availableBytes: number;
    reserveBytes: number;
    bytesPerWorker: number;
    provenance: string;
  };
  run: (workers: number, out: string) => Promise<T>;
}) {
  const file = path.join(options.out, "attempts.json");
  await mkdir(options.out, { recursive: true });
  let journal: {
    identity: string;
    configuration?: {
      counts: number[];
      repeats: number;
      memory?: typeof options.memory;
    };
    exclusions?: {
      workers: number;
      reason: string;
      requiredBytes?: number;
      availableBytes?: number;
    }[];
    attempts: {
      workers: number;
      repeat: number;
      attempt: number;
      out: string;
      status: string;
      error?: string;
      result?: T;
      evidence?: CalibrationEvidence;
    }[];
  } = { identity: options.identity, attempts: [] };
  try {
    journal = JSON.parse(await readFile(file, "utf8"));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
  if (
    !options.counts.length ||
    new Set(options.counts).size !== options.counts.length ||
    options.counts.some((n) => !Number.isSafeInteger(n) || n < 2) ||
    !Number.isSafeInteger(options.repeats) ||
    options.repeats < 1
  )
    throw Error("Invalid calibration stages");
  if (
    options.memory &&
    (!options.memory.provenance ||
      Object.entries(options.memory).some(
        ([k, v]) =>
          k !== "provenance" && (!Number.isSafeInteger(v) || Number(v) < 0),
      ) ||
      options.memory.bytesPerWorker <= 0)
  )
    throw Error("Invalid calibration memory preflight");
  const configuration = {
    counts: options.counts,
    repeats: options.repeats,
    ...(options.memory ? { memory: options.memory } : {}),
  };
  if (
    journal.configuration &&
    JSON.stringify(journal.configuration) !== JSON.stringify(configuration)
  )
    throw Error("Calibration configuration identity mismatch");
  journal.configuration = configuration;
  if (journal.identity !== options.identity)
    throw Error("Calibration resume identity mismatch");
  const save = async () => writeOutput(file, JSON.stringify(journal, null, 2));
  const unsafe =
    /integrity|mismatch|changed|budget|max-output|deadline|owner-stop|cancelled/i;
  const blocked = journal.attempts.find(
    (a) => a.status === "failed" && unsafe.test(a.error ?? ""),
  );
  if (blocked)
    throw Error(`Calibration requires incident resolution: ${blocked.error}`);
  let fingerprint = journal.attempts.find((a) => a.result)?.result?.fingerprint;
  for (const attempt of journal.attempts.filter(
    (a) => a.status === "complete",
  )) {
    if (!attempt.evidence)
      throw Error(
        "Calibration integrity: successful measurement lacks retained evidence",
      );
    if (
      !attempt.result ||
      attempt.result.workers !== attempt.workers ||
      !Number.isFinite(attempt.result.wallMs) ||
      attempt.result.wallMs <= 0 ||
      attempt.result.fingerprint !== fingerprint
    )
      throw Error("Calibration measurement integrity mismatch");
    await verifyCalibrationEvidence(attempt.evidence);
  }
  journal.exclusions ??= [];
  const excluded = new Set<number>(journal.exclusions.map((e) => e.workers));
  if (options.memory)
    for (const workers of options.counts) {
      const requiredBytes =
        workers * options.memory.bytesPerWorker + options.memory.reserveBytes;
      if (
        requiredBytes > options.memory.availableBytes &&
        !excluded.has(workers)
      ) {
        excluded.add(workers);
        journal.exclusions.push({
          workers,
          reason: "memory-preflight",
          requiredBytes,
          availableBytes: options.memory.availableBytes,
        });
      }
    }
  await save();
  for (let repeat = 0; repeat < options.repeats; repeat++)
    for (const workers of repeat % 2
      ? [...options.counts].reverse()
      : options.counts) {
      if (excluded.has(workers)) continue;
      const prior = journal.attempts.filter(
        (a) => a.workers === workers && a.repeat === repeat,
      );
      if (prior.some((a) => a.status === "complete")) continue;
      let success = false;
      for (let attempt = prior.length; attempt < 2; attempt++) {
        const entry: (typeof journal.attempts)[number] = {
          workers,
          repeat,
          attempt,
          out: path.join(
            options.out,
            `workers-${workers}-repeat-${repeat + 1}-attempt-${attempt + 1}`,
          ),
          status: "running",
        };
        journal.attempts.push(entry);
        await save();
        try {
          await mkdir(entry.out, { recursive: true });
          const result = await options.run(workers, entry.out);
          if (
            result.workers !== workers ||
            !Number.isFinite(result.wallMs) ||
            result.wallMs <= 0
          )
            throw Error("Calibration measurement integrity mismatch");
          if (fingerprint !== undefined && result.fingerprint !== fingerprint)
            throw Error("Calibration gameplay integrity mismatch");
          fingerprint ??= result.fingerprint;
          entry.evidence = await calibrationEvidence(entry.out);
          entry.result = result;
          entry.status = "complete";
          await save();
          success = true;
          break;
        } catch (e) {
          entry.status = "failed";
          entry.error = String(e);
          await save();
          if (
            /integrity|mismatch|changed|budget|max-output|deadline|owner-stop|cancelled/i.test(
              String(e),
            )
          )
            throw e;
        }
      }
      if (!success) {
        excluded.add(workers);
        journal.exclusions.push({
          workers,
          reason: "failed-after-single-retry",
        });
        await save();
      }
    }
  const runs = journal.attempts
    .filter((a) => a.status === "complete" && !excluded.has(a.workers))
    .map((a) => a.result!);
  return {
    runs,
    excluded: [...excluded].sort((a, b) => a - b),
    exclusions: journal.exclusions,
    journal: path.resolve(file),
    journalIdentity: options.identity,
  };
}

export async function recoverCalibration<
  T extends { workers: number; wallMs: number; fingerprint: string },
>(options: Parameters<typeof runCalibration<T>>[0]) {
  await mkdir(options.out, { recursive: true });
  return ownedOperation(
    path.join(options.out, "calibration-operation.json"),
    options.identity,
    () => runCalibration(options),
  );
}

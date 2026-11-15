/** Bounded copied-evidence benchmark. Never dispatches games, analysts or replays. */
import {
  readFile,
  writeFile,
  mkdir,
  stat,
  readdir,
  rename,
  lstat,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { digest } from "./session-fixtures.ts";
import {
  compactLossReview,
  reconstructCompactReview,
} from "./compact-loss-review.ts";
import { readableLossPages } from "./loss-review.ts";
import { decodeLog } from "./game-log.ts";
import { isDeepStrictEqual } from "node:util";
import { locked } from "./output-storage.ts";
export interface ReviewBenchmarkRequest {
  inputRoot: string;
  out: string;
  maxCases: number;
  maxWallMs: number;
  maxBytes: number;
  cases: {
    id: string;
    path: string;
    sha256: string;
    stratum: "short" | "medium" | "long";
    tags?: string[];
  }[];
}
interface MeasuredCase {
  id: string;
  sourceSha256: string;
  stratum: string;
  tags: string[];
  inputBytes: number;
  phases: {
    decodeMs: number;
    legacyPrepareMs: number;
    compactPrepareMs: number;
    receiptValidationMs: number;
  };
  legacyBytes: number;
  compactBytes: number;
  legacyPages: number;
  pages: { path: string; sha256: string; bytes: number }[];
  rows: number;
}
export interface ReviewObservation {
  caseId: string;
  sourceSha256: string;
  analyst: string;
  startedAt: number;
  endedAt: number;
  pagesRead: number;
  completed: boolean;
  actualTokens: number | null;
  lostProgressMs: number;
  findingsSummary: string;
}
interface BenchmarkReport {
  schemaVersion: 1;
  identity: string;
  startedAt: number;
  finishedAt: number;
  request: ReviewBenchmarkRequest;
  cases: MeasuredCase[];
  peakRssBytes: number;
  inputBytes: number;
  scope: string;
  observations: ReviewObservation[];
  observationHistory?: ReviewObservation[];
  replayMeasurements: {
    sourceSha256: string;
    caseIds: string[];
    elapsedMs: number;
    cases: number;
    branchAttempts: number;
  }[];
}
async function safePath(root: string, relative: string) {
  if (
    path.isAbsolute(relative) ||
    relative.split(/[\\/]/).some((p) => !p || p === "." || p === "..")
  )
    throw Error("Unsafe benchmark input path");
  let current = path.resolve(root);
  for (const p of relative.split(/[\\/]/)) {
    current = path.join(current, p);
    if ((await lstat(current)).isSymbolicLink())
      throw Error("Benchmark inputs cannot follow symlinks");
  }
  return current;
}
async function usage(dir: string): Promise<number> {
  let bytes = 0;
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, item.name);
    bytes += item.isDirectory() ? await usage(file) : (await stat(file)).size;
  }
  return bytes;
}
async function publish(report: BenchmarkReport, file: string, value: unknown) {
  if (Date.now() - report.startedAt > report.request.maxWallMs)
    throw Error("Diagnostic wall budget exhausted");
  const bytes = JSON.stringify(value, null, 2) + "\n";
  const inputs = report.inputBytes;
  if (
    inputs + (await usage(report.request.out)) + Buffer.byteLength(bytes) >
    report.request.maxBytes
  )
    throw Error("Diagnostic byte budget exhausted");
  const tmp = `${file}.${randomUUID()}.tmp`;
  await writeFile(tmp, bytes, { flag: "wx" });
  await rename(tmp, file);
}
export async function benchmarkReviewWorkflow(request: ReviewBenchmarkRequest) {
  if (
    ![request.maxCases, request.maxWallMs, request.maxBytes].every(
      (n) => Number.isSafeInteger(n) && n > 0,
    ) ||
    request.cases.length > request.maxCases ||
    !request.cases.length ||
    request.maxCases > 100
  )
    throw Error("Explicit bounded diagnostic limits required");
  if (
    new Set(request.cases.map((c) => c.id)).size !== request.cases.length ||
    request.cases.some(
      (c) =>
        !/^[-\w]+$/.test(c.id) ||
        !["short", "medium", "long"].includes(c.stratum) ||
        !/^([a-f0-9]{64})$/.test(c.sha256),
    )
  )
    throw Error("Invalid benchmark manifest");
  const startedAt = Date.now();
  const out = path.resolve(request.out),
    inputRoot = path.resolve(request.inputRoot);
  if (
    out === inputRoot ||
    inputRoot.startsWith(out + path.sep) ||
    out.startsWith(inputRoot + path.sep)
  )
    throw Error("Diagnostic output must be separate from input copies");
  request = { ...request, out, inputRoot };
  const sources = await Promise.all(
    request.cases.map(async (c) => {
      const file = await safePath(inputRoot, c.path);
      return { file, bytes: (await stat(file)).size };
    }),
  );
  if (sources.reduce((n, s) => n + s.bytes, 0) >= request.maxBytes)
    throw Error("Diagnostic inputs exceed byte budget");
  await mkdir(path.dirname(out), { recursive: true });
  await mkdir(out);
  const report: BenchmarkReport = {
    schemaVersion: 1,
    identity: digest(JSON.stringify(request)),
    startedAt,
    finishedAt: startedAt,
    request,
    cases: [],
    peakRssBytes: 0,
    inputBytes: sources.reduce((n, s) => n + s.bytes, 0),
    scope:
      "Copied target-loss evidence only. Byte counts are not model tokens. No game, replay or model dispatch. Reading observations are separately attested.",
    observations: [],
    replayMeasurements: [],
  };
  for (const [index, c] of request.cases.entries()) {
    if (Date.now() - startedAt > request.maxWallMs)
      throw Error("Diagnostic wall budget exhausted");
    const text = await readFile(sources[index]!.file, "utf8");
    if (digest(text) !== c.sha256)
      throw Error("Benchmark source hash mismatch");
    let before = performance.now();
    const decoded = decodeLog(text, "ASCENCIO_LOSS_LOG\t2");
    const decodeMs = performance.now() - before;
    before = performance.now();
    const legacy = readableLossPages(text);
    const legacyPrepareMs = performance.now() - before;
    before = performance.now();
    const compact = compactLossReview(text);
    const compactPrepareMs = performance.now() - before;
    before = performance.now();
    if (
      !isDeepStrictEqual(
        reconstructCompactReview(compact.pages.map((p) => p.text).join("")),
        decoded,
      )
    )
      throw Error("Benchmark reconstruction mismatch");
    const receiptValidationMs = performance.now() - before;
    const row: MeasuredCase = {
      id: c.id,
      sourceSha256: c.sha256,
      stratum: c.stratum,
      tags: c.tags ?? [],
      inputBytes: Buffer.byteLength(text),
      phases: {
        decodeMs,
        legacyPrepareMs,
        compactPrepareMs,
        receiptValidationMs,
      },
      legacyBytes: Buffer.byteLength(legacy.map((p) => p.text).join("")),
      compactBytes: compact.bytes,
      legacyPages: legacy.length,
      pages: [],
      rows: compact.rows,
    };
    report.cases.push(row);
    for (const [i, page] of compact.pages.entries()) {
      const relative = `${c.id}-page-${String(i + 1).padStart(4, "0")}.json`;
      // Persist the exact text inside a JSON value; it is decoded before hashing on reads.
      await publish(report, path.join(out, relative), { text: page.text });
      row.pages.push({
        path: relative,
        sha256: digest(page.text),
        bytes: Buffer.byteLength(page.text),
      });
    }
  }
  report.finishedAt = Date.now();
  report.peakRssBytes = process.resourceUsage().maxRSS * 1024;
  await publish(report, path.join(out, "benchmark.json"), report);
  return report;
}
export async function recordReviewObservation(
  out: string,
  observation: ReviewObservation,
) {
  return locked(path.resolve(out), async () => {
    const file = path.join(path.resolve(out), "benchmark.json");
    const report = JSON.parse(await readFile(file, "utf8")) as BenchmarkReport;
    const c = report.cases.find((c) => c.id === observation.caseId);
    if (
      !c ||
      c.sourceSha256 !== observation.sourceSha256 ||
      typeof observation.completed !== "boolean" ||
      typeof observation.analyst !== "string" ||
      observation.analyst.length > 256 ||
      !observation.analyst ||
      !Number.isSafeInteger(observation.pagesRead) ||
      observation.pagesRead < 0 ||
      observation.pagesRead > c.pages.length ||
      !Number.isFinite(observation.startedAt) ||
      !Number.isFinite(observation.endedAt) ||
      observation.startedAt < report.startedAt ||
      observation.endedAt < observation.startedAt ||
      observation.endedAt > Date.now() + 1000 ||
      observation.lostProgressMs < 0 ||
      observation.lostProgressMs >
        observation.endedAt - observation.startedAt ||
      !(
        observation.actualTokens === null ||
        (Number.isSafeInteger(observation.actualTokens) &&
          observation.actualTokens >= 0)
      ) ||
      observation.findingsSummary.length > 8000
    )
      throw Error("Invalid reading observation");
    if (
      observation.completed &&
      (observation.pagesRead !== c.pages.length ||
        !observation.findingsSummary.trim())
    )
      throw Error("Completed reading requires every page and a finding");
    for (const page of c.pages.slice(0, observation.pagesRead)) {
      const value = JSON.parse(
        await readFile(await safePath(out, page.path), "utf8"),
      );
      if (digest(value.text) !== page.sha256)
        throw Error("Reading page hash mismatch");
    }
    const priorIndex = report.observations.findIndex(
      (o) =>
        o.caseId === observation.caseId && o.analyst === observation.analyst,
    );
    if (priorIndex >= 0) {
      const prior = report.observations[priorIndex]!;
      if (isDeepStrictEqual(prior, observation)) return report;
      if (
        prior.completed ||
        observation.startedAt !== prior.startedAt ||
        observation.endedAt < prior.endedAt ||
        observation.pagesRead < prior.pagesRead
      )
        throw Error("Conflicting analyst/case observation");
      report.observationHistory ??= [];
      report.observationHistory.push(prior);
      report.observations[priorIndex] = observation;
    } else report.observations.push(observation);
    await publish(report, file, report);
    return report;
  });
}

/** Import a separately run diagnostic result; never executes a replay. */
export async function recordReplayMeasurement(
  out: string,
  input: { path: string; sha256: string; caseIds: string[] },
) {
  return locked(path.resolve(out), async () => {
    const file = path.join(path.resolve(out), "benchmark.json");
    const report = JSON.parse(await readFile(file, "utf8")) as BenchmarkReport;
    if (
      !input.caseIds.length ||
      new Set(input.caseIds).size !== input.caseIds.length ||
      input.caseIds.some((id) => !report.cases.some((c) => c.id === id))
    )
      throw Error("Replay measurement requires benchmark case binding");
    const replayBytes = (await stat(input.path)).size;
    if (
      report.inputBytes + replayBytes + (await usage(report.request.out)) >
      report.request.maxBytes
    )
      throw Error("Replay diagnostic exceeds byte budget");
    const bytes = await readFile(input.path);
    if (digest(bytes) !== input.sha256)
      throw Error("Replay diagnostic hash mismatch");
    const result = JSON.parse(bytes.toString());
    if (
      result.status !== "complete" ||
      result.failed ||
      result.cancelled ||
      result.ignored ||
      !Number.isFinite(result.elapsedMs) ||
      result.elapsedMs <= 0 ||
      !Number.isSafeInteger(result.complete) ||
      result.complete < 1 ||
      !Number.isSafeInteger(result.branchAttempts?.control) ||
      !Number.isSafeInteger(result.branchAttempts?.alternative) ||
      result.branchAttempts.control < 0 ||
      result.branchAttempts.alternative < 0
    )
      throw Error("Replay measurement requires complete diagnostic result");
    if (report.replayMeasurements.some((r) => r.sourceSha256 === input.sha256))
      throw Error("Duplicate replay diagnostic");
    report.inputBytes += bytes.length;
    report.replayMeasurements.push({
      sourceSha256: input.sha256,
      caseIds: input.caseIds,
      elapsedMs: result.elapsedMs,
      cases: result.complete,
      branchAttempts:
        result.branchAttempts.control + result.branchAttempts.alternative,
    });
    await publish(report, file, report);
    return report;
  });
}
export function reviewBenchmarkMetrics(report: BenchmarkReport) {
  const complete = report.observations.filter((o) => o.completed);
  const elapsed = complete.reduce((n, o) => n + o.endedAt - o.startedAt, 0);
  const tokens = complete.every((o) => o.actualTokens !== null)
    ? complete.reduce((n, o) => n + o.actualTokens!, 0)
    : null;
  return {
    observedCompletedLosses: complete.length,
    partialObservations: report.observations.length - complete.length,
    lossesPerAnalystHour:
      elapsed > 0 ? (complete.length * 3600000) / elapsed : null,
    actualTokensPerCompletedLoss:
      complete.length && tokens !== null ? tokens / complete.length : null,
    lostProgressMs: report.observations.reduce(
      (n, o) => n + o.lostProgressMs,
      0,
    ),
    strata: report.cases.map((c) => c.stratum),
    replay:
      "No replay timing unless separately supplied verified diagnostic results",
  };
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const [command, requestFile, output] = process.argv.slice(2);
    if (!requestFile)
      throw Error(
        "Usage: benchmark-review-workflow.ts prepare REQUEST.json | observe OBSERVATION.json OUTPUT",
      );
    const request = JSON.parse(await readFile(requestFile, "utf8"));
    const report =
      command === "prepare"
        ? await benchmarkReviewWorkflow(request)
        : command === "observe" && output
          ? await recordReviewObservation(output, request)
          : null;
    if (!report) throw Error("Unknown benchmark command");
    console.log(
      JSON.stringify({
        out: report.request.out,
        metrics: reviewBenchmarkMetrics(report),
      }),
    );
  } catch (e) {
    console.error(String(e));
    process.exitCode = 1;
  }
}

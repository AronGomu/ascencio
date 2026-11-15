/** Calibration reuse is content-bound, including retained stage evidence. */
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readdir, lstat, readFile } from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
export interface CalibrationEvidence {
  root: string;
  files: Record<string, string>;
}
export async function calibrationEvidence(
  root: string,
): Promise<CalibrationEvidence> {
  root = path.resolve(root);
  if ((await lstat(root)).isSymbolicLink())
    throw Error("Calibration integrity: symlink evidence root");
  const files: Record<string, string> = {};
  async function visit(dir: string) {
    for (const entry of (await readdir(dir, { withFileTypes: true })).sort(
      (a, b) => a.name.localeCompare(b.name),
    )) {
      const file = path.join(dir, entry.name);
      const stat = await lstat(file);
      if (stat.isSymbolicLink())
        throw Error("Calibration integrity: symlink evidence");
      if (stat.isDirectory()) await visit(file);
      else if (stat.isFile()) {
        const hash = createHash("sha256");
        for await (const chunk of createReadStream(file)) hash.update(chunk);
        files[path.relative(root, file)] = hash.digest("hex");
      } else throw Error("Calibration integrity: unsupported evidence file");
    }
  }
  await visit(root);
  return { root, files };
}
export async function verifyCalibrationEvidence(evidence: CalibrationEvidence) {
  if (!evidence || !path.isAbsolute(evidence.root) || !evidence.files)
    throw Error("Calibration integrity: missing evidence manifest");
  if (!isDeepStrictEqual(await calibrationEvidence(evidence.root), evidence))
    throw Error("Calibration evidence integrity mismatch");
}
/** Volatile observation metadata must not invalidate otherwise identical resume. */
export function stableCalibrationProvenance(
  provenance: Record<string, unknown>,
) {
  const stable = { ...provenance };
  delete stable.capturedAt;
  const machine = {
    ...(stable.machine as Record<string, unknown> | undefined),
  };
  delete machine.loadAverage;
  return { ...stable, machine };
}
export async function verifyCalibrationReport(report: {
  journal?: string;
  journalIdentity?: string;
  runs?: unknown[];
  excluded?: number[];
}) {
  if (!report.journal || !report.journalIdentity)
    throw Error(
      "Calibration evidence journal required; recalibrate legacy recommendations",
    );
  const journal = JSON.parse(await readFile(report.journal, "utf8"));
  if (journal.identity !== report.journalIdentity)
    throw Error("Calibration journal identity mismatch");
  const excluded = (journal.exclusions ?? [])
    .map((e: { workers: number }) => e.workers)
    .sort((a: number, b: number) => a - b);
  if (
    !isDeepStrictEqual(
      excluded,
      [...(report.excluded ?? [])].sort((a, b) => a - b),
    )
  )
    throw Error("Calibration exclusion mismatch");
  const completed = journal.attempts.filter(
    (a: {
      status: string;
      workers: number;
      result: unknown;
      evidence: CalibrationEvidence;
    }) =>
      a.status === "complete" && !(report.excluded ?? []).includes(a.workers),
  );
  if (
    !isDeepStrictEqual(
      completed.map(
        (a: {
          status: string;
          workers: number;
          result: unknown;
          evidence: CalibrationEvidence;
        }) => a.result,
      ),
      report.runs,
    )
  )
    throw Error("Calibration report measurements mismatch");
  for (const attempt of completed)
    await verifyCalibrationEvidence(attempt.evidence);
}

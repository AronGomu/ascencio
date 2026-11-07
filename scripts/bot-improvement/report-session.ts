import { readFile } from "node:fs/promises";
import path from "node:path";
import { evidence, save } from "./session-checkpoint.ts";
import type { SessionControl } from "./session-control-contract.ts";

export async function writeSessionReport<T>(
  session: string,
  plan: T,
  fixture: { path: string; identity: string },
  ledger: SessionControl,
) {
  const refs = [
    ...ledger.records.map((r) => r.evidence),
    ...ledger.iterations.flatMap((i) => (i.evidence ? [i.evidence] : [])),
    ...ledger.attempts.flatMap((a) => a.games.map((g) => g.evidence)),
  ];
  const integrity = [];
  for (const ref of refs) {
    try {
      await evidence(session, ref);
      integrity.push({ ...ref, intact: true });
    } catch {
      integrity.push({ ...ref, intact: false });
    }
  }
  const recorded = await Promise.all(
    ledger.records.map(async (r) => {
      try {
        await evidence(session, r.evidence);
        return {
          ...r,
          content: await readFile(path.join(session, r.evidence.path), "utf8"),
        };
      } catch {
        return { ...r, content: null };
      }
    }),
  );
  const report = {
    ...plan,
    recorded,
    fixture: fixture,
    limits: ledger.limits,
    attempts: ledger.attempts,
    evidence: integrity,
    scope:
      "Recorded execution accounting; completion and comparisons are producer attestations, not independently verified game semantics. Missing records mean unavailable evidence.",
  };
  const reportPath = path.join(session, "report.json");
  await save(reportPath, report);
  return { ...report, report: reportPath };
}

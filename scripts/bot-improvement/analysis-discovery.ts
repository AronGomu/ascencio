import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { json } from "./session-checkpoint.ts";
import { verifyFrozen } from "./frozen-setup.ts";
import {
  analysisPath,
  readEvidence,
  finalizedXml,
} from "./analysis-evidence.ts";
import type {
  AnalysisBinding,
  AnalysisPacket,
  AnalysisQueue,
} from "./analysis-contract.ts";
import type { IterationManifest } from "./iteration-contract.ts";

export async function discoverAnalyses(
  session: string,
  binding: AnalysisBinding,
) {
  const config = await json(path.join(session, "config.json"));
  const frozen = await verifyFrozen(config.fixture.path);
  const manifest = (await json(
    path.join(
      session,
      `iterations/iteration-${String(binding.iteration).padStart(4, "0")}/manifest.json`,
    ),
  )) as IterationManifest;
  const workers = config.limits.analysisWorkers;
  if (
    config.schemaVersion !== 1 ||
    config.fixture.identity !== frozen.identity ||
    manifest.schemaVersion !== 1 ||
    manifest.iteration !== binding.iteration ||
    manifest.fixture.identity !== frozen.identity ||
    !Number.isSafeInteger(workers) ||
    workers < 1 ||
    workers > 64
  )
    throw new Error("Invalid analysis session/iteration binding");
  await analysisPath(session, binding.root);
  await readEvidence(session, binding.proposal);
  const execution = JSON.parse(
    (await readEvidence(session, binding.execution)).toString(),
  );
  if (
    execution.schemaVersion !== 1 ||
    execution.fixtureIdentity !== frozen.identity ||
    !/^[a-f0-9]{64}$/.test(execution.identity) ||
    !/^[a-f0-9]{64}$/.test(execution.candidateIdentity) ||
    execution.selfIdentity !== manifest.self.identity ||
    !Array.isArray(execution.matches)
  )
    throw new Error("Runner execution binding mismatch");
  if (
    binding.role === "control" &&
    execution.candidateIdentity !== manifest.control.identity
  )
    throw new Error("Control identity mismatch");
  const items = new Map<string, { match: unknown; identities: string[] }>();
  for (const item of execution.matches) {
    if (items.has(item.match?.id)) throw new Error("Duplicate runner match");
    items.set(item.match?.id, item);
  }
  if (items.size !== frozen.matches.length)
    throw new Error("Runner schedule coverage mismatch");
  const packets: AnalysisPacket[] = [];
  const unavailable: { match: string; reason: string }[] = [];
  for (const match of frozen.matches) {
    const item = items.get(match.id);
    const opponent =
      match.opponentSlot === "self"
        ? manifest.self
        : manifest.opponents.find((o) => o.slot === match.opponentSlot);
    if (
      !item ||
      !isDeepStrictEqual(item.match, match) ||
      !opponent ||
      !isDeepStrictEqual(item.identities, [
        execution.candidateIdentity,
        opponent.identity,
      ])
    )
      throw new Error("Runner schedule/opponent mismatch");
    const relative = `${binding.root}/matches/${match.id}`;
    try {
      const result = await finalizedXml(session, relative, {
        match: match.id,
        executionIdentity: execution.identity,
        fixtureIdentity: frozen.identity,
        candidateIdentity: execution.candidateIdentity,
        opponentIdentity: opponent.identity,
        item,
      });
      packets.push({
        schemaVersion: 1,
        adapter: "frozen-xml-v1",
        id: `${binding.iteration}/${binding.role}/${match.id}`,
        iteration: binding.iteration,
        role: binding.role,
        match: match.id,
        fixtureIdentity: frozen.identity,
        runnerIdentity: manifest.runnerIdentity,
        executionIdentity: execution.identity,
        candidateIdentity: execution.candidateIdentity,
        opponent: { slot: match.opponentSlot, identity: opponent.identity },
        proposal: binding.proposal,
        ...result,
      });
    } catch (error) {
      unavailable.push({
        match: match.id,
        reason:
          (error as NodeJS.ErrnoException).code === "ENOENT"
            ? "not-finalized"
            : String(error),
      });
    }
  }
  // Pin preparation and proposal across discovery; never publish from a changing request.
  await readEvidence(session, binding.execution);
  await readEvidence(session, binding.proposal);
  return {
    packets,
    unavailable,
    queue: {
      schemaVersion: 1 as const,
      binding,
      fixtureIdentity: frozen.identity,
      runnerIdentity: manifest.runnerIdentity,
      executionIdentity: execution.identity,
      workers,
      queueLimit: workers * 2,
      expected: frozen.matches.map((m) => m.id),
      jobs: [],
    } satisfies AnalysisQueue,
  };
}

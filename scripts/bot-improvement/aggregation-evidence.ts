import path from "node:path";
import { isDeepStrictEqual as equal } from "node:util";
import {
  analysisPath,
  finalizedXml,
  readEvidence,
} from "./analysis-evidence.ts";
import { validateAnalysisReport } from "./analysis-report.ts";
import { identity } from "./session-fixtures.ts";
import type { FrozenSetup } from "./session-contract.ts";
import type {
  IterationManifest,
  BaselineReceipt,
} from "./iteration-contract.ts";
import type { AggregationInput } from "./aggregation-contract.ts";
import type { EvidenceReference } from "./session-control-contract.ts";
import type { AnalysisQueue, AnalysisPacket } from "./analysis-contract.ts";
import type { MatchObservation } from "./aggregation-statistics.ts";

export async function collectEvaluation(
  session: string,
  input: AggregationInput,
  role: "control" | "candidate",
  frozen: FrozenSetup,
  manifest: IterationManifest,
  candidateIdentity: string,
) {
  await analysisPath(session, input.root);
  const job = JSON.parse(
    (await readEvidence(session, input.execution)).toString(),
  );
  const expectedIdentity =
    role === "control" ? manifest.control.identity : candidateIdentity;
  if (
    job.schemaVersion !== 1 ||
    job.fixtureIdentity !== frozen.identity ||
    job.candidateIdentity !== expectedIdentity ||
    job.selfIdentity !== manifest.self.identity ||
    job.profile !== frozen.profile ||
    !Array.isArray(job.matches) ||
    job.sessionControl?.role !== role ||
    job.sessionControl?.runnerIdentity !== manifest.runnerIdentity ||
    job.sessionControl?.executableIdentity !== expectedIdentity ||
    (role === "candidate" &&
      job.sessionControl?.iteration !== manifest.iteration)
  )
    throw new Error(`${role}: runner execution binding mismatch`);
  const calculatedIdentity = identity({
    fixtureIdentity: job.fixtureIdentity,
    candidateIdentity: job.candidateIdentity,
    selfIdentity: job.selfIdentity,
    profile: job.profile,
    limits: job.limits,
    budget: job.budget,
    matches: job.matches.map(
      ({
        match,
        decks,
        identities,
      }: {
        match: unknown;
        decks: unknown;
        identities: unknown;
      }) => ({ match, decks, identities }),
    ),
  });
  if (
    job.identity !== calculatedIdentity ||
    job.matches.length !== frozen.matches.length
  )
    throw new Error(`${role}: runner execution identity/coverage mismatch`);
  const items = new Map<string, (typeof job.matches)[number]>();
  for (const item of job.matches) {
    if (items.has(item.match?.id)) throw new Error("Duplicate runner match");
    items.set(item.match?.id, item);
  }
  let receipt: BaselineReceipt | undefined;
  if (input.receipt) {
    receipt = JSON.parse(
      (await readEvidence(session, input.receipt)).toString(),
    );
    const ids = frozen.matches.map((m) => m.id).sort();
    if (
      role !== "control" ||
      receipt?.schemaVersion !== 1 ||
      receipt.status !== "complete" ||
      receipt.comparisonIdentity !== manifest.comparisonIdentity ||
      !equal([...(receipt.completedMatches ?? [])].sort(), ids) ||
      !equal(Object.keys(receipt.matches ?? {}).sort(), ids)
    )
      throw new Error("Invalid baseline receipt binding/coverage");
  }
  const rows: MatchObservation[] = [];
  const finalized = new Map<string, Awaited<ReturnType<typeof finalizedXml>>>();
  for (const match of [...frozen.matches].sort((a, b) =>
    a.id.localeCompare(b.id),
  )) {
    const item = items.get(match.id);
    const slot = manifest.opponents.find((o) => o.slot === match.opponentSlot)!;
    const opponent =
      match.opponentSlot === "self"
        ? manifest.accepted.bot
        : frozen.opponents[
            Number(match.opponentSlot.slice("opponent-".length)) - 1
          ]!;
    if (
      !item ||
      !equal(item.match, match) ||
      !equal(item.identities, [expectedIdentity, slot.identity]) ||
      !equal(item.decks, [manifest.accepted.bot.deck, opponent.deck])
    )
      throw new Error(`${role}: runner schedule/deck/opponent mismatch`);
    const relative = `${input.root}/matches/${match.id}`;
    if (receipt) {
      const ref = receipt.matches[match.id]!;
      const receiptRelative = path.posix.join(
        path.posix.dirname(input.receipt!.path),
        ref.path,
      );
      if (
        ref.path !== `matches/${match.id}/done.json` ||
        receiptRelative !== `${relative}/done.json`
      )
        throw new Error("Receipt does not address runner completion marker");
      await readEvidence(session, {
        path: receiptRelative,
        sha256: ref.sha256,
      });
    }
    try {
      const result = await finalizedXml(session, relative, {
        match: match.id,
        executionIdentity: job.identity,
        fixtureIdentity: frozen.identity,
        candidateIdentity: expectedIdentity,
        opponentIdentity: slot.identity,
        item,
        outcomes: true,
      });
      rows.push({
        id: match.id,
        slot: match.opponentSlot,
        games: result.outcomes,
        sideboarding: result.sideboarding,
      });
      finalized.set(
        match.id,
        input.analyses ? result : { ...result, events: [] },
      );
    } catch (error) {
      rows.push({
        id: match.id,
        slot: match.opponentSlot,
        games: null,
        unavailable:
          (error as NodeJS.ErrnoException).code === "ENOENT"
            ? "not-finalized"
            : String(error),
      });
    }
  }
  const reportFiles: EvidenceReference[] = [];
  const reports = await reportCompleteness(
    session,
    input,
    role,
    manifest,
    job.identity,
    expectedIdentity,
    frozen,
    finalized,
    reportFiles,
  );
  await readEvidence(session, input.execution);
  if (input.receipt) await readEvidence(session, input.receipt);
  return {
    rows,
    reports,
    executionIdentity: job.identity,
    executionSettings: {
      profile: job.profile,
      limits: job.limits,
      budget: job.budget,
    },
    files: [...[...finalized.values()].flatMap((m) => m.files), ...reportFiles],
  };
}

async function reportCompleteness(
  session: string,
  input: AggregationInput,
  role: "control" | "candidate",
  manifest: IterationManifest,
  executionIdentity: string,
  candidateIdentity: string,
  frozen: FrozenSetup,
  finalized: Map<string, Awaited<ReturnType<typeof finalizedXml>>>,
  refs: EvidenceReference[],
) {
  const expected = frozen.matches.map((m) => m.id).sort();
  if (!input.analyses)
    return {
      status: "not-requested",
      expected: expected.length,
      complete: 0,
      pending: expected.length,
      invalid: [] as { match: string; reason: string }[],
    };
  const queue = JSON.parse(
    (await readEvidence(session, input.analyses)).toString(),
  ) as AnalysisQueue;
  if (
    queue.schemaVersion !== 1 ||
    queue.binding.role !== role ||
    queue.binding.root !== input.root ||
    !equal(queue.binding.execution, input.execution) ||
    queue.binding.iteration !== manifest.iteration ||
    queue.fixtureIdentity !== frozen.identity ||
    queue.runnerIdentity !== manifest.runnerIdentity ||
    queue.executionIdentity !== executionIdentity ||
    !equal([...queue.expected].sort(), expected) ||
    !Array.isArray(queue.jobs)
  )
    throw new Error("Analysis queue binding/coverage mismatch");
  await readEvidence(session, queue.binding.proposal);
  refs.push(queue.binding.proposal);
  const seen = new Set<string>();
  let complete = 0;
  const invalid: { match: string; reason: string }[] = [];
  for (const job of [...queue.jobs].sort((a, b) =>
    a.match.localeCompare(b.match),
  )) {
    if (
      seen.has(job.match) ||
      !expected.includes(job.match) ||
      job.id !== `${manifest.iteration}/${role}/${job.match}` ||
      !["waiting", "pending", "claimed", "complete"].includes(job.status)
    )
      throw new Error("Invalid or duplicate analysis job");
    seen.add(job.match);
    if (job.status !== "complete") continue;
    try {
      const packet = JSON.parse(
        (await readEvidence(session, job.packet)).toString(),
      ) as AnalysisPacket;
      const result = finalized.get(job.match);
      const slot = frozen.matches.find((m) => m.id === job.match)!.opponentSlot;
      if (
        !result ||
        packet.schemaVersion !== 1 ||
        packet.adapter !== "frozen-xml-v1" ||
        packet.id !== job.id ||
        packet.iteration !== manifest.iteration ||
        packet.role !== role ||
        packet.match !== job.match ||
        packet.fixtureIdentity !== frozen.identity ||
        packet.runnerIdentity !== manifest.runnerIdentity ||
        packet.executionIdentity !== executionIdentity ||
        packet.candidateIdentity !== candidateIdentity ||
        !equal(packet.proposal, queue.binding.proposal) ||
        !equal(packet.opponent, {
          slot,
          identity: manifest.opponents.find((o) => o.slot === slot)!.identity,
        }) ||
        !equal(packet.files, result.files) ||
        !equal(packet.events, result.events) ||
        !equal(packet.games, result.games)
      )
        throw new Error("Analysis packet does not match finalized evidence");
      if (!job.report) throw new Error("Missing completed report");
      validateAnalysisReport(
        JSON.parse((await readEvidence(session, job.report)).toString()),
        packet,
        job.packet.sha256,
      );
      refs.push(job.packet, job.report);
      complete++;
    } catch (error) {
      invalid.push({ match: job.match, reason: String(error) });
    }
  }
  await readEvidence(session, input.analyses);
  return {
    status: complete === expected.length ? "complete" : "incomplete",
    expected: expected.length,
    complete,
    pending: expected.length - complete - invalid.length,
    invalid,
  };
}

/** Ensure no evidence changed while other matches/reports were being read. */
export async function recheckEvaluation(
  session: string,
  evaluation: Awaited<ReturnType<typeof collectEvaluation>>,
) {
  for (const ref of evaluation.files) await readEvidence(session, ref);
}

import type {
  AnalysisPacket,
  EventReference,
  MatchAnalysisReport,
} from "./analysis-contract.ts";

export const eventKey = (ref: EventReference) =>
  `${ref.game}/${ref.perspective}/${ref.sequence}`;
/** Structural completeness and reference resolution only; no factual/causal judgment. */
export function validateAnalysisReport(
  value: unknown,
  packet: AnalysisPacket,
  packetSha256: string,
): asserts value is MatchAnalysisReport {
  const report = value as MatchAnalysisReport;
  if (
    !report ||
    report.schemaVersion !== 1 ||
    report.job !== packet.id ||
    report.packetSha256 !== packetSha256
  )
    throw new Error("Report job/packet association mismatch");
  const available = new Set(packet.events.map(eventKey));
  for (const name of [
    "activation",
    "changedDecisions",
    "impact",
    "consequentialPlays",
  ] as const) {
    const section = report.sections?.[name];
    if (
      !section ||
      typeof section.text !== "string" ||
      !section.text.trim() ||
      !Array.isArray(section.evidence)
    )
      throw new Error(`Missing report section: ${name}`);
    if (
      !section.evidence.length &&
      (typeof section.unavailable !== "string" || !section.unavailable.trim())
    )
      throw new Error(
        `Report section needs evidence or explicit unavailability: ${name}`,
      );
    for (const ref of section.evidence)
      if (
        !ref ||
        !Number.isSafeInteger(ref.game) ||
        !Number.isSafeInteger(ref.sequence) ||
        !available.has(eventKey(ref))
      )
        throw new Error(`Unresolvable event in ${name}`);
  }
  if (
    !["positive", "negative", "uncertain"].includes(
      report.sections.impact.assessment,
    )
  )
    throw new Error("Invalid impact assessment");
}

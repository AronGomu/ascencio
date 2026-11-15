import type {
  AnalysisPacket,
  EventReference,
  MatchAnalysisReport,
  LossMatchReport,
  LossReason,
} from "./analysis-contract.ts";

export const eventKey = (ref: EventReference) =>
  `${ref.game}/${ref.perspective}/${ref.sequence}`;
/** Structural completeness and reference resolution only; no factual/causal judgment. */
export function validateAnalysisReport(
  value: unknown,
  packet: AnalysisPacket,
  packetSha256: string,
): asserts value is MatchAnalysisReport | LossMatchReport {
  if (packet.adapter === "linked-text-v1") {
    validateLossReport(value as LossMatchReport, packet, packetSha256);
    return;
  }
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

/** Strict Markdown input; machine records are generated here, never authored by analysts. */
export function parseLossMarkdown(
  text: string,
  packet: AnalysisPacket,
  packetSha256: string,
): LossMatchReport {
  if (packet.adapter !== "linked-text-v1" || !packet.lossGames)
    throw new Error("Markdown loss findings require native packets");
  const job = text.match(/^Job: (.+)$/m)?.[1];
  const sha = text.match(/^Packet: ([a-f0-9]{64})$/m)?.[1];
  const findings: LossMatchReport["findings"] = [];
  for (const line of text.split(/\r?\n/).filter((l) => l.startsWith("- G"))) {
    const cells = line
      .slice(2)
      .split("|")
      .map((c) => c.trim());
    if (cells.length !== 5 || !/^G[1-4]$/.test(cells[0]!))
      throw new Error("Invalid Markdown loss row");
    findings.push({
      game: Number(cells[0]!.slice(1)),
      decision: cells[1] === "-" ? null : cells[1]!,
      classification: cells[2] as "avoidable" | "unavoidable" | "unclear",
      reason: cells[3]!,
      solution: cells[4]!,
    });
  }
  const reasons: LossReason[] = [];
  for (const line of text.split(/\r?\n/).filter((l) => l.startsWith("- R G"))) {
    const cells = line
      .slice(4)
      .split("|")
      .map((c) => c.trim());
    if (cells.length !== 8 || !/^G[1-4]$/.test(cells[0]!))
      throw Error("Invalid Markdown reason row");
    reasons.push({
      game: Number(cells[0]!.slice(1)),
      id: cells[1]!,
      decision: cells[2]!,
      offered: JSON.parse(cells[3]!),
      chosen: JSON.parse(cells[4]!),
      reason: cells[5]!,
      solution: cells[6]!,
    });
    if (cells[7] !== "supported")
      throw Error("Reason must be a supported hypothesis");
  }
  const completeReasons = /^Reasons: complete$/m.test(text);
  if (reasons.length && !completeReasons)
    throw Error("Missing first-pass reason coverage declaration");
  const report = {
    ...(completeReasons ? { reasons } : {}),
    schemaVersion: 1 as const,
    format: "loss-markdown-v1" as const,
    job: job ?? "",
    packetSha256: sha ?? "",
    findings,
  };
  validateLossReport(report, packet, packetSha256);
  return report;
}
export function validateLossReport(
  report: LossMatchReport,
  packet: AnalysisPacket,
  packetSha256: string,
) {
  if (
    packet.adapter !== "linked-text-v1" ||
    !packet.lossGames ||
    report.schemaVersion !== 1 ||
    report.format !== "loss-markdown-v1" ||
    report.job !== packet.id ||
    report.packetSha256 !== packetSha256 ||
    !Array.isArray(report.findings)
  )
    throw new Error("Loss report job/packet association mismatch");
  const seen = new Set<number>();
  for (const finding of report.findings) {
    const game = packet.lossGames.find((g) => g.game === finding.game);
    if (
      !game ||
      seen.has(finding.game) ||
      !["avoidable", "unavoidable", "unclear"].includes(
        finding.classification,
      ) ||
      typeof finding.reason !== "string" ||
      !finding.reason.trim() ||
      typeof finding.solution !== "string" ||
      !finding.solution.trim() ||
      (finding.decision !== null &&
        !game.decisions.includes(finding.decision)) ||
      (finding.classification === "avoidable" && finding.decision === null)
    )
      throw new Error("Invalid or unresolvable loss finding");
    seen.add(finding.game);
  }
  const reasonsSeen = new Set<string>();
  if (report.reasons !== undefined) {
    if (!Array.isArray(report.reasons)) throw Error("Invalid reason bindings");
    for (const reason of report.reasons) {
      const game = packet.lossGames.find((g) => g.game === reason.game);
      const key = `${reason.game}/${reason.id}`;
      if (
        !game ||
        !/^[a-z][a-z0-9-]*$/.test(reason.id) ||
        !game.decisions.includes(reason.decision) ||
        reasonsSeen.has(key) ||
        !Array.isArray(reason.offered) ||
        !Array.isArray(reason.chosen) ||
        ![...reason.offered, ...reason.chosen].every(
          (c) => typeof c === "string",
        ) ||
        reason.chosen.some((c) => !reason.offered.includes(c)) ||
        !reason.reason?.trim() ||
        !reason.solution?.trim()
      )
        throw Error("Invalid or duplicate reason binding");
      reasonsSeen.add(key);
    }
  }
  if (
    report.reasons !== undefined &&
    report.findings.some(
      (f) =>
        f.classification === "avoidable" &&
        !report.reasons!.some(
          (r) => r.game === f.game && r.decision === f.decision,
        ),
    )
  )
    throw Error("First-pass reasons omit a primary avoidable finding");
  if (seen.size !== packet.lossGames.length)
    throw new Error("Incomplete target loss coverage");
}

/** Structured agent findings have one canonical human-readable representation. */
export function renderLossMarkdown(
  report: LossMatchReport,
  packet: AnalysisPacket,
  sha: string,
) {
  validateLossReport(report, packet, sha);
  const cell = (s: string) => {
    if (/[|\r\n]/.test(s))
      throw Error("Markdown finding fields must be single-line without pipes");
    return s;
  };
  const json = (ids: string[]) =>
    JSON.stringify(ids).replaceAll("|", "\\u007c");
  return (
    `# Match loss analysis\n\nJob: ${report.job}\nPacket: ${sha}\n` +
    (report.reasons === undefined ? "" : "Reasons: complete\n") +
    "\n" +
    report.findings
      .map(
        (f) =>
          `- G${f.game} | ${cell(f.decision ?? "-")} | ${f.classification} | ${cell(f.reason)} | ${cell(f.solution)}\n`,
      )
      .join("") +
    (report.reasons ?? [])
      .map(
        (r) =>
          `- R G${r.game} | ${r.id} | ${cell(r.decision)} | ${json(r.offered)} | ${json(r.chosen)} | ${cell(r.reason)} | ${cell(r.solution)} | supported\n`,
      )
      .join("")
  );
}

/** Metadata admission for native evidence verified by the producer before its receipt. */
import { isDeepStrictEqual } from "node:util";
import { parseMatchLog, decodeLog } from "./game-log.ts";
import { lossDecisions } from "./loss-review.ts";
import { readEvidence } from "./analysis-evidence.ts";
import type { AnalysisPacket } from "./analysis-contract.ts";
import type { EvidenceReference } from "./session-control-contract.ts";
import type { TextExpectation } from "./analysis-text-evidence.ts";
export async function nativeLossSummary(
  session: string,
  relative: string,
  refs: EvidenceReference[],
  expected: TextExpectation,
) {
  const matchRef = refs.find((r) => r.path === `${relative}/native/match.log`);
  if (!matchRef) return null;
  const match = parseMatchLog(
    (await readEvidence(session, matchRef)).toString(),
  );
  if (match.manifest.loss_projection_version === undefined) return null;
  if (match.manifest.loss_projection_version !== 1)
    throw Error("Unsupported native loss projection version");
  const fixture = match.fixture as { identities?: string[] };
  if (
    match.match.match_id !== expected.match ||
    match.match.run_id !== expected.executionIdentity ||
    (expected.item !== undefined &&
      !isDeepStrictEqual(match.fixture, expected.item)) ||
    !isDeepStrictEqual(fixture.identities, [
      expected.candidateIdentity,
      expected.opponentIdentity,
    ]) ||
    (match.manifest.content as Record<string, unknown>)?.sha256 !==
      expected.fixtureIdentity ||
    match.refs.length !== 4
  )
    throw Error("Native loss summary binding mismatch");
  const games: AnalysisPacket["games"] = [],
    lossGames: NonNullable<AnalysisPacket["lossGames"]> = [];
  const outcomes: (
    "win" | "loss" | "draw" | "failed" | "skipped" | "timeout"
  )[] = [];
  for (const [i, ref] of match.refs.entries()) {
    const g = ref.checkpoint_game as Record<string, unknown>;
    if (
      !g ||
      g.game_id !== `${expected.match}-game-${i + 1}` ||
      g.number !== i + 1 ||
      g.stage !== (i < 2 ? "pre_side" : "post_side") ||
      g.starter !== (i % 2 === 0 ? "a" : "b") ||
      !["completed", "failed", "skipped"].includes(String(g.status))
    )
      throw Error("Invalid native game summary");
    const status = g.status as "completed" | "failed" | "skipped";
    if (
      status === "completed" &&
      (!["a", "b", null].includes(g.winner as string | null) ||
        g.draw !== (g.winner === null))
    )
      throw Error("Invalid native outcome summary");
    if (
      status === "skipped"
        ? g.evidence_sha256 !== null
        : typeof g.evidence_sha256 !== "string" ||
          !/^[a-f0-9]{64}$/.test(g.evidence_sha256)
    )
      throw Error("Invalid native evidence summary hash");
    const outcome =
      status !== "completed"
        ? g.failure_category === "timeout"
          ? "timeout"
          : status
        : g.winner === "a"
          ? "win"
          : g.winner === "b"
            ? "loss"
            : "draw";
    outcomes.push(outcome);
    games.push({
      number: i + 1,
      id: String(g.game_id),
      status,
      evidenceHash: g.evidence_sha256 as string | null,
    });
    const projection = ref.target_loss as
      | { transformation: number; sha256: string; decisions: string[] }
      | undefined;
    const view = refs.find(
      (r) => r.path === `${relative}/native/games/game-${i + 1}/loss.log`,
    );
    if (outcome === "loss") {
      if (
        !view ||
        projection?.transformation !== 1 ||
        view.sha256 !== projection.sha256
      )
        throw Error("Missing bound native loss view");
      const text = (await readEvidence(session, view)).toString();
      const header = decodeLog(text, "ASCENCIO_LOSS_LOG\t2")[0];
      if (
        header?.tag !== "GAME" ||
        (header.value as Record<string, unknown>).game_id !== g.game_id ||
        !isDeepStrictEqual(
          Object.keys(lossDecisions(text)),
          projection.decisions,
        )
      )
        throw Error("Native loss decision summary mismatch");
      lossGames.push({ game: i + 1, decisions: projection.decisions });
    } else if (projection || view) throw Error("Non-loss projection published");
  }
  const sideboarding = (match.match.sideboarding as Record<string, unknown>)
    ?.status;
  if (
    !["completed", "failed", "skipped"].includes(String(sideboarding)) ||
    match.match.status !==
      (games.every((g) => g.status === "completed")
        ? "completed"
        : "incomplete")
  )
    throw Error("Invalid native match status summary");
  return {
    files: refs,
    games,
    outcomes,
    lossGames,
    events: [],
    sideboarding: String(
      (match.match.sideboarding as Record<string, unknown>).status,
    ),
  };
}

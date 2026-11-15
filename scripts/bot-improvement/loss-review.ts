import { evidenceParseCache } from "./verified-evidence-cache.ts";
/** Deterministic target-only review pages. Full events remain in the pinned loss log. */
import { open } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { analysisPath, readEvidence } from "./analysis-evidence.ts";
import { digest } from "./session-fixtures.ts";
import type { EvidenceReference } from "./session-control-contract.ts";
import { isDeepStrictEqual } from "node:util";
import { decodeLog } from "./game-log.ts";

type ObjectValue = Record<string, unknown>;
export interface DecisionChoices {
  offered: string[];
  chosen: string[];
}
export function lossDecisions(text: string): Record<string, DecisionChoices> {
  return Object.assign(
    Object.create(null),
    evidenceParseCache.decode(text, "loss-decisions/v1", () =>
      parseLossDecisions(text),
    ),
  );
}
function parseLossDecisions(text: string): Record<string, DecisionChoices> {
  const result: Record<string, DecisionChoices> = Object.create(null);
  for (const row of decodeLog(text, "ASCENCIO_LOSS_LOG\t2")) {
    const e = row.value as ObjectValue;
    if (row.tag !== "EVENT" || e.kind !== "decision") continue;
    const id = e.decision_id;
    if (typeof id !== "string" || Object.hasOwn(result, id))
      throw Error("Invalid loss decision ID");
    const prompt = e.prompt as
      { choices?: { choice?: { id: string }[] } } | undefined;
    const selected = e.selected_choice_ids as
      { choice_id?: string[] } | undefined;
    const offered = (prompt?.choices?.choice ?? []).map((c) => c.id);
    const chosen = selected?.choice_id ?? [];
    if (
      ![...offered, ...chosen].every((c) => typeof c === "string") ||
      chosen.some((c) => !offered.includes(c))
    )
      throw Error("Invalid recorded loss choices");
    result[id] = { offered, chosen };
  }
  return result;
}
function delta(previous: unknown, next: unknown): unknown {
  if (isDeepStrictEqual(previous, next)) return undefined;
  if (
    previous &&
    next &&
    typeof previous === "object" &&
    typeof next === "object" &&
    !Array.isArray(previous) &&
    !Array.isArray(next)
  ) {
    const before = previous as ObjectValue,
      after = next as ObjectValue;
    const changes: ObjectValue = Object.create(null);
    for (const key of new Set([
      ...Object.keys(before),
      ...Object.keys(after),
    ])) {
      if (!Object.hasOwn(after, key)) changes[key] = { removed: true };
      else {
        const value = delta(before[key], after[key]);
        if (value !== undefined) changes[key] = value;
      }
    }
    return changes;
  }
  return next;
}
/** Pages split before decisions/turn changes; event batches cap long non-decision spans. */
export function readableLossPages(text: string) {
  const rows = decodeLog(text, "ASCENCIO_LOSS_LOG\t2");
  const pages: { text: string; events: number; decisions: string[] }[] = [];
  let lines: string[] = [],
    events = 0,
    decisions: string[] = [],
    turn: unknown;
  const previous = new Map<string, unknown>();
  const flush = () => {
    if (!lines.length) return;
    pages.push({ text: lines.join("\n\n") + "\n", events, decisions });
    lines = [];
    events = 0;
    decisions = [];
  };
  for (const row of rows) {
    const e = row.value as ObjectValue;
    if (row.tag !== "EVENT") {
      lines.push(
        `## ${row.tag}\n\n\`\`\`json\n${JSON.stringify(e, null, 2)}\n\`\`\``,
      );
      continue;
    }
    const nextTurn = e.turn ?? e.turn_number;
    if (
      events &&
      ((e.kind === "decision" && events >= 20) ||
        (nextTurn !== undefined && nextTurn !== turn && events >= 10) ||
        events >= 80)
    )
      flush();
    if (nextTurn !== undefined) turn = nextTurn;
    const key = String(e.kind);
    // Decisions retain all available choices and their labels/card identities.
    const body = e.kind === "decision" ? e : delta(previous.get(key), e);
    previous.set(key, e);
    lines.push(
      `### Event ${e.sequence}: ${key}${turn === undefined ? "" : ` · turn ${turn}`}${e.decision_id ? ` · ${e.decision_id}` : ""}\n\n\`\`\`json\n${JSON.stringify(body ?? {}, null, 2)}\n\`\`\``,
    );
    events++;
    if (typeof e.decision_id === "string") decisions.push(e.decision_id);
  }
  flush();
  return pages;
}

export interface ReviewPage extends EvidenceReference {
  offset: number;
  bytes: number;
  pageSha256: string;
  events: number;
  decisions: string[];
  /** v3 restart blocks preserve independently decodable context. */
  block?: number;
  part?: number;
  parts?: number;
  tokenUpperBound?: number;
}
export interface ReviewRestartBlock {
  block: number;
  firstRow: number;
  rows: number;
  firstPage: number;
  pages: number;
  sha256: string;
}
/** One-based restart address; navigation is not a reading acknowledgement. */
export function reviewRestartPage(blocks: ReviewRestartBlock[], page: number) {
  if (!Number.isSafeInteger(page) || page < 1)
    throw Error("Invalid review page");
  const block = blocks.find(
    (b) => page > b.firstPage && page <= b.firstPage + b.pages,
  );
  if (!block) throw Error("Unknown review restart block");
  return {
    page: block.firstPage + 1,
    block: block.block,
    firstRow: block.firstRow,
    rows: block.rows,
    pages: block.pages,
    sha256: block.sha256,
  };
}
/** Read only one indexed page, checking its exact bytes against the pinned packet. */
export async function readReviewPage(session: string, page: ReviewPage) {
  if (
    !Number.isSafeInteger(page.offset) ||
    page.offset < 0 ||
    !Number.isSafeInteger(page.bytes) ||
    page.bytes < 1 ||
    page.bytes > 256 * 1024 * 1024
  )
    throw Error("Invalid review page range");
  if (
    page.tokenUpperBound !== undefined &&
    (!Number.isSafeInteger(page.tokenUpperBound) ||
      page.tokenUpperBound < page.bytes ||
      page.tokenUpperBound > 64000)
  )
    throw Error("Invalid review token bound");
  const file = await open(await analysisPath(session, page.path), "r");
  try {
    const bytes = Buffer.alloc(page.bytes);
    let read = 0;
    while (read < bytes.length) {
      const chunk = await file.read(
        bytes,
        read,
        bytes.length - read,
        page.offset + read,
      );
      if (!chunk.bytesRead) throw Error("Truncated review page");
      read += chunk.bytesRead;
    }
    if (digest(bytes) !== page.pageSha256)
      throw Error("Review page evidence mismatch");
    return bytes.toString();
  } finally {
    await file.close();
  }
}
if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  try {
    const [session, packetPath, packetSha, match, game, page, mode] =
      process.argv.slice(2);
    if (!session || !packetPath || !packetSha || !match || !game || !page)
      throw Error(
        "Usage: node scripts/bot-improvement/loss-review.ts SESSION PACKET_PATH PACKET_SHA MATCH GAME PAGE (1-based)",
      );
    const packet = JSON.parse(
      (
        await readEvidence(session, { path: packetPath, sha256: packetSha })
      ).toString(),
    );
    const review = packet.jobs
      .find((j: { match: string }) => j.match === match)
      ?.losses.find((l: { game: number }) => l.game === Number(game))?.review;
    if (
      !Number.isSafeInteger(Number(page)) ||
      Number(page) < 1 ||
      !review?.pages[Number(page) - 1]
    )
      throw Error("Unknown allowlisted review page");
    if (mode !== undefined && mode !== "--restart")
      throw Error("Unknown review mode");
    if (mode === "--restart") {
      if (!review.blocks)
        throw Error("Legacy review requires chronology from page 1");
      process.stdout.write(
        JSON.stringify(reviewRestartPage(review.blocks, Number(page))) + "\n",
      );
    } else
      process.stdout.write(
        await readReviewPage(session, review.pages[Number(page) - 1]),
      );
  } catch (error) {
    console.error(String(error));
    process.exitCode = 1;
  }
}

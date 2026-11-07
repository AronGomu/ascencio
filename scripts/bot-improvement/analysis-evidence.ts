import { lstat, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { SaxesParser } from "saxes";
import { digest } from "./session-fixtures.ts";
import type { EvidenceReference } from "./session-control-contract.ts";
import type { EventReference } from "./analysis-contract.ts";

/** Evidence is session-relative, confined, and never followed through symlinks. */
export async function analysisPath(session: string, relative: string) {
  if (
    typeof relative !== "string" ||
    !relative ||
    path.isAbsolute(relative) ||
    relative.split(/[\\/]/).some((p) => !p || p === "." || p === "..")
  )
    throw new Error("Unsafe analysis evidence path");
  let current = path.resolve(session);
  for (const part of relative.split(/[\\/]/)) {
    current = path.join(current, part);
    if ((await lstat(current)).isSymbolicLink())
      throw new Error("Symlink evidence is unsupported");
  }
  return current;
}
export async function readEvidence(session: string, ref: EvidenceReference) {
  const bytes = await readFile(await analysisPath(session, ref.path));
  if (!/^[a-f0-9]{64}$/.test(ref.sha256) || digest(bytes) !== ref.sha256)
    throw new Error(`Evidence mismatch: ${ref.path}`);
  return bytes;
}

/** Read only exporter fields needed for completeness and timeline addressing. */
function xmlSummary(bytes: Buffer, root: string) {
  const parser = new SaxesParser();
  const stack: string[] = [];
  const fields: Record<string, string> = {};
  const games: { fields: Record<string, string>; sequences: number[] }[] = [];
  let game: (typeof games)[number] | undefined;
  let text = "";
  parser.on("doctype", () => {
    throw new Error("DTD evidence is unsupported");
  });
  parser.on("opentag", (tag) => {
    stack.push(tag.name);
    text = "";
    if (stack.join("/") === `${root}/games/game`) {
      game = { fields: {}, sequences: [] };
      games.push(game);
    }
  });
  parser.on("text", (value) => {
    text += value;
  });
  parser.on("closetag", () => {
    const key = stack.slice(1).join("/");
    if (game && key.startsWith("games/game/")) {
      const field = key.slice("games/game/".length);
      if (field === "timeline/entry/sequence") {
        const sequence = Number(text);
        if (
          !Number.isSafeInteger(sequence) ||
          sequence <= (game.sequences.at(-1) ?? 0)
        )
          throw new Error("Timeline sequence must increase");
        game.sequences.push(sequence);
      } else if (
        [
          "game_id",
          "number",
          "status",
          "stage",
          "starter",
          "starting_player",
          "evidence_sha256",
          "result/evidence_sha256",
        ].includes(field)
      ) {
        if (field in game.fields) throw new Error("Duplicate XML game field");
        game.fields[field] = text;
      }
    } else if (
      [
        "run_id",
        "match_id",
        "status",
        "perspective",
        "bot_artifact_sha256",
        "sideboarding/status",
        "bots/a/artifact_sha256",
        "bots/b/artifact_sha256",
        "content/sha256",
      ].includes(key)
    ) {
      if (key in fields) throw new Error("Duplicate XML identity field");
      fields[key] = text;
    }
    if (stack.join("/") === `${root}/games/game`) game = undefined;
    if (stack.length === 1 && stack[0] !== root)
      throw new Error("Unexpected XML root");
    stack.pop();
    text = "";
  });
  parser.write(bytes.toString("utf8")).close();
  return { fields, games };
}
async function tree(base: string, prefix = ""): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(path.join(base, prefix), {
    withFileTypes: true,
  })) {
    const file = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink())
      throw new Error("Symlink evidence is unsupported");
    if (entry.isDirectory()) files.push(...(await tree(base, file)));
    else if (entry.isFile()) files.push(file);
    else throw new Error("Unsupported evidence file");
  }
  return files.sort();
}

/** Adapter for ARO2-18 frozen_evidence.rs done.json + existing evaluator XML. */
export async function finalizedXml(
  session: string,
  relative: string,
  expected: {
    match: string;
    executionIdentity: string;
    fixtureIdentity: string;
    candidateIdentity: string;
    opponentIdentity: string;
    item?: unknown;
  },
) {
  const base = await analysisPath(session, relative);
  const donePath = `${relative}/done.json`;
  const doneBytes = await readFile(await analysisPath(session, donePath));
  const done = JSON.parse(doneBytes.toString());
  const files = done.files as Record<string, string>;
  if (!files || typeof files !== "object" || Array.isArray(files))
    throw new Error("Invalid completion marker");
  const prefix = `matches/${expected.match}`;
  const required = [
    "manifest.xml",
    `${prefix}/match.xml`,
    `${prefix}/player-a.xml`,
    `${prefix}/player-b.xml`,
  ];
  if (required.some((f) => !Object.hasOwn(files, f)))
    throw new Error("Incomplete finalized evidence");
  // Early runner samples published fixture.json separately; newer markers hash it too.
  const actual = (await tree(base)).filter(
    (f) =>
      f !== "done.json" && (f !== "fixture.json" || Object.hasOwn(files, f)),
  );
  if (JSON.stringify(actual) !== JSON.stringify(Object.keys(files).sort()))
    throw new Error("Finalized evidence file set changed");
  const refs: EvidenceReference[] = [
    { path: donePath, sha256: digest(doneBytes) },
  ];
  const xml = new Map<string, Buffer>();
  for (const [file, sha256] of Object.entries(files).sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const ref = { path: `${relative}/${file}`, sha256 };
    const bytes = await readEvidence(session, ref);
    refs.push(ref);
    if (required.includes(file)) xml.set(file, bytes);
  }
  if (expected.item !== undefined) {
    const fixtureBytes = await readFile(
      await analysisPath(session, `${relative}/fixture.json`),
    );
    if (!isDeepStrictEqual(JSON.parse(fixtureBytes.toString()), expected.item))
      throw new Error("Finalized fixture preparation mismatch");
    if (!Object.hasOwn(files, "fixture.json"))
      refs.push({
        path: `${relative}/fixture.json`,
        sha256: digest(fixtureBytes),
      });
  }
  const manifest = xmlSummary(xml.get("manifest.xml")!, "manifest");
  if (
    manifest.fields.run_id !== expected.executionIdentity ||
    manifest.fields["content/sha256"] !== expected.fixtureIdentity ||
    manifest.fields["bots/a/artifact_sha256"] !== expected.candidateIdentity ||
    manifest.fields["bots/b/artifact_sha256"] !== expected.opponentIdentity
  )
    throw new Error("Finalized manifest binding mismatch");
  const neutral = xmlSummary(xml.get(`${prefix}/match.xml`)!, "match");
  const reports = ["a", "b"].map((actor) =>
    xmlSummary(xml.get(`${prefix}/player-${actor}.xml`)!, "player-report"),
  );
  const events: EventReference[] = [];
  for (const [i, summary] of [neutral, ...reports].entries()) {
    if (
      summary.fields.run_id !== expected.executionIdentity ||
      summary.fields.match_id !== expected.match ||
      summary.games.length !== 4 ||
      !["completed", "failed", "skipped"].includes(
        summary.fields["sideboarding/status"] ?? "",
      )
    )
      throw new Error("Incomplete match or mismatched XML identity");
    if (
      i === 0 &&
      summary.fields.status !==
        (summary.games.every((g) => g.fields.status === "completed")
          ? "completed"
          : "incomplete")
    )
      throw new Error("Inconsistent finalized match status");
    if (
      i > 0 &&
      (summary.fields.perspective !== (i === 1 ? "a" : "b") ||
        summary.fields.bot_artifact_sha256 !==
          (i === 1 ? expected.candidateIdentity : expected.opponentIdentity))
    )
      throw new Error("Perspective identity mismatch");
    for (const [n, game] of summary.games.entries()) {
      const other = neutral.games[n]!.fields;
      const stage = n < 2 ? "pre_side" : "post_side";
      const starter = n % 2 === 0 ? "a" : "b";
      if (
        game.fields.game_id !== `${expected.match}-game-${n + 1}` ||
        !["completed", "failed", "skipped"].includes(
          game.fields.status ?? "",
        ) ||
        game.fields.status !== other.status ||
        game.fields.stage !== stage ||
        (i === 0
          ? game.fields.starter !== starter ||
            Number(game.fields.number) !== n + 1
          : game.fields.starting_player !== starter ||
            (game.fields.status !== "skipped" &&
              game.fields["result/evidence_sha256"] !== other.evidence_sha256))
      )
        throw new Error("Incomplete or inconsistent game evidence");
      if (i > 0) {
        if (game.fields.status === "completed" && !game.sequences.length)
          throw new Error("Missing perspective timeline");
        events.push(
          ...game.sequences.map((sequence) => ({
            game: n + 1,
            perspective: i === 1 ? ("a" as const) : ("b" as const),
            sequence,
          })),
        );
      }
    }
  }
  for (const ref of refs) await readEvidence(session, ref);
  return {
    files: refs,
    games: neutral.games.map((g, i) => {
      const status = g.fields.status as "completed" | "failed" | "skipped";
      const evidenceHash = g.fields.evidence_sha256 || null;
      if (
        status === "skipped"
          ? evidenceHash !== null
          : !evidenceHash || !/^[a-f0-9]{64}$/.test(evidenceHash)
      )
        throw new Error("Missing or invalid game evidence hash");
      return { number: i + 1, id: g.fields.game_id!, status, evidenceHash };
    }),
    events,
  };
}

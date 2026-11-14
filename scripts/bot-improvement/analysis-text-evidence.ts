import { parseGameLog, parseMatchLog } from "./game-log.ts";
import { writeOutput } from "./output-storage.ts";
/** Native linked game records and compact logs, with no XML dependency. */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { analysisPath, readEvidence } from "./analysis-evidence.ts";
import { digest } from "./session-fixtures.ts";
import type { EvidenceReference } from "./session-control-contract.ts";
import type { EventReference } from "./analysis-contract.ts";

type Value =
  string | number | boolean | null | Value[] | { [key: string]: Value };
interface Marker {
  schemaVersion: 1;
  adapter: "linked-text-v1" | "game-log-v2";
  match: string;
  executionIdentity: string;
  fixtureIdentity: string;
  candidateIdentity: string;
  opponentIdentity: string;
  files: EvidenceReference[];
}
export type TextExpectation = Pick<
  Marker,
  | "match"
  | "executionIdentity"
  | "fixtureIdentity"
  | "candidateIdentity"
  | "opponentIdentity"
> & { item?: unknown; outcomes?: boolean };
async function localFiles(
  session: string,
  relative: string,
  receipt = `${relative}/done.json`,
): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(await analysisPath(session, relative), {
    withFileTypes: true,
  })) {
    const file = `${relative}/${entry.name}`;
    await analysisPath(session, file);
    if (entry.isDirectory())
      files.push(...(await localFiles(session, file, receipt)));
    else if (entry.isFile() && file !== receipt) files.push(file);
    else if (!entry.isFile())
      throw new Error("Unsupported native evidence file");
  }
  return files.sort();
}
/** Every linked dependency is pinned, including shared records outside a match folder. */
async function linkedReader(session: string, pins?: Map<string, string>) {
  const refs = new Map<string, EvidenceReference>();
  const cache = new Map<string, Buffer>();
  const read = async (file: string) => {
    if (cache.has(file)) return cache.get(file)!;
    const bytes = pins
      ? await readEvidence(session, {
          path: file,
          sha256: pins.get(file) ?? "",
        })
      : await readFile(await analysisPath(session, file));
    refs.set(file, { path: file, sha256: digest(bytes) });
    cache.set(file, bytes);
    return bytes;
  };
  async function resolve(
    value: Value,
    file: string,
    seen: Set<string>,
  ): Promise<Value> {
    if (Array.isArray(value))
      return Promise.all(value.map((v) => resolve(v, file, seen)));
    if (value && typeof value === "object") {
      if (typeof value.$ref === "string") {
        if (Object.keys(value).length !== 1)
          throw new Error("Ambiguous linked record");
        const [target, pointer = ""] = value.$ref.split("#");
        if (!target || path.isAbsolute(target))
          throw new Error("Unsafe linked record");
        const next = path.posix.normalize(
          path.posix.join(path.posix.dirname(file), target),
        );
        const key = `${next}#${pointer}`;
        if (seen.has(key)) throw new Error("Cyclic linked record");
        const chain = new Set(seen).add(key);
        let data = JSON.parse((await read(next)).toString()) as Value;
        if (pointer) {
          if (!pointer.startsWith("/"))
            throw new Error("Invalid linked pointer");
          for (const part of pointer.slice(1).split("/")) {
            const name = part.replaceAll("~1", "/").replaceAll("~0", "~");
            if (!data || typeof data !== "object" || !Object.hasOwn(data, name))
              throw new Error("Missing linked field");
            data = (data as Record<string, Value>)[name]!;
          }
        }
        return resolve(data, next, chain);
      }
      const result: Record<string, Value> = Object.create(null);
      for (const [key, v] of Object.entries(value))
        result[key] = await resolve(v, file, seen);
      return result;
    }
    return value;
  }
  return {
    refs,
    read,
    json: async (file: string) => {
      // V2 stores complete typed records in logs. Legacy paths are virtual,
      // reconstructed in memory so validation has one source of truth.
      let virtual = pins ? !pins.has(file) : false;
      if (!pins) {
        try {
          await analysisPath(session, file);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
          virtual = true;
        }
      }
      if (virtual) {
        const game = /^(.*\/games\/game-[0-9]+)\/(game|a|b)\.json$/.exec(file);
        if (game) {
          const parsed = parseGameLog(
            (await read(`${game[1]}/game.log`)).toString(),
          );
          return game[2] === "game"
            ? parsed.neutral
            : parsed.actors[game[2] === "a" ? 0 : 1];
        }
        const match = /^(.*)\/(match|fixture)\.json$/.exec(file);
        if (match) {
          const parsed = parseMatchLog(
            (await read(`${match[1]}/match.log`)).toString(),
          );
          return match[2] === "match" ? parsed.match : parsed.fixture;
        }
        throw new Error(`Unpinned or missing record: ${file}`);
      }
      const value = await resolve(
        JSON.parse((await read(file)).toString()),
        file,
        new Set([`${file}#`]),
      );
      return value &&
        !Array.isArray(value) &&
        typeof value === "object" &&
        typeof value.kind === "string"
        ? value.data
        : value;
    },
  };
}
/** Publish last, after all native match files have been written. Never overwrites a receipt. */
export async function publishTextCompletion(
  session: string,
  relative: string,
  expected: TextExpectation,
) {
  const reader = await linkedReader(session);
  const files = await localFiles(session, relative);
  for (const file of files) {
    if (file.endsWith(".json")) await reader.json(file);
    else await reader.read(file);
  }
  const marker: Marker = {
    schemaVersion: 1,
    adapter:
      files.some((f) => f.endsWith("/match.log")) &&
      !files.some((f) => f.endsWith("/match.json"))
        ? "game-log-v2"
        : "linked-text-v1",
    match: expected.match,
    executionIdentity: expected.executionIdentity,
    fixtureIdentity: expected.fixtureIdentity,
    candidateIdentity: expected.candidateIdentity,
    opponentIdentity: expected.opponentIdentity,
    files: [...reader.refs.values()].sort((a, b) =>
      a.path.localeCompare(b.path),
    ),
  };
  await validateText(session, relative, expected, marker, reader);
  await writeOutput(
    path.join(await analysisPath(session, relative), "done.json"),
    JSON.stringify(marker, null, 2) + "\n",
    true,
  );
}

export async function finalizedText(
  session: string,
  relative: string,
  expected: TextExpectation,
) {
  const bytes = await readFile(
    await analysisPath(session, `${relative}/done.json`),
  );
  const marker = JSON.parse(bytes.toString()) as Marker;
  const pins = new Map(marker.files?.map((ref) => [ref.path, ref.sha256]));
  if (!Array.isArray(marker.files) || pins.size !== marker.files.length)
    throw new Error("Invalid native completion references");
  const reader = await linkedReader(session, pins);
  const result = await validateText(
    session,
    relative,
    expected,
    marker,
    reader,
  );
  return {
    ...result,
    files: [
      { path: `${relative}/done.json`, sha256: digest(bytes) },
      ...marker.files,
    ],
  };
}
async function validateText(
  session: string,
  relative: string,
  expected: TextExpectation,
  marker: Marker,
  reader: Awaited<ReturnType<typeof linkedReader>>,
) {
  if (
    marker.schemaVersion !== 1 ||
    !["linked-text-v1", "game-log-v2"].includes(marker.adapter) ||
    [
      "match",
      "executionIdentity",
      "fixtureIdentity",
      "candidateIdentity",
      "opponentIdentity",
    ].some(
      (k) => marker[k as keyof Marker] !== expected[k as keyof TextExpectation],
    )
  )
    throw new Error("Native match identity mismatch");
  const owned = await localFiles(session, relative);
  const declared = marker.files
    .filter((f) => f.path.startsWith(relative + "/"))
    .map((f) => f.path)
    .sort();
  if (!isDeepStrictEqual(owned, declared))
    throw new Error("Native evidence file set changed");
  for (const ref of marker.files) await readEvidence(session, ref);
  if (
    expected.item !== undefined &&
    !isDeepStrictEqual(
      JSON.parse(JSON.stringify(await reader.json(`${relative}/fixture.json`))),
      expected.item,
    )
  )
    throw new Error("Native fixture preparation mismatch");
  const match = (await reader.json(`${relative}/match.json`)) as Record<
    string,
    Value
  >;
  if (
    match.match_id !== expected.match ||
    match.run_id !== expected.executionIdentity ||
    !["completed", "incomplete"].includes(String(match.status))
  )
    throw new Error("Native source match binding mismatch");
  const sideboarding = match.sideboarding as Record<string, Value>;
  if (
    !sideboarding ||
    !["completed", "failed", "skipped"].includes(String(sideboarding.status))
  )
    throw new Error("Invalid native sideboarding status");
  const games: {
    number: number;
    id: string;
    status: "completed" | "failed" | "skipped";
    evidenceHash: string | null;
  }[] = [];
  const outcomes: (
    "win" | "loss" | "draw" | "failed" | "skipped" | "timeout"
  )[] = [];
  const events: EventReference[] = [];
  const lossGames: { game: number; decisions: string[] }[] = [];
  for (let n = 1; n <= 4; n++) {
    const folder = `${relative}/games/game-${n}`;
    const g = (await reader.json(`${folder}/game.json`)) as Record<
      string,
      Value
    >;
    const status = g.status as "completed" | "failed" | "skipped";
    if (
      g.game_id !== `${expected.match}-game-${n}` ||
      g.number !== n ||
      !["completed", "failed", "skipped"].includes(status) ||
      g.stage !== (n < 3 ? "pre_side" : "post_side") ||
      g.starter !== (n % 2 ? "a" : "b")
    )
      throw new Error("Invalid native game identity/status");
    const hash =
      typeof g.evidence_sha256 === "string" ? g.evidence_sha256 : null;
    if (status !== "skipped" && (!hash || !/^[a-f0-9]{64}$/.test(hash)))
      throw new Error("Invalid native game hash");
    if (
      status === "completed" &&
      (!["a", "b", null].includes(g.winner as string | null) ||
        g.draw !== (g.winner === null))
    )
      throw new Error("Invalid native outcome");
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
    const decisions: string[] = [];
    for (const actor of ["a", "b"] as const) {
      const record = (await reader.json(`${folder}/${actor}.json`)) as Record<
        string,
        Value
      >;
      const result = record.result as Record<string, Value>;
      const expectedOutcome =
        status !== "completed"
          ? status
          : g.winner === null
            ? "draw"
            : g.winner === actor
              ? "win"
              : "loss";
      if (
        record.game_id !== g.game_id ||
        record.status !== status ||
        record.stage !== g.stage ||
        record.starting_player !== g.starter ||
        (status === "skipped"
          ? result?.outcome !== undefined &&
            result.outcome !== null &&
            result.outcome !== "" &&
            result.outcome !== "skipped"
          : result?.outcome !== expectedOutcome) ||
        (status !== "skipped" && result.evidence_sha256 !== hash)
      )
        throw new Error("Native perspective mismatch");
      const entries = (record.timeline as { entry?: Value[] })?.entry ?? [];
      if (status === "completed" && !entries.length)
        throw new Error("Missing native timeline");
      let previous = -1;
      for (const value of entries) {
        const entry = value as Record<string, Value>;
        const seq = entry.sequence;
        if (!Number.isSafeInteger(seq) || Number(seq) <= previous)
          throw new Error("Invalid native event sequence");
        previous = Number(seq);
        events.push({ game: n, perspective: actor, sequence: previous });
        if (
          actor === "a" &&
          entry.kind === "decision" &&
          typeof entry.decision_id === "string"
        )
          decisions.push(entry.decision_id);
      }
      const combined = `${folder}/game.log`;
      const log = await localFiles(session, folder);
      if (
        !(
          await reader.read(
            log.includes(combined) ? combined : `${folder}/${actor}.log`,
          )
        ).length
      )
        throw new Error("Missing compact game log");
    }
    games.push({
      number: n,
      id: String(g.game_id),
      status,
      evidenceHash: hash,
    });
    outcomes.push(outcome);
    if (outcome === "loss")
      lossGames.push({ game: n, decisions: [...new Set(decisions)] });
  }
  if (
    match.status !==
    (games.every((g) => g.status === "completed") ? "completed" : "incomplete")
  )
    throw new Error("Inconsistent native match completion");
  return {
    files: marker.files,
    games,
    outcomes,
    events,
    lossGames,
    sideboarding: String(sideboarding.status),
  };
}

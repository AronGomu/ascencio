import type {
  ReplayEntry,
  ReplayRecord,
} from "../bot-evaluation/decision-replay.ts";
import type { Artifact } from "../bot-evaluation/host-inputs.ts";
import type { FrozenSetup, MatchExecutionLimits } from "./session-contract.ts";
import type { ParsedDeck } from "../../src/battle/duel/presets/deck-parser.ts";
/** Lossless, typed text records. JSON is used only to escape scalar strings. */
export type LogValue =
  null | boolean | number | string | LogValue[] | { [key: string]: LogValue };
export interface LogLine {
  tag: string;
  value: LogValue;
}
const part = (key: string) =>
  key.replaceAll("~", "~0").replaceAll("/", "~1").replaceAll("=", "~2");
export function encodeLogRecord(tag: string, value: unknown): string {
  if (!/^[A-Z_]+$/.test(tag)) throw Error("Invalid log record tag");
  const fields: string[] = [];
  const visit = (v: unknown, pointer: string) => {
    const token =
      v === null
        ? "z"
        : Array.isArray(v)
          ? "a"
          : typeof v === "object"
            ? "o"
            : typeof v === "string"
              ? `s:${JSON.stringify(v)}`
              : typeof v === "boolean"
                ? `b:${Number(v)}`
                : typeof v === "number" && Number.isFinite(v)
                  ? `n:${v}`
                  : null;
    if (token === null) throw Error("Unsupported log value");
    fields.push(`${pointer}=${token}`);
    if (v && typeof v === "object")
      for (const [k, x] of Object.entries(v)) visit(x, `${pointer}/${part(k)}`);
  };
  visit(value, "");
  return `${tag}\t${fields.join("\t")}\n`;
}
export function decodeLogRecord(line: string): LogLine {
  const [tag, ...fields] = line.split("\t");
  return decodeFields(tag, fields);
}
function fieldPath(pointer: string) {
  const slash = pointer.lastIndexOf("/");
  return {
    pointer,
    parent: pointer.slice(0, slash),
    key: pointer
      .slice(slash + 1)
      .replaceAll("~2", "=")
      .replaceAll("~1", "/")
      .replaceAll("~0", "~"),
  };
}
function decodeFields(
  tag: string | undefined,
  fields: string[],
  dictionary?: ReturnType<typeof fieldPath>[],
): LogLine {
  if (!tag || !/^[A-Z_]+$/.test(tag) || !fields.length)
    throw Error("Invalid log record");
  const nodes = new Map<string, LogValue>();
  for (const field of fields) {
    const at = field.indexOf("=");
    if (at < 0) throw Error("Malformed log field");
    let pointer = field.slice(0, at);
    let location: ReturnType<typeof fieldPath> | undefined;
    const token = field.slice(at + 1);
    if (dictionary) {
      if (
        !/^#(0|[1-9][0-9]*)$/.test(pointer) ||
        dictionary[Number(pointer.slice(1))] === undefined
      )
        throw Error("Unknown log field alias");
      location = dictionary[Number(pointer.slice(1))]!;
      pointer = location.pointer;
    }
    if (nodes.has(pointer) || (pointer !== "" && !pointer.startsWith("/")))
      throw Error("Duplicate or invalid log field");
    let value: LogValue;
    if (token === "o") value = {};
    else if (token === "a") value = [];
    else if (token === "z") value = null;
    else if (token === "b:0" || token === "b:1") value = token === "b:1";
    else if (token.startsWith("s:")) {
      value = JSON.parse(token.slice(2));
      if (typeof value !== "string") throw Error("Invalid string field");
    } else if (
      token.startsWith("n:") &&
      /^-?(0|[1-9][0-9]*)(\.[0-9]+)?([eE][+-]?[0-9]+)?$/.test(token.slice(2)) &&
      Number.isFinite(Number(token.slice(2)))
    )
      value = Number(token.slice(2));
    else throw Error("Invalid log field type");
    if (pointer !== "") {
      const resolved = location ?? fieldPath(pointer);
      const parent = nodes.get(resolved.parent),
        key = resolved.key;
      if (!parent || typeof parent !== "object")
        throw Error("Missing log field parent");
      // Inherited object names must never invoke a prototype setter.
      if (Array.isArray(parent)) {
        if (!/^(0|[1-9][0-9]*)$/.test(key) || Number(key) !== parent.length)
          throw Error("Invalid log array index");
        parent.push(value);
      } else if (Object.hasOwn(Object.prototype, key))
        Object.defineProperty(parent, key, {
          value,
          writable: true,
          enumerable: true,
          configurable: true,
        });
      else parent[key] = value;
    } else if (nodes.size) throw Error("Log root must come first");
    nodes.set(pointer, value);
  }
  if (!nodes.has("")) throw Error("Missing log root");
  return { tag, value: nodes.get("")! };
}
export function decodeLog(text: string, header: string): LogLine[] {
  const lines = text.split("\n");
  if (lines.shift() !== header || lines.pop() !== "")
    throw Error("Invalid or truncated log header/footer");
  let fields: ReturnType<typeof fieldPath>[] | undefined;
  if (lines[0]?.startsWith("FIELDS\t")) {
    const dictionary = decodeLogRecord(lines.shift()!);
    if (
      !Array.isArray(dictionary.value) ||
      dictionary.value.some((v) => typeof v !== "string") ||
      new Set(dictionary.value).size !== dictionary.value.length
    )
      throw Error("Invalid log field dictionary");
    fields = (dictionary.value as string[]).map(fieldPath);
  }
  return lines.map((line) => {
    if (!fields) return decodeLogRecord(line);
    const [tag, ...values] = line.split("\t");
    return decodeFields(tag, values, fields);
  });
}
export interface LogObject {
  [key: string]: LogValue;
}
export interface LoggedDeck {
  [section: string]: {
    card: { card_code: string | number; copies: string | number }[];
  };
}
export interface LoggedInitial {
  [key: string]: unknown;
  own_configuration?: LoggedDeck;
  own_starting_order?: {
    main?: { card: (number | string)[] };
    extra?: { card: (number | string)[] };
  };
}
export interface LoggedResult {
  [key: string]: unknown;
  outcome?: string | null;
  evidence_sha256?: string | null;
}
export interface LoggedGame extends Record<string, unknown> {
  game_id: string;
  status: string;
  number?: number | string;
  stage: string;
  starter: string;
  winner: string | null;
  draw: boolean | null;
}
export interface LoggedActor extends ReplayRecord, Record<string, unknown> {
  game_id: string;
  status: string;
  stage: string;
  starting_player: string;
  initial: LoggedInitial | null;
  result: LoggedResult | null;
}
export interface PreparedMatchItem {
  match: FrozenSetup["matches"][number];
  decks: ParsedDeck[];
  identities: string[];
  bots: (Artifact & { wasm?: string })[];
}
export interface PreparedMatchJob {
  fixtureIdentity: string;
  content: string;
  engine: string;
  engineHash: string;
  profile: string;
  limits: MatchExecutionLimits;
  matches: PreparedMatchItem[];
  schedule?: string;
}
export interface GameLog {
  neutral: LoggedGame;
  actors: [LoggedActor, LoggedActor];
  sideboarding: [LogObject, LogObject];
}
function object(value: LogValue, label: string): LogObject {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error(`Invalid ${label} log object`);
  return value;
}
function optionalObject(value: LogValue, label: string): LogObject | null {
  return value === null ? null : object(value, label);
}
/** Complete game records exist only in memory after parsing their authoritative log. */
export function parseGameLog(text: string): GameLog {
  const lines = decodeLog(text, "ASCENCIO_GAME_LOG\t2");
  const next = (tag: string) => {
    const line = lines.shift();
    if (line?.tag !== tag) throw Error(`Expected ${tag} log record`);
    return line.value;
  };
  const neutralObject = object(next("GAME"), "game");
  if (
    typeof neutralObject.game_id !== "string" ||
    typeof neutralObject.status !== "string" ||
    typeof neutralObject.stage !== "string" ||
    typeof neutralObject.starter !== "string"
  )
    throw Error("Invalid game log identity");
  const neutral = neutralObject as unknown as LoggedGame;
  const actors: LoggedActor[] = [],
    sideboarding: LogObject[] = [];
  for (const actor of ["a", "b"]) {
    if (next("ACTOR") !== actor) throw Error("Invalid actor order");
    const header = object(next("RECORD"), "actor");
    sideboarding.push(object(next("SIDEBOARD"), "sideboarding"));
    const initial = optionalObject(next("INITIAL"), "initial");
    const entry: ReplayEntry[] = [];
    while (lines[0]?.tag === "EVENT") {
      const event = object(next("EVENT"), "event");
      if (typeof event.kind !== "string") throw Error("Invalid event kind");
      entry.push(event as ReplayEntry);
    }
    const result = optionalObject(next("RESULT"), "result");
    const record = {
      ...header,
      initial,
      timeline: { entry },
      result,
    } as unknown as LoggedActor;
    if (next("END_ACTOR") !== actor) throw Error("Truncated actor log");
    actors.push(record);
  }
  if (next("END_GAME") !== neutral.game_id || lines.length)
    throw Error("Truncated or trailing game log");
  return {
    neutral,
    actors: actors as [LoggedActor, LoggedActor],
    sideboarding: sideboarding as [LogObject, LogObject],
  };
}
export function targetLossView(text: string): string {
  const { neutral, actors, sideboarding } = parseGameLog(text);
  if (
    neutral.status !== "completed" ||
    neutral.winner !== "b" ||
    neutral.draw !== false ||
    actors[0].result?.outcome !== "loss"
  )
    throw Error("Only completed target losses may be published to analysts");
  const own = actors[0];
  return (
    "ASCENCIO_LOSS_LOG\t2\n" +
    encodeLogRecord("GAME", {
      game_id: neutral.game_id,
      stage: neutral.stage,
      starter: neutral.starter,
      outcome: "loss",
    }) +
    encodeLogRecord("SIDEBOARD", sideboarding[0]) +
    encodeLogRecord("INITIAL", own.initial) +
    own.timeline.entry
      .map((e: unknown) => encodeLogRecord("EVENT", e))
      .join("") +
    encodeLogRecord("RESULT", own.result) +
    encodeLogRecord("END_GAME", neutral.game_id)
  );
}
export interface MatchLog {
  match: LogObject;
  manifest: LogObject;
  fixture: LogObject;
  reports: [LogObject, LogObject];
  refs: LogObject[];
}
export function parseMatchLog(text: string): MatchLog {
  const lines = decodeLog(text, "ASCENCIO_MATCH_LOG\t2");
  const one = (tag: string) => {
    const values = lines.filter((l) => l.tag === tag);
    if (values.length !== 1) throw Error(`Missing/duplicate ${tag}`);
    return values[0]!.value;
  };
  const match = object(one("MATCH"), "match");
  if (one("END_MATCH") !== match.match_id) throw Error("Truncated match log");
  const refs = lines
    .filter((l) => l.tag === "GAME_REF")
    .map((l, i) => {
      const r = object(l.value, "game reference");
      if (r.number !== i + 1 || r.path !== `games/game-${i + 1}/game.log`)
        throw Error("Invalid match game reference");
      return r;
    });
  return {
    match,
    manifest: object(one("MANIFEST"), "manifest"),
    fixture: object(one("FIXTURE"), "fixture"),
    reports: [
      object(one("REPORT_A"), "report a"),
      object(one("REPORT_B"), "report b"),
    ] as [LogObject, LogObject],
    refs,
  };
}

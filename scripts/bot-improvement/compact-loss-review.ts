/* eslint-disable @typescript-eslint/no-explicit-any -- Codec traversal operates on recursively validated heterogeneous log values. */
/** Lossless chronological review. Restart blocks bound decoder context without waiving coverage. */
import { isDeepStrictEqual } from "node:util";
import { decodeLog, type LogLine } from "./game-log.ts";
import { digest } from "./session-fixtures.ts";

type Value =
  null | boolean | number | string | Value[] | { [key: string]: Value };
type Wire = null | boolean | number | string | Wire[];
const object = (v: unknown): v is Record<string, Value> =>
  !!v && typeof v === "object" && !Array.isArray(v);
export interface CompactReviewOptions {
  maxBytes?: number;
  /** Conservative upper bound for byte-level tokenizers, excluding external tool wrappers. */
  maxTokens?: number;
  checkpointRows?: number;
}
export function compactLossReview(
  text: string,
  options: number | CompactReviewOptions = 12000,
) {
  const settings =
    typeof options === "number" ? { maxBytes: options } : options;
  const maxBytes = settings.maxBytes ?? 12000,
    checkpointRows = settings.checkpointRows ?? 128;
  const maxTokens = settings.maxTokens ?? maxBytes;
  if (
    !Number.isSafeInteger(maxBytes) ||
    maxBytes < 1024 ||
    maxBytes > 64000 ||
    !Number.isSafeInteger(maxTokens) ||
    maxTokens < 1024 ||
    !Number.isSafeInteger(checkpointRows) ||
    checkpointRows < 1 ||
    checkpointRows > 256
  )
    throw Error(
      "Review bounds require bytes 1024..64000, tokens >=1024 and checkpoint rows 1..256",
    );
  const cap = Math.min(maxBytes, maxTokens),
    rows = decodeLog(text, "ASCENCIO_LOSS_LOG\t2"),
    sourceSha256 = digest(text);
  const pages: {
    text: string;
    events: number;
    decisions: string[];
    block: number;
    part: number;
    parts: number;
    tokenUpperBound: number;
  }[] = [];
  const blocks: {
    block: number;
    firstRow: number;
    rows: number;
    firstPage: number;
    pages: number;
    sha256: string;
  }[] = [];
  const index: {
    row: number;
    sequence: unknown;
    decision: unknown;
    block: number;
    page: number;
    cards: string[];
  }[] = [];
  const cardIndex: Record<string, number[]> = Object.create(null);
  function cardsIn(value: unknown, found = new Set<string>()): string[] {
    if (Array.isArray(value)) for (const child of value) cardsIn(child, found);
    else if (object(value))
      for (const [key, child] of Object.entries(value)) {
        if (
          /^(instance_id|instanceId|card_instance_id|cardInstanceId)$/.test(
            key,
          ) &&
          typeof child === "string"
        )
          found.add(child);
        else cardsIn(child, found);
      }
    return [...found].sort();
  }
  for (let start = 0; start < rows.length; start += checkpointRows) {
    const group = rows.slice(start, start + checkpointRows),
      block = blocks.length,
      firstPage = pages.length;
    const strings: string[] = [],
      stringIds = new Map<string, number>(),
      templates = new Map<string, number>();
    const frequency = new Map<string, number>();
    function count(value: unknown) {
      if (!value || typeof value !== "object") return;
      const key = JSON.stringify(value);
      frequency.set(key, (frequency.get(key) ?? 0) + 1);
      for (const child of Object.values(value)) count(child);
    }
    for (const row of group) count(row.value);
    const lines = [JSON.stringify(["review", 3, sourceSha256, block, start])];
    function intern(value: string) {
      let id = stringIds.get(value);
      if (id === undefined) {
        id = strings.length;
        strings.push(value);
        stringIds.set(value, id);
        lines.push(JSON.stringify(["define", id, value]));
      }
      return id;
    }
    function encode(value: Value, allowTemplate = true): Wire {
      if (typeof value === "string") return ["s", intern(value)];
      if (value && typeof value === "object") {
        const key = JSON.stringify(value);
        if (
          allowTemplate &&
          key.length >= 16 &&
          (frequency.get(key) ?? 0) > 1
        ) {
          let id = templates.get(key);
          if (id === undefined) {
            const node = encode(value, false);
            id = templates.size;
            templates.set(key, id);
            lines.push(JSON.stringify(["template", id, node]));
          }
          return ["r", id];
        }
        if (Array.isArray(value)) return ["a", ...value.map((v) => encode(v))];
        return [
          "o",
          ...Object.entries(value).map(
            ([k, v]) => [intern(k), encode(v)] as Wire,
          ),
        ];
      }
      return value;
    }
    function patch(before: Value | undefined, after: Value): Wire {
      if (isDeepStrictEqual(before, after)) return ["="];
      if (object(before) && object(after)) {
        const changes: Wire[] = [];
        for (const [key, value] of Object.entries(after))
          if (
            !Object.hasOwn(before, key) ||
            !isDeepStrictEqual(before[key], value)
          )
            changes.push([intern(key), patch(before[key], value)]);
        return [
          "p",
          changes,
          Object.keys(before)
            .filter((k) => !Object.hasOwn(after, k))
            .map(intern),
        ];
      }
      return ["v", encode(after)];
    }
    const previous = new Map<string, Value>();
    group.forEach((row, i) => {
      const value = row.value as Value,
        key = `${row.tag}/${object(value) ? (value.kind ?? "") : ""}`;
      const node = patch(previous.get(key), value);
      previous.set(key, value);
      lines.push(JSON.stringify(["delta", row.tag, key, node]));
      const cards = cardsIn(value),
        ordinal = start + i;
      for (const card of cards) (cardIndex[card] ??= []).push(ordinal);
      index.push({
        row: ordinal,
        sequence: object(value) ? value.sequence : undefined,
        decision: object(value) ? value.decision_id : undefined,
        block,
        page: firstPage,
        cards,
      });
    });
    const blockText = lines.join("\n") + "\n",
      bytes = Buffer.from(blockText),
      fragments: string[] = [];
    for (let offset = 0; offset < bytes.length;) {
      let end = Math.min(offset + cap, bytes.length);
      while (end < bytes.length && (bytes[end]! & 0xc0) === 0x80) end--;
      fragments.push(bytes.subarray(offset, end).toString());
      offset = end;
    }
    fragments.forEach((fragment, part) =>
      pages.push({
        text: fragment,
        events:
          part === fragments.length - 1
            ? group.filter((r) => r.tag === "EVENT").length
            : 0,
        decisions:
          part === fragments.length - 1
            ? group.flatMap((r) =>
                object(r.value) && typeof r.value.decision_id === "string"
                  ? [r.value.decision_id]
                  : [],
              )
            : [],
        block,
        part: part + 1,
        parts: fragments.length,
        tokenUpperBound: Buffer.byteLength(fragment),
      }),
    );
    blocks.push({
      block,
      firstRow: start,
      rows: group.length,
      firstPage,
      pages: fragments.length,
      sha256: digest(blockText),
    });
    if (!isDeepStrictEqual(reconstructCompactReview(blockText), group))
      throw Error("Compact review block reconstruction mismatch");
  }
  const output = pages.map((p) => p.text).join("");
  if (!isDeepStrictEqual(reconstructCompactReview(output), rows))
    throw Error("Compact review reconstruction mismatch");
  return {
    version: 3 as const,
    pages,
    blocks,
    index,
    cardIndex,
    rows: rows.length,
    sourceSha256,
    bytes: Buffer.byteLength(output),
  };
}
/** Decode a complete stream or one independently hashed restart block. Accept old v2 packets. */
export function reconstructCompactReview(text: string): LogLine[] {
  let strings: string[] = [],
    templates: Value[] = [],
    previous = new Map<string, Value>(),
    version = 0;
  const result: LogLine[] = [];
  function lookup(id: unknown) {
    if (
      !Number.isSafeInteger(id) ||
      Number(id) < 0 ||
      Number(id) >= strings.length
    )
      throw Error("Unknown dictionary reference");
    return strings[Number(id)]!;
  }
  function decode(node: any): Value {
    if (!Array.isArray(node)) return node;
    if (node[0] === "s") return lookup(node[1]);
    if (node[0] === "r") {
      if (
        !Number.isSafeInteger(node[1]) ||
        node[1] < 0 ||
        node[1] >= templates.length
      )
        throw Error("Unknown template reference");
      return structuredClone(templates[node[1]]!);
    }
    if (node[0] === "a") return node.slice(1).map(decode);
    if (node[0] === "o")
      return Object.fromEntries(
        node.slice(1).map(([k, v]: any[]) => [lookup(k), decode(v)]),
      );
    throw Error("Unknown review node");
  }
  function apply(before: Value | undefined, node: any): Value {
    if (!Array.isArray(node)) throw Error("Invalid review patch");
    if (node[0] === "=") {
      if (before === undefined) throw Error("Missing patch base");
      return structuredClone(before);
    }
    if (node[0] === "v") return decode(node[1]);
    if (node[0] === "p") {
      if (!object(before)) throw Error("Missing object patch base");
      const after = { ...before };
      for (const [id, change] of node[1])
        Object.defineProperty(after, lookup(id), {
          value: apply(before[lookup(id)], change),
          writable: true,
          enumerable: true,
          configurable: true,
        });
      for (const id of node[2]) delete after[lookup(id)];
      return after;
    }
    throw Error("Unknown review patch");
  }
  if (!text.trim()) return [];
  for (const line of text
    .trimEnd()
    .split("\n")
    .map((l) => JSON.parse(l))) {
    if (line[0] === "review") {
      if (![2, 3].includes(line[1])) throw Error("Unknown review version");
      version = line[1];
      strings = [];
      templates = [];
      previous = new Map();
      continue;
    }
    if (!version) throw Error("Missing review header");
    if (line[0] === "define") {
      if (line[1] !== strings.length || typeof line[2] !== "string")
        throw Error("Invalid dictionary");
      strings.push(line[2]);
    } else if (line[0] === "template" && version === 3) {
      if (line[1] !== templates.length) throw Error("Invalid template");
      templates.push(decode(line[2]));
    } else if (line[0] === "delta" && version === 3) {
      const value = apply(previous.get(line[2]), line[3]);
      previous.set(line[2], value);
      result.push({ tag: line[1], value } as LogLine);
    } else if (line[0] === "full" && version === 2)
      result.push({ tag: line[1], value: decode(line[2]) } as LogLine);
    else if (line[0] === "row" && version === 2) {
      const value = {
        ...(previous.get(line[2]) as object),
        ...(decode(line[3]) as object),
      } as Record<string, Value>;
      for (const id of line[4]) delete value[lookup(id)];
      previous.set(line[2], value);
      result.push({ tag: line[1], value } as LogLine);
    } else throw Error("Unknown review record");
  }
  return result;
}
export function reconstructReviewBlock(
  pages: { text: string }[],
  block: { firstPage: number; pages: number; sha256: string },
) {
  const text = pages
    .slice(block.firstPage, block.firstPage + block.pages)
    .map((p) => p.text)
    .join("");
  if (digest(text) !== block.sha256)
    throw Error("Review restart block hash mismatch");
  return reconstructCompactReview(text);
}

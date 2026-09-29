import type { AuthoringResult } from "./authoring-result.ts";

class InvalidContent extends Error {}
export function invalid(): never {
  throw new InvalidContent("CONTENT_INVALID_MANIFEST");
}
export function record(
  value: unknown,
  keys: readonly string[],
): Record<string, unknown> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    (Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null)
  )
    invalid();
  const entries = Object.getOwnPropertyDescriptors(value);
  if (
    Reflect.ownKeys(value).length !== keys.length ||
    keys.some((key) => !entries[key]?.enumerable || !("value" in entries[key]!))
  )
    invalid();
  return value as Record<string, unknown>;
}
export function text(value: unknown): string {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.length > 512 ||
    /[\p{Cc}\uD800-\uDFFF]/u.test(value)
  )
    invalid();
  return value;
}
export function hash(value: unknown): string {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) invalid();
  return value;
}
export function integer(
  value: unknown,
  max = Number.MAX_SAFE_INTEGER,
  min = 0,
): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < min ||
    value > max
  )
    invalid();
  return value;
}
export function literal<T extends string | number | boolean | null>(
  value: unknown,
  ...allowed: readonly T[]
): T {
  if (!allowed.includes(value as T)) invalid();
  return value as T;
}
export function array<T>(
  value: unknown,
  parse: (v: unknown) => T,
  max = 50000,
): T[] {
  if (!Array.isArray(value) || value.length > max) invalid();
  return Array.from(value, parse);
}
export function unique<T>(
  items: readonly T[],
  key: (item: T) => string | number,
): void {
  if (new Set(items.map(key)).size !== items.length) invalid();
}
export function safePath(value: unknown): string {
  const result = text(value);
  if (
    new TextEncoder().encode(result).length > 512 ||
    /[\\:%?#<>"|*]/.test(result) ||
    result
      .split("/")
      .some(
        (part) =>
          !part ||
          part === "." ||
          part === ".." ||
          /[. ]$/.test(part) ||
          /^(?:con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/i.test(part),
      )
  )
    invalid();
  return result;
}
export function chapterId(value: unknown): `chapter-${string}` {
  if (typeof value !== "string" || !/^chapter-(0[1-9]|[1-9][0-9])$/.test(value))
    invalid();
  return value as `chapter-${string}`;
}
export function packId(value: unknown): "runtime" | `chapter-${string}` {
  return value === "runtime" ? value : chapterId(value);
}
/** Count bounded compact JSON before any whole-body encoding; rejects cycles/accessors. */
export function budget(value: unknown, max: number): void {
  let remaining = max - 1;
  const seen = new Set<object>();
  const visit = (v: unknown, depth: number): void => {
    if (depth > 32 || remaining < 0) invalid();
    if (
      v === null ||
      typeof v === "boolean" ||
      typeof v === "number" ||
      typeof v === "string"
    ) {
      if (typeof v === "number" && !Number.isSafeInteger(v)) invalid();
      if (typeof v === "string" && v.length > remaining) invalid();
      remaining -= new TextEncoder().encode(JSON.stringify(v)).length;
    } else if (typeof v === "object") {
      if (seen.has(v)) invalid();
      seen.add(v);
      if (Array.isArray(v)) {
        if (v.length > remaining / 2) invalid();
        remaining -= 2 + Math.max(0, v.length - 1);
        for (const child of v) visit(child, depth + 1);
      } else {
        const keys = Reflect.ownKeys(v);
        if (keys.length > remaining / 4) invalid();
        remaining -= 2 + Math.max(0, keys.length - 1) + keys.length;
        for (const key of keys) {
          const d = Object.getOwnPropertyDescriptor(v, key)!;
          if (typeof key !== "string" || !d.enumerable || !("value" in d))
            invalid();
          visit(key, depth + 1);
          visit(d.value, depth + 1);
        }
      }
      seen.delete(v);
    } else invalid();
    if (remaining < 0) invalid();
  };
  visit(value, 0);
}
export function result<T>(
  value: unknown,
  max: number,
  parse: (value: unknown) => T,
): AuthoringResult<T> {
  try {
    budget(value, max);
    return { kind: "ok", value: parse(value) };
  } catch (error) {
    if (!(error instanceof InvalidContent)) throw error;
    return {
      kind: "failed",
      code: "CONTENT_INVALID_MANIFEST",
      packId: null,
      path: null,
    };
  }
}

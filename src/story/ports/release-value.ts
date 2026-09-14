export function invalid(): never {
  throw new Error("STORY_RELEASE_INVALID");
}
export function record(
  value: unknown,
  keys: readonly string[],
): Record<string, unknown> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.keys(value).sort().join("\n") !== [...keys].sort().join("\n")
  )
    invalid();
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (
    (Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null) ||
    Reflect.ownKeys(value).length !== keys.length ||
    keys.some(
      (key) => !descriptors[key]?.enumerable || !("value" in descriptors[key]!),
    )
  )
    invalid();
  return value as Record<string, unknown>;
}
export function text(value: unknown, max = 512, empty = false): string {
  if (
    typeof value !== "string" ||
    (!empty && !value.trim()) ||
    value.length > max ||
    /[\uD800-\uDFFF]/u.test(value) ||
    [...value].some((c) => {
      const n = c.charCodeAt(0);
      return (n < 32 && n !== 9 && n !== 10 && n !== 13) || n === 127;
    })
  )
    invalid();
  return value;
}
export function integer(
  value: unknown,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
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
export function literal<T extends string | number | null>(
  value: unknown,
  ...allowed: readonly T[]
): T {
  if (!allowed.includes(value as T)) invalid();
  return value as T;
}
export function array<T>(
  value: unknown,
  parse: (item: unknown) => T,
  max = 50000,
): readonly T[] {
  if (!Array.isArray(value) || value.length > max) invalid();
  return Object.freeze(Array.from(value, parse));
}
export function unique<T>(
  items: readonly T[],
  key: (item: T) => string | number,
): void {
  if (new Set(items.map(key)).size !== items.length) invalid();
}
export function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
/** Stable semantic equality ignores object insertion order, not array order. */
export function semanticJson(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(semanticJson).join(",")}]`;
  return `{${Object.entries(value)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, item]) => `${JSON.stringify(key)}:${semanticJson(item)}`)
    .join(",")}}`;
}

import type { StorageResult } from "../contracts/package.ts";
import type { UserNamespace, UserRecord } from "../contracts/user-data.ts";
import { validateUserRecordPayload } from "../schema/user-record-validation.ts";

export const USER_DATA_MAX_BYTES = 256 * 1024 * 1024;
export const USER_NAMESPACES = [
  "decks",
  "deck-meta",
  "deck-autosaves",
  "story",
  "preferences",
  "story-read-log",
] as const satisfies readonly UserNamespace[];

export interface UserDocument {
  readonly format: "ascencio-user-data-json";
  readonly schemaVersion: 1;
  readonly revision: number;
  readonly records: readonly UserRecord[];
}

export function emptyUserDocument(): UserDocument {
  return {
    format: "ascencio-user-data-json",
    schemaVersion: 1,
    revision: 0,
    records: [],
  };
}

export function isUserNamespace(value: unknown): value is UserNamespace {
  return (
    typeof value === "string" &&
    (USER_NAMESPACES as readonly string[]).includes(value)
  );
}

export function validUserKey(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 256 &&
    !value.includes("\0")
  );
}

export function safeRevision(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

export function payloadRevisionMatches(
  namespace: UserNamespace,
  payload: unknown,
  revision: number,
): boolean {
  if (namespace === "decks") {
    const value = payload as { deck?: { revision?: unknown } } | null;
    return value?.deck?.revision === revision;
  }
  if (namespace === "story")
    return (payload as { revision?: unknown } | null)?.revision === revision;
  return true;
}

export function parseUserDocument(source: string): StorageResult<UserDocument> {
  if (new TextEncoder().encode(source).byteLength > USER_DATA_MAX_BYTES)
    return { kind: "failed", error: { code: "USER_DATA_TOO_LARGE" } };
  try {
    const value: unknown = JSON.parse(source);
    if (
      !object(value) ||
      Object.keys(value).sort().join() !==
        "format,records,revision,schemaVersion" ||
      value.format !== "ascencio-user-data-json" ||
      value.schemaVersion !== 1 ||
      !safeRevision(value.revision) ||
      !Array.isArray(value.records)
    )
      return invalid();
    const keys = new Set<string>();
    for (const record of value.records) {
      if (
        !object(record) ||
        Object.keys(record).sort().join() !==
          "key,namespace,payload,revision" ||
        !isUserNamespace(record.namespace) ||
        !validUserKey(record.key) ||
        !safeRevision(record.revision) ||
        record.revision === 0
      )
        return invalid();
      const payload = validateUserRecordPayload(
        record.namespace,
        record.key,
        record.payload,
      );
      if (payload.kind === "failed") return payload;
      if (
        !payloadRevisionMatches(
          record.namespace,
          record.payload,
          record.revision,
        )
      )
        return invalid();
      const key = JSON.stringify([record.namespace, record.key]);
      if (keys.has(key)) return invalid();
      keys.add(key);
    }
    return { kind: "ok", value: value as unknown as UserDocument };
  } catch {
    return invalid();
  }
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function invalid(): StorageResult<never> {
  return { kind: "failed", error: { code: "USER_DATA_INVALID" } };
}

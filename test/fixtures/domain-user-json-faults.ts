import { JsonUserDataStore } from "../../src/storage/json/user-data-store.ts";
import {
  emptyUserDocument,
  type UserDocument,
} from "../../src/storage/json/user-document.ts";

const STORAGE_KEY = "ascencio:user-data:v1";
const slots = new Set([
  "manual:1",
  "manual:2",
  "manual:3",
  "autosave",
  "checkpoint:pre-duel",
]);
let failDeckWrite = false;

/** Fixed test faults in the same localStorage snapshot used by production repositories. */
export async function fixtureFault(input: unknown): Promise<unknown> {
  if (!input || typeof input !== "object")
    throw new Error("Invalid fixture operation");
  const operation = input as { kind: string; slot: string; value: unknown };
  const source = localStorage.getItem(STORAGE_KEY);
  const document: UserDocument =
    source === null ? emptyUserDocument() : JSON.parse(source);
  if (operation.kind === "snapshot-story") {
    return document.records
      .filter((row) => row.namespace === "story")
      .map((row) => ({
        slot: row.key,
        revision: row.revision,
        payload: JSON.stringify(row.payload),
      }))
      .sort((a, b) => a.slot.localeCompare(b.slot));
  }
  if (operation.kind === "fail-deck-write") {
    failDeckWrite = true;
    return null;
  }
  if (
    (operation.kind === "corrupt-story" || operation.kind === "clear-story") &&
    slots.has(operation.slot)
  ) {
    const records = document.records.filter(
      (row) => row.namespace !== "story" || row.key !== operation.slot,
    );
    if (operation.kind === "corrupt-story") {
      if (typeof operation.value !== "string")
        throw new Error("Fixture corruption must be malformed text");
      records.push({
        namespace: "story",
        key: operation.slot,
        revision: 1,
        payload: operation.value,
      });
    }
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...document, revision: document.revision + 1, records }),
    );
    return null;
  }
  throw new Error("Unknown fixture fault operation");
}

export function openBrowserUserData(): JsonUserDataStore {
  return new JsonUserDataStore({
    read: async () => localStorage.getItem(STORAGE_KEY),
    write: async (source, expected) => {
      if (localStorage.getItem(STORAGE_KEY) !== expected)
        return { kind: "failed", error: { code: "STORAGE_CONFLICT" } };
      const document: UserDocument = JSON.parse(source);
      const previous: UserDocument =
        expected === null ? emptyUserDocument() : JSON.parse(expected);
      if (
        failDeckWrite &&
        JSON.stringify(
          document.records.filter((row) => row.namespace === "decks"),
        ) !==
          JSON.stringify(
            previous.records.filter((row) => row.namespace === "decks"),
          )
      ) {
        failDeckWrite = false;
        return { kind: "failed", error: { code: "STORAGE_UNAVAILABLE" } };
      }
      localStorage.setItem(STORAGE_KEY, source);
      return { kind: "ok", value: undefined };
    },
  });
}

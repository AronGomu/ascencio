import { JsonUserDataStore } from "../../src/storage/json/user-data-store.ts";

/** Existing consumer fixtures exercise the current JSON store through UserDataStore. */
export function sqliteUserRuntime() {
  let source: string | null = null;
  return new JsonUserDataStore({
    read: async () => source,
    write: async (next, expected) => {
      if (source !== expected)
        return { kind: "failed", error: { code: "STORAGE_CONFLICT" } };
      source = next;
      return { kind: "ok", value: undefined };
    },
  });
}

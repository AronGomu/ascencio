import { describe, expect, it, vi } from "vitest";
import { createUserPersistenceOwner } from "../../../src/shell/application/user-persistence-owner.ts";
import type { LocalStorageClient } from "../../../src/storage/index.ts";
import type { UserRecord } from "../../../src/storage/contracts/user-data.ts";
import {
  JsonUserDataStore,
  type UserJsonBackend,
} from "../../../src/storage/json/user-data-store.ts";
import {
  emptyUserDocument,
  parseUserDocument,
} from "../../../src/storage/json/user-document.ts";
import { allUserMutations } from "./user-data-test-records.ts";

async function fixture(deckCount: number, autosaveCount: number) {
  const baseline: UserRecord[] = allUserMutations().flatMap((mutation) =>
    mutation.kind === "put"
      ? [
          {
            namespace: mutation.namespace,
            key: mutation.key,
            revision: 1,
            payload: mutation.payload,
          },
        ]
      : [],
  );
  const records = baseline.filter(
    (record) => !["decks", "deck-autosaves"].includes(record.namespace),
  );
  for (const [namespace, count] of [
    ["decks", deckCount],
    ["deck-autosaves", autosaveCount],
  ] as const) {
    const template = baseline.find((record) => record.namespace === namespace)!;
    for (let index = 0; index < count; index += 1) {
      const key = `${namespace}-${index}`;
      const payload = structuredClone(template.payload) as {
        id: string;
        deck: { id: string };
      };
      if (namespace === "decks") payload.deck.id = key;
      else payload.id = key;
      records.push({ ...template, key, payload });
    }
  }
  let source = JSON.stringify({ ...emptyUserDocument(), revision: 7, records });
  expect(parseUserDocument(source).kind).toBe("ok");
  const backend: UserJsonBackend = {
    read: async () => source,
    write: vi.fn<UserJsonBackend["write"]>(async (next, expected) => {
      if (source !== expected)
        return { kind: "failed", error: { code: "STORAGE_CONFLICT" } };
      source = next;
      return { kind: "ok", value: undefined };
    }),
  };
  const store = new JsonUserDataStore(backend);
  const client = {
    userData: store,
    close: () => store.close(),
  } as unknown as LocalStorageClient;
  const owner = await createUserPersistenceOwner(client);
  expect(owner.failure).toBeNull();
  return { owner, store, backend, records, source: () => source };
}

describe("JSON namespace reset with large libraries", () => {
  it.each([
    [1025, 0],
    [0, 1025],
    [513, 513],
  ])(
    "atomically resets %i decks and %i autosaves while preserving other namespaces",
    async (decks, autosaves) => {
      const f = await fixture(decks, autosaves);
      try {
        expect(await f.owner.reset(["decks", "deck-autosaves"])).toEqual({
          kind: "ok",
          value: undefined,
        });
        expect(f.backend.write).toHaveBeenCalledOnce();
        const reopened = new JsonUserDataStore(f.backend);
        expect(await reopened.listUser("decks")).toEqual({
          kind: "ok",
          value: [],
        });
        expect(await reopened.listUser("deck-autosaves")).toEqual({
          kind: "ok",
          value: [],
        });
        expect(parseUserDocument(f.source())).toEqual({
          kind: "ok",
          value: {
            ...emptyUserDocument(),
            revision: 8,
            records: f.records.filter(
              (record) =>
                !["decks", "deck-autosaves"].includes(record.namespace),
            ),
          },
        });
        await reopened.close();
      } finally {
        await f.owner.close();
      }
    },
  );

  it("preserves the entire snapshot when a large reset's backend write fails", async () => {
    const f = await fixture(513, 513);
    try {
      const before = f.source();
      vi.mocked(f.backend.write).mockResolvedValueOnce({
        kind: "failed",
        error: { code: "STORAGE_QUOTA_EXCEEDED" },
      });
      expect(await f.owner.reset(["decks", "deck-autosaves"])).toEqual({
        kind: "failed",
        error: { code: "STORAGE_QUOTA_EXCEEDED" },
      });
      expect(f.backend.write).toHaveBeenCalledOnce();
      expect(f.source()).toBe(before);
      expect((await f.owner.reset(["decks", "deck-autosaves"])).kind).toBe(
        "ok",
      );
    } finally {
      await f.owner.close();
    }
  });

  it("preserves every record when the final deletion has a stale revision", async () => {
    const f = await fixture(513, 513);
    try {
      const before = f.source();
      const listUser = f.store.listUser.bind(f.store);
      vi.spyOn(f.store, "listUser").mockImplementation(async (namespace) => {
        const result = await listUser(namespace);
        if (namespace !== "deck-autosaves" || result.kind === "failed")
          return result;
        return {
          kind: "ok",
          value: result.value.map((record, index) =>
            index === result.value.length - 1
              ? { ...record, revision: record.revision + 1 }
              : record,
          ),
        };
      });
      expect(await f.owner.reset(["decks", "deck-autosaves"])).toEqual({
        kind: "failed",
        error: { code: "STORAGE_CONFLICT" },
      });
      expect(f.backend.write).not.toHaveBeenCalled();
      expect(f.source()).toBe(before);
    } finally {
      await f.owner.close();
    }
  });
});

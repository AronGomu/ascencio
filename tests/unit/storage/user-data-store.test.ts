import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { describe, expect, it } from "vitest";
import { DEFAULT_SHELL_SETTINGS } from "../../../src/shell/settings/shell-settings.ts";
import { USER_DATA_MAX_PAYLOAD_BYTES } from "../../../src/storage/schema/index.ts";
import { UserDataRuntime } from "../../../src/storage/runtime/user-data-runtime.ts";
import type { RuntimeDatabase } from "../../../src/storage/runtime/runtime-ports.ts";
import {
  createRegistryFixture,
  createUserDataFixture,
} from "./sqlite-fixtures.ts";
import { createNodeFileStore, databaseAdapter } from "./runtime-fixtures.ts";

function runtime(
  options: {
    readonly database?: RuntimeDatabase;
    readonly fault?: (point: string) => void;
  } = {},
) {
  const user = createUserDataFixture();
  const files = createNodeFileStore();
  return {
    user,
    files,
    runtime: new UserDataRuntime({
      database: options.database ?? databaseAdapter(user.database),
      files,
      randomId: () => crypto.randomUUID(),
      ...(options.fault ? { fault: options.fault } : {}),
    }),
  };
}

const shellMutation = (expectedRevision: number | null = null) => ({
  kind: "put" as const,
  namespace: "preferences" as const,
  key: "shell",
  expectedRevision,
  payload: DEFAULT_SHELL_SETTINGS,
});

const readLogMutation = (expectedRevision: number | null = null) => ({
  kind: "put" as const,
  namespace: "story-read-log" as const,
  key: "read",
  expectedRevision,
  payload: { version: 1, beats: ["opening"] },
});

describe("UserDataRuntime records", () => {
  it("writes, reads, lists, deletes, and advances global revision once per batch", async () => {
    const fixture = runtime();
    expect(
      await fixture.runtime.writeUser([shellMutation(), readLogMutation()]),
    ).toMatchObject({
      kind: "ok",
      value: [
        { namespace: "preferences", key: "shell", revision: 1 },
        { namespace: "story-read-log", key: "read", revision: 1 },
      ],
    });
    expect(
      fixture.user.database
        .prepare("SELECT revision FROM user_data_meta WHERE singleton=1")
        .get(),
    ).toEqual({ revision: 1 });
    expect(await fixture.runtime.readUser("preferences", "shell")).toEqual({
      kind: "ok",
      value: {
        namespace: "preferences",
        key: "shell",
        revision: 1,
        payload: DEFAULT_SHELL_SETTINGS,
      },
    });
    expect(await fixture.runtime.listUser("preferences")).toMatchObject({
      kind: "ok",
      value: [{ key: "shell", revision: 1 }],
    });
    expect(
      await fixture.runtime.writeUser([
        {
          ...shellMutation(1),
          payload: { ...DEFAULT_SHELL_SETTINGS, rotationNoticeDismissed: true },
        },
        {
          kind: "delete",
          namespace: "story-read-log",
          key: "read",
          expectedRevision: 1,
        },
      ]),
    ).toMatchObject({
      kind: "ok",
      value: [{ key: "shell", revision: 2 }],
    });
    expect(
      fixture.user.database
        .prepare("SELECT revision FROM user_data_meta WHERE singleton=1")
        .get(),
    ).toEqual({ revision: 2 });
    expect(await fixture.runtime.readUser("story-read-log", "read")).toEqual({
      kind: "ok",
      value: null,
    });
  });

  it("rejects stale and duplicate-key batches without partial writes", async () => {
    const fixture = runtime();
    expect((await fixture.runtime.writeUser([shellMutation()])).kind).toBe(
      "ok",
    );
    expect(
      await fixture.runtime.writeUser([shellMutation(null), readLogMutation()]),
    ).toEqual({ kind: "failed", error: { code: "STORAGE_CONFLICT" } });
    expect(await fixture.runtime.readUser("story-read-log", "read")).toEqual({
      kind: "ok",
      value: null,
    });
    expect(
      await fixture.runtime.writeUser([readLogMutation(), readLogMutation()]),
    ).toEqual({ kind: "failed", error: { code: "USER_DATA_INVALID" } });
    expect(
      fixture.user.database
        .prepare("SELECT revision FROM user_data_meta WHERE singleton=1")
        .get(),
    ).toEqual({ revision: 1 });
  });

  it("validates namespace payloads, UTF-8 row cap, and embedded domain revisions", async () => {
    const fixture = runtime();
    expect(
      await fixture.runtime.writeUser([
        {
          kind: "put",
          namespace: "unknown" as never,
          key: "x",
          expectedRevision: null,
          payload: {},
        },
      ]),
    ).toEqual({ kind: "failed", error: { code: "USER_DATA_INVALID" } });
    expect(
      await fixture.runtime.writeUser([
        {
          kind: "put",
          namespace: "deck-meta",
          key: "lastOpened",
          expectedRevision: null,
          payload: "😀".repeat(USER_DATA_MAX_PAYLOAD_BYTES / 2),
        },
      ]),
    ).toEqual({ kind: "failed", error: { code: "USER_DATA_TOO_LARGE" } });
    const deck = storedDeck(2);
    expect(
      await fixture.runtime.writeUser([
        {
          kind: "put",
          namespace: "decks",
          key: "deck-1",
          expectedRevision: null,
          payload: deck,
        },
      ]),
    ).toEqual({ kind: "failed", error: { code: "USER_DATA_INVALID" } });
  });

  it("rolls back an injected fault and never mutates content registry bytes", async () => {
    let fail = false;
    const user = createUserDataFixture();
    const files = createNodeFileStore();
    const registry = createRegistryFixture();
    const before = bytesToHex(
      sha256(
        (
          registry.database as unknown as { serialize(): Uint8Array }
        ).serialize(),
      ),
    );
    const store = new UserDataRuntime({
      database: databaseAdapter(user.database),
      files,
      randomId: () => "fault",
      fault(point) {
        if (fail && point === "write-after-first") throw new Error("fault");
      },
    });
    expect((await store.writeUser([shellMutation()])).kind).toBe("ok");
    fail = true;
    expect(
      await store.writeUser([
        {
          ...shellMutation(1),
          payload: { ...DEFAULT_SHELL_SETTINGS, rotationNoticeDismissed: true },
        },
        readLogMutation(),
      ]),
    ).toEqual({ kind: "failed", error: { code: "STORAGE_UNAVAILABLE" } });
    expect(await store.readUser("preferences", "shell")).toMatchObject({
      kind: "ok",
      value: { revision: 1, payload: { rotationNoticeDismissed: false } },
    });
    expect(await store.readUser("story-read-log", "read")).toEqual({
      kind: "ok",
      value: null,
    });
    expect(
      bytesToHex(
        sha256(
          (
            registry.database as unknown as { serialize(): Uint8Array }
          ).serialize(),
        ),
      ),
    ).toBe(before);
    registry.database.close();
  });

  it("serializes concurrent CAS writes so only one wins", async () => {
    const fixture = runtime();
    expect((await fixture.runtime.writeUser([shellMutation()])).kind).toBe(
      "ok",
    );
    const results = await Promise.all([
      fixture.runtime.writeUser([
        {
          ...shellMutation(1),
          payload: { ...DEFAULT_SHELL_SETTINGS, rotationNoticeDismissed: true },
        },
      ]),
      fixture.runtime.writeUser([shellMutation(1)]),
    ]);
    expect(results.map((result) => result.kind).sort()).toEqual([
      "failed",
      "ok",
    ]);
    expect(
      fixture.user.database
        .prepare("SELECT revision FROM user_data_meta WHERE singleton=1")
        .get(),
    ).toEqual({ revision: 2 });
  });
});

function storedDeck(revision: number) {
  return {
    deck: {
      schemaVersion: 1,
      id: "deck-1",
      revision,
      name: "Fixture",
      createdAt: "2026-09-24T00:00:00.000Z",
      updatedAt: "2026-09-24T00:00:00.000Z",
      validation: { status: "valid", issues: [], rulesetRevision: "fixture" },
      importedNeedsReview: false,
      illustrationCardCode: null,
      main: [1],
      extra: [],
      side: [],
    },
    history: { undo: [], redo: [], nextSequence: 0 },
  };
}

it("snapshots nested payload and CAS fields at enqueue for put and delete", async () => {
  const fixture = runtime();
  const mutation = {
    kind: "put" as const,
    namespace: "decks" as const,
    key: "deck-1",
    expectedRevision: null as number | null,
    payload: storedDeck(1),
  };
  const original = structuredClone(mutation);
  const pending = fixture.runtime.writeUser([mutation]);
  mutation.payload.deck.revision = 99;
  mutation.payload.deck.main.push(999);
  mutation.key = "changed";
  mutation.expectedRevision = 42;
  const result = await pending;
  expect(result).toEqual({
    kind: "ok",
    value: [
      {
        namespace: original.namespace,
        key: original.key,
        revision: 1,
        payload: original.payload,
      },
    ],
  });
  expect(await fixture.runtime.readUser("decks", "deck-1")).toEqual({
    kind: "ok",
    value: {
      namespace: original.namespace,
      key: original.key,
      revision: 1,
      payload: original.payload,
    },
  });
  const deletion = {
    kind: "delete" as const,
    namespace: "decks" as const,
    key: "deck-1",
    expectedRevision: 1,
  };
  const deleting = fixture.runtime.writeUser([deletion]);
  deletion.key = "changed";
  deletion.expectedRevision = 99;
  expect(await deleting).toEqual({ kind: "ok", value: [] });
  expect(await fixture.runtime.readUser("decks", "deck-1")).toEqual({
    kind: "ok",
    value: null,
  });
});

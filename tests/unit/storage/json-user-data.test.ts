import { afterEach, describe, expect, it, vi } from "vitest";
import {
  JsonUserDataStore,
  type UserJsonBackend,
} from "../../../src/storage/json/user-data-store.ts";
import {
  emptyUserDocument,
  parseUserDocument,
} from "../../../src/storage/json/user-document.ts";
import {
  openBrowserUserData,
  USER_DATA_STORAGE_KEY,
} from "../../../src/storage/json/browser-user-data.ts";
import { openNativeStorage } from "../../../src/storage/native/storage-client.ts";
import { DEFAULT_SHELL_SETTINGS } from "../../../src/shell/settings/index.ts";
import type { StorageResult } from "../../../src/storage/contracts/package.ts";
import type { RestoreOutcomeUnknown } from "../../../src/storage/contracts/user-data.ts";
import { allUserMutations } from "./user-data-test-records.ts";
import { nativeUserJsonBackend } from "../../../src/storage/native/user-json-backend.ts";

const native = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: native.invoke }));

function fixture() {
  let source: string | null = null;
  const backend: UserJsonBackend = {
    read: async () => source,
    write: async (next, expected) => {
      if (source !== expected)
        return { kind: "failed", error: { code: "STORAGE_CONFLICT" } };
      source = next;
      return { kind: "ok", value: undefined };
    },
  };
  return {
    backend,
    store: new JsonUserDataStore(backend),
    source: () => source,
    corrupt: (next: string) => {
      source = next;
    },
  };
}

const preference = (
  revision: number | null = null,
  payload = DEFAULT_SHELL_SETTINGS,
) => ({
  kind: "put" as const,
  namespace: "preferences" as const,
  key: "shell",
  expectedRevision: revision,
  payload,
});
function value<T>(result: StorageResult<T> | RestoreOutcomeUnknown): T {
  expect(result.kind).toBe("ok");
  if (result.kind !== "ok")
    throw new Error(
      result.kind === "failed" ? result.error.code : "RESTORE_OUTCOME_UNKNOWN",
    );
  return result.value;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("JSON user persistence", () => {
  it("round-trips full decks, autosaves and structurally valid story saves", async () => {
    const f = fixture();
    const input = allUserMutations();
    value(await f.store.writeUser(input));
    const backup = value(await f.store.exportUserData());
    const reopened = new JsonUserDataStore(f.backend);
    for (const mutation of input) {
      if (mutation.kind !== "put") continue;
      expect(
        value(await reopened.readUser(mutation.namespace, mutation.key)),
      ).toMatchObject({ payload: mutation.payload });
    }
    const target = fixture();
    const preview = value(
      await target.store.inspectUserDataBackup(
        new File([backup], "user-data.json"),
      ),
    );
    value(
      await target.store.restoreUserData(
        preview.token,
        preview.currentRevision,
        true,
      ),
    );
    expect(value(await target.store.listUser("story"))).toHaveLength(1);
    expect(value(await target.store.listUser("decks"))).toHaveLength(1);
  });

  it("recognizes a completed native write when its reply is lost", async () => {
    let saved: string | null = null;
    native.invoke.mockImplementation(
      async (command: string, args?: { source: string }) => {
        if (command === "native_user_json_write" && args) {
          saved = args.source;
          throw new Error("lost reply");
        }
        if (command === "native_user_json_read") return saved;
        throw new Error(command);
      },
    );
    const store = new JsonUserDataStore(nativeUserJsonBackend());
    value(await store.writeUser([preference()]));
    expect(value(await store.readUser("preferences", "shell"))).toMatchObject({
      payload: DEFAULT_SHELL_SETTINGS,
    });
  });

  it("blocks further saves if a native restore outcome cannot be established", async () => {
    const f = fixture();
    value(await f.store.writeUser([preference()]));
    const preview = value(
      await f.store.inspectUserDataBackup(
        new File([JSON.stringify(emptyUserDocument())], "empty.json"),
      ),
    );
    f.backend.write = async () => {
      const error = new Error("unknown");
      error.name = "UserWriteOutcomeUnknown";
      throw error;
    };
    expect(
      await f.store.restoreUserData(
        preview.token,
        preview.currentRevision,
        true,
      ),
    ).toEqual({ kind: "restore-outcome-unknown" });
    expect(await f.store.writeUser([preference(1)])).toMatchObject({
      kind: "failed",
      error: { code: "STORAGE_UNAVAILABLE" },
    });
  });
  it("persists preferences, decks and story-read logs together and reopens them", async () => {
    const f = fixture();
    value(
      await f.store.writeUser([
        preference(),
        {
          kind: "put",
          namespace: "deck-meta",
          key: "defaultDeck",
          expectedRevision: null,
          payload: "deck-1",
        },
        {
          kind: "put",
          namespace: "story-read-log",
          key: "read",
          expectedRevision: null,
          payload: { version: 1, beats: ["beat-1"] },
        },
      ]),
    );
    const reopened = new JsonUserDataStore(f.backend);
    expect(
      value(await reopened.readUser("preferences", "shell")),
    ).toMatchObject({ revision: 1, payload: DEFAULT_SHELL_SETTINGS });
    expect(value(await reopened.listUser("deck-meta"))).toHaveLength(1);
    expect(value(parseUserDocument(f.source()!)).revision).toBe(1);
  });

  it("keeps the whole prior snapshot when any mutation conflicts or fails validation", async () => {
    const f = fixture();
    value(await f.store.writeUser([preference()]));
    const before = f.source();
    expect(
      await f.store.writeUser([
        {
          kind: "put",
          namespace: "deck-meta",
          key: "defaultDeck",
          expectedRevision: null,
          payload: "new",
        },
        preference(),
      ]),
    ).toMatchObject({ kind: "failed", error: { code: "STORAGE_CONFLICT" } });
    expect(f.source()).toBe(before);
    expect(
      await f.store.writeUser([{ ...preference(1), payload: {} }]),
    ).toMatchObject({ kind: "failed", error: { code: "USER_DATA_INVALID" } });
    expect(f.source()).toBe(before);
  });

  it("exports JSON and restores every namespace only after an unchanged preview", async () => {
    const f = fixture();
    value(await f.store.writeUser([preference()]));
    const exported = value(await f.store.exportUserData());
    expect(exported.type).toBe("application/json");
    const backup = new File([exported], "backup.json");
    const preview = value(await f.store.inspectUserDataBackup(backup));
    expect(preview.counts.preferences).toBe(1);
    value(
      await f.store.writeUser([
        {
          kind: "delete",
          namespace: "preferences",
          key: "shell",
          expectedRevision: 1,
        },
      ]),
    );
    expect(
      await f.store.restoreUserData(
        preview.token,
        preview.currentRevision,
        true,
      ),
    ).toMatchObject({ kind: "failed", error: { code: "STORAGE_CONFLICT" } });
    const fresh = value(await f.store.inspectUserDataBackup(backup));
    value(
      await f.store.restoreUserData(fresh.token, fresh.currentRevision, true),
    );
    expect(value(await f.store.readUser("preferences", "shell"))).toMatchObject(
      { payload: DEFAULT_SHELL_SETTINGS },
    );
    expect(
      await f.store.restoreUserData(fresh.token, fresh.currentRevision, true),
    ).toMatchObject({ kind: "failed", error: { code: "STORAGE_CONFLICT" } });
  });

  it.each([
    "{}",
    "not JSON",
    "SQLite format 3\0",
    JSON.stringify({ ...emptyUserDocument(), schemaVersion: 2 }),
  ])(
    "rejects malformed backup without replacing live data: %s",
    async (source) => {
      const f = fixture();
      value(await f.store.writeUser([preference()]));
      const before = f.source();
      expect(
        await f.store.inspectUserDataBackup(new File([source], "backup.json")),
      ).toMatchObject({ kind: "failed", error: { code: "USER_DATA_INVALID" } });
      expect(f.source()).toBe(before);
    },
  );

  it("preserves corrupt live data instead of resetting it", async () => {
    const f = fixture();
    f.corrupt("damaged save");
    expect(await f.store.writeUser([preference()])).toMatchObject({
      kind: "failed",
      error: { code: "USER_DATA_INVALID" },
    });
    expect(f.source()).toBe("damaged save");
  });

  it("returns a quota failure without changing the saved snapshot", async () => {
    const f = fixture();
    value(await f.store.writeUser([preference()]));
    const before = f.source();
    f.backend.write = async () => {
      throw new DOMException("full", "QuotaExceededError");
    };
    expect(await f.store.writeUser([preference(1)])).toMatchObject({
      kind: "failed",
      error: { code: "STORAGE_QUOTA_EXCEEDED" },
    });
    expect(f.source()).toBe(before);
  });

  it("drains an accepted write on close and rejects subsequent writes", async () => {
    const f = fixture();
    const saved = f.store.writeUser([preference()]);
    await f.store.close();
    value(await saved);
    expect(f.source()).not.toBeNull();
    expect(await f.store.writeUser([preference(1)])).toMatchObject({
      kind: "failed",
      error: { code: "STORAGE_UNAVAILABLE" },
    });
  });

  it("uses one dedicated localStorage key and preserves unrelated legacy keys", async () => {
    const storage = new Map<string, string>([["legacy", "keep"]]);
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, source: string) => storage.set(key, source),
    });
    value(await openBrowserUserData().writeUser([preference()]));
    expect(storage.has(USER_DATA_STORAGE_KEY)).toBe(true);
    expect(storage.get("legacy")).toBe("keep");
    expect(
      value(await openBrowserUserData().readUser("preferences", "shell")),
    ).toMatchObject({ payload: DEFAULT_SHELL_SETTINGS });
  });

  it("native client saves JSON through file commands without SQLite user commands", async () => {
    const f = fixture();
    native.invoke.mockImplementation(
      async (
        command: string,
        args?: { source: string; expected: string | null },
      ) => {
        if (command === "native_package_stack")
          return {
            kind: "ok",
            value: {
              generation: 0,
              packages: [],
              readiness: { duel: false, story: false },
            },
          };
        if (command === "native_user_json_read") return f.backend.read();
        if (command === "native_user_json_write" && args)
          return f.backend.write(args.source, args.expected);
        throw new Error(command);
      },
    );
    const client = value(await openNativeStorage());
    value(await client.userData.writeUser([preference()]));
    expect(value(await client.userData.exportUserData()).type).toBe(
      "application/json",
    );
    expect(
      native.invoke.mock.calls.every(
        ([command]) =>
          ![
            "native_user_read",
            "native_user_write",
            "native_user_export",
          ].includes(command),
      ),
    ).toBe(true);
    await client.close();
  });
});

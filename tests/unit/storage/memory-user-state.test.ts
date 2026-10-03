import { describe, expect, it, vi } from "vitest";
import { JsonUserDataStore } from "../../../src/storage/json/user-data-store.ts";
import { DEFAULT_SHELL_SETTINGS } from "../../../src/shell/settings/index.ts";

describe("application lifetime user state", () => {
  it("reads once and ignores external edits after initialization", async () => {
    let disk: string | null = null;
    const read = vi.fn(async () => disk);
    const store = new JsonUserDataStore({
      read,
      write: async (source) => {
        disk = source;
        return { kind: "ok", value: undefined };
      },
    });
    expect(await store.initialize()).toMatchObject({ kind: "ok" });
    await store.writeUser([
      {
        kind: "put",
        namespace: "preferences",
        key: "shell",
        expectedRevision: null,
        payload: DEFAULT_SHELL_SETTINGS,
      },
    ]);
    disk = "externally corrupted";
    expect(await store.readUser("preferences", "shell")).toMatchObject({
      kind: "ok",
      value: { revision: 1 },
    });
    expect((await store.exportUserData()).kind).toBe("ok");
    expect((await store.listUser("preferences")).kind).toBe("ok");
    expect(read).toHaveBeenCalledTimes(1);
  });
  it("retains dirty bytes for retry without calling read", async () => {
    const read = vi.fn(async () => null);
    let fail = true;
    const write = vi.fn(async () =>
      fail
        ? {
            kind: "failed" as const,
            error: { code: "STORAGE_UNAVAILABLE" as const },
          }
        : { kind: "ok" as const, value: undefined },
    );
    const store = new JsonUserDataStore({ read, write });
    await store.initialize();
    expect(
      (
        await store.writeUser([
          {
            kind: "put",
            namespace: "preferences",
            key: "shell",
            expectedRevision: null,
            payload: DEFAULT_SHELL_SETTINGS,
          },
        ])
      ).kind,
    ).toBe("failed");
    expect(store.persistence).toEqual({
      acceptedRevision: 1,
      persistedRevision: 0,
      dirty: true,
      uncertain: false,
    });
    expect(await store.readUser("preferences", "shell")).toMatchObject({
      kind: "ok",
      value: { revision: 1 },
    });
    fail = false;
    expect((await store.flush()).kind).toBe("ok");
    expect(write.mock.calls[0]).toEqual(write.mock.calls[1]);
    expect(read).toHaveBeenCalledTimes(1);
    expect(store.persistence.dirty).toBe(false);
  });
});

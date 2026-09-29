import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { deleteDB, openDB } from "idb";
import { validateFrozenBattleExecutable } from "../../src/battle/ports/index.ts";
import { SnapshotStore } from "../../src/battle/storage/snapshot-store.ts";

afterEach(async () => {
  await deleteDB("ygo-story-duel");
});

describe("frozen executable and retained Battle diagnostics", () => {
  it("compiled pin equals untouched frozen vendor bytes", async () => {
    await expect(
      validateFrozenBattleExecutable(
        await readFile("vendor/ocgcore-wasm/0.1.2/vendor-manifest.json"),
        await readFile("vendor/ocgcore-wasm/0.1.2/lib/ocgcore.sync.wasm"),
      ),
    ).resolves.toBeUndefined();
  });
  it("Battle DB upgrade preserves legacy records without receipt storage", async () => {
    const old = await openDB("ygo-story-duel", 2, {
      upgrade(db) {
        db.createObjectStore("snapshots", { keyPath: "snapshotId" });
        db.createObjectStore("pointers", { keyPath: "name" });
        db.createObjectStore("preferences", { keyPath: "key" });
        db.createObjectStore("debugRuns", { keyPath: "id" });
      },
    });
    const legacy = { snapshotId: "legacy", arbitrary: "preserved" };
    await old.put("snapshots", legacy);
    old.close();
    const store = await SnapshotStore.open();
    store.close();
    const db = await openDB("ygo-story-duel");
    try {
      expect(db.version).toBe(3);
      expect([...db.objectStoreNames].sort()).toEqual([
        "debugRuns",
        "pointers",
        "preferences",
        "snapshots",
      ]);
      expect(await db.get("snapshots", "legacy")).toEqual(legacy);
    } finally {
      db.close();
    }
  });
});

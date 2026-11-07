import { selectStoryModule } from "../../../src/shell/application/story-module-selection.ts";
import type {
  LocalStorageClient,
  PackageStack,
} from "../../../src/storage/index.ts";
import { expect, it } from "vitest";
import { JsonUserDataStore } from "../../../src/storage/json/user-data-store.ts";
import {
  createSqliteStoryRepository,
  parseStoredStoryEnvelope,
} from "../../../src/story/saves/index.ts";
import { createInitialStoryState } from "../../../src/story/model/story-state.ts";
import { storyBindingFixture } from "../../fixtures/story-release.ts";
it("binds saves to admitted mods, preserves visited graph beats and refuses a changed composition", async () => {
  const store = new JsonUserDataStore({
    read: async () => null,
    write: async () => ({ kind: "ok", value: undefined }),
  });
  const composition = {
    identity: "a".repeat(64),
    requiredMods: [{ id: "custom", version: "1.0.0", sha256: "b".repeat(64) }],
  };
  const saves = createSqliteStoryRepository(store, composition);
  const state = {
    ...createInitialStoryState(),
    visitedBeatIds: ["entry", "chosen"],
  };
  expect(
    (await saves.write("manual:1", state, null, storyBindingFixture())).kind,
  ).toBe("written");
  const read = await saves.read("manual:1");
  expect(read.kind).toBe("ready");
  if (read.kind !== "ready") throw new Error("Fixture save unavailable");
  expect(read.envelope.state.visitedBeatIds).toEqual(["entry", "chosen"]);
  expect(parseStoredStoryEnvelope("manual:1", read.envelope).kind).toBe(
    "ready",
  );
  expect(
    await createSqliteStoryRepository(store).read("manual:1"),
  ).toMatchObject({ kind: "incompatible", reason: "content-composition" });
  expect(
    await createSqliteStoryRepository(store, {
      ...composition,
      identity: "c".repeat(64),
    }).read("manual:1"),
  ).toMatchObject({ kind: "incompatible", reason: "content-composition" });
  const storage = {
    userData: store,
    composition,
    content: {
      query: async () => ({ kind: "ok", value: { chapterNumber: 1 } }),
    },
  } as unknown as LocalStorageClient;
  const stack = {
    packages: [
      {
        packageId: "chapter-01",
        packageType: "chapter",
        version: "1.1.0",
        schemaVersion: 1,
        createdAt: "2026-10-01T00:00:00.000Z",
        dependencies: [
          { packageId: "freeplay", requirement: "exact", version: "1.1.0" },
        ],
        fileKey: "fixture",
        bytes: 1,
        sha256: "a".repeat(64),
      },
    ],
    generation: 1,
  } as PackageStack;
  expect(
    await selectStoryModule(
      storage,
      stack,
      { intent: "continue" },
      new AbortController().signal,
    ),
  ).toMatchObject({ chapterId: "chapter-01" });
  await store.close();
});

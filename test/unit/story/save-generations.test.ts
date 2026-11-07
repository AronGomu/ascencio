import { afterEach, expect, it, vi } from "vitest";
import { createInitialStoryState } from "../../../src/story/model/story-state.ts";
import {
  parseStoredStoryEnvelope,
  STORY_SLOT_KEYS,
} from "../../../src/story/saves/index.ts";
import { storyBindingFixture } from "../../fixtures/story-release.ts";
import { storyDeckFixture } from "../../fixtures/story-decks.ts";
import {
  createStorySaveRepository,
  resetStorySessionFixture,
  storyUserRuntime,
} from "../../fixtures/story-session.ts";

afterEach(async () => {
  await resetStorySessionFixture();
  vi.restoreAllMocks();
});
const sparsePaths = [
  "story.completedChapterIds",
  "state.locations",
  "state.decks",
  "state.openedCards",
  "state.decks.0.main",
  "state.decks.0.extra",
  "state.decks.0.side",
  "state.decks.0.validation.issues",
];
function sparseEnvelope(path: string) {
  const envelope = {
    schemaVersion: 6 as const,
    slot: "autosave" as const,
    revision: 1,
    savedAt: 1234,
    state: {
      ...createInitialStoryState(),
      decks: [storyDeckFixture("preserved")],
    },
    story: storyBindingFixture(),
  };
  const cloned = structuredClone(envelope);
  const keys = path.split(".");
  let parent = cloned as unknown as Record<string, unknown>;
  for (const key of keys.slice(0, -1))
    parent = parent[key] as Record<string, unknown>;
  const key = keys.at(-1)!;
  const values = (parent[key] ?? []) as unknown[];
  values.length += 1;
  parent[key] = values;
  return cloned;
}

it.each(sparsePaths)("schema6 rejects sparse %s at parse entry", (path) => {
  expect(
    parseStoredStoryEnvelope("autosave", sparseEnvelope(path)),
  ).toMatchObject({ kind: "corrupt", slot: "autosave" });
});
it.each(sparsePaths)(
  "sparse %s write returns typed failure without mutation",
  async (path) => {
    const key = {};
    const repo = createStorySaveRepository(key);
    expect(await repo.write("autosave", createInitialStoryState(), 0)).toEqual({
      kind: "written",
      revision: 1,
    });
    const before = await storyUserRuntime(key).listUser("story");
    const envelope = sparseEnvelope(path);
    expect(
      await repo.write("autosave", envelope.state, 1, envelope.story),
    ).toEqual({ kind: "failed", reason: "unknown" });
    expect(await storyUserRuntime(key).listUser("story")).toEqual(before);
  },
);
it("all five SQLite slots preserve economy, decks and checkpoint without generation migration", async () => {
  const key = {},
    repo = createStorySaveRepository(key);
  for (const slot of STORY_SLOT_KEYS) {
    const state = {
      ...createInitialStoryState(),
      narrativeIndex: 8,
      dp: 123,
      boosters: { "installed-set": 2 },
      decks: [storyDeckFixture("preserved")],
      pendingHandoffId: slot === "checkpoint:pre-duel" ? "handoff" : null,
    };
    expect(await repo.write(slot, state, 0)).toEqual({
      kind: "written",
      revision: 1,
    });
    expect(await repo.read(slot)).toMatchObject({
      kind: "ready",
      envelope: { slot, revision: 1, state },
    });
  }
  expect(await repo.list()).toHaveLength(5);
});
it("CAS: competing stale write never overwrites SQLite source", async () => {
  const repo = createStorySaveRepository({});
  const results = await Promise.all([
    repo.write("autosave", createInitialStoryState(), 0),
    repo.write("autosave", { ...createInitialStoryState(), dp: 123 }, 0),
  ]);
  expect(results).toEqual([
    { kind: "written", revision: 1 },
    { kind: "stale", currentRevision: 1 },
  ]);
  expect(await repo.read("autosave")).toMatchObject({
    kind: "ready",
    envelope: { state: { dp: 1000 } },
  });
});
it("snapshots write inputs before awaits", async () => {
  const repo = createStorySaveRepository({}),
    state = createInitialStoryState();
  const pending = repo.write("autosave", state, 0);
  Object.assign(state, { dp: 123 });
  expect(await pending).toEqual({ kind: "written", revision: 1 });
  expect(await repo.read("autosave")).toMatchObject({
    kind: "ready",
    envelope: { state: { dp: 1000 } },
  });
});
it.each([1, 2, 3, 4, 5])(
  "schema%s is incompatible without legacy grant",
  (schemaVersion) => {
    expect(parseStoredStoryEnvelope("autosave", { schemaVersion })).toEqual({
      kind: "incompatible",
      slot: "autosave",
      found: schemaVersion,
    });
  },
);
it("list I/O failure rejects rather than pretending no saves", async () => {
  const key = {},
    repo = createStorySaveRepository(key);
  await storyUserRuntime(key).close();
  await expect(repo.list()).rejects.toThrow("STORAGE_UNAVAILABLE");
});

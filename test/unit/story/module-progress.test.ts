// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  DEFAULT_CHAPTER_MODULE,
  isChapterModule,
  progressSatisfied,
  readFact,
  type ChapterModule,
} from "../../../src/modules/index.ts";
import {
  recordCampaignProgress,
  campaignProgress,
} from "../../../src/story/saves/campaign-progress.ts";
import {
  chapterTransition,
  createSqliteStoryRepository,
} from "../../../src/story/saves/index.ts";
import { createInitialStoryState } from "../../../src/story/model/story-state.ts";
import { resolveSavedBeat } from "../../../src/story/model/restore-module-story.ts";
import { parseStoryDocument } from "../../../src/story/ports/story-document.ts";
import {
  storyReleaseFixture,
  storyBindingFixture,
} from "../../fixtures/story-release.ts";
import { storyDeckFixture } from "../../fixtures/story-decks.ts";
import { JsonUserDataStore } from "../../../src/storage/json/user-data-store.ts";
import { selectStoryModule } from "../../../src/shell/application/story-module-selection.ts";
import type {
  LocalStorageClient,
  PackageStack,
  ChapterConfig,
} from "../../../src/storage/index.ts";

function storageFixture() {
  let source: string | null = null;
  const store = new JsonUserDataStore({
    read: async () => source,
    write: async (next, expected) => {
      if (expected !== source)
        return { kind: "failed", error: { code: "STORAGE_CONFLICT" } };
      source = next;
      return { kind: "ok", value: undefined };
    },
  });
  return {
    store,
    source: () => source,
    saves: createSqliteStoryRepository(store),
  };
}
const nextModule: ChapterModule = {
  ...DEFAULT_CHAPTER_MODULE,
  requiresProgress: [
    { kind: "chapter-completed", chapterId: "chapter-01" },
    { kind: "fact", id: "chapter-01:choice", equals: "trust-rin" },
  ],
};
describe("campaign progress across removable chapters", () => {
  it("records choices and outcomes, completes a declared objective, and preserves unknown module facts", () => {
    const state = {
      ...createInitialStoryState(),
      choice: "custom-choice",
      encounterId: "old-arena" as const,
      outcome: "win" as const,
    };
    const module: ChapterModule = {
      ...DEFAULT_CHAPTER_MODULE,
      completion: [
        { kind: "fact", id: "chapter-01:duel:old-arena:result", equals: "win" },
      ],
    };
    const result = recordCampaignProgress(
      { ...storyBindingFixture(), facts: { "future-module:opaque": 42 } },
      state,
      module,
      "stable-scene",
    );
    expect(result.completedChapterIds).toContain("chapter-01");
    expect(result.facts).toMatchObject({
      "chapter-01:choice": "custom-choice",
      "chapter-01:duel:old-arena:result": "win",
      "future-module:opaque": 42,
    });
    expect(
      recordCampaignProgress(result, state, module).completedChapterIds,
    ).toEqual(result.completedChapterIds);
    expect(readFact(campaignProgress(result), "absent:value", false)).toBe(
      false,
    );
  });
  it("does not treat an absent fact as a null fact or accept unsupported module APIs", () => {
    expect(
      progressSatisfied(
        { schemaVersion: 1, completedChapterIds: [], facts: {} },
        [{ kind: "fact", id: "module:value", equals: null }],
      ),
    ).toBe(false);
    expect(isChapterModule({ ...nextModule, apiVersion: 2 })).toBe(false);
    expect(
      isChapterModule({
        ...nextModule,
        requiresProgress: [{ kind: "fact", id: "unnamespaced", equals: true }],
      }),
    ).toBe(false);
  });
  it("round-trips new content IDs, authored choices and future facts in JSON saves and backups", async () => {
    const f = storageFixture();
    const binding = {
      ...storyBindingFixture(),
      contentId: "chapter02-document",
      factsSchemaVersion: 1 as const,
      facts: { "future:flag": true },
      beatId: "stable-beat",
    };
    const state = {
      ...createInitialStoryState(),
      choice: "chapter02-new-choice",
    };
    expect(await f.saves.write("autosave", state, null, binding)).toEqual({
      kind: "written",
      revision: 1,
    });
    const read = await f.saves.read("autosave");
    expect(read).toMatchObject({
      kind: "ready",
      envelope: { state: { choice: "chapter02-new-choice" }, story: binding },
    });
    const backup = await f.store.exportUserData();
    expect(backup.kind).toBe("ok");
    if (backup.kind !== "ok") throw new Error(backup.error.code);
    const restored = storageFixture();
    const preview = await restored.store.inspectUserDataBackup(
      new File([backup.value], "save.json"),
    );
    expect(preview.kind).toBe("ok");
    if (preview.kind !== "ok") throw new Error(preview.error.code);
    expect(
      await restored.store.restoreUserData(
        preview.value.token,
        preview.value.currentRevision,
        true,
      ),
    ).toMatchObject({ kind: "ok" });
    expect(await restored.saves.read("autosave")).toEqual(read);
  });
  it("continues to chapter 02 from saved facts while chapter 01 is absent, without modifying the save", async () => {
    const f = storageFixture();
    const state = {
      ...createInitialStoryState(),
      dp: 777,
      boosters: { "previous-set": 2 },
      collection: { 123: 3 },
      decks: [storyDeckFixture("saved-deck")],
      defaultDeckId: "saved-deck",
    };
    const binding = {
      ...storyBindingFixture(),
      completedChapterIds: ["chapter-01"],
      facts: { "chapter-01:choice": "trust-rin", "future:flag": true },
    };
    await f.saves.write("autosave", state, null, binding);
    const before = f.source();
    const config: ChapterConfig = {
      title: "Next",
      chapterNumber: 2,
      storyContentId: "next-story",
      defaults: { starterDeckId: "starter", opponentId: "opponent" },
      setIds: [],
      mapAssetPath: null,
      module: nextModule,
    };
    const storage = {
      userData: f.store,
      content: { query: async () => ({ kind: "ok", value: config }) },
    } as unknown as LocalStorageClient;
    const stack = {
      generation: 7,
      packages: [{ packageId: "chapter-02", packageType: "chapter" }],
    } as unknown as PackageStack;
    const selected = await selectStoryModule(
      storage,
      stack,
      { intent: "continue" },
      new AbortController().signal,
    );
    expect(selected).toMatchObject({
      chapterId: "chapter-02",
      advancing: true,
    });
    expect(f.source()).toBe(before);
    const release = storyReleaseFixture(7);
    const chapter = release.chapters[0]!;
    const transition = chapterTransition(selected.previous!, {
      revision: 7,
      chapters: [
        {
          ...chapter,
          id: "chapter-02",
          document: { ...chapter.document!, contentId: "next-story" },
        },
      ],
    });
    expect(transition.state).toMatchObject({
      screen: "narrative",
      dp: 777,
      boosters: state.boosters,
      collection: state.collection,
      decks: state.decks,
      defaultDeckId: "saved-deck",
    });
    expect(transition.story).toMatchObject({
      chapterId: "chapter-02",
      contentId: "next-story",
      facts: binding.facts,
      completedChapterIds: ["chapter-01"],
    });
    await expect(
      selectStoryModule(
        storage,
        stack,
        { intent: "new" },
        new AbortController().signal,
      ),
    ).rejects.toThrow("STORY_MODULE_UNAVAILABLE");
  });
  it("resumes a stable scene after reordering and refuses a deleted scene without changing the save", () => {
    const document = storyReleaseFixture().chapters[0]!.document!;
    const reordered = { ...document, beats: [...document.beats].reverse() };
    const binding = { ...storyBindingFixture(), beatId: document.beats[0]!.id };
    const state = createInitialStoryState();
    expect(resolveSavedBeat(state, binding, reordered)).toBe(
      reordered.beats.length - 1,
    );
    expect(() =>
      resolveSavedBeat(
        state,
        { ...binding, beatId: "missing-scene" },
        document,
      ),
    ).toThrow("saved scene is unavailable");
    expect(resolveSavedBeat(state, storyBindingFixture(), document)).toBe(
      state.narrativeIndex,
    );
  });
  it("accepts a chapter's authored choices and rejects mismatched response maps", () => {
    const original = storyReleaseFixture().chapters[0]!.document!;
    const document = {
      ...original,
      contentId: "chapter02-story",
      choices: [{ id: "chapter02-choice", label: "Investigate" }],
      choiceResponses: { "chapter02-choice": "A new response" },
      laterAcknowledgments: { "chapter02-choice": "Remembered" },
    };
    expect(parseStoryDocument(document)).toEqual(document);
    expect(() =>
      parseStoryDocument({ ...document, choiceResponses: {} }),
    ).toThrow();
  });
});

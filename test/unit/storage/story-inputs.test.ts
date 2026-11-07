// @vitest-environment node
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { cardCode } from "../../../src/cards/index.ts";
import {
  closeStoryInputs,
  loadStoryInputs,
} from "../../../src/shell/adapters/sqlite-story-inputs.ts";
import { runtimeSnapshotId } from "../../../src/shell/adapters/sqlite-battle-runtime.ts";
import { buildInstalledStarterGrant } from "../../../src/story/decks/starter-grant.ts";
import { createInitialStoryState } from "../../../src/story/model/story-state.ts";
import { reduceStory } from "../../../src/story/model/story-reducer.ts";
import type {
  ContentQueries,
  ContentQuery,
  QueryMap,
  StorageResult,
} from "../../../src/storage/index.ts";
import {
  createStoryInputsHarness,
  type StoryInputsHarness,
} from "../../fixtures/sqlite/story-inputs-runtime.ts";

let harness: StoryInputsHarness;
let releaseSession: Awaited<
  ReturnType<StoryInputsHarness["storage"]["packages"]["acquireSession"]>
>;

beforeAll(async () => {
  harness = await createStoryInputsHarness();
  releaseSession = await harness.storage.packages.acquireSession();
  expect(releaseSession.kind).toBe("ok");
}, 120_000);

afterEach(() => vi.restoreAllMocks());

afterAll(async () => {
  if (releaseSession.kind === "ok") await releaseSession.value.release();
  await harness.close();
});

describe("loadStoryInputs", () => {
  it("loads exact chapter semantics from real SQLite without reading or rewriting saved Story rows", async () => {
    const oldPayload = JSON.stringify({
      schemaVersion: 6,
      slot: "manual:1",
      revision: 1,
      savedAt: 1_800_000_000_000,
      state: {
        ...createInitialStoryState(),
        narrativeIndex: 999,
        choice: "removed-choice",
        encounterId: "removed-opponent",
        locations: [
          { id: "removed-location", access: "available", completed: true },
        ],
      },
      story: {
        chapterId: "removed-chapter",
        contentId: "removed-content",
        revision: 97,
        completedChapterIds: ["removed-completed-chapter"],
      },
    });
    harness.userDatabase
      .prepare("INSERT INTO user_records VALUES ('story', 'manual:1', 1, ?)")
      .run(oldPayload);
    const before = harness.userDatabase
      .prepare(
        "SELECT revision, payload_json FROM user_records WHERE namespace='story' AND record_key='manual:1'",
      )
      .get();
    harness.queries.length = 0;
    harness.userReads.count = 0;

    const inputs = await loadStoryInputs(
      harness.storage,
      harness.users,
      "chapter-01",
      new AbortController().signal,
    );
    try {
      expect(inputs.users).toBe(harness.users);
      expect(inputs.cards.all()).toHaveLength(20);
      expect(inputs.cards.get(cardCode(18))?.name).toBe("Global Card 18");
      expect(inputs.gameplay.editor().cards).toBe(inputs.cards);
      expect(inputs.release).toMatchObject({
        revision: harness.generation,
        chapters: [
          {
            id: "chapter-01",
            document: { contentId: "prototype-prologue-v1" },
            defaults: { starterDeckId: "starter", opponentId: "opponent" },
            sets: [{ id: "fixture-set", releaseYear: 2002 }],
            decks: [{ id: "starter" }],
            opponents: [{ id: "opponent", policyId: "basic" }],
          },
        ],
      });
      expect(inputs.release.chapters[0]!.cardCodes).toEqual([
        ...Array.from({ length: 14 }, (_, index) => index + 1),
        17,
        18,
      ]);
      expect(inputs.gameplay.presentation.defaults).toEqual(
        inputs.release.chapters[0]!.defaults,
      );
      expect(inputs.gameplay.sets).toEqual(inputs.release.chapters[0]!.sets);
      const fresh = reduceStory(createInitialStoryState(), {
        type: "new-game",
        starterGrant: buildInstalledStarterGrant(
          inputs.release.chapters[0]!,
          inputs.gameplay.editor().ruleset,
        ),
      });
      expect(fresh.decks).toHaveLength(1);
      expect(fresh.decks[0]?.name).toBe("Starter");
      expect(harness.userReads.count).toBe(0);
      expect(
        harness.queries.some(
          ({ kind }) =>
            kind === "asset" || kind === "set-image" || kind === "scripts",
        ),
      ).toBe(false);
      expect(
        harness.queries.some(
          (request) =>
            "packageId" in request && request.packageId === "freeplay",
        ),
      ).toBe(false);
      expect(
        harness.userDatabase
          .prepare(
            "SELECT revision, payload_json FROM user_records WHERE namespace='story' AND record_key='manual:1'",
          )
          .get(),
      ).toEqual(before);
    } finally {
      closeStoryInputs(inputs);
      closeStoryInputs(inputs);
    }
  });

  it("builds chapter-scoped runtime identity, limits, alias closure, and unsupported-code defense", async () => {
    const inputs = await loadStoryInputs(
      harness.storage,
      harness.users,
      "chapter-01",
      new AbortController().signal,
    );
    try {
      const runtime = await inputs.gameplay.battle.load(
        new AbortController().signal,
      );
      const stack = await harness.storage.packages.current();
      expect(stack.kind).toBe("ok");
      expect(runtime.snapshotId).toBe(
        runtimeSnapshotId(
          stack.kind === "ok" ? stack.value.packages : [],
          "chapter-01",
        ),
      );
      expect(runtime.ruleset).toMatchObject({ id: "chapter-01" });
      expect(new Map(runtime.ruleset.quantityByCode).get(cardCode(1))).toBe(1);
      expect(new Map(runtime.ruleset.quantityByCode).has(cardCode(2))).toBe(
        false,
      );
      expect(
        runtime.cards.find(({ code }) => code === cardCode(2))?.alias,
      ).toBe(cardCode(1));
      expect(runtime.scripts.some(({ name }) => name === "c2.lua")).toBe(true);
      expect(new Set(runtime.allowedCardCodes)).toEqual(
        new Set([
          ...Array.from({ length: 14 }, (_, index) => index + 1),
          17,
          18,
        ]),
      );
      expect(runtime.cards.map(({ code }) => code)).toEqual(
        Array.from({ length: 20 }, (_, index) => index + 1),
      );
    } finally {
      inputs.close();
    }
  }, 120_000);

  it("keeps chapter and set media lazy, preserves MIME, and revokes leases on cleanup", async () => {
    const created: Blob[] = [];
    const revoked: string[] = [];
    vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
      created.push(blob as Blob);
      return `blob:story-${created.length}`;
    });
    vi.spyOn(URL, "revokeObjectURL").mockImplementation((url) => {
      revoked.push(url);
    });
    harness.queries.length = 0;
    const inputs = await loadStoryInputs(
      harness.storage,
      harness.users,
      "chapter-01",
      new AbortController().signal,
    );
    expect(
      harness.queries.some(
        ({ kind }) => kind === "asset" || kind === "set-image",
      ),
    ).toBe(false);

    const cancelled = new AbortController();
    cancelled.abort();
    await expect(
      inputs.media.acquireMap("chapter-02", cancelled.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
    const map = await inputs.media.acquireMap(
      "chapter-01",
      new AbortController().signal,
    );
    const set = await inputs.media.acquireSetImage(
      "fixture-set",
      new AbortController().signal,
    );
    expect(map?.url).toBe("blob:story-1");
    expect(set?.url).toBe("blob:story-2");
    expect(created.map(({ type }) => type)).toEqual([
      "image/svg+xml",
      "image/webp",
    ]);
    expect(harness.queries).toEqual(
      expect.arrayContaining([
        {
          kind: "asset",
          packageId: "chapter-01",
          path: "media/city-map.svg",
        },
        { kind: "set-image", setId: "fixture-set" },
      ]),
    );
    map?.release();
    set?.release();
    inputs.close();
    expect(revoked).toEqual(["blob:story-1", "blob:story-2"]);
  });

  it("aborts pending media reads and releases the internal request on caller cancellation", async () => {
    const original = harness.storage.content.query;
    let internalSignal: AbortSignal | undefined;
    vi.spyOn(harness.storage.content, "query").mockImplementation((async <
      Q extends ContentQuery,
    >(
      request: Q,
      signal: AbortSignal,
    ): Promise<StorageResult<QueryMap[Q["kind"]]>> => {
      if (request.kind !== "asset" || request.packageId !== "chapter-01")
        return original(request, signal);
      internalSignal = signal;
      return new Promise((resolve) => {
        signal.addEventListener(
          "abort",
          () =>
            resolve({
              kind: "failed",
              error: { code: "OPERATION_CANCELLED" },
            }),
          { once: true },
        );
      });
    }) as ContentQueries["query"]);
    const inputs = await loadStoryInputs(
      harness.storage,
      harness.users,
      "chapter-01",
      new AbortController().signal,
    );
    const caller = new AbortController();
    const pending = inputs.media.acquireMap("chapter-01", caller.signal);
    caller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    await vi.waitFor(() => expect(internalSignal?.aborted).toBe(true));
    inputs.close();
  });

  it("rejects a selected global set with an unknown date instead of fabricating one", async () => {
    const original = harness.storage.content.query;
    vi.spyOn(harness.storage.content, "query").mockImplementation((async <
      Q extends ContentQuery,
    >(
      request: Q,
      signal: AbortSignal,
    ): Promise<StorageResult<QueryMap[Q["kind"]]>> => {
      const result = await original(request, signal);
      if (request.kind !== "sets" || result.kind === "failed") return result;
      const sets = result as StorageResult<QueryMap["sets"]>;
      if (sets.kind === "failed") return result;
      return {
        kind: "ok",
        value: sets.value.map((set) => ({ ...set, releaseYear: null })),
      } as unknown as StorageResult<QueryMap[Q["kind"]]>;
    }) as ContentQueries["query"]);
    await expect(
      loadStoryInputs(
        harness.storage,
        harness.users,
        "chapter-01",
        new AbortController().signal,
      ),
    ).rejects.toThrow("STORY_RELEASE_INVALID");
  });
});

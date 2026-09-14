import type {
  StoryGenerationId,
  StoryGenerationSeal,
} from "../../../src/story/saves/index.ts";
// @vitest-environment node
import { IDBFactory, IDBObjectStore } from "fake-indexeddb";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createStoryMigrationPort } from "../../../src/story/saves/index.ts";
import { createInitialStoryState } from "../../../src/story/model/story-state.ts";
import {
  storyReleaseFixture,
  mutableStoryRelease,
  storyBindingFixture,
} from "../../fixtures/story-release.ts";
import { STORY_SLOT_KEYS } from "../../../src/story/saves/story-save-contracts.ts";
import { storyDeckFixture } from "../../fixtures/story-decks.ts";
import { parseGenerationEnvelope } from "../../../src/story/saves/generation-envelope.ts";

afterEach(() => vi.restoreAllMocks());
async function raw(
  factory: IDBFactory,
  store: string,
  change?: (store: IDBObjectStore) => void,
) {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const r = factory.open("ygo-story-saves");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  const tx = db.transaction(store, change ? "readwrite" : "readonly");
  const s = tx.objectStore(store);
  change?.(s as unknown as IDBObjectStore);
  const r = s.getAll();
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error);
  });
  db.close();
  return r.result;
}
async function seeded() {
  const factory = new IDBFactory();
  const port = createStoryMigrationPort(factory, () => 1234);
  const seal = await port.prepare(null, storyReleaseFixture());
  const repo = port.repository(seal.generationId);
  for (const slot of STORY_SLOT_KEYS) {
    const state = {
      ...createInitialStoryState(),
      narrativeIndex: 8,
      dp: 123,
      boosters: { "installed-set": 2 },
      decks: [storyDeckFixture("preserved")],
      pendingHandoffId: slot === "checkpoint:pre-duel" ? "handoff" : null,
    };
    expect(await repo.write(slot, state, 0, storyBindingFixture())).toEqual({
      kind: "written",
      revision: 1,
    });
  }
  return { factory, port, seal, repo };
}
describe("Story save generations", () => {
  it("All-slot COW preserves all five slots/economy/decks/checkpoint and old bytes", async () => {
    const { factory, port, seal, repo } = await seeded();
    const before = await raw(factory, "generationSaves");
    const target = storyReleaseFixture(2);
    const next = await port.prepare(seal.generationId, target);
    expect(next.slots).toHaveLength(5);
    await port.verifySeal(next);
    for (const slot of STORY_SLOT_KEYS) {
      const old = await repo.read(slot);
      const copied = await port.repository(next.generationId).read(slot);
      expect(copied).toEqual(
        old.kind === "ready"
          ? {
              kind: "ready",
              envelope: {
                ...old.envelope,
                story: { ...old.envelope.story, revision: 2 },
              },
            }
          : old,
      );
    }
    expect((await raw(factory, "generationSaves")).slice(0, 5).length).toBe(5);
    for (const record of before)
      expect(await raw(factory, "generationSaves")).toContainEqual(record);
    expect(await port.prepare(seal.generationId, target)).toEqual(next);
  });
  it("Narrative continuity remaps via stored semantic beat ID", async () => {
    const { port, seal } = await seeded();
    const target = mutableStoryRelease(2);
    target.chapters[0]!.document!.beats.unshift({
      ...target.chapters[0]!.document!.beats[0]!,
      id: "inserted",
    });
    const next = await port.prepare(seal.generationId, target);
    const read = await port.repository(next.generationId).read("autosave");
    expect(read.kind === "ready" && read.envelope.state.narrativeIndex).toBe(9);
  });
  it.each(["removed beat", "unknown schema", "corrupt slot"])(
    "Migration refusal: %s leaves source unchanged",
    async (defect) => {
      const { factory, port, seal } = await seeded();
      const target = mutableStoryRelease(2);
      if (defect === "removed beat")
        target.chapters[0]!.document!.beats.splice(8, 1);
      else
        await raw(factory, "generationSaves", (s) =>
          s.put(
            defect === "unknown schema"
              ? { schemaVersion: 7 }
              : { schemaVersion: 6 },
            [seal.generationId, "manual:2"],
          ),
        );
      const before = await raw(factory, "generationSaves");
      await expect(port.prepare(seal.generationId, target)).rejects.toThrow(
        "STORY_MIGRATION_FAILED",
      );
      expect(await raw(factory, "generationSaves")).toEqual(before);
    },
  );
  it("Active-generation reopen ignores mutable preparation hashes, detects descriptor/missing generation", async () => {
    const { port, seal, repo } = await seeded();
    await repo.clear("manual:1");
    await expect(
      port.verifyActiveGeneration(seal.generationId, storyReleaseFixture()),
    ).resolves.toBeUndefined();
    await expect(port.verifySeal(seal)).rejects.toThrow(
      "STORY_MIGRATION_FAILED",
    );
    await expect(
      port.verifyActiveGeneration(
        "missing" as StoryGenerationId,
        storyReleaseFixture(),
      ),
    ).rejects.toThrow("STORY_MIGRATION_FAILED");
    const target = mutableStoryRelease();
    target.chapters[0]!.document!.title = "changed";
    await expect(
      port.verifyActiveGeneration(seal.generationId, target),
    ).rejects.toThrow("STORY_MIGRATION_FAILED");
  });
  it("CAS and lease boundary: competing stale write never overwrites source", async () => {
    const { port, seal, repo } = await seeded();
    const state = createInitialStoryState();
    const result = await Promise.all([
      port.prepare(seal.generationId, storyReleaseFixture(2)),
      repo.write("autosave", state, 0, storyBindingFixture()),
    ]);
    expect(result[1]).toEqual({ kind: "stale", currentRevision: 1 });
    await port.verifySeal(result[0]);
  });
  it("snapshots write inputs before awaits; changed source creates distinct generation", async () => {
    const { port, seal, repo } = await seeded();
    const target = storyReleaseFixture(2);
    const first = await port.prepare(seal.generationId, target);
    const state = { ...createInitialStoryState(), dp: 456 };
    const binding = storyBindingFixture();
    const pending = repo.write("autosave", state, 1, binding);
    state.dp = 789;
    binding.revision = 9;
    expect(await pending).toEqual({ kind: "written", revision: 2 });
    const read = await repo.read("autosave");
    expect(read.kind === "ready" && read.envelope.state.dp).toBe(456);
    const second = await port.prepare(seal.generationId, target);
    expect(second.generationId).not.toBe(first.generationId);
  });
  it("quota abort preserves source bytes and writes no partial generation", async () => {
    const { factory, port, seal } = await seeded();
    const before = await raw(factory, "generationSaves");
    const generations = await raw(factory, "generations");
    const original = IDBObjectStore.prototype.put;
    let count = 0;
    vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (
      this: IDBObjectStore,
      ...args: Parameters<IDBObjectStore["put"]>
    ) {
      if (this.name === "generationSaves" && ++count === 3)
        throw new DOMException("full", "QuotaExceededError");
      return original.apply(this, args);
    });
    await expect(
      port.prepare(seal.generationId, storyReleaseFixture(2)),
    ).rejects.toThrow("STORY_STORAGE_QUOTA");
    expect(await raw(factory, "generationSaves")).toEqual(before);
    expect(await raw(factory, "generations")).toEqual(generations);
  });
  it("Legacy preservation: schema1–5 bytes unchanged, visible incompatible, no grant", async () => {
    const factory = new IDBFactory();
    await new Promise<void>((resolve, reject) => {
      const r = factory.open("ygo-story-saves", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("saves");
      r.onerror = () => reject(r.error);
      r.onsuccess = () => {
        r.result.close();
        resolve();
      };
    });
    await raw(factory, "saves", (s) =>
      STORY_SLOT_KEYS.forEach((slot, i) =>
        s.put({ schemaVersion: i + 1, opaque: "preserve" }, slot),
      ),
    );
    const before = await raw(factory, "saves");
    const port = createStoryMigrationPort(factory);
    const seal = await port.prepare(null, storyReleaseFixture());
    expect(seal.slots).toEqual([]);
    expect(await raw(factory, "saves")).toEqual(before);
    const repo = port.repository(seal.generationId);
    for (const [i, slot] of STORY_SLOT_KEYS.entries())
      expect(await repo.read(slot)).toEqual({
        kind: "incompatible",
        slot,
        found: i + 1,
      });
  });
  it("list I/O failure rejects rather than pretending no saves", async () => {
    const port = createStoryMigrationPort({
      open: () => {
        throw new Error("denied");
      },
    } as unknown as IDBFactory);
    await expect(
      port.repository("missing" as StoryGenerationId).list(),
    ).rejects.toThrow("STORY_STORAGE_UNAVAILABLE");
  });
});

it("source change during precompute refuses commit; snapshots target before hash await", async () => {
  const { factory, port, seal, repo } = await seeded();
  const original = crypto.subtle.digest.bind(crypto.subtle);
  let release!: () => void;
  let entered!: () => void;
  const reached = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let block = true;
  vi.spyOn(crypto.subtle, "digest").mockImplementation(async (...args) => {
    if (block) {
      block = false;
      entered();
      await gate;
    }
    return original(...args);
  });
  const target = mutableStoryRelease(2);
  const pending = port.prepare(seal.generationId, target);
  await reached;
  target.revision = 999;
  await repo.write(
    "autosave",
    { ...createInitialStoryState(), dp: 77 },
    1,
    storyBindingFixture(),
  );
  const before = await raw(factory, "generationSaves");
  release();
  await expect(pending).rejects.toThrow("STORY_MIGRATION_FAILED");
  expect(await raw(factory, "generationSaves")).toEqual(before);
  expect(await raw(factory, "generations")).toHaveLength(1);
});
it.each([
  "manual:1",
  "manual:2",
  "manual:3",
  "autosave",
  "checkpoint:pre-duel",
] as const)(
  "verifySeal checks occupied slot %s and missing expected slot",
  async (slot) => {
    const { port, seal, repo } = await seeded();
    const prepared = await port.prepare(
      seal.generationId,
      storyReleaseFixture(2),
    );
    await port.repository(prepared.generationId).clear(slot);
    await expect(port.verifySeal(prepared)).rejects.toThrow(
      "STORY_MIGRATION_FAILED",
    );
    await expect(port.verifySeal(seal)).rejects.toThrow(
      "STORY_MIGRATION_FAILED",
    );
    expect((await repo.read(slot)).kind).toBe("ready");
  },
);
it("verifySeal detects descriptor corruption, verifies empty absences", async () => {
  const factory = new IDBFactory();
  const port = createStoryMigrationPort(factory);
  const seal = await port.prepare(null, storyReleaseFixture());
  await port.verifySeal(seal);
  const rows = await raw(factory, "generations");
  rows[0].descriptor.chapters[0].document.title = "changed";
  await raw(factory, "generations", (store) => store.put(rows[0]));
  await expect(port.verifySeal(seal)).rejects.toThrow("STORY_MIGRATION_FAILED");
  await expect(
    port.verifyActiveGeneration(seal.generationId, storyReleaseFixture()),
  ).rejects.toThrow("STORY_MIGRATION_FAILED");
});
it("schema1–5 inside generation slots refuse migration, never legacy-grant", async () => {
  const { factory, port, seal } = await seeded();
  for (let schemaVersion = 1; schemaVersion <= 5; schemaVersion++) {
    await raw(factory, "generationSaves", (store) =>
      store.put({ schemaVersion }, [seal.generationId, "manual:2"]),
    );
    await expect(
      port.prepare(seal.generationId, storyReleaseFixture(2)),
    ).rejects.toThrow("STORY_MIGRATION_FAILED");
  }
});
it("concurrent prepare is idempotent for identical unchanged inputs", async () => {
  const { port, seal } = await seeded();
  const [a, b] = await Promise.all([
    port.prepare(seal.generationId, storyReleaseFixture(2)),
    port.prepare(seal.generationId, storyReleaseFixture(2)),
  ]);
  expect(a).toEqual(b);
});

it("malformed seal entries reject semantic failure, not storage failure", async () => {
  const { port, seal } = await seeded();
  await expect(
    port.verifySeal({
      ...seal,
      slots: [null],
    } as unknown as StoryGenerationSeal),
  ).rejects.toThrow("STORY_MIGRATION_FAILED");
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
    parseGenerationEnvelope(
      "autosave",
      sparseEnvelope(path),
      storyReleaseFixture(),
    ),
  ).toMatchObject({ kind: "corrupt", slot: "autosave" });
});
it.each(sparsePaths)(
  "sparse %s write returns typed failure without mutation",
  async (path) => {
    const { factory, repo } = await seeded();
    const before = await raw(factory, "generationSaves");
    const envelope = sparseEnvelope(path);
    expect(
      await repo.write("autosave", envelope.state, 1, envelope.story),
    ).toEqual({
      kind: "failed",
      reason: "unknown",
    });
    expect(await raw(factory, "generationSaves")).toStrictEqual(before);
  },
);
it.each(sparsePaths)(
  "raw sparse %s refuses migration, preserves source bytes",
  async (path) => {
    const { factory, port, seal, repo } = await seeded();
    await raw(factory, "generationSaves", (store) =>
      store.put(sparseEnvelope(path), [seal.generationId, "autosave"]),
    );
    const before = await raw(factory, "generationSaves");
    const generations = await raw(factory, "generations");
    expect(await repo.read("autosave")).toMatchObject({ kind: "corrupt" });
    await expect(
      port.prepare(seal.generationId, storyReleaseFixture(2)),
    ).rejects.toEqual(new Error("STORY_MIGRATION_FAILED"));
    expect(await raw(factory, "generationSaves")).toStrictEqual(before);
    expect(await raw(factory, "generations")).toStrictEqual(generations);
  },
);

const validSeal = {
  generationId: "generation" as StoryGenerationId,
  sourceGenerationId: null,
  revision: 1,
  slots: [],
};
const invalidSeals: [string, unknown][] = [
  ["undefined seal", undefined],
  ["function seal", () => undefined],
  ["sparse slots", { ...validSeal, slots: Array(1) }],
  ["undefined slots", { ...validSeal, slots: undefined }],
  ["undefined slot entry", { ...validSeal, slots: [undefined] }],
];
for (const field of ["generationId", "sourceGenerationId", "revision"])
  for (const [label, value] of [
    ["undefined", undefined],
    ["function", () => undefined],
    ["empty", ""],
    ["blank", " "],
    ["object", {}],
    ["array", []],
    ["boolean", true],
    ["zero", 0],
    ["negative", -1],
    ["fraction", 1.5],
    ["NaN", NaN],
    ["infinite", Infinity],
    ["unsafe", Number.MAX_SAFE_INTEGER + 1],
  ] as const)
    invalidSeals.push([`${field}: ${label}`, { ...validSeal, [field]: value }]);
invalidSeals.push(
  ["null generationId", { ...validSeal, generationId: null }],
  ["null revision", { ...validSeal, revision: null }],
  ["string revision", { ...validSeal, revision: "1" }],
);
it.each(invalidSeals)(
  "malformed seal %s fails semantically before DB access",
  async (_label, input) => {
    const open = vi.fn(() => {
      throw new Error("denied");
    });
    const port = createStoryMigrationPort({ open } as unknown as IDBFactory);
    await expect(port.verifySeal(input as StoryGenerationSeal)).rejects.toEqual(
      new Error("STORY_MIGRATION_FAILED"),
    );
    expect(open).not.toHaveBeenCalled();
  },
);
it.each([
  ["unavailable", new Error("private DB failure"), "STORY_STORAGE_UNAVAILABLE"],
  [
    "quota",
    new DOMException("private quota failure", "QuotaExceededError"),
    "STORY_STORAGE_QUOTA",
  ],
] as const)(
  "valid seal retains %s DB error mapping without raw leak",
  async (_label, error, message) => {
    const open = vi.fn(() => {
      throw error;
    });
    const port = createStoryMigrationPort({ open } as unknown as IDBFactory);
    await expect(port.verifySeal(validSeal)).rejects.toEqual(
      new Error(message),
    );
    expect(open).toHaveBeenCalledOnce();
  },
);

it("target descriptor snapshots before first await", async () => {
  const port = createStoryMigrationPort(new IDBFactory());
  const target = mutableStoryRelease(2);
  const pending = port.prepare(null, target);
  target.revision = 999;
  target.chapters[0]!.document!.title = "changed";
  const seal = await pending;
  expect(seal.revision).toBe(2);
  await port.verifyActiveGeneration(seal.generationId, storyReleaseFixture(2));
});

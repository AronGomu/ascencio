// @vitest-environment node
import { rmdirSync, unlinkSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PROLOGUE } from "../../../src/story/content/prologue.ts";
import {
  createInitialStoryState,
  type StoryState,
} from "../../../src/story/model/story-state.ts";
import {
  createSqliteStoryRepository,
  parseStoredStoryEnvelope,
  STORY_SLOT_KEYS,
  type StorySlotKey,
} from "../../../src/story/saves/index.ts";
import { UserDataRuntime } from "../../fixtures/legacy-user-data-runtime.ts";
import { storyBindingFixture } from "../../fixtures/story-release.ts";
import { storyDeckFixture } from "../../fixtures/story-decks.ts";
import { createUserDataFixture } from "../storage/sqlite-fixtures.ts";
import {
  createNodeFileStore,
  databaseAdapter,
} from "../storage/runtime-fixtures.ts";

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  for (const close of cleanup.splice(0)) await close();
});

function fixture(fault?: (point: string) => void) {
  const user = createUserDataFixture();
  const files = createNodeFileStore();
  const runtime = new UserDataRuntime({
    database: databaseAdapter(user.database),
    files,
    randomId: () => crypto.randomUUID(),
    fault,
  });
  cleanup.push(async () => {
    await runtime.close();
    unlinkSync(user.file);
    rmdirSync(files.root);
  });
  const saves = createSqliteStoryRepository(runtime);
  return {
    saves,
    runtime,
    database: user.database,
    snapshot: () => ({
      rows: user.database
        .prepare("SELECT * FROM user_records ORDER BY namespace, record_key")
        .all(),
      meta: user.database.prepare("SELECT * FROM user_data_meta").all(),
    }),
    seed(slot: StorySlotKey, value: unknown) {
      // Explicit raw-row injection: production writes reject unsupported schemas.
      user.database
        .prepare(
          "INSERT OR REPLACE INTO user_records (namespace, record_key, revision, payload_json) VALUES ('story', ?, 1, ?)",
        )
        .run(slot, JSON.stringify(value, null, 2) + "\n");
    },
    write(
      slot: StorySlotKey,
      state: StoryState,
      expected: number | null = null,
    ) {
      return saves.write(slot, state, expected, storyBindingFixture());
    },
  };
}

function envelope(state: unknown = createInitialStoryState()) {
  return {
    schemaVersion: 6,
    slot: "manual:1",
    revision: 1,
    savedAt: 1_700_000_000_123,
    state,
    story: storyBindingFixture(),
  };
}

describe("current SQLite Story save semantics", () => {
  it("names five slots and reads an empty database without creating a save", async () => {
    expect(STORY_SLOT_KEYS).toEqual([
      "manual:1",
      "manual:2",
      "manual:3",
      "autosave",
      "checkpoint:pre-duel",
    ]);
    const f = fixture();
    const before = f.snapshot();
    for (const slot of STORY_SLOT_KEYS)
      expect(await f.saves.read(slot)).toEqual({ kind: "empty", slot });
    expect(await f.saves.list()).toEqual([]);
    expect(f.snapshot()).toEqual(before);
  });

  it("round-trips schema6 state, economy, decks, navigation and handoff exactly", async () => {
    const f = fixture();
    vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_123);
    const state: StoryState = {
      ...createInitialStoryState(),
      screen: "map",
      savedScreen: "map",
      previousScreen: "shop-browse",
      narrativeIndex: 18,
      choice: "trust-rin",
      choiceResponse: "Then walk beside me.",
      progressExists: true,
      dp: 640,
      boosters: { "removed-set": 2 },
      collection: { 89631139: 3 },
      decks: [
        structuredClone(storyDeckFixture("alpha")),
        structuredClone(storyDeckFixture("beta")),
      ],
      defaultDeckId: "beta",
      pendingHandoffId: "saved-checkpoint",
    };
    expect(await f.write("manual:1", state)).toEqual({
      kind: "written",
      revision: 1,
    });
    const read = await f.saves.read("manual:1");
    expect(read).toEqual({ kind: "ready", envelope: envelope(state) });
    if (read.kind !== "ready") throw new Error("expected a ready save");
    expect(read.envelope.state).not.toBe(state);
    expect(JSON.stringify(read.envelope.state)).toBe(JSON.stringify(state));
    const before = f.snapshot();
    expect(await f.saves.read("manual:1")).toEqual(read);
    expect(f.snapshot()).toEqual(before);
    expect(JSON.parse(String(before.rows[0]!.payload_json))).toEqual(
      envelope(state),
    );
  });

  it("never grants a deck or inventory while reading an empty current library", async () => {
    const f = fixture();
    const state = { ...createInitialStoryState(), dp: 40 };
    await f.write("manual:1", state);
    const before = f.snapshot();
    for (let i = 0; i < 2; i += 1)
      expect(await f.saves.read("manual:1")).toMatchObject({
        kind: "ready",
        envelope: {
          state: { decks: [], defaultDeckId: null, collection: {}, dp: 40 },
        },
      });
    expect(f.snapshot()).toEqual(before);
  });

  it("overwrites one row with increasing revisions and preserves rejected CAS bytes", async () => {
    const f = fixture();
    for (const narrativeIndex of [3, 9])
      expect(
        (
          await f.write("manual:1", {
            ...createInitialStoryState(),
            narrativeIndex,
          })
        ).kind,
      ).toBe("written");
    const before = f.snapshot();
    expect(before.rows).toHaveLength(1);
    expect(await f.write("manual:1", createInitialStoryState(), 1)).toEqual({
      kind: "stale",
      currentRevision: 2,
    });
    expect(f.snapshot()).toEqual(before);
    expect(await f.saves.read("manual:1")).toMatchObject({
      kind: "ready",
      envelope: { revision: 2, state: { narrativeIndex: 9 } },
    });
  });

  it("bounds concurrent CAS retries without losing a successful write", async () => {
    const f = fixture();
    const intended = [1, 2, 3].map((narrativeIndex) => ({
      ...createInitialStoryState(),
      narrativeIndex,
    }));
    expect(
      await Promise.all(intended.map((state) => f.write("autosave", state))),
    ).toEqual([
      { kind: "written", revision: 1 },
      { kind: "written", revision: 2 },
      { kind: "failed", reason: "unknown" },
    ]);
    const current = await f.saves.read("autosave");
    expect(current).toMatchObject({
      kind: "ready",
      envelope: { revision: 2, state: intended[1] },
    });
    if (current.kind !== "ready") throw new Error("expected a ready save");
    expect(
      await f.write("autosave", intended[2]!, current.envelope.revision),
    ).toEqual({ kind: "written", revision: 3 });
    expect(await f.saves.read("autosave")).toMatchObject({
      kind: "ready",
      envelope: { revision: 3, state: { narrativeIndex: 3 } },
    });
  });

  it("lists current readable slots newest first with chapter labels", async () => {
    const f = fixture();
    let clock = 1_700_000_000_000;
    vi.spyOn(Date, "now").mockImplementation(() => (clock += 1000));
    const cases = [
      ["manual:1", "narrative", "Prologue"],
      ["manual:3", "map", "City map"],
      ["autosave", "reward", "Reward"],
    ] as const;
    for (const [slot, savedScreen] of cases)
      await f.write(slot, { ...createInitialStoryState(), savedScreen });
    expect(await f.saves.list()).toEqual(
      cases
        .map(([slot, , label], index) => ({
          slot,
          revision: 1,
          savedAt: 1_700_000_001_000 + index * 1000,
          chapterLabel: `${PROLOGUE.title} · ${label}`,
        }))
        .reverse(),
    );
  });

  it("clears only the requested slot, accepts absent clears and restarts its revision", async () => {
    const f = fixture();
    for (const slot of ["manual:1", "manual:2", "manual:3"] as const)
      await f.write(slot, createInitialStoryState());
    await f.saves.clear("manual:2");
    await expect(f.saves.clear("checkpoint:pre-duel")).resolves.toBeUndefined();
    expect(await f.saves.read("manual:2")).toEqual({
      kind: "empty",
      slot: "manual:2",
    });
    expect((await f.saves.list()).map(({ slot }) => slot).sort()).toEqual([
      "manual:1",
      "manual:3",
    ]);
    expect(await f.write("manual:2", createInitialStoryState())).toEqual({
      kind: "written",
      revision: 1,
    });
  });

  it("isolates checkpoint from autosave and refuses unowned checkpoint cleanup", async () => {
    const f = fixture();
    await f.write("autosave", { ...createInitialStoryState(), screen: "map" });
    expect(await f.saves.read("checkpoint:pre-duel")).toEqual({
      kind: "empty",
      slot: "checkpoint:pre-duel",
    });
    await f.write("checkpoint:pre-duel", {
      ...createInitialStoryState(),
      screen: "battle-mock",
    });
    const before = f.snapshot();
    await expect(f.saves.clear("checkpoint:pre-duel", 0)).rejects.toThrow(
      "STORAGE_CONFLICT",
    );
    expect(f.snapshot()).toEqual(before);
    expect(await f.saves.read("autosave")).toMatchObject({
      kind: "ready",
      envelope: { state: { screen: "map" } },
    });
    expect(await f.saves.read("checkpoint:pre-duel")).toMatchObject({
      kind: "ready",
      envelope: { state: { screen: "battle-mock" } },
    });
    await f.saves.clear("checkpoint:pre-duel", 1);
    expect(await f.saves.read("checkpoint:pre-duel")).toEqual({
      kind: "empty",
      slot: "checkpoint:pre-duel",
    });
  });

  it("refuses forged slot keys without touching SQLite", async () => {
    const f = fixture();
    const slot = "manual:4" as StorySlotKey;
    const before = f.snapshot();
    expect(await f.saves.read(slot)).toEqual({ kind: "empty", slot });
    expect(await f.write(slot, createInitialStoryState())).toEqual({
      kind: "failed",
      reason: "unknown",
    });
    await f.saves.clear(slot);
    expect(f.snapshot()).toEqual(before);
  });

  it.each(["quota", "abort"])(
    "rolls back real SQLite %s failure, preserves bytes and remains writable",
    async (failure) => {
      let fail = false;
      const f = fixture((point) => {
        if (fail && point === "write-after-first")
          throw failure === "quota"
            ? new DOMException("no room left", "QuotaExceededError")
            : new Error("injected transaction failure");
      });
      await f.write("manual:1", {
        ...createInitialStoryState(),
        narrativeIndex: 3,
      });
      const before = f.snapshot();
      fail = true;
      expect(
        await f.write("manual:1", {
          ...createInitialStoryState(),
          narrativeIndex: 9,
        }),
      ).toEqual({
        kind: "failed",
        reason: failure === "quota" ? "quota" : "unavailable",
      });
      expect(f.snapshot()).toEqual(before);
      expect(await f.saves.read("manual:1")).toMatchObject({
        kind: "ready",
        envelope: { revision: 1, state: { narrativeIndex: 3 } },
      });
      fail = false;
      expect(await f.write("manual:1", createInitialStoryState())).toEqual({
        kind: "written",
        revision: 2,
      });
    },
  );

  it("reports a closed owner without silently emptying the listing", async () => {
    const f = fixture();
    await f.runtime.close();
    expect(await f.write("manual:1", createInitialStoryState())).toEqual({
      kind: "failed",
      reason: "unavailable",
    });
    expect(await f.saves.read("manual:1")).toEqual({
      kind: "corrupt",
      slot: "manual:1",
      reason: "STORAGE_UNAVAILABLE",
    });
    await expect(f.saves.list()).rejects.toThrow("STORAGE_UNAVAILABLE");
  });
});

describe("current envelope validation without migration", () => {
  it.each([1, 2, 3, 4, 5, 7, 9])(
    "classifies schema%s incompatible and never migrates its exact stored bytes",
    async (schemaVersion) => {
      const f = fixture();
      const record = { ...envelope(), schemaVersion };
      expect(parseStoredStoryEnvelope("manual:1", record)).toEqual({
        kind: "incompatible",
        slot: "manual:1",
        found: schemaVersion,
      });
      f.seed("manual:1", record);
      const before = f.snapshot();
      // User-data admission refuses old schemas before the Story repository can read them.
      expect(await f.saves.read("manual:1")).toEqual({
        kind: "corrupt",
        slot: "manual:1",
        reason: "USER_DATA_INVALID",
      });
      await expect(f.saves.list()).rejects.toThrow("USER_DATA_INVALID");
      expect(await f.write("manual:1", createInitialStoryState())).toEqual({
        kind: "failed",
        reason: "unavailable",
      });
      expect(f.snapshot()).toEqual(before);
    },
  );

  it("rejects malformed current envelopes without repairing or overwriting bytes", async () => {
    const f = fixture();
    const valid = envelope();
    const records: unknown[] = [
      "not an object",
      42,
      [],
      {},
      null,
      { schemaVersion: 6 },
      { ...valid, schemaVersion: "6" },
      { ...valid, slot: "autosave" },
      { ...valid, revision: 0 },
      { ...valid, savedAt: -1 },
      { ...valid, extra: true },
      { ...valid, state: null },
      { ...valid, story: null },
    ];
    for (const record of records) {
      expect(
        parseStoredStoryEnvelope("manual:1", record).kind,
        JSON.stringify(record),
      ).toBe("corrupt");
      f.seed("manual:1", record);
      const before = f.snapshot();
      expect((await f.saves.read("manual:1")).kind).toBe("corrupt");
      expect((await f.write("manual:1", createInitialStoryState())).kind).toBe(
        "failed",
      );
      expect(f.snapshot()).toEqual(before);
    }
  });

  it("rejects malformed state, inventory and deck structures without normalizing them", async () => {
    const f = fixture();
    const state = createInitialStoryState();
    const invalid = [
      { ...state, screen: "unsafe" },
      { ...state, savedScreen: [] },
      { ...state, previousScreen: "unknown-screen" },
      Object.fromEntries(
        Object.entries(state).filter(([key]) => key !== "previousScreen"),
      ),
      Object.fromEntries(
        Object.entries(state).filter(([key]) => key !== "decks"),
      ),
      { ...state, favouriteDeckIds: ["alpha"] },
      { ...state, narrativeIndex: -1 },
      { ...state, outcome: "unsafe" },
      { ...state, collection: { a: 1 } },
      { ...state, collection: { "01": 1 } },
      { ...state, collection: { "1.5": 1 } },
      { ...state, collection: { "-2": 1 } },
      { ...state, collection: { 97590747: "three" } },
      { ...state, boosters: { "": 2 } },
      { ...state, decks: null },
      { ...state, decks: "all of them" },
      { ...state, decks: [{ id: "alpha" }] },
      { ...state, decks: [storyDeckFixture("alpha", { main: [-1] })] },
      { ...state, defaultDeckId: 7 },
      {
        ...createInitialStoryState(),
        locations: createInitialStoryState().locations.map((location) => ({
          ...location,
          access: ["available"],
        })),
      },
    ];
    for (const candidate of invalid) {
      const record = envelope(candidate);
      expect(
        parseStoredStoryEnvelope("manual:1", record).kind,
        JSON.stringify(record),
      ).toBe("corrupt");
      f.seed("manual:1", record);
      const before = f.snapshot();
      expect((await f.saves.read("manual:1")).kind).toBe("corrupt");
      expect(f.snapshot()).toEqual(before);
    }
  });

  it("preserves unsupported references and libraries, listing only playable slots", async () => {
    const f = fixture();
    await f.write("autosave", createInitialStoryState());
    for (const state of [
      { ...createInitialStoryState(), locations: [] },
      {
        ...createInitialStoryState(),
        decks: [
          structuredClone(storyDeckFixture("alpha")),
          structuredClone(storyDeckFixture("alpha")),
        ],
      },
    ]) {
      f.seed("manual:1", envelope(state));
      expect(parseStoredStoryEnvelope("manual:1", envelope(state)).kind).toBe(
        "ready",
      );
      const before = f.snapshot();
      expect(await f.saves.read("manual:1")).toEqual({
        kind: "incompatible",
        slot: "manual:1",
        found: 6,
      });
      expect((await f.saves.list()).map(({ slot }) => slot)).toEqual([
        "autosave",
      ]);
      expect(f.snapshot()).toEqual(before);
    }
  });

  it("accepts a structurally valid later beat and absent optional deck reference without repair", async () => {
    const f = fixture();
    const state = {
      ...createInitialStoryState(),
      narrativeIndex: PROLOGUE.beats.length,
      defaultDeckId: "removed-deck",
    };
    expect(await f.write("manual:1", state)).toEqual({
      kind: "written",
      revision: 1,
    });
    expect(await f.saves.read("manual:1")).toMatchObject({
      kind: "ready",
      envelope: { state },
    });
  });
});

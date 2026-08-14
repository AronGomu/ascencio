import { describe, expect, it } from "vitest";
import { createInitialStoryState } from "../../../src/story/model/story-state.ts";
import {
  STORY_STORAGE_KEY,
  loadStorySlots,
  resetStoryStorage,
  saveStoryState,
} from "../../../src/story/storage/story-storage.ts";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  touched: string[] = [];
  get length(): number {
    return this.values.size;
  }
  clear(): void {
    this.values.clear();
  }
  getItem(key: string): string | null {
    this.touched.push(key);
    return this.values.get(key) ?? null;
  }
  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.touched.push(key);
    this.values.delete(key);
  }
  setItem(key: string, value: string): void {
    this.touched.push(key);
    this.values.set(key, value);
  }
}

describe("story storage", () => {
  it("round-trips distinct manual and autosave slots under one isolated key", () => {
    const storage = new MemoryStorage();
    const manual = {
      ...createInitialStoryState(),
      screen: "narrative" as const,
      progressExists: true,
    };
    const autosave = {
      ...createInitialStoryState(),
      screen: "reward" as const,
      savedScreen: "reward" as const,
      progressExists: true,
    };
    expect(saveStoryState(manual, storage, "manual")).toEqual({ ok: true });
    expect(saveStoryState(autosave, storage, "autosave")).toEqual({
      ok: true,
    });
    expect(loadStorySlots(storage)).toEqual({
      ok: true,
      slots: { manual, autosave, latest: "autosave" },
    });
    expect(storage.touched.every((key) => key === STORY_STORAGE_KEY)).toBe(
      true,
    );
    expect(STORY_STORAGE_KEY).toBe("ygo.story.v1");
    expect(STORY_STORAGE_KEY).not.toMatch(/snapshot|duel|database/i);
  });

  it("rejects invalid envelopes and full state mutations", () => {
    const storage = new MemoryStorage();
    expect(loadStorySlots(storage)).toEqual({
      ok: true,
      slots: { manual: null, autosave: null, latest: null },
    });
    storage.setItem(STORY_STORAGE_KEY, "not json");
    expect(loadStorySlots(storage)).toMatchObject({ ok: false });
    const valid = createInitialStoryState();
    for (const invalid of [
      { ...valid, screen: "unsafe" },
      { ...valid, savedScreen: [] },
      { ...valid, narrativeIndex: -1 },
      { ...valid, narrativeIndex: 999 },
      { ...valid, choice: "unsafe" },
      { ...valid, outcome: "unsafe" },
      { ...valid, locations: valid.locations.slice(1) },
      {
        ...valid,
        locations: valid.locations.map((location) => ({
          ...location,
          access: ["available"],
        })),
      },
    ]) {
      storage.setItem(
        STORY_STORAGE_KEY,
        JSON.stringify({
          schemaVersion: 1,
          manual: invalid,
          autosave: null,
          latest: "manual",
        }),
      );
      expect(loadStorySlots(storage)).toMatchObject({ ok: false });
    }
  });

  it("deletes one slot without touching the other or production keys", () => {
    const storage = new MemoryStorage();
    const state = createInitialStoryState();
    expect(saveStoryState(state, storage, "manual")).toEqual({ ok: true });
    expect(saveStoryState(state, storage, "autosave")).toEqual({
      ok: true,
    });
    storage.setItem("production-snapshot", "keep");
    expect(resetStoryStorage(storage, "manual")).toEqual({ ok: true });
    expect(loadStorySlots(storage)).toEqual({
      ok: true,
      slots: { manual: null, autosave: state, latest: "autosave" },
    });
    expect(storage.getItem("production-snapshot")).toBe("keep");
    expect(resetStoryStorage(storage)).toEqual({ ok: true });
    expect(storage.getItem(STORY_STORAGE_KEY)).toBeNull();
  });

  it("contains unavailable default/read/write/reset storage", () => {
    const descriptor = Object.getOwnPropertyDescriptor(
      globalThis,
      "localStorage",
    );
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get: () => {
        throw new Error("blocked default");
      },
    });
    expect(loadStorySlots()).toMatchObject({
      ok: false,
      message: "blocked default",
    });
    if (descriptor === undefined)
      delete (globalThis as { localStorage?: Storage }).localStorage;
    else Object.defineProperty(globalThis, "localStorage", descriptor);

    const storage = new MemoryStorage();
    storage.getItem = () => {
      throw new Error("blocked read");
    };
    expect(loadStorySlots(storage)).toMatchObject({
      ok: false,
      message: "blocked read",
    });
    storage.getItem = () => null;
    storage.setItem = () => {
      throw new Error("quota");
    };
    expect(saveStoryState(createInitialStoryState(), storage)).toMatchObject({
      ok: false,
      message: "quota",
    });
    storage.removeItem = () => {
      throw new Error("blocked reset");
    };
    expect(resetStoryStorage(storage)).toMatchObject({
      ok: false,
      message: "blocked reset",
    });
  });
});

// @vitest-environment node

import { IDBFactory } from "fake-indexeddb";
import { afterEach, expect, it, vi } from "vitest";
import { createInitialStoryState } from "../../../src/story/model/story-state.ts";
import { createStoryMigrationPort } from "../../../src/story/saves/index.ts";
import {
  storyBindingFixture,
  storyReleaseFixture,
} from "../../fixtures/story-release.ts";

afterEach(() => vi.restoreAllMocks());

it("reports unavailable when concurrent database deletion closes a write connection", async () => {
  const factory = new IDBFactory();
  const port = createStoryMigrationPort(factory);
  const seal = await port.prepare(null, storyReleaseFixture());
  const originalDigest = crypto.subtle.digest.bind(crypto.subtle);
  let releaseDigest!: () => void;
  let digestStarted!: () => void;
  const started = new Promise<void>((resolve) => {
    digestStarted = resolve;
  });
  const gate = new Promise<void>((resolve) => {
    releaseDigest = resolve;
  });
  vi.spyOn(crypto.subtle, "digest").mockImplementation(async (...args) => {
    digestStarted();
    await gate;
    return originalDigest(...args);
  });

  const pending = port
    .repository(seal.generationId)
    .write("autosave", createInitialStoryState(), 0, storyBindingFixture());
  await started;
  await new Promise<void>((resolve, reject) => {
    const request = factory.deleteDatabase("ygo-story-saves");
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  releaseDigest();

  await expect(pending).resolves.toEqual({
    kind: "failed",
    reason: "unavailable",
  });
});

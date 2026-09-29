import { expect, it } from "vitest";
import { DEFAULT_PERSISTED_UI_STATE } from "../../../src/battle/app/stores/persisted-ui-state.ts";
import { DEFAULT_SHELL_SETTINGS } from "../../../src/shell/settings/shell-settings.ts";
import { createInitialStoryState } from "../../../src/story/model/story-state.ts";
import { DEFAULT_STORY_PLAYBACK_SETTINGS } from "../../../src/story/playback/story-playback-settings.ts";
import {
  isPersistableStoryState,
  parseStoredStoryEnvelope,
} from "../../../src/story/saves/index.ts";
import {
  USER_DATA_MAX_PAYLOAD_BYTES,
  validateUserRecordPayload,
} from "../../../src/storage/schema/index.ts";
import {
  createRegistryFixture,
  createUserDataFixture,
} from "./sqlite-fixtures.ts";

const outdatedEnvelope = () => ({
  schemaVersion: 6 as const,
  slot: "manual:1" as const,
  revision: 7,
  savedAt: 1_800_000_000_000,
  state: {
    ...createInitialStoryState(),
    narrativeIndex: 999,
    encounterId: "removed-opponent",
    choice: "removed-choice",
    locations: [
      { id: "removed-location", access: "available", completed: false },
    ],
    choiceResponse: "removed-beat",
  },
  story: {
    chapterId: "chapter-77",
    contentId: "removed-content",
    revision: 1,
    completedChapterIds: ["chapter-55", "chapter-76"],
  },
});

it("creates real registry and user-data SQLite fixtures", () => {
  const registry = createRegistryFixture();
  const user = createUserDataFixture();
  expect(
    registry.database.prepare("SELECT * FROM registry_state").get(),
  ).toEqual({
    singleton: 1,
    generation: 0,
  });
  expect(user.database.prepare("SELECT * FROM user_data_meta").get()).toEqual({
    singleton: 1,
    format: "ascencio-user-data",
    schema_version: 1,
    revision: 0,
  });
  expect(user.database.prepare("PRAGMA integrity_check").get()).toEqual({
    integrity_check: "ok",
  });
  registry.database.close();
  user.database.close();
});

it("accepts structurally valid outdated Story references without release lookup", () => {
  const input = outdatedEnvelope();
  expect(isPersistableStoryState(input.state)).toBe(true);
  const result = parseStoredStoryEnvelope("manual:1", input);
  expect(result).toEqual({ kind: "ready", envelope: input });
  expect(result).not.toBe(input);
  expect(validateUserRecordPayload("story", "manual:1", input)).toEqual({
    kind: "ok",
    value: input,
  });
});

it("separates incompatible Story schema from corrupt schema6", () => {
  expect(
    parseStoredStoryEnvelope("manual:1", {
      ...outdatedEnvelope(),
      schemaVersion: 7,
    }),
  ).toEqual({ kind: "incompatible", slot: "manual:1", found: 7 });
  expect(
    parseStoredStoryEnvelope("manual:1", {
      ...outdatedEnvelope(),
      state: { ...outdatedEnvelope().state, narrativeIndex: -1 },
    }),
  ).toMatchObject({ kind: "corrupt", slot: "manual:1" });
});

const storedDeck = {
  deck: {
    schemaVersion: 1,
    id: "deck-1",
    revision: 1,
    name: "Fixture",
    createdAt: "2026-09-24T00:00:00.000Z",
    updatedAt: "2026-09-24T00:00:00.000Z",
    validation: { status: "valid", issues: [], rulesetRevision: "fixture" },
    importedNeedsReview: false,
    illustrationCardCode: null,
    main: [1],
    extra: [],
    side: [],
  },
  history: { undo: [], redo: [], nextSequence: 0 },
};
const deckAutosave = {
  id: "autosave-1",
  deckId: "deck-1",
  deckName: "Fixture",
  createdAt: "2026-09-24T00:00:00.000Z",
  main: [1],
  extra: [],
  side: [],
  illustrationCardCode: null,
};

it.each([
  ["decks", "deck-1", storedDeck],
  ["deck-autosaves", "autosave-1", deckAutosave],
  ["deck-meta", "lastOpened", null],
  ["deck-meta", "defaultDeck", "deck-1"],
  ["preferences", "shell", DEFAULT_SHELL_SETTINGS],
  ["preferences", "battle-ui", DEFAULT_PERSISTED_UI_STATE],
  ["preferences", "story-playback", DEFAULT_STORY_PLAYBACK_SETTINGS],
  ["story-read-log", "read", { version: 1, beats: ["beat-2", "beat-1"] }],
])("accepts %s/%s payload", (namespace, key, payload) => {
  expect(validateUserRecordPayload(namespace, key, payload)).toEqual({
    kind: "ok",
    value: payload,
  });
});

it.each([
  ["unknown", "key", {}],
  ["deck-meta", "other", null],
  ["story-read-log", "read", { version: 2, beats: [] }],
  ["story-read-log", "read", { version: 1, beats: ["same", "same"] }],
])("rejects invalid namespace payload %s/%s", (namespace, key, payload) => {
  expect(validateUserRecordPayload(namespace, key, payload)).toMatchObject({
    kind: "failed",
    error: { code: "USER_DATA_INVALID" },
  });
});

it("rejects payloads over 16 MiB", () => {
  const payload = "x".repeat(USER_DATA_MAX_PAYLOAD_BYTES);
  expect(
    validateUserRecordPayload("deck-meta", "lastOpened", payload),
  ).toMatchObject({
    kind: "failed",
    error: { code: "USER_DATA_TOO_LARGE" },
  });
});

it.each([42, {}, "", "x".repeat(257), "bad\0ref"])(
  "rejects unsafe persisted Story refs %j",
  (reference) => {
    const envelope = outdatedEnvelope();
    for (const payload of [
      { ...envelope, state: { ...envelope.state, encounterId: reference } },
      {
        ...envelope,
        state: {
          ...envelope.state,
          locations: [{ id: reference, access: "available", completed: false }],
        },
      },
      { ...envelope, story: { ...envelope.story, contentId: reference } },
      { ...envelope, story: { ...envelope.story, chapterId: reference } },
    ])
      expect(parseStoredStoryEnvelope("manual:1", payload).kind).toBe(
        "corrupt",
      );
  },
);

it("keeps saved dialogue text distinct from bounded authored references", () => {
  const envelope = outdatedEnvelope();
  const state = {
    ...envelope.state,
    choiceResponse: "text".repeat(100),
    laterAcknowledgment: "",
    outcomeScene: "scene".repeat(100),
  };
  expect(parseStoredStoryEnvelope("manual:1", { ...envelope, state })).toEqual({
    kind: "ready",
    envelope: { ...envelope, state },
  });
});

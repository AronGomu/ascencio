import type { DatabaseSync } from "node:sqlite";
import { createInitialStoryState } from "../../../src/story/model/story-state.ts";
import { DEFAULT_SHELL_SETTINGS } from "../../../src/shell/settings/shell-settings.ts";
import { DEFAULT_PERSISTED_UI_STATE } from "../../../src/battle/app/stores/persisted-ui-state.ts";
import { DEFAULT_STORY_PLAYBACK_SETTINGS } from "../../../src/story/playback/story-playback-settings.ts";
import type { UserMutation } from "../../../src/storage/contracts/user-data.ts";

export function allUserMutations(): UserMutation[] {
  const deck = {
    schemaVersion: 1,
    id: "deck-1",
    revision: 1,
    name: "Fixture",
    createdAt: "2026-09-24T00:00:00.000Z",
    updatedAt: "2026-09-24T00:00:00.000Z",
    validation: { status: "valid", issues: [], rulesetRevision: "removed" },
    importedNeedsReview: false,
    illustrationCardCode: null,
    main: [1],
    extra: [],
    side: [],
  };
  const update = {
    id: "update-1",
    deckId: "deck-1",
    sequence: 0,
    createdAt: deck.createdAt,
    before: { main: [], extra: [], side: [] },
    after: { main: [1], extra: [], side: [] },
    beforeImportedNeedsReview: false,
    afterImportedNeedsReview: false,
    beforeIllustrationCardCode: null,
    afterIllustrationCardCode: null,
    reason: "add",
  };
  const records = [
    [
      "decks",
      "deck-1",
      {
        deck,
        history: {
          undo: [update],
          redo: [{ ...update, id: "update-2", sequence: 1 }],
          nextSequence: 2,
        },
      },
    ],
    ["deck-meta", "lastOpened", "deck-1"],
    ["deck-meta", "defaultDeck", null],
    [
      "deck-autosaves",
      "autosave-1",
      {
        id: "autosave-1",
        deckId: "deck-1",
        deckName: "Fixture",
        createdAt: deck.createdAt,
        main: [1],
        extra: [],
        side: [],
        illustrationCardCode: null,
      },
    ],
    [
      "story",
      "manual:1",
      {
        schemaVersion: 6,
        slot: "manual:1",
        revision: 1,
        savedAt: 1800000000000,
        state: {
          ...createInitialStoryState(),
          narrativeIndex: 999,
          encounterId: "removed-opponent",
          choice: "removed-choice",
          choiceResponse: "removed-beat",
          outcomeScene: "removed-outcome-beat",
          locations: [
            { id: "removed-location", access: "available", completed: true },
          ],
          collection: { 123: 3 },
          decks: [deck],
          defaultDeckId: "deck-1",
        },
        story: {
          chapterId: "removed-chapter",
          contentId: "removed-content",
          revision: 97,
          completedChapterIds: ["removed-completed-chapter"],
        },
      },
    ],
    ["preferences", "shell", { ...DEFAULT_SHELL_SETTINGS }],
    ["preferences", "battle-ui", { ...DEFAULT_PERSISTED_UI_STATE }],
    ["preferences", "story-playback", { ...DEFAULT_STORY_PLAYBACK_SETTINGS }],
    ["story-read-log", "read", { version: 1, beats: ["removed-beat"] }],
  ] as const;
  return records.map(([namespace, key, payload]) => ({
    kind: "put",
    namespace,
    key,
    expectedRevision: null,
    payload,
  }));
}

export function logicalUserSnapshot(database: DatabaseSync) {
  return {
    schema: database
      .prepare(
        "SELECT type, name, tbl_name, sql FROM sqlite_schema ORDER BY type, name",
      )
      .all(),
    version: database.prepare("PRAGMA user_version").all(),
    journal: database.prepare("PRAGMA journal_mode").all(),
    meta: database
      .prepare("SELECT * FROM user_data_meta ORDER BY singleton")
      .all(),
    rows: database
      .prepare("SELECT * FROM user_records ORDER BY namespace, record_key")
      .all(),
  };
}

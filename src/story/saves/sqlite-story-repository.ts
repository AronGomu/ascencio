import { userWriteLifecycle } from "../../storage/index.ts";
import type {
  StorageFailure,
  UserDataStore,
  UserRecord,
  ContentComposition,
} from "../../storage/index.ts";
import { isStoryState } from "./story-save-contracts.ts";
import { isStorySlotKey, storyChapterLabel } from "./story-save-contracts.ts";
import type {
  GenerationSaveRepository,
  StoryBinding,
  StorySaveEnvelope,
  StorySaveReadResult,
  StorySaveWriteResult,
  StorySlotKey,
} from "./generation-contracts.ts";
import { parseStoredStoryEnvelope } from "./stored-story-envelope.ts";
import type { PersistedStoryEnvelope } from "./persisted-story-contracts.ts";

export function createSqliteStoryRepository(
  store: UserDataStore,
  composition?: ContentComposition,
): GenerationSaveRepository {
  return {
    async read(slot) {
      if (!isStorySlotKey(slot)) return { kind: "empty", slot };
      const result = await store.readUser("story", slot);
      if (result.kind === "failed")
        return {
          kind: "corrupt",
          slot,
          reason: result.error.code,
        };
      const read = readRecord(slot, result.value);
      if (
        read.kind === "ready" &&
        read.envelope.story.contentComposition &&
        read.envelope.story.contentComposition.identity !==
          composition?.identity
      )
        return {
          kind: "incompatible",
          slot,
          found: 6,
          reason: "content-composition",
        };
      return read;
    },

    write(slot, state, expectedRevision, story) {
      let stateSnapshot: typeof state;
      let storySnapshot: StoryBinding;
      try {
        stateSnapshot = structuredClone(state);
        storySnapshot = structuredClone(story);
        if (
          storySnapshot.contentComposition &&
          storySnapshot.contentComposition.identity !== composition?.identity
        )
          return Promise.resolve({ kind: "failed", reason: "unknown" });
        if (composition?.requiredMods.length)
          storySnapshot = { ...storySnapshot, contentComposition: composition };
      } catch {
        return Promise.resolve({ kind: "failed", reason: "unknown" });
      }
      return userWriteLifecycle(store)
        .run(
          () =>
            writeSnapshot(
              store,
              slot,
              stateSnapshot,
              expectedRevision,
              storySnapshot,
            ),
          (result) =>
            result.kind === "failed"
              ? {
                  code:
                    result.reason === "quota"
                      ? "STORAGE_QUOTA_EXCEEDED"
                      : "STORAGE_UNAVAILABLE",
                }
              : null,
        )
        .catch((): StorySaveWriteResult => ({
          kind: "failed",
          reason: "unavailable",
        }));
    },

    async list() {
      const result = await store.listUser("story");
      if (result.kind === "failed") throw storageError(result.error);
      return Object.freeze(
        result.value
          .flatMap((record) => {
            if (!isStorySlotKey(record.key)) return [];
            const parsed = readRecord(record.key, record);
            return parsed.kind === "ready"
              ? [
                  {
                    slot: parsed.envelope.slot,
                    revision: parsed.envelope.revision,
                    savedAt: parsed.envelope.savedAt,
                    chapterLabel: storyChapterLabel(parsed.envelope.state),
                  },
                ]
              : [];
          })
          .sort(
            (left, right) =>
              right.savedAt - left.savedAt ||
              left.slot.localeCompare(right.slot),
          ),
      );
    },

    clear(slot, expectedRevision) {
      return userWriteLifecycle(store).run(async () => {
        if (!isStorySlotKey(slot)) return;
        for (let attempt = 0; attempt < 2; attempt += 1) {
          const current = await store.readUser("story", slot);
          if (current.kind === "failed") throw storageError(current.error);
          if (
            expectedRevision !== undefined &&
            (current.value?.revision ?? 0) !== expectedRevision
          )
            throw storageError({ code: "STORAGE_CONFLICT" });
          if (current.value === null) return;
          const result = await store.writeUser([
            {
              kind: "delete",
              namespace: "story",
              key: slot,
              expectedRevision: current.value.revision,
            },
          ]);
          if (result.kind === "ok") return;
          if (
            expectedRevision !== undefined ||
            result.error.code !== "STORAGE_CONFLICT"
          )
            throw storageError(result.error);
        }
        throw storageError({ code: "STORAGE_CONFLICT" });
      });
    },
  };
}

async function writeSnapshot(
  store: UserDataStore,
  slot: StorySlotKey,
  state: Parameters<GenerationSaveRepository["write"]>[1],
  expectedRevision: number | null,
  story: StoryBinding,
): Promise<StorySaveWriteResult> {
  if (
    !isStorySlotKey(slot) ||
    !(
      expectedRevision === null ||
      (Number.isSafeInteger(expectedRevision) && expectedRevision >= 0)
    )
  )
    return { kind: "failed", reason: "unknown" };
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const current = await store.readUser("story", slot);
    if (current.kind === "failed") return writeFailure(current.error);
    const currentRevision = current.value?.revision ?? 0;
    if (
      current.value !== null &&
      persistedEnvelope(slot, current.value) === null
    )
      return { kind: "failed", reason: "unknown" };
    if (expectedRevision !== null && expectedRevision !== currentRevision)
      return { kind: "stale", currentRevision };
    const revision = currentRevision + 1;
    const envelope: StorySaveEnvelope = {
      schemaVersion: 6,
      slot,
      revision,
      savedAt: Date.now(),
      state,
      story,
    };
    if (
      parseStoredStoryEnvelope(slot, envelope).kind !== "ready" ||
      !isStoryState(state, Number.MAX_SAFE_INTEGER)
    )
      return { kind: "failed", reason: "unknown" };
    const result = await store.writeUser([
      {
        kind: "put",
        namespace: "story",
        key: slot,
        expectedRevision: current.value?.revision ?? null,
        payload: envelope,
      },
    ]);
    if (result.kind === "ok") return { kind: "written", revision };
    if (result.error.code !== "STORAGE_CONFLICT")
      return writeFailure(result.error);
    if (expectedRevision !== null) {
      const latest = await store.readUser("story", slot);
      return latest.kind === "ok"
        ? {
            kind: "stale",
            currentRevision: latest.value?.revision ?? 0,
          }
        : writeFailure(latest.error);
    }
  }
  return { kind: "failed", reason: "unknown" };
}

function readRecord(
  slot: StorySlotKey,
  record: UserRecord | null,
): StorySaveReadResult {
  if (record === null) return { kind: "empty", slot };
  const parsed = parseStoredStoryEnvelope(slot, record.payload);
  if (parsed.kind !== "ready") return parsed;
  if (parsed.envelope.revision !== record.revision)
    return {
      kind: "corrupt",
      slot,
      reason: "Saved story revision does not match storage revision",
    };
  return strictEnvelope(parsed) ?? { kind: "incompatible", slot, found: 6 };
}

function persistedEnvelope(
  slot: StorySlotKey,
  record: UserRecord,
): PersistedStoryEnvelope | null {
  const parsed = parseStoredStoryEnvelope(slot, record.payload);
  return parsed.kind === "ready" && parsed.envelope.revision === record.revision
    ? parsed.envelope
    : null;
}

function strictEnvelope(
  parsed: ReturnType<typeof parseStoredStoryEnvelope>,
): Extract<StorySaveReadResult, { readonly kind: "ready" }> | null {
  if (parsed.kind !== "ready") return null;
  const value = parsed.envelope;
  if (!isStoryState(value.state, Number.MAX_SAFE_INTEGER)) return null;
  const envelope: StorySaveEnvelope = {
    schemaVersion: 6,
    slot: value.slot,
    revision: value.revision,
    savedAt: value.savedAt,
    state: value.state,
    story: structuredClone(value.story),
  };
  return { kind: "ready", envelope };
}

function writeFailure(error: StorageFailure): StorySaveWriteResult {
  return {
    kind: "failed",
    reason:
      error.code === "STORAGE_QUOTA_EXCEEDED"
        ? "quota"
        : error.code === "STORAGE_UNAVAILABLE" ||
            error.code === "SQLITE_UNAVAILABLE" ||
            error.code === "USER_DATA_INVALID"
          ? "unavailable"
          : "unknown",
  };
}

function storageError(error: StorageFailure): Error {
  return new Error(error.code, { cause: error });
}

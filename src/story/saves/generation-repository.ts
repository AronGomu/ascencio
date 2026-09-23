import type {
  GenerationSaveRepository,
  StoryGenerationId,
  StorySaveWriteResult,
} from "./generation-contracts.ts";
import {
  GENERATIONS,
  GENERATION_SAVES,
  abort,
  migrationFailed,
  request,
  settled,
  storageError,
} from "./generation-database.ts";
import { validRecord } from "./generation-record.ts";
import { parseGenerationEnvelope } from "./generation-envelope.ts";
import {
  isStorySlotKey,
  STORY_SAVES_STORE_NAME,
  STORY_SLOT_KEYS,
  storyChapterLabel,
} from "./story-save-contracts.ts";
import { semanticJson } from "../ports/release-value.ts";
export function generationRepository(
  open: () => Promise<IDBDatabase>,
  id: StoryGenerationId,
  now: () => number,
): GenerationSaveRepository {
  async function descriptor(db: IDBDatabase) {
    const tx = db.transaction(GENERATIONS, "readonly"),
      done = settled(tx);
    const [row] = await Promise.all([
      request(tx.objectStore(GENERATIONS).get(id)),
      done,
    ]);
    return await validRecord(row, id);
  }
  return {
    async read(slot) {
      if (!isStorySlotKey(slot)) return { kind: "empty", slot };
      try {
        const db = await open();
        const row = await descriptor(db);
        const tx = db.transaction(
            [GENERATION_SAVES, STORY_SAVES_STORE_NAME],
            "readonly",
          ),
          done = settled(tx);
        const [value, legacy] = await Promise.all([
          request(tx.objectStore(GENERATION_SAVES).get([id, slot])),
          request(tx.objectStore(STORY_SAVES_STORE_NAME).get(slot)),
          done,
        ]);
        if (value === undefined && legacy !== undefined)
          return {
            kind: "incompatible",
            slot,
            found:
              typeof legacy?.schemaVersion === "number"
                ? legacy.schemaVersion
                : 0,
          };
        return parseGenerationEnvelope(slot, value, row.descriptor);
      } catch (error) {
        return { kind: "corrupt", slot, reason: storageError(error).message };
      }
    },
    write(slot, state, expectedRevision, story) {
      // Both snapshots precede open(), IDB work, and caller-controlled awaits.
      let snapshot: typeof state, binding: typeof story;
      try {
        snapshot = structuredClone(state);
        binding = structuredClone(story);
      } catch {
        return Promise.resolve({ kind: "failed", reason: "unknown" });
      }
      return (async (): Promise<StorySaveWriteResult> => {
        if (
          !isStorySlotKey(slot) ||
          !(
            expectedRevision === null ||
            (Number.isSafeInteger(expectedRevision) && expectedRevision >= 0)
          )
        )
          return { kind: "failed", reason: "unknown" };
        let db: IDBDatabase;
        try {
          db = await open();
        } catch {
          return { kind: "failed", reason: "unavailable" };
        }
        try {
          const row = await descriptor(db);
          const tx = db.transaction(
              [GENERATIONS, GENERATION_SAVES],
              "readwrite",
            ),
            done = settled(tx);
          try {
            const store = tx.objectStore(GENERATION_SAVES);
            const [current, actual] = await Promise.all([
              request(store.get([id, slot])),
              request(tx.objectStore(GENERATIONS).get(id)),
            ]);
            if (semanticJson(actual) !== semanticJson(row)) migrationFailed();
            const parsed = parseGenerationEnvelope(
              slot,
              current,
              row.descriptor,
            );
            const currentRevision =
              parsed.kind === "ready" ? parsed.envelope.revision : 0;
            if (
              expectedRevision !== null &&
              expectedRevision !== currentRevision
            ) {
              await done;
              return { kind: "stale", currentRevision };
            }
            const revision = currentRevision + 1;
            const envelope = {
              schemaVersion: 6 as const,
              slot,
              revision,
              savedAt: now(),
              state: snapshot,
              story: binding,
            };
            if (
              parseGenerationEnvelope(slot, envelope, row.descriptor).kind !==
              "ready"
            )
              migrationFailed();
            store.put(envelope, [id, slot]);
            await done;
            return { kind: "written", revision };
          } catch (error) {
            await abort(tx, done);
            throw error;
          }
        } catch (error) {
          return {
            kind: "failed",
            reason:
              (error instanceof DOMException &&
                error.name === "QuotaExceededError") ||
              (error instanceof Error &&
                error.message === "STORY_STORAGE_QUOTA")
                ? "quota"
                : error instanceof DOMException ||
                    (error instanceof Error &&
                      error.message === "STORY_STORAGE_UNAVAILABLE")
                  ? "unavailable"
                  : "unknown",
          };
        }
      })();
    },
    async list() {
      try {
        const db = await open();
        const row = await descriptor(db);
        const tx = db.transaction(GENERATION_SAVES, "readonly"),
          done = settled(tx);
        const [values] = await Promise.all([
          Promise.all(
            STORY_SLOT_KEYS.map((slot) =>
              request(tx.objectStore(GENERATION_SAVES).get([id, slot])),
            ),
          ),
          done,
        ]);
        return Object.freeze(
          values
            .flatMap((value, i) => {
              const parsed = parseGenerationEnvelope(
                STORY_SLOT_KEYS[i]!,
                value,
                row.descriptor,
              );
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
              (a, b) => b.savedAt - a.savedAt || a.slot.localeCompare(b.slot),
            ),
        );
      } catch (error) {
        throw storageError(error);
      }
    },
    async clear(slot) {
      if (!isStorySlotKey(slot)) return;
      try {
        const db = await open();
        await descriptor(db);
        const tx = db.transaction([GENERATIONS, GENERATION_SAVES], "readwrite"),
          done = settled(tx);
        try {
          if (
            (await request(tx.objectStore(GENERATIONS).get(id))) === undefined
          )
            migrationFailed();
          tx.objectStore(GENERATION_SAVES).delete([id, slot]);
          await done;
        } catch (error) {
          await abort(tx, done);
          throw error;
        }
      } catch (error) {
        throw storageError(error);
      }
    },
  };
}

import type { StoryRelease } from "../ports/story-release.ts";
import { parseStoryRelease } from "../ports/parse-story-release.ts";
import { validateStoryContinuity } from "../ports/story-continuity.ts";
import { semanticJson } from "../ports/release-value.ts";
import type {
  StoryGenerationId,
  StoryGenerationSeal,
  StoryMigrationPort,
  StorySaveEnvelope,
} from "./generation-contracts.ts";
import {
  GENERATIONS,
  GENERATION_SAVES,
  abort,
  migrationFailed,
  request,
  settled,
  storageError,
  storyDatabase,
} from "./generation-database.ts";
import {
  digest,
  slotSeals,
  snapshot,
  snapshotRequests,
  validRecord,
  validateSealShape,
  type GenerationRecord,
  type GenerationSnapshot,
} from "./generation-record.ts";
import { parseGenerationEnvelope } from "./generation-envelope.ts";
import { generationRepository } from "./generation-repository.ts";
import { STORY_SLOT_KEYS } from "./story-save-contracts.ts";
export function createStoryMigrationPort(
  factory: IDBFactory,
  now: () => number = Date.now,
): StoryMigrationPort {
  const open = storyDatabase(factory);
  return {
    async prepare(sourceGenerationId, target) {
      // Snapshot caller-owned release before first await. Validation errors stay semantic.
      let descriptor: StoryRelease;
      try {
        descriptor = parseStoryRelease(target);
      } catch {
        return migrationFailed();
      }
      try {
        const db = await open();
        const source: GenerationSnapshot =
          sourceGenerationId === null
            ? { row: null, values: STORY_SLOT_KEYS.map(() => undefined) }
            : await snapshot(db, sourceGenerationId);
        const row =
          sourceGenerationId === null
            ? null
            : await validRecord(source.row, sourceGenerationId);
        const values = migrate(
          source.values,
          row?.descriptor ?? null,
          descriptor,
        );
        const descriptorDigest = await digest(descriptor),
          sourceDigest = await digest(source);
        const tx = db.transaction(GENERATIONS, "readonly"),
          done = settled(tx);
        const [candidates] = await Promise.all([
          request(tx.objectStore(GENERATIONS).getAll()),
          done,
        ]);
        for (const candidate of candidates as GenerationRecord[]) {
          if (
            candidate.sourceGenerationId !== sourceGenerationId ||
            candidate.sourceDigest !== sourceDigest ||
            candidate.descriptorDigest !== descriptorDigest
          )
            continue;
          const checked = await validRecord(candidate, candidate.generationId);
          const current = await snapshot(db, checked.generationId);
          if (
            semanticJson(await slotSeals(current.values)) !==
            semanticJson(checked.seal.slots)
          )
            continue;
          // CAS check also applies to idempotent reuse; no stale source receipt.
          await commit(db, sourceGenerationId, source, checked, values, false);
          return structuredClone(checked.seal);
        }
        const generationId = crypto.randomUUID() as StoryGenerationId;
        const seal = {
          generationId,
          sourceGenerationId,
          revision: descriptor.revision,
          slots: await slotSeals(values),
        };
        const prepared: GenerationRecord = {
          generationId,
          sourceGenerationId,
          phase: "prepared",
          descriptor,
          descriptorDigest,
          sourceDigest,
          seal,
        };
        return structuredClone(
          await commit(db, sourceGenerationId, source, prepared, values, true),
        );
      } catch (error) {
        throw storageError(error);
      }
    },
    async verifySeal(input) {
      let seal: StoryGenerationSeal;
      try {
        seal = structuredClone(input);
        validateSealShape(seal);
      } catch {
        return migrationFailed();
      }
      try {
        const current = await snapshot(await open(), seal.generationId);
        const row = await validRecord(current.row, seal.generationId);
        if (semanticJson(row.seal) !== semanticJson(seal)) migrationFailed();
        for (const [i, value] of current.values.entries())
          if (
            value !== undefined &&
            parseGenerationEnvelope(STORY_SLOT_KEYS[i]!, value, row.descriptor)
              .kind !== "ready"
          )
            migrationFailed();
        if (
          semanticJson(await slotSeals(current.values)) !==
          semanticJson(seal.slots)
        )
          migrationFailed();
      } catch (error) {
        throw storageError(error);
      }
    },
    async verifyActiveGeneration(id, target) {
      let descriptor: StoryRelease;
      try {
        descriptor = parseStoryRelease(target);
      } catch {
        return migrationFailed();
      }
      try {
        const current = await snapshot(await open(), id);
        const row = await validRecord(current.row, id);
        if (semanticJson(row.descriptor) !== semanticJson(descriptor))
          migrationFailed();
      } catch (error) {
        throw storageError(error);
      }
    },
    repository(id) {
      return generationRepository(open, id, now);
    },
  };
}
function migrate(
  values: readonly unknown[],
  previous: StoryRelease | null,
  next: StoryRelease,
): readonly (StorySaveEnvelope | undefined)[] {
  try {
    if (previous !== null) validateStoryContinuity(previous, next);
    return values.map((value, i) => {
      if (value === undefined) return undefined;
      if (previous === null) return migrationFailed();
      const parsed = parseGenerationEnvelope(
        STORY_SLOT_KEYS[i]!,
        value,
        previous,
      );
      if (parsed.kind !== "ready") return migrationFailed();
      const old = parsed.envelope;
      const before = previous.chapters.find(
        (c) => c.id === old.story.chapterId,
      )!.document!;
      const after = next.chapters.find(
        (c) => c.id === old.story.chapterId,
      )?.document;
      if (!after) return migrationFailed();
      const beatId = before.beats[old.state.narrativeIndex]?.id;
      const narrativeIndex = after.beats.findIndex((b) => b.id === beatId);
      if (narrativeIndex < 0) return migrationFailed();
      const envelope = {
        ...old,
        state: { ...old.state, narrativeIndex },
        story: { ...old.story, revision: next.revision },
      };
      if (parseGenerationEnvelope(old.slot, envelope, next).kind !== "ready")
        return migrationFailed();
      return envelope;
    });
  } catch {
    return migrationFailed();
  }
}
/** Only Story IDB requests run inside this transaction. All parsing/hashing precede it. */
async function commit(
  db: IDBDatabase,
  sourceId: StoryGenerationId | null,
  source: GenerationSnapshot,
  row: GenerationRecord,
  values: readonly (StorySaveEnvelope | undefined)[],
  insert: boolean,
): Promise<StoryGenerationSeal> {
  const tx = db.transaction([GENERATIONS, GENERATION_SAVES], "readwrite"),
    done = settled(tx);
  try {
    if (
      sourceId !== null &&
      semanticJson(await snapshotRequests(tx, sourceId)) !==
        semanticJson(source)
    )
      migrationFailed();
    if (insert) {
      // Serialize concurrent identical prepares within the same Story transaction.
      const candidates = (await request(
        tx.objectStore(GENERATIONS).getAll(),
      )) as GenerationRecord[];
      for (const candidate of candidates) {
        if (
          candidate.sourceDigest !== row.sourceDigest ||
          candidate.descriptorDigest !== row.descriptorDigest ||
          candidate.sourceGenerationId !== sourceId
        )
          continue;
        const expected = {
          ...row,
          generationId: candidate.generationId,
          seal: { ...row.seal, generationId: candidate.generationId },
        };
        if (semanticJson(candidate) !== semanticJson(expected))
          migrationFailed();
        const current = await snapshotRequests(tx, candidate.generationId);
        if (semanticJson(current.values) === semanticJson(values)) {
          await done;
          return candidate.seal;
        }
      }
      for (const [i, value] of values.entries())
        if (value !== undefined)
          tx.objectStore(GENERATION_SAVES).put(value, [
            row.generationId,
            STORY_SLOT_KEYS[i]!,
          ]);
      tx.objectStore(GENERATIONS).add(row);
    } else {
      const actual = await snapshotRequests(tx, row.generationId);
      if (
        semanticJson(actual.row) !== semanticJson(row) ||
        semanticJson(actual.values) !== semanticJson(values)
      )
        migrationFailed();
    }
    await done;
    return row.seal;
  } catch (error) {
    await abort(tx, done);
    throw error;
  }
}

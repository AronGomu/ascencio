import type { StoryRelease } from "../ports/story-release.ts";
import { parseStoryRelease } from "../ports/parse-story-release.ts";
import {
  array,
  integer,
  literal,
  record,
  semanticJson,
  text,
  unique,
} from "../ports/release-value.ts";
import type {
  StoryGenerationId,
  StoryGenerationSeal,
  StorySlotKey,
} from "./generation-contracts.ts";
import { STORY_SLOT_KEYS } from "./story-save-contracts.ts";
import {
  GENERATIONS,
  GENERATION_SAVES,
  migrationFailed,
  request,
  settled,
} from "./generation-database.ts";
export interface GenerationRecord {
  readonly generationId: StoryGenerationId;
  readonly sourceGenerationId: StoryGenerationId | null;
  readonly phase: "prepared";
  readonly descriptor: StoryRelease;
  readonly descriptorDigest: string;
  readonly sourceDigest: string;
  readonly seal: StoryGenerationSeal;
}
export interface GenerationSnapshot {
  readonly row: unknown;
  readonly values: readonly unknown[];
}
export async function digest(value: unknown): Promise<string> {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(semanticJson(value)),
  );
  return Array.from(new Uint8Array(hash), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
export function snapshotRequests(tx: IDBTransaction, id: StoryGenerationId) {
  return Promise.all([
    request(tx.objectStore(GENERATIONS).get(id)),
    Promise.all(
      STORY_SLOT_KEYS.map((slot) =>
        request(tx.objectStore(GENERATION_SAVES).get([id, slot])),
      ),
    ),
  ]).then(([row, values]) => ({ row, values }));
}
export async function snapshot(
  db: IDBDatabase,
  id: StoryGenerationId,
): Promise<GenerationSnapshot> {
  const tx = db.transaction([GENERATIONS, GENERATION_SAVES], "readonly");
  const done = settled(tx);
  const [result] = await Promise.all([snapshotRequests(tx, id), done]);
  return result;
}
export async function validRecord(
  value: unknown,
  id: StoryGenerationId,
): Promise<GenerationRecord> {
  if (value === null || typeof value !== "object") return migrationFailed();
  const r = value as GenerationRecord;
  try {
    if (
      Object.keys(r).sort().join(",") !==
        [
          "generationId",
          "sourceGenerationId",
          "phase",
          "descriptor",
          "descriptorDigest",
          "sourceDigest",
          "seal",
        ]
          .sort()
          .join(",") ||
      r.generationId !== id ||
      r.phase !== "prepared" ||
      !(
        r.sourceGenerationId === null ||
        typeof r.sourceGenerationId === "string"
      ) ||
      typeof r.sourceDigest !== "string" ||
      !/^[a-f0-9]{64}$/.test(r.sourceDigest)
    )
      return migrationFailed();
    const descriptor = parseStoryRelease(r.descriptor);
    if (
      semanticJson(descriptor) !== semanticJson(r.descriptor) ||
      (await digest(descriptor)) !== r.descriptorDigest ||
      r.seal.generationId !== id ||
      r.seal.sourceGenerationId !== r.sourceGenerationId ||
      r.seal.revision !== descriptor.revision
    )
      return migrationFailed();
    validateSealShape(r.seal);
    return r;
  } catch {
    return migrationFailed();
  }
}
export function validateSealShape(seal: StoryGenerationSeal): void {
  try {
    const r = record(seal, [
      "generationId",
      "sourceGenerationId",
      "revision",
      "slots",
    ]);
    text(r.generationId);
    if (r.sourceGenerationId !== null) text(r.sourceGenerationId);
    integer(r.revision, 1);
    const keys = array(
      r.slots,
      (value) => {
        const entry = record(value, ["slot", "revision", "digest"]);
        integer(entry.revision, 1);
        if (!/^[a-f0-9]{64}$/.test(text(entry.digest))) migrationFailed();
        return literal(entry.slot, ...STORY_SLOT_KEYS);
      },
      STORY_SLOT_KEYS.length,
    );
    unique(keys, (key) => key);
    if (
      semanticJson(keys) !==
      semanticJson(STORY_SLOT_KEYS.filter((slot) => keys.includes(slot)))
    )
      migrationFailed();
  } catch {
    migrationFailed();
  }
}
export async function slotSeals(
  values: readonly unknown[],
): Promise<StoryGenerationSeal["slots"]> {
  const entries = await Promise.all(
    values.map(async (value, index) =>
      value === undefined
        ? null
        : {
            slot: STORY_SLOT_KEYS[index] as StorySlotKey,
            revision: (value as { revision: number }).revision,
            digest: await digest(value),
          },
    ),
  );
  return entries.filter((entry) => entry !== null);
}

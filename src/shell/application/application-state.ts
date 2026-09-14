import type { StagedContent } from "../../content/index.ts";
import type { StoryGenerationId } from "../../story/saves/index.ts";

export interface ApplicationSelection {
  readonly schemaVersion: 1;
  readonly generation: number;
  readonly content: StagedContent | null;
  readonly storyGenerationId: StoryGenerationId | null;
}

const empty: ApplicationSelection = Object.freeze({
  schemaVersion: 1,
  generation: 0,
  content: null,
  storyGenerationId: null,
});
const hash = /^[a-f0-9]{64}$/;
export function parseApplicationSelection(
  value: unknown,
): ApplicationSelection {
  if (value === undefined) return empty;
  const row = value as ApplicationSelection;
  if (
    !row ||
    typeof row !== "object" ||
    Object.keys(row).sort().join(",") !==
      "content,generation,schemaVersion,storyGenerationId" ||
    row.schemaVersion !== 1 ||
    !Number.isSafeInteger(row.generation) ||
    row.generation < 0
  )
    throw new Error("APP_STORAGE_UNAVAILABLE");
  if (row.generation === 0) {
    if (row.content !== null || row.storyGenerationId !== null)
      throw new Error("APP_STORAGE_UNAVAILABLE");
    return empty;
  }
  const content = row.content;
  if (
    !content ||
    typeof row.storyGenerationId !== "string" ||
    !/^[A-Za-z0-9-]{1,128}$/.test(row.storyGenerationId) ||
    Object.keys(content).sort().join(",") !==
      "chapterIds,manifestVersion,receiptId,releaseSequence" ||
    !hash.test(content.receiptId) ||
    !hash.test(content.manifestVersion) ||
    !Number.isSafeInteger(content.releaseSequence) ||
    content.releaseSequence < 1 ||
    !Array.isArray(content.chapterIds) ||
    content.chapterIds.length < 1 ||
    content.chapterIds.length > 99 ||
    Array.from(content.chapterIds).some(
      (id, i) =>
        typeof id !== "string" ||
        !/^chapter-(0[1-9]|[1-9][0-9])$/.test(id) ||
        (i > 0 && content.chapterIds[i - 1]! >= id),
    )
  )
    throw new Error("APP_STORAGE_UNAVAILABLE");
  return Object.freeze({
    ...row,
    content: Object.freeze({
      ...content,
      chapterIds: Object.freeze([...content.chapterIds]),
    }),
  });
}

function open(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open("ygo-application-state", 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("selection");
      request.result.createObjectStore("coreApproval");
    };
    request.onerror = () =>
      reject(new Error("APP_STORAGE_UNAVAILABLE", { cause: request.error }));
    request.onblocked = () => reject(new Error("APP_STORAGE_UNAVAILABLE"));
    request.onsuccess = () => resolve(request.result);
  });
}

/** Only same-DB IDB callbacks run in this transaction. Commit is visibility's linearization point. */
export async function selectionTransaction(
  factory: IDBFactory,
  candidate?: ApplicationSelection,
): Promise<ApplicationSelection | null> {
  const db = await open(factory);
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(
        "selection",
        candidate ? "readwrite" : "readonly",
      );
      const store = tx.objectStore("selection");
      let result: ApplicationSelection | null = null;
      const request = store.get("active");
      request.onsuccess = () => {
        try {
          const current = parseApplicationSelection(request.result);
          if (!candidate) result = current;
          else if (current.generation === candidate.generation - 1) {
            result = parseApplicationSelection(candidate);
            store.put(result, "active");
          }
        } catch {
          tx.abort();
        }
      };
      tx.oncomplete = () => resolve(result);
      tx.onabort = () =>
        reject(new Error("APP_STORAGE_UNAVAILABLE", { cause: tx.error }));
      tx.onerror = () =>
        reject(new Error("APP_STORAGE_UNAVAILABLE", { cause: tx.error }));
    });
  } finally {
    db.close();
  }
}

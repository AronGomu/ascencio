import {
  createStorySaveStores,
  STORY_SAVES_DATABASE_NAME,
} from "./story-save-contracts.ts";
export const GENERATIONS = "generations";
export const GENERATION_SAVES = "generationSaves";
export function migrationFailed(): never {
  throw new Error("STORY_MIGRATION_FAILED");
}
export function storageError(error: unknown): Error {
  if (
    error instanceof Error &&
    [
      "STORY_MIGRATION_FAILED",
      "STORY_STORAGE_UNAVAILABLE",
      "STORY_STORAGE_QUOTA",
    ].includes(error.message)
  )
    return error;
  return new Error(
    error instanceof DOMException && error.name === "QuotaExceededError"
      ? "STORY_STORAGE_QUOTA"
      : "STORY_STORAGE_UNAVAILABLE",
  );
}
export function storyDatabase(factory: IDBFactory): () => Promise<IDBDatabase> {
  let connection: Promise<IDBDatabase> | null = null;
  return () =>
    (connection ??= new Promise<IDBDatabase>((resolve, reject) => {
      let pending: IDBOpenDBRequest;
      try {
        pending = factory.open(STORY_SAVES_DATABASE_NAME, 2);
      } catch (error) {
        reject(storageError(error));
        return;
      }
      let refused = false;
      pending.onupgradeneeded = () => createStorySaveStores(pending.result);
      pending.onerror = () => reject(storageError(pending.error));
      pending.onblocked = () => {
        refused = true;
        reject(storageError(null));
      };
      pending.onsuccess = () => {
        const db = pending.result;
        if (refused) {
          db.close();
          return;
        }
        db.onversionchange = () => {
          db.close();
          connection = null;
        };
        db.onclose = () => {
          connection = null;
        };
        resolve(db);
      };
    }).catch((error: unknown) => {
      connection = null;
      throw storageError(error);
    }));
}
export function request<T>(pending: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    pending.onsuccess = () => resolve(pending.result);
    pending.onerror = () => reject(pending.error);
  });
}
/** Register before requests, so abort/complete cannot race handler attachment. */
export function settled(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () =>
      reject(tx.error ?? new Error("STORY_STORAGE_UNAVAILABLE"));
  });
}
export async function abort(
  tx: IDBTransaction,
  done: Promise<void>,
): Promise<void> {
  try {
    tx.abort();
  } catch (error) {
    if (!(error instanceof DOMException && error.name === "InvalidStateError"))
      throw error;
  }
  // Consume expected abort rejection; caller preserves original failure.
  await done.catch(() => undefined);
}

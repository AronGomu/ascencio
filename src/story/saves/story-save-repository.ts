/* Durable story progress. Every slot holds at most one record, writes to the
   same slot are serialized, and no failure path throws into the story: a read
   that cannot produce a save produces "no save" plus a reason, so a bad record
   costs the player their progress and never their session. */

import {
  createStorySaveStores,
  isStorySlotKey,
  parseStorySaveEnvelope,
  STORY_SAVE_SCHEMA_VERSION,
  STORY_SAVES_DATABASE_NAME,
  STORY_SAVES_DATABASE_VERSION,
  STORY_SAVES_STORE_NAME,
  summarizeStorySave,
  type StorySaveReadResult,
  type StorySaveSummary,
  type StorySaveWriteResult,
  type StorySlotKey,
} from "./story-save-contracts.ts";
import type { StoryState } from "../model/story-state.ts";

export interface StorySaveRepository {
  read(slot: StorySlotKey): Promise<StorySaveReadResult>;
  /**
   * Writes `state` into `slot`, returning the revision it landed on.
   *
   * `expectedRevision` is the revision the caller believes is stored: `null`
   * overwrites whatever is there, a number writes only when it still matches,
   * so a checkpoint restored from a slower tab cannot roll a newer save back.
   * An empty slot counts as revision 0.
   */
  write(
    slot: StorySlotKey,
    state: StoryState,
    expectedRevision: number | null,
  ): Promise<StorySaveWriteResult>;
  list(): Promise<readonly StorySaveSummary[]>;
  clear(slot: StorySlotKey): Promise<void>;
}

export function createStorySaveRepository(
  factory: IDBFactory,
  now: () => number = () => Date.now(),
): StorySaveRepository {
  /* One connection per repository, reopened after the admin console deletes
     the database out from under it. A rejection drops the cache so the next
     call retries rather than replaying the same failure forever. */
  let connection: Promise<IDBDatabase> | null = null;

  function open(): Promise<IDBDatabase> {
    connection ??= new Promise<IDBDatabase>((resolve, reject) => {
      const request = factory.open(
        STORY_SAVES_DATABASE_NAME,
        STORY_SAVES_DATABASE_VERSION,
      );
      request.onupgradeneeded = () => createStorySaveStores(request.result);
      request.onerror = () =>
        reject(request.error ?? new Error("Could not open story saves"));
      /* Another tab holding an older version open. Rejecting keeps the caller
         on its in-memory story instead of hanging on a queued upgrade. */
      request.onblocked = () =>
        reject(new Error("Another browser tab still has the story saves open"));
      request.onsuccess = () => {
        const database = request.result;
        const forget = (): void => {
          connection = null;
        };
        database.onversionchange = () => {
          database.close();
          forget();
        };
        database.onclose = forget;
        resolve(database);
      };
    }).catch((error: unknown) => {
      connection = null;
      throw error;
    });
    return connection;
  }

  /* Per-slot, not global: an autosave must not queue behind a manual save of a
     different slot, but two writes to the same slot have to read-then-write in
     order or the second silently reuses the first's revision. */
  const chains = new Map<StorySlotKey, Promise<unknown>>();

  function serialize<T>(
    slot: StorySlotKey,
    task: () => Promise<T>,
  ): Promise<T> {
    const next = (chains.get(slot) ?? Promise.resolve()).then(task, task);
    chains.set(
      slot,
      next.catch(() => undefined),
    );
    return next;
  }

  async function readEnvelope(
    slot: StorySlotKey,
  ): Promise<StorySaveReadResult> {
    const database = await open();
    const transaction = database.transaction(
      STORY_SAVES_STORE_NAME,
      "readonly",
    );
    const record = transaction.objectStore(STORY_SAVES_STORE_NAME).get(slot);
    await settled(transaction);
    return parseStorySaveEnvelope(slot, record.result);
  }

  return {
    async read(slot) {
      if (!isStorySlotKey(slot)) return { kind: "empty", slot };
      try {
        return await readEnvelope(slot);
      } catch (error) {
        /* Storage being unreachable and storage holding nonsense are the same
           thing to the story: there is no save to resume, and the reason goes
           on screen. Throwing here would blank the page instead. */
        return { kind: "corrupt", slot, reason: reason(error) };
      }
    },

    write(slot, state, expectedRevision) {
      if (!isStorySlotKey(slot))
        return Promise.resolve({ kind: "failed", reason: "unknown" as const });
      return serialize(slot, async () => {
        let database: IDBDatabase;
        try {
          database = await open();
        } catch (error) {
          return failure(error, "unavailable");
        }
        const transaction = database.transaction(
          STORY_SAVES_STORE_NAME,
          "readwrite",
        );
        try {
          const store = transaction.objectStore(STORY_SAVES_STORE_NAME);
          const current = await request(store.get(slot));
          const parsed = parseStorySaveEnvelope(slot, current);
          /* Anything unreadable counts as revision 0, so a corrupt slot is
             replaceable by the next save rather than permanently wedged. */
          const currentRevision =
            parsed.kind === "ready" ? parsed.envelope.revision : 0;
          if (expectedRevision !== null && expectedRevision !== currentRevision)
            return abandon(transaction, { kind: "stale", currentRevision });
          const revision = currentRevision + 1;
          store.put(
            {
              schemaVersion: STORY_SAVE_SCHEMA_VERSION,
              slot,
              revision,
              savedAt: now(),
              state,
            },
            slot,
          );
          await settled(transaction);
          return { kind: "written", revision };
        } catch (error) {
          return abandon(transaction, failure(error, "unknown"));
        }
      });
    },

    async list() {
      try {
        const database = await open();
        const transaction = database.transaction(
          STORY_SAVES_STORE_NAME,
          "readonly",
        );
        const store = transaction.objectStore(STORY_SAVES_STORE_NAME);
        /* Both requests are issued before the first await, so the transaction
           cannot auto-commit between them and the two arrays stay aligned. */
        const keys = store.getAllKeys();
        const values = store.getAll();
        await settled(transaction);

        const summaries: StorySaveSummary[] = [];
        keys.result.forEach((key, index) => {
          if (!isStorySlotKey(key)) return;
          const parsed = parseStorySaveEnvelope(key, values.result[index]);
          /* A record this build cannot read is left out of the listing rather
             than allowed to fail it: one bad slot must not hide the others. */
          if (parsed.kind === "ready")
            summaries.push(summarizeStorySave(parsed.envelope));
        });
        return Object.freeze(
          summaries.sort(
            (left, right) =>
              right.savedAt - left.savedAt ||
              left.slot.localeCompare(right.slot),
          ),
        );
      } catch {
        return Object.freeze([]);
      }
    },

    clear(slot) {
      if (!isStorySlotKey(slot)) return Promise.resolve();
      return serialize(slot, async () => {
        const database = await open();
        const transaction = database.transaction(
          STORY_SAVES_STORE_NAME,
          "readwrite",
        );
        transaction.objectStore(STORY_SAVES_STORE_NAME).delete(slot);
        await settled(transaction);
      });
    },
  };
}

/** Ends a transaction without writing, then answers with `result`. Used for
    both the stale-write refusal and the failure path, so neither can leave a
    half-open transaction holding the store.

    Deliberately does not wait for the abort to be observed. On the failure
    path the transaction has usually aborted itself already, and an `abort`
    handler attached after the event has been delivered is never called: waiting
    on one would leave the caller with no answer at all rather than a typed
    failure. Nothing was committed either way, and the next write on this slot
    queues behind the abort. */
function abandon<T>(transaction: IDBTransaction, result: T): T {
  try {
    transaction.abort();
  } catch {
    // Already settled: nothing was written either way.
  }
  return result;
}

function failure(
  error: unknown,
  fallback: "unavailable" | "unknown",
): StorySaveWriteResult {
  return {
    kind: "failed",
    reason:
      error instanceof DOMException && error.name === "QuotaExceededError"
        ? "quota"
        : fallback,
  };
}

function request<T>(pending: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    pending.onsuccess = () => resolve(pending.result);
    pending.onerror = () =>
      reject(pending.error ?? new Error("Story save request failed"));
  });
}

function settled(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("Story save write was aborted"));
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("Story save write failed"));
  });
}

function reason(error: unknown): string {
  return error instanceof Error ? error.message : "Story saves are unavailable";
}

import { userWriteLifecycle } from "../storage/index.ts";
import type {
  StorageFailure,
  StorageResult,
  UserDataStore,
  UserMutation,
  UserRecord,
} from "../storage/index.ts";
import type {
  DeckAutosaveRecord,
  DeckCardLists,
  DeckHistory,
  DeckId,
  DeckRecord,
  StoredDeck,
} from "./deck-contracts.ts";
import { deckId } from "./deck-contracts.ts";
import { isDeckAutosaveRecord, isStoredDeck } from "./contracts/index.ts";
import type { DeckRepository } from "./deck-repository.ts";
import {
  DeckRevisionConflictError,
  DeckStorageError,
} from "./deck-storage-errors.ts";
import { MAXIMUM_DECK_UPDATES } from "./deck-history.ts";
import { MAXIMUM_DECK_AUTOSAVES } from "./deck-autosave.ts";

const LAST_OPENED_KEY = "lastOpened";
const DEFAULT_DECK_KEY = "defaultDeck";

// Share the whole read/write operation across repositories using this store.
const mutationTails = new WeakMap<UserDataStore, Promise<void>>();

export function createSqliteDeckRepository(
  store: UserDataStore,
): DeckRepository {
  return {
    async list() {
      const records = requireResult(
        "Unable to list decks",
        await store.listUser("decks"),
      );
      return Object.freeze(
        records
          .map((record) => storedDeck(record).deck)
          .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
      );
    },

    async load(id) {
      const record = requireResult(
        "Unable to load deck",
        await store.readUser("decks", id),
      );
      return record === null ? null : storedDeck(record);
    },

    create(deck, history) {
      return create(deck, history, false);
    },

    createAndOpen(deck, history) {
      return create(deck, history, true);
    },

    async save(expectedRevision, deck, history) {
      const deckSnapshot = snapshot(deck);
      const historySnapshot = snapshot(history);
      return serializeDeckMutation(store, async () => {
        const current = requireResult(
          "Unable to save deck",
          await store.readUser("decks", deckSnapshot.id),
        );
        if (current === null || current.revision !== expectedRevision)
          throw new DeckRevisionConflictError(current?.revision ?? null);
        const currentDeck = storedDeck(current).deck;
        const next = prepareStoredDeck(
          {
            ...deckSnapshot,
            revision: expectedRevision + 1,
            updatedAt: latestTimestamp(currentDeck.updatedAt, new Date()),
          },
          historySnapshot,
        );
        const result = await store.writeUser([
          {
            kind: "put",
            namespace: "decks",
            key: deckSnapshot.id,
            expectedRevision,
            payload: next,
          },
        ]);
        if (result.kind === "failed") {
          if (result.error.code === "STORAGE_CONFLICT")
            throw new DeckRevisionConflictError(
              await currentDeckRevision(store, deckSnapshot.id),
            );
          throw storageError("Unable to save deck", result.error);
        }
        return storedDeck(
          requireReturned(result.value, "decks", deckSnapshot.id),
        );
      });
    },

    async delete(id, expectedRevision) {
      return serializeDeckMutation(store, async () => {
        const current = requireResult(
          "Unable to delete deck",
          await store.readUser("decks", id),
        );
        if (current !== null && current.revision !== expectedRevision)
          throw new DeckRevisionConflictError(current.revision);
        const pointers = await Promise.all([
          readMeta(store, LAST_OPENED_KEY, "Unable to delete deck"),
          readMeta(store, DEFAULT_DECK_KEY, "Unable to delete deck"),
        ]);
        const mutations: UserMutation[] =
          current === null
            ? []
            : [
                {
                  kind: "delete",
                  namespace: "decks",
                  key: id,
                  expectedRevision,
                },
              ];
        for (const pointer of pointers)
          if (pointer !== null && pointer.payload === id)
            mutations.push({
              kind: "delete",
              namespace: "deck-meta",
              key: pointer.key,
              expectedRevision: pointer.revision,
            });
        if (mutations.length === 0) return;
        const result = await store.writeUser(mutations);
        if (result.kind === "failed") {
          if (result.error.code === "STORAGE_CONFLICT")
            throw new DeckRevisionConflictError(
              await currentDeckRevision(store, id),
            );
          throw storageError("Unable to delete deck", result.error);
        }
      });
    },

    async getLastOpened() {
      return await readPointer(store, LAST_OPENED_KEY, false);
    },

    async setLastOpened(id) {
      return serializeDeckMutation(store, () =>
        writePointer(store, LAST_OPENED_KEY, id, "last-opened"),
      );
    },

    async clearLastOpened(expectedId) {
      return serializeDeckMutation(store, async () => {
        const current = await readMeta(
          store,
          LAST_OPENED_KEY,
          "Unable to clear last-opened deck",
        );
        if (
          current === null ||
          (expectedId !== undefined && current.payload !== expectedId)
        )
          return;
        const result = await store.writeUser([
          {
            kind: "delete",
            namespace: "deck-meta",
            key: LAST_OPENED_KEY,
            expectedRevision: current.revision,
          },
        ]);
        requireResult("Unable to clear last-opened deck", result);
      });
    },

    async getDefaultDeck() {
      return await readPointer(store, DEFAULT_DECK_KEY, true);
    },

    async setDefaultDeck(id) {
      return serializeDeckMutation(store, async () => {
        if (id === null) {
          const current = await readMeta(
            store,
            DEFAULT_DECK_KEY,
            "Unable to save the default deck",
          );
          if (current === null) return;
          requireResult(
            "Unable to save the default deck",
            await store.writeUser([
              {
                kind: "delete",
                namespace: "deck-meta",
                key: DEFAULT_DECK_KEY,
                expectedRevision: current.revision,
              },
            ]),
          );
          return;
        }
        await writePointer(store, DEFAULT_DECK_KEY, id, "default");
      });
    },

    appendAutosave(record) {
      const saved = validateAutosave(snapshot(record));
      return serializeDeckMutation(store, async () => {
        const existing = requireResult(
          "Unable to append an autosave entry",
          await store.listUser("deck-autosaves"),
        );
        const duplicate = existing.find((item) => item.key === saved.id);
        if (duplicate !== undefined)
          throw new DeckStorageError("Unable to append an autosave entry");
        const ordered = [
          ...existing.map((item) => ({
            key: item.key,
            revision: item.revision,
            record: autosaveRecord(item),
          })),
          { key: saved.id, revision: 0, record: saved },
        ].sort(
          (left, right) =>
            left.record.createdAt.localeCompare(right.record.createdAt) ||
            left.key.localeCompare(right.key),
        );
        const mutations: UserMutation[] = [
          {
            kind: "put",
            namespace: "deck-autosaves",
            key: saved.id,
            expectedRevision: null,
            payload: saved,
          },
          ...ordered
            .slice(0, Math.max(0, ordered.length - MAXIMUM_DECK_AUTOSAVES))
            .filter((item) => item.key !== saved.id)
            .map((item): UserMutation => ({
              kind: "delete",
              namespace: "deck-autosaves",
              key: item.key,
              expectedRevision: item.revision,
            })),
        ];
        requireResult(
          "Unable to append an autosave entry",
          await store.writeUser(mutations),
        );
      });
    },

    async listAutosaves() {
      const records = requireResult(
        "Unable to list autosave entries",
        await store.listUser("deck-autosaves"),
      );
      return Object.freeze(
        records
          .map(autosaveRecord)
          .sort(
            (left, right) =>
              right.createdAt.localeCompare(left.createdAt) ||
              right.id.localeCompare(left.id),
          ),
      );
    },
  };

  async function create(
    inputDeck: DeckRecord,
    inputHistory: DeckHistory,
    open: boolean,
  ): Promise<StoredDeck> {
    const next = prepareStoredDeck(
      {
        ...snapshot(inputDeck),
        revision: 1,
        updatedAt: latestTimestamp(inputDeck.createdAt, new Date()),
      },
      snapshot(inputHistory),
    );
    return serializeDeckMutation(store, async () => {
      const existing = requireResult(
        "Unable to create deck",
        await store.readUser("decks", next.deck.id),
      );
      if (existing !== null)
        throw new DeckRevisionConflictError(existing.revision);
      const mutations: UserMutation[] = [
        {
          kind: "put",
          namespace: "decks",
          key: next.deck.id,
          expectedRevision: null,
          payload: next,
        },
      ];
      if (open) {
        const pointer = await readMeta(
          store,
          LAST_OPENED_KEY,
          "Unable to create deck",
        );
        mutations.push({
          kind: "put",
          namespace: "deck-meta",
          key: LAST_OPENED_KEY,
          expectedRevision: pointer?.revision ?? null,
          payload: next.deck.id,
        });
      }
      const result = await store.writeUser(mutations);
      if (result.kind === "failed") {
        if (result.error.code === "STORAGE_CONFLICT")
          throw new DeckRevisionConflictError(
            await currentDeckRevision(store, next.deck.id),
          );
        throw storageError("Unable to create deck", result.error);
      }
      return storedDeck(requireReturned(result.value, "decks", next.deck.id));
    });
  }
}

async function readPointer(
  store: UserDataStore,
  key: typeof LAST_OPENED_KEY | typeof DEFAULT_DECK_KEY,
  validateDeck: boolean,
): Promise<DeckId | null> {
  const message =
    key === LAST_OPENED_KEY
      ? "Unable to read last-opened deck"
      : "Unable to read the default deck";
  const pointer = await readMeta(store, key, message);
  if (pointer === null || pointer.payload === null) return null;
  const id = deckId(pointer.payload);
  if (!validateDeck) return id;
  const deck = requireResult(message, await store.readUser("decks", id));
  return deck === null ? null : id;
}

async function writePointer(
  store: UserDataStore,
  key: typeof LAST_OPENED_KEY | typeof DEFAULT_DECK_KEY,
  id: DeckId,
  label: "last-opened" | "default",
): Promise<void> {
  const message =
    label === "last-opened"
      ? "Unable to save last-opened deck"
      : "Unable to save the default deck";
  if (requireResult(message, await store.readUser("decks", id)) === null)
    throw new DeckStorageError(
      `Cannot ${label === "default" ? "default" : "open"} a missing deck`,
    );
  const current = await readMeta(store, key, message);
  requireResult(
    message,
    await store.writeUser([
      {
        kind: "put",
        namespace: "deck-meta",
        key,
        expectedRevision: current?.revision ?? null,
        payload: id,
      },
    ]),
  );
}

async function readMeta(
  store: UserDataStore,
  key: typeof LAST_OPENED_KEY | typeof DEFAULT_DECK_KEY,
  message: string,
): Promise<(UserRecord & { readonly payload: string | null }) | null> {
  const record = requireResult(message, await store.readUser("deck-meta", key));
  if (
    record !== null &&
    !(record.payload === null || typeof record.payload === "string")
  )
    throw new DeckStorageError(message);
  return record as UserRecord & { readonly payload: string | null };
}

function storedDeck(record: UserRecord): StoredDeck {
  if (
    !isStoredDeck(record.payload) ||
    record.payload.deck.revision !== record.revision
  )
    throw new DeckStorageError("Stored deck record is invalid");
  validateStoredDeck(record.payload.deck, record.payload.history);
  return Object.freeze({
    deck: Object.freeze(record.payload.deck),
    history: Object.freeze(record.payload.history),
  });
}

function prepareStoredDeck(deck: DeckRecord, history: DeckHistory): StoredDeck {
  const value = { deck, history };
  if (!isStoredDeck(value))
    throw new DeckStorageError("Stored deck record is invalid");
  validateStoredDeck(deck, history);
  return Object.freeze({
    deck: Object.freeze(deck),
    history: Object.freeze(history),
  });
}

function validateStoredDeck(deck: DeckRecord, history: DeckHistory): void {
  if (
    deck.schemaVersion !== 1 ||
    !validKey(deck.id) ||
    !Number.isSafeInteger(deck.revision) ||
    deck.revision < 1 ||
    typeof deck.name !== "string" ||
    deck.name.trim().length === 0 ||
    deck.name.length > 120 ||
    !validTimestamp(deck.createdAt) ||
    !validTimestamp(deck.updatedAt) ||
    Date.parse(deck.createdAt) > Date.parse(deck.updatedAt) ||
    !validCardLists(deck) ||
    !validKey(deck.validation.rulesetRevision) ||
    !deck.validation.issues.every(
      (issue) => validKey(issue.id) && typeof issue.message === "string",
    ) ||
    typeof deck.importedNeedsReview !== "boolean" ||
    !validOptionalCardCode(deck.illustrationCardCode)
  )
    throw new DeckStorageError("Stored deck record is invalid");
  const updates = [...history.undo, ...history.redo];
  if (
    updates.length > MAXIMUM_DECK_UPDATES ||
    !Number.isSafeInteger(history.nextSequence) ||
    history.nextSequence < 1 ||
    new Set(updates.map((update) => update.sequence)).size !== updates.length ||
    updates.some(
      (update) =>
        update.deckId !== deck.id ||
        !validKey(update.id) ||
        !Number.isSafeInteger(update.sequence) ||
        update.sequence < 1 ||
        update.sequence >= history.nextSequence ||
        !validTimestamp(update.createdAt) ||
        !validCardLists(update.before) ||
        !validCardLists(update.after) ||
        typeof update.beforeImportedNeedsReview !== "boolean" ||
        typeof update.afterImportedNeedsReview !== "boolean" ||
        !validOptionalCardCode(update.beforeIllustrationCardCode) ||
        !validOptionalCardCode(update.afterIllustrationCardCode),
    )
  )
    throw new DeckStorageError("Stored deck history is invalid");
  const ordered = (values: readonly { readonly sequence: number }[]) =>
    values.every(
      (update, index) =>
        index === 0 || values[index - 1]!.sequence < update.sequence,
    );
  const continuous = (values: DeckHistory["undo"]) =>
    values.every((update, index) => {
      const nextUpdate = values[index + 1];
      return (
        nextUpdate === undefined ||
        sameSnapshot(
          update.after,
          update.afterImportedNeedsReview,
          update.afterIllustrationCardCode,
          nextUpdate.before,
          nextUpdate.beforeImportedNeedsReview,
          nextUpdate.beforeIllustrationCardCode,
        )
      );
    });
  const current = history.undo.at(-1);
  const next = history.redo[0];
  if (
    !ordered(history.undo) ||
    !ordered(history.redo) ||
    !continuous(history.undo) ||
    !continuous(history.redo) ||
    (current !== undefined &&
      !sameSnapshot(
        current.after,
        current.afterImportedNeedsReview,
        current.afterIllustrationCardCode,
        deck,
        deck.importedNeedsReview,
        deck.illustrationCardCode,
      )) ||
    (current === undefined &&
      next !== undefined &&
      !sameSnapshot(
        next.before,
        next.beforeImportedNeedsReview,
        next.beforeIllustrationCardCode,
        deck,
        deck.importedNeedsReview,
        deck.illustrationCardCode,
      ))
  )
    throw new DeckStorageError("Stored deck history is inconsistent");
}

function sameSnapshot(
  left: DeckCardLists,
  leftImported: boolean,
  leftIllustration: number | null,
  right: DeckCardLists,
  rightImported: boolean,
  rightIllustration: number | null,
): boolean {
  const sameZone = (a: readonly number[], b: readonly number[]) =>
    [...a].sort((x, y) => x - y).join(",") ===
    [...b].sort((x, y) => x - y).join(",");
  return (
    leftImported === rightImported &&
    leftIllustration === rightIllustration &&
    sameZone(left.main, right.main) &&
    sameZone(left.extra, right.extra) &&
    sameZone(left.side, right.side)
  );
}

function autosaveRecord(record: UserRecord): DeckAutosaveRecord {
  return validateAutosave(record.payload);
}

function validateAutosave(value: unknown): DeckAutosaveRecord {
  if (
    !isDeckAutosaveRecord(value) ||
    !validKey(value.id) ||
    !validKey(value.deckId) ||
    typeof value.deckName !== "string" ||
    !validTimestamp(value.createdAt) ||
    !validCardLists(value)
  )
    throw new DeckStorageError("Stored autosave entry is invalid");
  return Object.freeze(value);
}

function validCardLists(value: DeckCardLists): boolean {
  return [value.main, value.extra, value.side].every(
    (cards) => Array.isArray(cards) && cards.every(validCardCode),
  );
}
function validCardCode(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}
function validOptionalCardCode(value: number | null | undefined): boolean {
  return value === null || (value !== undefined && validCardCode(value));
}
function validTimestamp(value: string): boolean {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}
function validKey(value: string): boolean {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= 512 &&
    !value.includes("\0")
  );
}
function latestTimestamp(createdAt: string, now: Date): string {
  return new Date(Math.max(Date.parse(createdAt), now.getTime())).toISOString();
}
function snapshot<T>(value: T): T {
  try {
    return structuredClone(value);
  } catch (error) {
    throw new DeckStorageError("Stored deck record is invalid", {
      cause: error,
    });
  }
}
function requireReturned(
  records: readonly UserRecord[],
  namespace: UserRecord["namespace"],
  key: string,
): UserRecord {
  const record = records.find(
    (item) => item.namespace === namespace && item.key === key,
  );
  if (record === undefined)
    throw new DeckStorageError("Storage returned no written deck");
  return record;
}
function requireResult<T>(message: string, result: StorageResult<T>): T {
  if (result.kind === "failed") throw storageError(message, result.error);
  return result.value;
}
function storageError(
  message: string,
  cause: StorageFailure,
): DeckStorageError {
  return new DeckStorageError(message, { cause });
}
async function currentDeckRevision(
  store: UserDataStore,
  id: DeckId,
): Promise<number | null> {
  const current = await store.readUser("decks", id);
  return current.kind === "ok" ? (current.value?.revision ?? null) : null;
}
function serializeDeckMutation<T>(
  store: UserDataStore,
  operation: () => Promise<T>,
): Promise<T> {
  return userWriteLifecycle(store).run(() => {
    const previous = mutationTails.get(store) ?? Promise.resolve();
    const result = previous.then(operation, operation);
    mutationTails.set(
      store,
      result.then(
        () => undefined,
        () => undefined,
      ),
    );
    return result;
  });
}

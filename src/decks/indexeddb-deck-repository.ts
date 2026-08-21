import { openDB, unwrap, type DBSchema, type IDBPDatabase } from "idb";
import type {
  DeckAutosaveRecord,
  DeckHistory,
  DeckId,
  DeckRecord,
  StoredDeck,
} from "./deck-contracts.ts";
import { deckId } from "./deck-contracts.ts";
import {
  createDeckStores,
  DECK_DATABASE_NAME,
  DECK_DATABASE_VERSION,
  MAXIMUM_DECK_AUTOSAVES,
  migrateLegacyDeckDatabase,
  type DeckMigrationReport,
} from "./deck-database.ts";
import { MAXIMUM_DECK_UPDATES } from "./deck-history.ts";
import type { DeckRepository } from "./deck-repository.ts";

const LAST_OPENED_KEY = "last-opened-deck";
const DEFAULT_DECK_KEY = "default-deck";
const FAVOURITE_DECKS_KEY = "favourite-decks";

/* One migration per page load, shared by every caller: the deck editor and the
   admin console both open the repository and the copy must not run twice. A
   rejection drops the cache so a retry starts over rather than replaying the
   same failure forever. */
let migration: Promise<DeckMigrationReport> | null = null;

function migrateOnce(): Promise<DeckMigrationReport> {
  migration ??= migrateLegacyDeckDatabase(globalThis.indexedDB).catch(
    (error: unknown) => {
      migration = null;
      throw error;
    },
  );
  return migration;
}

interface DeckDatabase extends DBSchema {
  decks: {
    key: string;
    value: DeckRecord;
    indexes: { updatedAt: string; name: string };
  };
  histories: {
    key: string;
    value: Readonly<{ deckId: DeckId; history: DeckHistory }>;
  };
  preferences: {
    key: string;
    value: Readonly<{ key: string; value: string }>;
  };
  autosaves: {
    key: string;
    value: DeckAutosaveRecord;
    indexes: { createdAt: string };
  };
}

export class DeckStorageError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "DeckStorageError";
  }
}

export class DeckRevisionConflictError extends DeckStorageError {
  readonly actualRevision: number | null;

  constructor(actualRevision: number | null) {
    super("Deck was changed by another browser context");
    this.name = "DeckRevisionConflictError";
    this.actualRevision = actualRevision;
  }
}

export class IndexedDbDeckRepository implements DeckRepository {
  readonly #database: IDBPDatabase<DeckDatabase>;
  readonly #now: () => Date;

  private constructor(database: IDBPDatabase<DeckDatabase>, now: () => Date) {
    this.#database = database;
    this.#now = now;
  }

  static async open(
    databaseName = DECK_DATABASE_NAME,
    now: () => Date = () => new Date(),
  ): Promise<IndexedDbDeckRepository> {
    /* Before the first read, and only for the database that has a prototype
       predecessor: a caller naming its own database gets no migration. A
       `DeckMigrationError` is deliberately not wrapped as a `DeckStorageError`,
       because the deck editor answers it with its own blocking state. */
    if (databaseName === DECK_DATABASE_NAME) await migrateOnce();
    try {
      const database = await openDB<DeckDatabase>(
        databaseName,
        DECK_DATABASE_VERSION,
        {
          upgrade(db) {
            createDeckStores(unwrap(db));
          },
        },
      );
      return new IndexedDbDeckRepository(database, now);
    } catch (error) {
      throw storageError("Unable to open deck storage", error);
    }
  }

  async list(): Promise<readonly DeckRecord[]> {
    try {
      const values = await this.#database.getAll("decks");
      const valid: DeckRecord[] = [];
      for (const value of values) {
        try {
          valid.push(validateDeckRecord(value));
        } catch {
          // Keep corrupt rows isolated so valid local decks remain accessible.
        }
      }
      return Object.freeze(
        valid.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      );
    } catch (error) {
      throw storageError("Unable to list decks", error);
    }
  }

  async load(id: DeckId): Promise<StoredDeck | null> {
    try {
      const transaction = this.#database.transaction(
        ["decks", "histories"],
        "readonly",
      );
      const [deck, storedHistory] = await Promise.all([
        transaction.objectStore("decks").get(id),
        transaction.objectStore("histories").get(id),
      ]);
      await transaction.done;
      if (deck === undefined) return null;
      if (storedHistory === undefined)
        throw new DeckStorageError(`Deck ${id} has no history record`);
      const validatedDeck = validateDeckRecord(deck);
      const validatedHistory = validateHistory(storedHistory.history, id);
      validateDeckHistoryConsistency(validatedDeck, validatedHistory);
      return Object.freeze({
        deck: validatedDeck,
        history: validatedHistory,
      });
    } catch (error) {
      throw storageError("Unable to load deck", error);
    }
  }

  create(deck: DeckRecord, history: DeckHistory): Promise<StoredDeck> {
    return this.#create(deck, history, false);
  }

  createAndOpen(deck: DeckRecord, history: DeckHistory): Promise<StoredDeck> {
    return this.#create(deck, history, true);
  }

  async #create(
    deck: DeckRecord,
    history: DeckHistory,
    open: boolean,
  ): Promise<StoredDeck> {
    validateDeckRecord(deck);
    validateHistory(history, deck.id);
    validateDeckHistoryConsistency(deck, history);
    const transaction = this.#database.transaction(
      ["decks", "histories", "preferences"],
      "readwrite",
    );
    try {
      if ((await transaction.objectStore("decks").get(deck.id)) !== undefined)
        throw new DeckRevisionConflictError(deck.revision);
      const next = Object.freeze({
        ...deck,
        revision: 1,
        updatedAt: latestTimestamp(deck.createdAt, this.#now()),
      });
      await Promise.all([
        transaction.objectStore("decks").add(next),
        transaction.objectStore("histories").add({ deckId: deck.id, history }),
        open
          ? transaction.objectStore("preferences").put({
              key: LAST_OPENED_KEY,
              value: deck.id,
            })
          : Promise.resolve(),
      ]);
      await transaction.done;
      return Object.freeze({ deck: next, history });
    } catch (error) {
      await transaction.done.catch(() => undefined);
      throw storageError("Unable to create deck", error);
    }
  }

  async save(
    expectedRevision: number,
    deck: DeckRecord,
    history: DeckHistory,
  ): Promise<StoredDeck> {
    validateDeckRecord(deck);
    validateHistory(history, deck.id);
    validateDeckHistoryConsistency(deck, history);
    const transaction = this.#database.transaction(
      ["decks", "histories"],
      "readwrite",
    );
    try {
      const current = await transaction.objectStore("decks").get(deck.id);
      if (current === undefined || current.revision !== expectedRevision)
        throw new DeckRevisionConflictError(current?.revision ?? null);
      const next = Object.freeze({
        ...deck,
        revision: expectedRevision + 1,
        updatedAt: latestTimestamp(deck.createdAt, this.#now()),
      });
      await Promise.all([
        transaction.objectStore("decks").put(next),
        transaction.objectStore("histories").put({ deckId: deck.id, history }),
      ]);
      await transaction.done;
      return Object.freeze({ deck: next, history });
    } catch (error) {
      await transaction.done.catch(() => undefined);
      throw storageError("Unable to save deck", error);
    }
  }

  async delete(id: DeckId, expectedRevision: number): Promise<void> {
    const transaction = this.#database.transaction(
      ["decks", "histories", "preferences"],
      "readwrite",
    );
    try {
      const current = await transaction.objectStore("decks").get(id);
      if (current !== undefined && current.revision !== expectedRevision)
        throw new DeckRevisionConflictError(current.revision);
      await Promise.all([
        transaction.objectStore("decks").delete(id),
        transaction.objectStore("histories").delete(id),
      ]);
      /* Both preferences name a deck, so both follow it out of storage: a
         default pointing at a deleted deck is a deck picker offering nothing. */
      for (const key of [LAST_OPENED_KEY, DEFAULT_DECK_KEY]) {
        const preference = await transaction
          .objectStore("preferences")
          .get(key);
        if (preference?.value === id)
          await transaction.objectStore("preferences").delete(key);
      }
      await transaction.done;
    } catch (error) {
      await transaction.done.catch(() => undefined);
      throw storageError("Unable to delete deck", error);
    }
  }

  async getLastOpened(): Promise<DeckId | null> {
    try {
      const value = (await this.#database.get("preferences", LAST_OPENED_KEY))
        ?.value;
      return value === undefined ? null : deckId(value);
    } catch (error) {
      throw storageError("Unable to read last-opened deck", error);
    }
  }

  async setLastOpened(id: DeckId): Promise<void> {
    const transaction = this.#database.transaction(
      ["decks", "preferences"],
      "readwrite",
    );
    try {
      if ((await transaction.objectStore("decks").get(id)) === undefined)
        throw new DeckStorageError("Cannot open a missing deck");
      await transaction.objectStore("preferences").put({
        key: LAST_OPENED_KEY,
        value: id,
      });
      await transaction.done;
    } catch (error) {
      await transaction.done.catch(() => undefined);
      throw storageError("Unable to save last-opened deck", error);
    }
  }

  async clearLastOpened(expectedId?: DeckId): Promise<void> {
    const transaction = this.#database.transaction("preferences", "readwrite");
    try {
      const current = await transaction
        .objectStore("preferences")
        .get(LAST_OPENED_KEY);
      if (expectedId === undefined || current?.value === expectedId)
        await transaction.objectStore("preferences").delete(LAST_OPENED_KEY);
      await transaction.done;
    } catch (error) {
      await transaction.done.catch(() => undefined);
      throw storageError("Unable to clear last-opened deck", error);
    }
  }

  /* Read across both stores in one transaction: a default whose deck is gone
     reads as none set, rather than as an id the caller then fails to load. */
  async getDefaultDeck(): Promise<DeckId | null> {
    const transaction = this.#database.transaction(
      ["decks", "preferences"],
      "readonly",
    );
    try {
      const value = (
        await transaction.objectStore("preferences").get(DEFAULT_DECK_KEY)
      )?.value;
      const deck =
        value === undefined
          ? undefined
          : await transaction.objectStore("decks").get(value);
      await transaction.done;
      return value === undefined || deck === undefined ? null : deckId(value);
    } catch (error) {
      await transaction.done.catch(() => undefined);
      throw storageError("Unable to read the default deck", error);
    }
  }

  /** Favourites, pruned against existing decks. */
  async listFavourites(): Promise<readonly DeckId[]> {
    const transaction = this.#database.transaction(
      ["decks", "preferences"],
      "readonly",
    );
    try {
      const row = await transaction
        .objectStore("preferences")
        .get(FAVOURITE_DECKS_KEY);
      const ids = parseFavouritesJson(row?.value);
      const kept: DeckId[] = [];
      for (const id of ids) {
        const exists =
          (await transaction.objectStore("decks").get(id)) !== undefined;
        if (exists) kept.push(deckId(id));
      }
      await transaction.done;
      return Object.freeze(kept);
    } catch (error) {
      await transaction.done.catch(() => undefined);
      throw storageError("Unable to read favourite decks", error);
    }
  }

  async setFavourite(id: DeckId, favourite: boolean): Promise<void> {
    const transaction = this.#database.transaction(
      ["decks", "preferences"],
      "readwrite",
    );
    try {
      const deckExists =
        (await transaction.objectStore("decks").get(id)) !== undefined;
      if (!deckExists && favourite)
        throw new DeckStorageError("Cannot favourite a missing deck");
      const row = await transaction
        .objectStore("preferences")
        .get(FAVOURITE_DECKS_KEY);
      const current = parseFavouritesJson(row?.value);
      const next = favourite
        ? current.includes(id)
          ? current
          : [...current, id]
        : current.filter((v) => v !== id);
      if (next.length === 0)
        await transaction
          .objectStore("preferences")
          .delete(FAVOURITE_DECKS_KEY);
      else
        await transaction.objectStore("preferences").put({
          key: FAVOURITE_DECKS_KEY,
          value: JSON.stringify(next),
        });
      await transaction.done;
    } catch (error) {
      await transaction.done.catch(() => undefined);
      throw storageError("Unable to save favourite deck", error);
    }
  }

  async setDefaultDeck(id: DeckId | null): Promise<void> {
    const transaction = this.#database.transaction(
      ["decks", "preferences"],
      "readwrite",
    );
    try {
      if (id === null)
        await transaction.objectStore("preferences").delete(DEFAULT_DECK_KEY);
      else {
        if ((await transaction.objectStore("decks").get(id)) === undefined)
          throw new DeckStorageError("Cannot default a missing deck");
        await transaction.objectStore("preferences").put({
          key: DEFAULT_DECK_KEY,
          value: id,
        });
      }
      await transaction.done;
    } catch (error) {
      await transaction.done.catch(() => undefined);
      throw storageError("Unable to save the default deck", error);
    }
  }

  /* Append and trim share one transaction, so two edits racing each other
     cannot both read a log of 100, both append, and leave 102 behind. */
  async appendAutosave(record: DeckAutosaveRecord): Promise<void> {
    validateAutosaveRecord(record);
    const transaction = this.#database.transaction("autosaves", "readwrite");
    try {
      await transaction.store.add(record);
      const oldestFirst = await transaction.store
        .index("createdAt")
        .getAllKeys();
      const excess = oldestFirst.length - MAXIMUM_DECK_AUTOSAVES;
      for (let index = 0; index < excess; index += 1)
        await transaction.store.delete(oldestFirst[index]!);
      await transaction.done;
    } catch (error) {
      await transaction.done.catch(() => undefined);
      throw storageError("Unable to append an autosave entry", error);
    }
  }

  async listAutosaves(): Promise<readonly DeckAutosaveRecord[]> {
    try {
      const values = await this.#database.getAllFromIndex(
        "autosaves",
        "createdAt",
      );
      const valid: DeckAutosaveRecord[] = [];
      for (const value of values) {
        try {
          valid.push(validateAutosaveRecord(value));
        } catch {
          // The log is a convenience surface; one bad row must not hide the rest.
        }
      }
      return Object.freeze(valid.reverse());
    } catch (error) {
      throw storageError("Unable to list autosave entries", error);
    }
  }

  close(): void {
    this.#database.close();
  }
}

function validateAutosaveRecord(
  record: DeckAutosaveRecord,
): DeckAutosaveRecord {
  if (
    !hasExactKeys(record, [
      "createdAt",
      "deckId",
      "deckName",
      "extra",
      "id",
      "main",
      "side",
    ]) ||
    !validKey(record.id) ||
    !validKey(record.deckId) ||
    typeof record.deckName !== "string" ||
    !validTimestamp(record.createdAt) ||
    !validCardList(record.main) ||
    !validCardList(record.extra) ||
    !validCardList(record.side)
  )
    throw new DeckStorageError("Stored autosave entry is invalid");
  return record;
}

function validateDeckRecord(deck: DeckRecord): DeckRecord {
  const expectedKeys = [
    "createdAt",
    "extra",
    "id",
    "importedNeedsReview",
    "main",
    "name",
    "revision",
    "schemaVersion",
    "side",
    "updatedAt",
    "validation",
  ];
  if (
    !hasExactKeys(deck, expectedKeys) ||
    deck.schemaVersion !== 1 ||
    !validKey(deck.id) ||
    !Number.isSafeInteger(deck.revision) ||
    deck.revision < 0 ||
    deck.name.trim().length === 0 ||
    deck.name.length > 120 ||
    !validTimestamp(deck.createdAt) ||
    !validTimestamp(deck.updatedAt) ||
    Date.parse(deck.createdAt) > Date.parse(deck.updatedAt) ||
    typeof deck.importedNeedsReview !== "boolean" ||
    !validCardList(deck.main) ||
    !validCardList(deck.extra) ||
    !validCardList(deck.side) ||
    !validValidation(deck.validation)
  )
    throw new DeckStorageError("Stored deck record is invalid");
  return deck;
}

function validateHistory(history: DeckHistory, id: DeckId): DeckHistory {
  const updates = [...history.undo, ...history.redo];
  const expectedUpdateKeys = [
    "after",
    "afterImportedNeedsReview",
    "before",
    "beforeImportedNeedsReview",
    "createdAt",
    "deckId",
    "id",
    "reason",
    "sequence",
  ];
  if (
    !hasExactKeys(history, ["nextSequence", "redo", "undo"]) ||
    updates.length > MAXIMUM_DECK_UPDATES ||
    !Number.isSafeInteger(history.nextSequence) ||
    history.nextSequence < 1 ||
    new Set(updates.map(({ sequence }) => sequence)).size !== updates.length ||
    updates.some(
      (update) =>
        !hasExactKeys(update, expectedUpdateKeys) ||
        update.deckId !== id ||
        !validKey(update.id) ||
        !Number.isSafeInteger(update.sequence) ||
        update.sequence < 1 ||
        update.sequence >= history.nextSequence ||
        !validTimestamp(update.createdAt) ||
        typeof update.beforeImportedNeedsReview !== "boolean" ||
        typeof update.afterImportedNeedsReview !== "boolean" ||
        !["add", "remove", "move", "import", "restore"].includes(
          update.reason,
        ) ||
        !validCardLists(update.before) ||
        !validCardLists(update.after),
    )
  )
    throw new DeckStorageError("Stored deck history is invalid");
  return history;
}

function validateDeckHistoryConsistency(
  deck: DeckRecord,
  history: DeckHistory,
): void {
  const ordered = [...history.undo, ...history.redo];
  const undoIsContinuous = history.undo.every((update, index) => {
    const next = history.undo[index + 1];
    return (
      next === undefined ||
      sameHistorySnapshot(
        update.after,
        update.afterImportedNeedsReview,
        next.before,
        next.beforeImportedNeedsReview,
      )
    );
  });
  const redoIsContinuous = history.redo.every((update, index) => {
    const next = history.redo[index + 1];
    return (
      next === undefined ||
      sameHistorySnapshot(
        update.after,
        update.afterImportedNeedsReview,
        next.before,
        next.beforeImportedNeedsReview,
      )
    );
  });
  const sequencesAreOrdered =
    history.undo.every(
      (update, index) =>
        index === 0 || history.undo[index - 1]!.sequence < update.sequence,
    ) &&
    history.redo.every(
      (update, index) =>
        index === 0 || history.redo[index - 1]!.sequence < update.sequence,
    );
  const current = history.undo.at(-1);
  const next = history.redo[0];
  const deckMatchesCurrent =
    current !== undefined
      ? sameHistorySnapshot(
          current.after,
          current.afterImportedNeedsReview,
          deck,
          deck.importedNeedsReview,
        )
      : next !== undefined
        ? sameHistorySnapshot(
            next.before,
            next.beforeImportedNeedsReview,
            deck,
            deck.importedNeedsReview,
          )
        : true;
  if (
    ordered.length > 0 &&
    (!undoIsContinuous ||
      !redoIsContinuous ||
      !sequencesAreOrdered ||
      !deckMatchesCurrent)
  )
    throw new DeckStorageError("Stored deck history is inconsistent");
}

function sameHistorySnapshot(
  left: {
    readonly main: readonly number[];
    readonly extra: readonly number[];
    readonly side: readonly number[];
  },
  leftImported: boolean,
  right: {
    readonly main: readonly number[];
    readonly extra: readonly number[];
    readonly side: readonly number[];
  },
  rightImported: boolean,
): boolean {
  /* History records which cards a deck held, not the order the player left
     them in, so a reorder saved without a history entry still lines up with
     the snapshot it came from. */
  return (
    leftImported === rightImported &&
    sameSnapshotZone(left.main, right.main) &&
    sameSnapshotZone(left.extra, right.extra) &&
    sameSnapshotZone(left.side, right.side)
  );
}

function sameSnapshotZone(
  left: readonly number[],
  right: readonly number[],
): boolean {
  return [...left].sort().join(",") === [...right].sort().join(",");
}

function validValidation(value: DeckRecord["validation"]): boolean {
  return (
    hasExactKeys(value, ["issues", "rulesetRevision", "status"]) &&
    ["valid", "warnings", "errors"].includes(value.status) &&
    validKey(value.rulesetRevision) &&
    Array.isArray(value.issues) &&
    value.issues.every(
      (issue) =>
        typeof issue.id === "string" &&
        typeof issue.message === "string" &&
        ["warning", "error"].includes(issue.severity) &&
        typeof issue.code === "string" &&
        (issue.cardCode === undefined || validCardCode(issue.cardCode)) &&
        (issue.zone === undefined ||
          ["main", "extra", "side"].includes(issue.zone)),
    )
  );
}

function validCardLists(value: {
  readonly main: readonly number[];
  readonly extra: readonly number[];
  readonly side: readonly number[];
}): boolean {
  return (
    hasExactKeys(value, ["extra", "main", "side"]) &&
    validCardList(value.main) &&
    validCardList(value.extra) &&
    validCardList(value.side)
  );
}

function validCardList(value: readonly number[]): boolean {
  return Array.isArray(value) && value.every(validCardCode);
}

function validCardCode(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

function latestTimestamp(createdAt: string, now: Date): string {
  return new Date(Math.max(Date.parse(createdAt), now.getTime())).toISOString();
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

function hasExactKeys(value: object, expected: readonly string[]): boolean {
  return (
    Object.keys(value).sort().join("\n") === [...expected].sort().join("\n")
  );
}

function parseFavouritesJson(raw: string | undefined): string[] {
  if (raw === undefined) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((v): v is string => typeof v === "string")
      : [];
  } catch {
    return [];
  }
}

function storageError(message: string, cause: unknown): DeckStorageError {
  return cause instanceof DeckStorageError
    ? cause
    : new DeckStorageError(message, { cause });
}

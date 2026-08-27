/* The deck store shipped under a prototype database name. This module owns the
   production name, the schema both names share, and the one-way migration that
   moves a player's decks across.

   The migration runs in a real browser against data nobody else has a copy of,
   so it is ordered copy → verify → delete and never the other way round. Every
   intermediate state a crash can leave behind is a state this module has to
   recognise on the next run: see `migrateLegacyDeckDatabase`. */

export const DECK_DATABASE_NAME = "ygo-story-decks";
export const LEGACY_DECK_DATABASE_NAME =
  "ygo-story-duel-deck-builder-prototype";
export const DECK_DATABASE_VERSION = 2;

/* The prototype database is frozen at the version it shipped at, and opening it
   is a read of somebody's only copy of their decks. Naming the production
   version here instead would fire `upgradeneeded` on a real prototype database
   the moment the two numbers diverge, and `openLegacyDatabase` reads that flag
   as "this database did not exist until I created it" and deletes it. */
export const LEGACY_DECK_DATABASE_VERSION = 1;

/** How many entries the global autosave log keeps. Older entries are dropped by
    the append that pushes the log past it. */
export const MAXIMUM_DECK_AUTOSAVES = 100;

const DECK_STORE_NAMES = ["decks", "histories", "preferences"] as const;

/** The schema, in one place, so the repository and the migration can never
    create two different shapes of the same database.

    Every store is guarded, because this runs for an upgrade as well as a
    creation: a player arriving from version 1 already has three of these, full
    of their decks, and `createObjectStore` on an existing name throws. */
export function createDeckStores(database: IDBDatabase): void {
  if (!database.objectStoreNames.contains("decks")) {
    const decks = database.createObjectStore("decks", { keyPath: "id" });
    decks.createIndex("updatedAt", "updatedAt");
    decks.createIndex("name", "name");
  }
  if (!database.objectStoreNames.contains("histories"))
    database.createObjectStore("histories", { keyPath: "deckId" });
  if (!database.objectStoreNames.contains("preferences"))
    database.createObjectStore("preferences", { keyPath: "key" });
  if (!database.objectStoreNames.contains("autosaves")) {
    const autosaves = database.createObjectStore("autosaves", {
      keyPath: "id",
    });
    autosaves.createIndex("createdAt", "createdAt");
  }
}

export type DeckMigrationFailure =
  "copy-failed" | "verify-failed" | "delete-failed";

export class DeckMigrationError extends Error {
  readonly cause: DeckMigrationFailure;

  constructor(cause: DeckMigrationFailure, message: string) {
    super(message);
    this.name = "DeckMigrationError";
    this.cause = cause;
  }
}

export interface DeckMigrationReport {
  /** Decks copied by this run. Zero whenever there was nothing left to do. */
  readonly migrated: number;
  readonly legacyDeleted: boolean;
}

const NOTHING_TO_MIGRATE: DeckMigrationReport = Object.freeze({
  migrated: 0,
  legacyDeleted: false,
});

/* Only the fields the copy has to compare. The rows themselves are written back
   untouched, so a schema addition needs no change here. */
interface DeckRow {
  readonly id: string;
  readonly revision: number;
}
interface HistoryRow {
  readonly deckId: string;
}
interface PreferenceRow {
  readonly key: string;
  readonly value: string;
}

interface DeckSnapshot {
  readonly decks: readonly DeckRow[];
  readonly histories: readonly HistoryRow[];
  readonly preferences: readonly PreferenceRow[];
}

/**
 * Moves a prototype deck database into the production one, exactly once.
 *
 * The states a player can arrive in, and what each resolves to:
 *
 * - no prototype database — a fresh player, or one who already migrated. No-op.
 * - prototype only — copy every store in one transaction, re-read the
 *   production database and compare, then delete the prototype.
 * - prototype present and empty — nothing to copy, but the husk still goes.
 * - both present, production already holding every prototype deck at the same
 *   revision — a previous run copied but never got to delete. Finish the delete.
 * - both present and diverged — the two databases hold different decks, so
 *   copying could clobber and deleting would lose data. Keep both, report
 *   nothing done, and let the player keep using the production database.
 *
 * Failures never delete: the prototype database survives every rejection.
 */
export async function migrateLegacyDeckDatabase(
  factory: IDBFactory,
): Promise<DeckMigrationReport> {
  const legacy = await openLegacyDatabase(factory);
  if (legacy === null) return NOTHING_TO_MIGRATE;

  let source: DeckSnapshot;
  try {
    source = await readSnapshot(legacy);
  } catch (error) {
    throw new DeckMigrationError(
      "copy-failed",
      `Could not read the prototype deck database: ${reason(error)}`,
    );
  } finally {
    legacy.close();
  }

  const production = await openProductionDatabase(factory);
  let existing: DeckSnapshot;
  try {
    existing = await readSnapshot(production);
  } catch (error) {
    production.close();
    throw new DeckMigrationError(
      "copy-failed",
      `Could not read the deck database: ${reason(error)}`,
    );
  }

  if (existing.decks.length > 0) {
    production.close();
    if (!contains(existing, source)) return NOTHING_TO_MIGRATE;
    await deleteLegacyDatabase(factory);
    return Object.freeze({ migrated: 0, legacyDeleted: true });
  }

  try {
    await writeSnapshot(production, source);
  } catch (error) {
    throw new DeckMigrationError(
      "copy-failed",
      `Could not copy decks into the deck database: ${reason(error)}`,
    );
  } finally {
    production.close();
  }

  /* Read back through a new connection rather than trusting the writes: a
     transaction that reported complete is still the only evidence we have, and
     the prototype database is about to be deleted on the strength of it. */
  const verification = await openProductionDatabase(factory);
  let copied: DeckSnapshot;
  try {
    copied = await readSnapshot(verification);
  } catch (error) {
    throw new DeckMigrationError(
      "verify-failed",
      `Could not re-read the copied decks: ${reason(error)}`,
    );
  } finally {
    verification.close();
  }

  if (!contains(copied, source) || copied.decks.length !== source.decks.length)
    throw new DeckMigrationError(
      "verify-failed",
      "The copied deck database does not match the prototype database",
    );

  await deleteLegacyDatabase(factory);
  return Object.freeze({
    migrated: source.decks.length,
    legacyDeleted: true,
  });
}

/** The prototype connection, or `null` when there is nothing to migrate.
    `databases()` answers without touching anything; the browsers that lack it
    fall back to opening the name and rolling back a database that turned out
    not to exist, so a probe can never leave a husk for the next run. */
async function openLegacyDatabase(
  factory: IDBFactory,
): Promise<IDBDatabase | null> {
  if (typeof factory.databases === "function") {
    const present = (await factory.databases()).some(
      ({ name }) => name === LEGACY_DECK_DATABASE_NAME,
    );
    if (!present) return null;
  }

  const request = factory.open(
    LEGACY_DECK_DATABASE_NAME,
    LEGACY_DECK_DATABASE_VERSION,
  );
  let created = false;
  request.onupgradeneeded = () => {
    created = true;
  };
  const database = await toPromise(request);

  const usable =
    !created &&
    DECK_STORE_NAMES.every((store) =>
      database.objectStoreNames.contains(store),
    );
  if (usable) return database;

  database.close();
  await removeDatabase(factory, LEGACY_DECK_DATABASE_NAME).catch(
    () => undefined,
  );
  return null;
}

function openProductionDatabase(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(DECK_DATABASE_NAME, DECK_DATABASE_VERSION);
    request.onupgradeneeded = () => createDeckStores(request.result);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Could not open deck database"));
    request.onblocked = () =>
      reject(
        new Error(
          "Another browser tab still has the deck library open at an older version",
        ),
      );
  });
}

async function deleteLegacyDatabase(factory: IDBFactory): Promise<void> {
  try {
    await removeDatabase(factory, LEGACY_DECK_DATABASE_NAME);
  } catch (error) {
    throw new DeckMigrationError(
      "delete-failed",
      `The decks were copied, but the prototype deck database could not be deleted: ${reason(error)}`,
    );
  }
}

/* Every request is issued before the first `await`, so the transaction cannot
   auto-commit between two reads of the same snapshot. Results stay readable on
   the request objects after the transaction completes. */
async function readSnapshot(database: IDBDatabase): Promise<DeckSnapshot> {
  const transaction = database.transaction([...DECK_STORE_NAMES], "readonly");
  const decks = transaction.objectStore("decks").getAll();
  const histories = transaction.objectStore("histories").getAll();
  const preferences = transaction.objectStore("preferences").getAll();
  await settled(transaction);
  return {
    decks: decks.result as readonly DeckRow[],
    histories: histories.result as readonly HistoryRow[],
    preferences: preferences.result as readonly PreferenceRow[],
  };
}

/** One transaction for all three stores, so an interrupted copy leaves the
    production database empty rather than half-written. */
async function writeSnapshot(
  database: IDBDatabase,
  snapshot: DeckSnapshot,
): Promise<void> {
  const transaction = database.transaction([...DECK_STORE_NAMES], "readwrite");
  try {
    for (const deck of snapshot.decks)
      transaction.objectStore("decks").put(deck);
    for (const history of snapshot.histories)
      transaction.objectStore("histories").put(history);
    for (const preference of snapshot.preferences)
      transaction.objectStore("preferences").put(preference);
  } catch (error) {
    transaction.abort();
    throw error;
  }
  await settled(transaction);
}

/** Whether `subject` holds every row of `expected`, comparing decks by id and
    revision so a stale copy never passes for a complete one. */
function contains(subject: DeckSnapshot, expected: DeckSnapshot): boolean {
  const decks = new Set(subject.decks.map(deckKey));
  const histories = new Set(subject.histories.map(({ deckId }) => deckId));
  const preferences = new Set(subject.preferences.map(preferenceKey));
  return (
    expected.decks.every((deck) => decks.has(deckKey(deck))) &&
    expected.histories.every(({ deckId }) => histories.has(deckId)) &&
    expected.preferences.every((preference) =>
      preferences.has(preferenceKey(preference)),
    )
  );
}

function deckKey(deck: DeckRow): string {
  return `${deck.id}@${String(deck.revision)}`;
}

function preferenceKey(preference: PreferenceRow): string {
  return `${preference.key}=${preference.value}`;
}

function toPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

function settled(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction failed"));
  });
}

function removeDatabase(factory: IDBFactory, name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = factory.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () =>
      reject(request.error ?? new Error(`Could not delete ${name}`));
    /* `blocked` means another tab still holds the database open, so the delete
       stays queued and the name is still there right now. Reporting success
       would claim a deletion that has not happened; the caller retries once the
       other tab is gone. */
    request.onblocked = () =>
      reject(new Error(`Another browser tab still has ${name} open`));
  });
}

function reason(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

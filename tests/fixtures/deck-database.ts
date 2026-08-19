import type { DeckRecord } from "../../src/decks/deck-contracts.ts";
import {
  createDeckStores,
  DECK_DATABASE_VERSION,
  LEGACY_DECK_DATABASE_NAME,
  LEGACY_DECK_DATABASE_VERSION,
} from "../../src/decks/deck-database.ts";
import { emptyDeckHistory } from "../../src/decks/deck-history.ts";

/* Raw-IndexedDB access for the tests that have to look at a deck database from
   outside the repository — the migration tests, which need to plant a
   prototype database the repository would never write. Seeding goes through
   `createDeckStores`, so a schema change cannot leave these fixtures describing
   a database that no longer exists. */

const LAST_OPENED_KEY = "last-opened-deck";
const STORES = ["decks", "histories", "preferences"] as const;

/** The schema version a player who last ran the previous release still holds,
    and the one the prototype database was frozen at. */
export const DECK_DATABASE_VERSION_1 = 1;

/* Written out rather than delegated to `createDeckStores`, because these
   fixtures exist to reproduce a database that is already on disk: version 1 is
   frozen history and must not follow the current schema forward. */
function createVersion1DeckStores(database: IDBDatabase): void {
  const decks = database.createObjectStore("decks", { keyPath: "id" });
  decks.createIndex("updatedAt", "updatedAt");
  decks.createIndex("name", "name");
  database.createObjectStore("histories", { keyPath: "deckId" });
  database.createObjectStore("preferences", { keyPath: "key" });
}

/** Opens a deck database at `version`, building the schema that version
    shipped. The prototype database defaults to the version the migration pins
    it to, so a fixture can never plant a prototype database no player has. */
export function openDeckDatabase(
  name: string,
  version: number = name === LEGACY_DECK_DATABASE_NAME
    ? LEGACY_DECK_DATABASE_VERSION
    : DECK_DATABASE_VERSION,
): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, version);
    request.onupgradeneeded = () => {
      if (version === DECK_DATABASE_VERSION_1)
        createVersion1DeckStores(request.result);
      else createDeckStores(request.result);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function transactionSettled(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error);
    transaction.onerror = () => reject(transaction.error);
  });
}

/** Writes decks with the matching empty history each deck needs to be
    loadable, plus the last-opened pointer when one is given. */
export async function seedDeckDatabase(
  name: string,
  content: {
    readonly decks?: readonly DeckRecord[];
    readonly lastOpened?: string;
  } = {},
  version?: number,
): Promise<void> {
  const database = await openDeckDatabase(name, version);
  const transaction = database.transaction([...STORES], "readwrite");
  for (const deck of content.decks ?? []) {
    transaction.objectStore("decks").put(deck);
    transaction
      .objectStore("histories")
      .put({ deckId: deck.id, history: emptyDeckHistory() });
  }
  if (content.lastOpened !== undefined)
    transaction
      .objectStore("preferences")
      .put({ key: LAST_OPENED_KEY, value: content.lastOpened });
  await transactionSettled(transaction);
  database.close();
}

export async function deckDatabaseRows(
  name: string,
  store: string,
): Promise<unknown[]> {
  const database = await openDeckDatabase(name);
  const transaction = database.transaction([store], "readonly");
  const request = transaction.objectStore(store).getAll();
  await transactionSettled(transaction);
  database.close();
  return request.result;
}

export async function deckDatabaseNames(): Promise<readonly string[]> {
  return (await indexedDB.databases()).map(({ name }) => name ?? "");
}

/** The version a database is on disk at, without opening it — opening is what
    an upgrade test has to prove nobody did. `null` when it does not exist. */
export async function deckDatabaseVersion(
  name: string,
): Promise<number | null> {
  const found = (await indexedDB.databases()).find(
    (database) => database.name === name,
  );
  return found?.version ?? null;
}

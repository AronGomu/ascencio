import type { DeckRecord } from "../../src/decks/deck-contracts.ts";
import {
  createDeckStores,
  DECK_DATABASE_VERSION,
} from "../../src/decks/deck-database.ts";
import { emptyDeckHistory } from "../../src/decks/deck-history.ts";

/* Raw-IndexedDB access for the tests that have to look at a deck database from
   outside the repository — the migration tests, which need to plant a
   prototype database the repository would never write. Seeding goes through
   `createDeckStores`, so a schema change cannot leave these fixtures describing
   a database that no longer exists. */

const LAST_OPENED_KEY = "last-opened-deck";
const STORES = ["decks", "histories", "preferences"] as const;

export function openDeckDatabase(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, DECK_DATABASE_VERSION);
    request.onupgradeneeded = () => createDeckStores(request.result);
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
): Promise<void> {
  const database = await openDeckDatabase(name);
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

import type { DeckRecord } from "../../src/decks/contracts/index.ts";
import { emptyDeckHistory } from "../../src/decks/editing/index.ts";

// Historical IDB constants only. E2E actions using these names are obsolete,
// pending T8 rebase; this fixture is not current storage acceptance.
export const DECK_DATABASE_NAME = "ygo-story-decks";
export const LEGACY_DECK_DATABASE_NAME =
  "ygo-story-duel-deck-builder-prototype";

/** Frozen prototype schema for sentinel tests proving runtime never accesses
 * an existing legacy library. No production schema or migration dependency.
 */
export function openDeckDatabase(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      const decks = database.createObjectStore("decks", { keyPath: "id" });
      decks.createIndex("updatedAt", "updatedAt");
      decks.createIndex("name", "name");
      database.createObjectStore("histories", { keyPath: "deckId" });
      database.createObjectStore("preferences", { keyPath: "key" });
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

export async function seedDeckDatabase(
  name: string,
  content: { readonly decks: readonly DeckRecord[] },
): Promise<void> {
  const database = await openDeckDatabase(name);
  const transaction = database.transaction(["decks", "histories"], "readwrite");
  for (const deck of content.decks) {
    transaction.objectStore("decks").put(deck);
    transaction
      .objectStore("histories")
      .put({ deckId: deck.id, history: emptyDeckHistory() });
  }
  await transactionSettled(transaction);
  database.close();
}

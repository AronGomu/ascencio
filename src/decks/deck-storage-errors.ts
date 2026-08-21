/* What a deck store refuses a write with, in a module of its own so that
   naming the failure never costs the storage engine that raised it.

   Both repositories throw these: the free-play one over IndexedDB, and the
   story one over a save. The story repository is reached from the visual
   novel's lazy chunk, and importing them from `indexeddb-deck-repository.ts`
   pulled that whole 19 kB module — `idb`, the schema, the migration — into the
   story closure, for two `Error` subclasses that touch none of it. */

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

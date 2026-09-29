/* Shared typed failures for the SQLite free-play repository and the save-owned
   Story adapter. Importing an error never loads either persistence backend. */

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

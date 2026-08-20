import type {
  DeckAutosaveRecord,
  DeckHistory,
  DeckId,
  DeckRecord,
  StoredDeck,
} from "./deck-contracts.ts";

export interface DeckRepository {
  list(): Promise<readonly DeckRecord[]>;
  load(id: DeckId): Promise<StoredDeck | null>;
  create(deck: DeckRecord, history: DeckHistory): Promise<StoredDeck>;
  createAndOpen(deck: DeckRecord, history: DeckHistory): Promise<StoredDeck>;
  save(
    expectedRevision: number,
    deck: DeckRecord,
    history: DeckHistory,
  ): Promise<StoredDeck>;
  delete(id: DeckId, expectedRevision: number): Promise<void>;
  getLastOpened(): Promise<DeckId | null>;
  setLastOpened(id: DeckId): Promise<void>;
  clearLastOpened(expectedId?: DeckId): Promise<void>;
  /** The deck a duel starts from; `null` when none is set or it is gone. */
  getDefaultDeck(): Promise<DeckId | null>;
  setDefaultDeck(id: DeckId | null): Promise<void>;
  appendAutosave(record: DeckAutosaveRecord): Promise<void>;
  /** The global autosave log, newest first. */
  listAutosaves(): Promise<readonly DeckAutosaveRecord[]>;
  /** Favourites, pruned against existing decks. */
  listFavourites(): Promise<readonly DeckId[]>;
  setFavourite(id: DeckId, favourite: boolean): Promise<void>;
}

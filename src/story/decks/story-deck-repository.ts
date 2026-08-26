/* The deck editor, writing into a story save instead of into the free-play
   deck database. Every mutating call is a story command followed by a save, so
   a deck edit lands in the same snapshot as the wallet and the collection and a
   load rolls all three back together (ADR-049).

   What describes an editing session rather than a save — the last-opened deck,
   the favourites, the autosave log and each deck's undo history — lives in this
   closure and dies with it. Persisting any of it would grow every snapshot with
   state the player never asked to keep, and per instance rather than per module
   so two contexts cannot inherit each other's session. */

import type {
  DeckAutosaveRecord,
  DeckHistory,
  DeckId,
  DeckRecord,
  StoredDeck,
} from "../../decks/deck-contracts.ts";
import { MAXIMUM_DECK_AUTOSAVES } from "../../decks/deck-database.ts";
import { emptyDeckHistory } from "../../decks/deck-history.ts";
import type { DeckRepository } from "../../decks/deck-repository.ts";
import {
  DeckRevisionConflictError,
  DeckStorageError,
} from "../../decks/deck-storage-errors.ts";
import type { StoryCommand } from "../model/story-reducer.ts";
import type { StoryState } from "../model/story-state.ts";
import { isStoryDeck } from "../saves/story-save-contracts.ts";

/** How the repository reaches the save it edits: the state as it stands, the
    reducer that changes it, and the write that makes the change durable. The
    caller owns all three, so the same adapter serves whichever slot and store
    the story context is currently running against. */
export interface StoryDeckRepositoryDeps {
  readState(): StoryState;
  dispatch(command: StoryCommand): void;
  /** Puts the captured pre-dispatch state back when the write is refused, so
      memory never runs ahead of the save on disk. */
  restore(state: StoryState): void;
  persist(): Promise<void>;
  now?: () => Date;
}

export function createStoryDeckRepository({
  readState,
  dispatch,
  restore,
  persist,
  now = () => new Date(),
}: StoryDeckRepositoryDeps): DeckRepository {
  const histories = new Map<DeckId, DeckHistory>();
  const autosaves: DeckAutosaveRecord[] = [];
  const favourites = new Set<DeckId>();
  let lastOpened: DeckId | null = null;

  function find(id: DeckId): DeckRecord | undefined {
    return readState().decks.find((deck) => deck.id === id);
  }

  /* One chain per repository — the save layer's serialize() idiom: every
     commit captures its snapshot only after the previous commit settled. The
     editor does not queue setDefaultDeck/deleteDeck behind an in-flight save,
     and a rollback racing such a commit could otherwise restore over a write
     that already landed on disk. */
  let chain: Promise<unknown> = Promise.resolve();

  function serialize<T>(task: () => Promise<T>): Promise<T> {
    const next = chain.then(task, task);
    chain = next.catch(() => undefined);
    return next;
  }

  /* Dispatch, confirm the command landed, and only then write. Each of the four
     deck commands answers an id it cannot resolve by changing nothing, so a
     save that followed a dropped command would store the state the editor was
     trying to replace — and report it to the editor as a successful save.

     The state captured first comes back through `restore` on any refusal, so a
     thrown commit leaves memory exactly where disk still is: a retry carries
     the revision the save holds instead of being refused as a conflict. */
  function commit(
    command: StoryCommand,
    landed: (state: StoryState) => boolean,
  ): Promise<void> {
    return serialize(async () => {
      const previous = readState();
      try {
        dispatch(command);
        if (!landed(readState()))
          throw new DeckStorageError(
            "The story save did not accept the change",
          );
        await persist();
      } catch (error) {
        restore(previous);
        throw error;
      }
    });
  }

  /* The save layer's own predicate rather than a second copy of the free-play
     validator: a record that layer cannot read back makes the whole save
     corrupt — progress, wallet and collection with it — while the two
     validators disagree only over records the editor never produces. */
  function guard(deck: DeckRecord): void {
    if (!isStoryDeck(deck))
      throw new DeckStorageError("Deck cannot be stored in a story save");
  }

  /* Never stamped behind its own creation: the free-play repository refuses
     such a record, and a deck has to stay legal in both worlds. */
  function stamp(deck: DeckRecord, revision: number): DeckRecord {
    return Object.freeze({
      ...deck,
      revision,
      updatedAt: new Date(
        Math.max(Date.parse(deck.createdAt), now().getTime()),
      ).toISOString(),
    });
  }

  async function add(
    deck: DeckRecord,
    history: DeckHistory,
    open: boolean,
  ): Promise<StoredDeck> {
    guard(deck);
    if (find(deck.id) !== undefined)
      throw new DeckRevisionConflictError(deck.revision);
    const next = stamp(deck, 1);
    await commit({ type: "deck-create", deck: next }, (state) =>
      state.decks.some(({ id }) => id === next.id),
    );
    /* Session state only after the write landed: a refused create must leave no
       trace for the editor's recovery probe to mistake for a committed deck. */
    histories.set(next.id, history);
    if (open) lastOpened = next.id;
    return Object.freeze({ deck: next, history });
  }

  return {
    list() {
      return Promise.resolve(readState().decks);
    },

    load(id) {
      const deck = find(id);
      return Promise.resolve(
        deck === undefined
          ? null
          : Object.freeze({
              deck,
              history: histories.get(id) ?? emptyDeckHistory(),
            }),
      );
    },

    create(deck, history) {
      return add(deck, history, false);
    },

    createAndOpen(deck, history) {
      return add(deck, history, true);
    },

    async save(expectedRevision, deck, history) {
      guard(deck);
      const current = find(deck.id);
      if (current === undefined || current.revision !== expectedRevision)
        throw new DeckRevisionConflictError(current?.revision ?? null);
      const next = stamp(deck, expectedRevision + 1);
      await commit(
        { type: "deck-save", deck: next },
        (state) =>
          state.decks.find(({ id }) => id === next.id)?.revision ===
          next.revision,
      );
      histories.set(next.id, history);
      return Object.freeze({ deck: next, history });
    },

    async delete(id, expectedRevision) {
      const current = find(id);
      if (current !== undefined && current.revision !== expectedRevision)
        throw new DeckRevisionConflictError(current.revision);
      /* A deck that is already gone is not a conflict — a retried delete has to
         settle — but it is also not a change worth writing a save for. */
      if (current !== undefined)
        await commit(
          { type: "deck-delete", id },
          (state) => !state.decks.some((deck) => deck.id === id),
        );
      /* Everything that named the deck goes out with it, so no part of the
         session is left pointing at a deck the save no longer has — but only
         once the write landed, so a refused delete leaves the session pointing
         at a deck the save still has. */
      histories.delete(id);
      favourites.delete(id);
      if (lastOpened === id) lastOpened = null;
    },

    getLastOpened() {
      return Promise.resolve(lastOpened);
    },

    async setLastOpened(id) {
      if (find(id) === undefined)
        throw new DeckStorageError("Cannot open a missing deck");
      lastOpened = id;
    },

    clearLastOpened(expectedId) {
      if (expectedId === undefined || lastOpened === expectedId)
        lastOpened = null;
      return Promise.resolve();
    },

    /* Read as a pointer, not as an id: the save layer keeps a default naming a
       deck the save no longer has rather than calling the record corrupt, so
       this is where it reads as none set. */
    getDefaultDeck() {
      const { decks, defaultDeckId } = readState();
      return Promise.resolve(
        decks.find(({ id }) => id === defaultDeckId)?.id ?? null,
      );
    },

    async setDefaultDeck(id) {
      if (id !== null && find(id) === undefined)
        throw new DeckStorageError("Cannot default a missing deck");
      await commit(
        { type: "deck-set-default", id },
        (state) => state.defaultDeckId === id,
      );
    },

    async setFavourite(id, favourite) {
      if (favourite && find(id) === undefined)
        throw new DeckStorageError("Cannot favourite a missing deck");
      if (favourite) favourites.add(id);
      else favourites.delete(id);
    },

    listFavourites() {
      const { decks } = readState();
      return Promise.resolve(
        Object.freeze(
          [...favourites].filter((id) => decks.some((deck) => deck.id === id)),
        ),
      );
    },

    /* Capped like the free-play log, so a long editing session cannot grow it
       without end. */
    appendAutosave(record) {
      autosaves.push(record);
      if (autosaves.length > MAXIMUM_DECK_AUTOSAVES)
        autosaves.splice(0, autosaves.length - MAXIMUM_DECK_AUTOSAVES);
      return Promise.resolve();
    },

    listAutosaves() {
      return Promise.resolve(Object.freeze([...autosaves].reverse()));
    },
  };
}

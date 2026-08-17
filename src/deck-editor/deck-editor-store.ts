import { get, writable, type Readable } from "svelte/store";
import type {
  DeckAutosaveRecord,
  DeckCardLists,
  DeckHistory,
  DeckId,
  DeckRecord,
  StoredDeck,
} from "../decks/deck-contracts.ts";
import {
  applyDeckCommand,
  createBlankDeck,
  derivedDeckName,
  normalizeDeckName,
  type DeckCommand,
} from "../decks/deck-model.ts";
import {
  emptyDeckHistory,
  pushDeckUpdate,
  redoDeckUpdate,
  undoDeckUpdate,
} from "../decks/deck-history.ts";
import type { DeckRepository } from "../decks/deck-repository.ts";
import { DeckRevisionConflictError } from "../decks/indexeddb-deck-repository.ts";
import type { DeckBuilderCardView } from "../decks/catalog/ocg-card-mapper.ts";
import type { PinnedDeckRuleset } from "../decks/catalog/pinned-ruleset.ts";
import { validateDeckDraft } from "../decks/deck-validation.ts";

interface PendingDeckSave {
  readonly deck: DeckRecord;
  readonly history: DeckHistory;
  readonly deckId: DeckId;
  readonly expectedRevision: number;
  readonly contextGeneration: number;
}

export interface DeckBuilderState {
  readonly mode: "loading" | "library" | "editor" | "error";
  readonly decks: readonly DeckRecord[];
  readonly current: StoredDeck | null;
  readonly saveState: "idle" | "saving" | "saved" | "failed" | "conflict";
  readonly message: string | null;
  /** The deck a duel starts from, so the library can mark its row. */
  readonly defaultDeckId: DeckId | null;
}

const INITIAL_STATE: DeckBuilderState = Object.freeze({
  mode: "loading",
  decks: Object.freeze([]),
  current: null,
  saveState: "idle",
  message: null,
  defaultDeckId: null,
});

export class DeckBuilderController implements Readable<DeckBuilderState> {
  readonly #state = writable<DeckBuilderState>(INITIAL_STATE);
  readonly #repository: DeckRepository;
  readonly #catalog: ReadonlyMap<number, DeckBuilderCardView>;
  readonly #ruleset: PinnedDeckRuleset;
  #queue: Promise<void> = Promise.resolve();
  #contextGeneration = 0;
  #createInFlight = false;
  #deletesInFlight = new Set<DeckId>();
  #pendingSave: PendingDeckSave | null = null;

  constructor(
    repository: DeckRepository,
    catalog: ReadonlyMap<number, DeckBuilderCardView>,
    ruleset: PinnedDeckRuleset,
  ) {
    this.#repository = repository;
    this.#catalog = catalog;
    this.#ruleset = ruleset;
  }

  subscribe = this.#state.subscribe;

  async initialize(): Promise<void> {
    const generation = this.#startContext();
    try {
      const [storedDecks, lastOpened, defaultDeckId] = await Promise.all([
        this.#repository.list(),
        this.#repository.getLastOpened(),
        this.#repository.getDefaultDeck(),
      ]);
      const decks = storedDecks.map((deck) => this.#revalidateDeck(deck));
      let recoveryMessage: string | null = null;
      let stored: StoredDeck | null = null;
      if (lastOpened !== null) {
        try {
          stored = await this.#repository.load(lastOpened);
        } catch {
          recoveryMessage =
            "Last-opened deck data is invalid. Valid decks remain available.";
        }
      }
      const current =
        stored === null
          ? null
          : Object.freeze({
              ...stored,
              deck: this.#revalidateDeck(stored.deck),
            });
      if (!this.#isCurrentContext(generation)) return;
      if (lastOpened !== null && current === null)
        await this.#repository.clearLastOpened(lastOpened);
      if (!this.#isCurrentContext(generation)) return;
      this.#state.set(
        Object.freeze({
          mode: current === null ? "library" : "editor",
          decks,
          current,
          saveState: current === null ? "idle" : "saved",
          message: recoveryMessage,
          defaultDeckId,
        }),
      );
    } catch (error) {
      if (this.#isCurrentContext(generation))
        this.#fail("Deck storage could not load", error);
    }
  }

  async showLibrary(): Promise<void> {
    await this.#queue;
    const state = get(this.#state);
    if (state.saveState === "failed" || state.saveState === "conflict") {
      this.#state.update((value) =>
        Object.freeze({
          ...value,
          message: "Resolve unsaved deck changes before leaving the editor.",
        }),
      );
      return;
    }
    const generation = this.#startContext();
    await this.#refreshLibrary(null, generation);
  }

  async openDeck(id: DeckId): Promise<void> {
    const generation = this.#startContext();
    try {
      const stored = await this.#repository.load(id);
      if (!this.#isCurrentContext(generation)) return;
      if (stored === null) {
        await this.#repository.clearLastOpened(id);
        await this.#refreshLibrary("Deck no longer exists.", generation);
        return;
      }
      await this.#repository.setLastOpened(id);
      if (!this.#isCurrentContext(generation)) return;
      const current = Object.freeze({
        ...stored,
        deck: this.#revalidateDeck(stored.deck),
      });
      this.#state.update((state) =>
        Object.freeze({
          ...state,
          mode: "editor",
          current,
          saveState: "saved",
          message: null,
        }),
      );
    } catch (error) {
      if (this.#isCurrentContext(generation))
        this.#fail("Deck could not open", error);
    }
  }

  async createDeck(name: string): Promise<boolean> {
    if (this.#createInFlight) return false;
    this.#createInFlight = true;
    const generation = this.#startContext();
    let draft: DeckRecord | null = null;
    try {
      draft = createBlankDeck(name, this.#catalog, this.#ruleset);
      const current = await this.#createAndOpen(draft, emptyDeckHistory());
      const decks = (await this.#repository.list()).map((deck) =>
        this.#revalidateDeck(deck),
      );
      if (!this.#isCurrentContext(generation)) return false;
      this.#state.set(
        Object.freeze({
          mode: "editor",
          decks,
          current,
          saveState: "saved",
          message: null,
          defaultDeckId: get(this.#state).defaultDeckId,
        }),
      );
      return true;
    } catch (error) {
      if (this.#isCurrentContext(generation)) {
        const committed =
          draft === null
            ? null
            : await this.#repository.load(draft.id).catch(() => null);
        if (!this.#isCurrentContext(generation)) return false;
        if (committed !== null) {
          await this.openDeck(committed.deck.id);
          return true;
        }
        this.#fail("Deck could not be created", error);
      }
      return false;
    } finally {
      this.#createInFlight = false;
    }
  }

  async importDeck(name: string, cards: DeckCardLists): Promise<boolean> {
    if (this.#createInFlight) return false;
    this.#createInFlight = true;
    const generation = this.#startContext();
    let deck: DeckRecord;
    let committed: StoredDeck | null = null;
    try {
      const draft = createBlankDeck(name, this.#catalog, this.#ruleset);
      const result = applyDeckCommand(
        draft,
        { type: "import", cards },
        this.#catalog,
        this.#ruleset,
      );
      if (result.type === "rejected") return false;
      deck = Object.freeze({
        ...draft,
        ...result.cards,
        importedNeedsReview: true,
        validation: validateDeckDraft(
          { ...result.cards, importedNeedsReview: true },
          this.#catalog,
          this.#ruleset,
        ),
      });
      const history = pushDeckUpdate(emptyDeckHistory(), {
        deckId: deck.id,
        before: draft,
        after: result.cards,
        reason: "import",
        beforeImportedNeedsReview: false,
        afterImportedNeedsReview: true,
      });
      committed = await this.#createAndOpen(deck, history);
      const decks = (await this.#repository.list()).map((value) =>
        this.#revalidateDeck(value),
      );
      if (!this.#isCurrentContext(generation)) return false;
      this.#state.set(
        Object.freeze({
          mode: "editor",
          decks,
          current: committed,
          saveState: "saved",
          message: "Deck imported.",
          defaultDeckId: get(this.#state).defaultDeckId,
        }),
      );
      return true;
    } catch (error) {
      if (committed !== null) {
        if (this.#isCurrentContext(generation)) {
          const decks = [
            ...get(this.#state).decks.filter(
              ({ id }) => id !== committed?.deck.id,
            ),
            committed.deck,
          ];
          this.#state.set(
            Object.freeze({
              mode: "editor",
              decks: Object.freeze(decks),
              current: committed,
              saveState: "saved",
              message: "Deck imported; library refresh failed.",
              defaultDeckId: get(this.#state).defaultDeckId,
            }),
          );
        }
        return true;
      }
      if (this.#isCurrentContext(generation))
        this.#fail("Deck could not be imported", error);
      return false;
    } finally {
      this.#createInFlight = false;
    }
  }

  mutate(command: DeckCommand): Promise<void> {
    const contextGeneration = this.#contextGeneration;
    const deckId = get(this.#state).current?.deck.id ?? null;
    return this.#enqueue(async () => {
      const state = get(this.#state);
      if (
        state.current === null ||
        state.current.deck.id !== deckId ||
        !this.#isCurrentContext(contextGeneration)
      )
        return;
      const result = applyDeckCommand(
        state.current.deck,
        command,
        this.#catalog,
        this.#ruleset,
      );
      if (result.type === "rejected") {
        this.#state.update((value) =>
          Object.freeze({ ...value, message: result.reason }),
        );
        return;
      }
      const before = state.current.deck;
      const importedNeedsReview =
        command.type === "import" ? true : before.importedNeedsReview;
      const nextDeck: DeckRecord = Object.freeze({
        ...before,
        ...result.cards,
        importedNeedsReview,
        validation: validateDeckDraft(
          { ...result.cards, importedNeedsReview },
          this.#catalog,
          this.#ruleset,
        ),
      });
      /* Where a card sits is not an edit worth remembering, so reorder and
         sort save the new order but leave undo pointing at the last change to
         which cards the deck holds. */
      const positional = command.type === "reorder" || command.type === "sort";
      const nextHistory = positional
        ? state.current.history
        : pushDeckUpdate(state.current.history, {
            deckId: before.id,
            before,
            after: result.cards,
            reason: command.type,
            beforeImportedNeedsReview: before.importedNeedsReview,
            afterImportedNeedsReview: importedNeedsReview,
          });
      /* A new history object is exactly the signal that which cards the deck
         holds changed: `pushDeckUpdate` hands back the one it was given when
         the multiset did not move, and positional commands never push at all. */
      if (nextHistory !== state.current.history) this.#appendAutosave(nextDeck);
      await this.#save(nextDeck, nextHistory);
    });
  }

  undo(): Promise<void> {
    const contextGeneration = this.#contextGeneration;
    const deckId = get(this.#state).current?.deck.id ?? null;
    return this.#enqueue(async () => {
      const current = get(this.#state).current;
      if (
        current === null ||
        current.deck.id !== deckId ||
        !this.#isCurrentContext(contextGeneration)
      )
        return;
      const result = undoDeckUpdate(current.history);
      if (result === null) return;
      const restored = this.#withCards(
        current.deck,
        result.cards,
        result.importedNeedsReview,
      );
      this.#appendAutosave(restored);
      await this.#save(restored, result.history);
    });
  }

  redo(): Promise<void> {
    const contextGeneration = this.#contextGeneration;
    const deckId = get(this.#state).current?.deck.id ?? null;
    return this.#enqueue(async () => {
      const current = get(this.#state).current;
      if (
        current === null ||
        current.deck.id !== deckId ||
        !this.#isCurrentContext(contextGeneration)
      )
        return;
      const result = redoDeckUpdate(current.history);
      if (result === null) return;
      const restored = this.#withCards(
        current.deck,
        result.cards,
        result.importedNeedsReview,
      );
      this.#appendAutosave(restored);
      await this.#save(restored, result.history);
    });
  }

  rename(name: string): Promise<void> {
    const contextGeneration = this.#contextGeneration;
    const deckId = get(this.#state).current?.deck.id ?? null;
    return this.#enqueue(async () => {
      const current = get(this.#state).current;
      if (
        current === null ||
        current.deck.id !== deckId ||
        !this.#isCurrentContext(contextGeneration)
      )
        return;
      let trimmed: string;
      try {
        trimmed = normalizeDeckName(name);
      } catch (error) {
        this.#state.update((state) =>
          Object.freeze({
            ...state,
            message:
              error instanceof Error ? error.message : "Invalid deck name",
          }),
        );
        return;
      }
      await this.#save(
        Object.freeze({ ...current.deck, name: trimmed }),
        current.history,
      );
    });
  }

  async duplicate(id: DeckId): Promise<void> {
    if (this.#createInFlight) return;
    this.#createInFlight = true;
    const generation = this.#startContext();
    try {
      const source = await this.#repository.load(id);
      if (source === null) return;
      const copy = createBlankDeck(
        derivedDeckName(source.deck.name, " Copy"),
        this.#catalog,
        this.#ruleset,
      );
      const value: DeckRecord = Object.freeze({
        ...copy,
        main: Object.freeze([...source.deck.main]),
        extra: Object.freeze([...source.deck.extra]),
        side: Object.freeze([...source.deck.side]),
        validation: validateDeckDraft(
          { ...source.deck, importedNeedsReview: false },
          this.#catalog,
          this.#ruleset,
        ),
      });
      const current = await this.#createAndOpen(value, emptyDeckHistory());
      const decks = (await this.#repository.list()).map((deck) =>
        this.#revalidateDeck(deck),
      );
      if (!this.#isCurrentContext(generation)) return;
      this.#state.set(
        Object.freeze({
          mode: "editor",
          decks,
          current,
          saveState: "saved",
          message: "Deck duplicated.",
          defaultDeckId: get(this.#state).defaultDeckId,
        }),
      );
    } catch (error) {
      if (this.#isCurrentContext(generation))
        this.#fail("Deck could not be duplicated", error);
    } finally {
      this.#createInFlight = false;
    }
  }

  async deleteDeck(id: DeckId, revision: number): Promise<void> {
    if (this.#deletesInFlight.has(id)) return;
    this.#deletesInFlight.add(id);
    const generation = this.#startContext();
    try {
      await this.#repository.delete(id, revision);
      await this.#refreshLibrary("Deck deleted.", generation);
    } catch (error) {
      if (this.#isCurrentContext(generation))
        this.#fail("Deck could not be deleted", error);
    } finally {
      this.#deletesInFlight.delete(id);
    }
  }

  /** Makes `id` the deck a duel starts from, then re-reads the library so the
      badge and the disabled button follow storage rather than the click. */
  async setDefaultDeck(id: DeckId): Promise<void> {
    const generation = this.#startContext();
    try {
      await this.#repository.setDefaultDeck(id);
      await this.#refreshLibrary(null, generation);
    } catch (error) {
      if (this.#isCurrentContext(generation))
        this.#fail("Default deck could not be set", error);
    }
  }

  retrySave(): Promise<void> {
    return this.#enqueue(async () => {
      const pending = this.#pendingSave;
      const current = get(this.#state).current;
      if (
        pending === null ||
        current === null ||
        pending.contextGeneration !== this.#contextGeneration ||
        pending.deckId !== current.deck.id ||
        pending.expectedRevision !== current.deck.revision
      ) {
        this.#pendingSave = null;
        return;
      }
      await this.#performSave(pending);
    });
  }

  async reloadCurrent(): Promise<void> {
    const current = get(this.#state).current;
    if (current !== null) await this.openDeck(current.deck.id);
  }

  async listAutosaves(): Promise<readonly DeckAutosaveRecord[]> {
    return this.#repository.listAutosaves().catch(() => []);
  }

  async restoreAutosave(entry: DeckAutosaveRecord): Promise<void> {
    const existing = await this.#repository
      .load(entry.deckId)
      .catch(() => null);
    /* Restoring into whatever deck happens to be open would overwrite it with
       another deck's cards, so a failed open or create stops here and leaves
       its own failure state standing. */
    if (existing !== null) {
      await this.openDeck(entry.deckId);
      if (get(this.#state).current?.deck.id !== entry.deckId) return;
    } else if (!(await this.createDeck(entry.deckName))) {
      return;
    }
    await this.mutate({
      type: "restore",
      cards: {
        main: [...entry.main],
        extra: [...entry.extra],
        side: [...entry.side],
      },
    });
  }

  async preserveCurrentAsCopy(): Promise<void> {
    if (this.#createInFlight) return;
    const current = get(this.#state).current;
    if (current === null) return;
    this.#createInFlight = true;
    const generation = this.#startContext();
    const copy = createBlankDeck(
      derivedDeckName(current.deck.name, " Recovered Copy"),
      this.#catalog,
      this.#ruleset,
    );
    const value: DeckRecord = Object.freeze({
      ...copy,
      main: Object.freeze([...current.deck.main]),
      extra: Object.freeze([...current.deck.extra]),
      side: Object.freeze([...current.deck.side]),
      validation: validateDeckDraft(
        { ...current.deck, importedNeedsReview: false },
        this.#catalog,
        this.#ruleset,
      ),
    });
    try {
      const stored = await this.#createAndOpen(value, emptyDeckHistory());
      if (!this.#isCurrentContext(generation)) return;
      this.#state.update((state) =>
        Object.freeze({
          ...state,
          mode: "editor",
          current: stored,
          saveState: "saved",
          message: "Local edits preserved as a copy.",
        }),
      );
    } catch (error) {
      if (this.#isCurrentContext(generation))
        this.#fail("Local edits could not be preserved", error);
    } finally {
      this.#createInFlight = false;
    }
  }

  #createAndOpen(deck: DeckRecord, history: DeckHistory): Promise<StoredDeck> {
    return this.#repository.createAndOpen(deck, history);
  }

  /* Deliberately not awaited: the log records what the player did, and a log
     that is slow, full, or broken must never fail or delay the edit it is
     about. Deck data is what `#save` is for. */
  #appendAutosave(deck: DeckRecord): void {
    void this.#repository
      .appendAutosave({
        id: crypto.randomUUID(),
        deckId: deck.id,
        deckName: deck.name,
        createdAt: new Date().toISOString(),
        main: [...deck.main],
        extra: [...deck.extra],
        side: [...deck.side],
      })
      .catch(() => undefined);
  }

  #enqueue(operation: () => Promise<void>): Promise<void> {
    const next = this.#queue.then(operation, operation);
    this.#queue = next.catch(() => undefined);
    return next;
  }

  async #save(deck: DeckRecord, history: DeckHistory): Promise<void> {
    const current = get(this.#state).current;
    if (current === null || current.deck.id !== deck.id) return;
    const pending = Object.freeze({
      deck,
      history,
      deckId: deck.id,
      expectedRevision: current.deck.revision,
      contextGeneration: this.#contextGeneration,
    });
    this.#pendingSave = pending;
    this.#state.update((state) =>
      Object.freeze({
        ...state,
        current: Object.freeze({ deck, history }),
        saveState: "saving",
        message: null,
      }),
    );
    await this.#performSave(pending);
  }

  async #performSave(pending: PendingDeckSave): Promise<void> {
    try {
      const saved = await this.#repository.save(
        pending.expectedRevision,
        pending.deck,
        pending.history,
      );
      if (!this.#pendingIsCurrent(pending)) return;
      this.#pendingSave = null;
      this.#state.update((state) =>
        Object.freeze({
          ...state,
          current: saved,
          saveState: "saved",
          message: null,
        }),
      );
    } catch (error) {
      if (!this.#pendingIsCurrent(pending)) return;
      this.#state.update((state) =>
        Object.freeze({
          ...state,
          saveState:
            error instanceof DeckRevisionConflictError ? "conflict" : "failed",
          message: error instanceof Error ? error.message : "Deck save failed.",
        }),
      );
    }
  }

  #pendingIsCurrent(pending: PendingDeckSave): boolean {
    const current = get(this.#state).current;
    return (
      this.#pendingSave === pending &&
      pending.contextGeneration === this.#contextGeneration &&
      current?.deck.id === pending.deckId
    );
  }

  #withCards(
    deck: DeckRecord,
    cards: DeckCardLists,
    importedNeedsReview = deck.importedNeedsReview,
  ): DeckRecord {
    return Object.freeze({
      ...deck,
      ...cards,
      importedNeedsReview,
      validation: validateDeckDraft(
        { ...cards, importedNeedsReview },
        this.#catalog,
        this.#ruleset,
      ),
    });
  }

  #revalidateDeck(deck: DeckRecord): DeckRecord {
    return Object.freeze({
      ...deck,
      validation: validateDeckDraft(
        {
          ...deck,
          storedRulesetRevision: deck.validation.rulesetRevision,
        },
        this.#catalog,
        this.#ruleset,
      ),
    });
  }

  async #refreshLibrary(
    message: string | null = null,
    generation = this.#contextGeneration,
  ): Promise<void> {
    try {
      const [storedDecks, defaultDeckId] = await Promise.all([
        this.#repository.list(),
        this.#repository.getDefaultDeck(),
      ]);
      const decks = storedDecks.map((deck) => this.#revalidateDeck(deck));
      if (!this.#isCurrentContext(generation)) return;
      this.#state.set(
        Object.freeze({
          mode: "library",
          decks,
          current: null,
          saveState: "idle",
          message,
          defaultDeckId,
        }),
      );
    } catch (error) {
      if (this.#isCurrentContext(generation))
        this.#fail("Deck Library could not load", error);
    }
  }

  #startContext(): number {
    this.#contextGeneration += 1;
    this.#pendingSave = null;
    return this.#contextGeneration;
  }

  #isCurrentContext(generation: number): boolean {
    return generation === this.#contextGeneration;
  }

  #fail(message: string, error: unknown): void {
    this.#state.update((state) =>
      Object.freeze({
        ...state,
        mode: "error",
        message: `${message}: ${error instanceof Error ? error.message : "Unknown error"}`,
      }),
    );
  }
}

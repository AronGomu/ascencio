import { get, writable, type Readable } from "svelte/store";
import type {
  DeckAutosaveRecord,
  DeckCardLists,
  DeckHistory,
  DeckId,
  DeckRecord,
  DeckValidationSummary,
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
import {
  quantityLimit,
  type PinnedDeckRuleset,
} from "../decks/catalog/pinned-ruleset.ts";
import {
  unlimitedCardOwnership,
  type CardOwnership,
} from "../decks/card-ownership.ts";
import {
  validateDeckDraft,
  type DeckValidationInput,
} from "../decks/deck-validation.ts";
import { availableCopies, unavailableReason } from "./catalog-availability.ts";

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
  readonly #ownership: CardOwnership;
  #queue: Promise<void> = Promise.resolve();
  #contextGeneration = 0;
  #createInFlight = false;
  #deletesInFlight = new Set<DeckId>();
  #pendingSave: PendingDeckSave | null = null;

  /** `ownership` defaults to free play's, because a host that says nothing about
      which world it is editing is editing the one that owns everything. */
  constructor(
    repository: DeckRepository,
    catalog: ReadonlyMap<number, DeckBuilderCardView>,
    ruleset: PinnedDeckRuleset,
    ownership: CardOwnership = unlimitedCardOwnership(),
  ) {
    this.#repository = repository;
    this.#catalog = catalog;
    this.#ruleset = ruleset;
    this.#ownership = ownership;
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
        validation: this.#validate({
          ...result.cards,
          importedNeedsReview: true,
        }),
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
      const denial = this.#ownershipDenial(state.current.deck, command);
      if (denial !== null) {
        this.#state.update((value) =>
          Object.freeze({ ...value, message: denial }),
        );
        return;
      }
      const before = state.current.deck;
      const importedNeedsReview =
        command.type === "import" ? true : before.importedNeedsReview;
      const illustrationCardCode =
        before.illustrationCardCode !== null &&
        [
          ...result.cards.main,
          ...result.cards.extra,
          ...result.cards.side,
        ].includes(before.illustrationCardCode)
          ? before.illustrationCardCode
          : null;
      const nextDeck: DeckRecord = Object.freeze({
        ...before,
        ...result.cards,
        importedNeedsReview,
        illustrationCardCode,
        validation: this.#validate({ ...result.cards, importedNeedsReview }),
      });
      /* Reorder and sort leave undo pointing at the last membership change so
         undo never fights the player's ordering; the log answers "what did the
         deck look like a moment ago", which includes where the cards sat. */
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
            beforeIllustrationCardCode: before.illustrationCardCode,
            afterIllustrationCardCode: illustrationCardCode,
          });
      this.#appendAutosave(nextDeck);
      await this.#save(nextDeck, nextHistory);
    });
  }

  setIllustration(code: number | null): Promise<void> {
    const contextGeneration = this.#contextGeneration;
    const deckId = get(this.#state).current?.deck.id ?? null;
    return this.#enqueue(async () => {
      const current = get(this.#state).current;
      if (
        current === null ||
        current.deck.id !== deckId ||
        !this.#isCurrentContext(contextGeneration) ||
        current.deck.illustrationCardCode === code
      )
        return;
      if (
        code !== null &&
        ![
          ...current.deck.main,
          ...current.deck.extra,
          ...current.deck.side,
        ].includes(code)
      ) {
        this.#state.update((state) =>
          Object.freeze({
            ...state,
            message: "Illustration card is not in deck.",
          }),
        );
        return;
      }
      const nextDeck = Object.freeze({
        ...current.deck,
        illustrationCardCode: code,
      });
      const nextHistory = pushDeckUpdate(current.history, {
        deckId: current.deck.id,
        before: current.deck,
        after: current.deck,
        reason: "illustration",
        beforeImportedNeedsReview: current.deck.importedNeedsReview,
        afterImportedNeedsReview: current.deck.importedNeedsReview,
        beforeIllustrationCardCode: current.deck.illustrationCardCode,
        afterIllustrationCardCode: code,
      });
      this.#appendAutosave(nextDeck);
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
        result.illustrationCardCode,
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
        result.illustrationCardCode,
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

  /** Renaming a deck the library is showing rather than the deck the editor
      has open. `rename` above can only ever touch `current`, and on the
      library screen there is no current deck at all, so this one loads the row
      by id and writes it back. Queued beside the editor's own writes, because
      the deck being renamed may be the deck a save is still in flight for. */
  renameDeck(id: DeckId, name: string): Promise<void> {
    const contextGeneration = this.#contextGeneration;
    return this.#enqueue(async () => {
      if (!this.#isCurrentContext(contextGeneration)) return;
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
      try {
        const stored = await this.#repository.load(id);
        /* A deck another context deleted is not an error here: the library is
           about to be re-read anyway, and it will not list it. */
        if (stored === null) return;
        await this.#repository.save(
          stored.deck.revision,
          Object.freeze({ ...stored.deck, name: trimmed }),
          stored.history,
        );
        await this.#refreshLibrary(null, contextGeneration);
      } catch (error) {
        if (this.#isCurrentContext(contextGeneration))
          this.#fail("Deck could not be renamed", error);
      }
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
        illustrationCardCode: source.deck.illustrationCardCode,
        validation: this.#validate({
          ...source.deck,
          importedNeedsReview: false,
        }),
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

  /** `true` only when storage really dropped the deck, so a caller that
      navigates away on delete cannot leave the page of a deck that survived. */
  async deleteDeck(id: DeckId, revision: number): Promise<boolean> {
    if (this.#deletesInFlight.has(id)) return false;
    this.#deletesInFlight.add(id);
    const generation = this.#startContext();
    try {
      await this.#repository.delete(id, revision);
      await this.#refreshLibrary("Deck deleted.", generation);
      return true;
    } catch (error) {
      if (this.#isCurrentContext(generation))
        this.#fail("Deck could not be deleted", error);
      return false;
    } finally {
      this.#deletesInFlight.delete(id);
    }
  }

  /** Makes `id` the deck a duel starts from, then re-reads the stored default
      so the badge and the disabled button follow storage rather than the
      click.

      Only the default is re-read. `#refreshLibrary` sets `mode` to `library`
      and `current` to `null`, which was survivable while this action lived on
      a library row and is not now that it lives on the deck page: it closed
      the deck under the button, and `DeckEditorApp` had already applied the
      route, so nothing re-opened it and the editor sat on its "Opening deck…"
      skeleton until a reload. Making a deck the default changes no deck, so
      the open one stays open. The context is captured rather than started for
      the same reason — a new context would throw away a save still in
      flight. */
  async setDefaultDeck(id: DeckId): Promise<void> {
    const generation = this.#contextGeneration;
    try {
      await this.#repository.setDefaultDeck(id);
      const defaultDeckId = await this.#repository.getDefaultDeck();
      if (!this.#isCurrentContext(generation)) return;
      this.#state.update((state) => Object.freeze({ ...state, defaultDeckId }));
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
    await this.setIllustration(entry.illustrationCardCode ?? null);
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
      illustrationCardCode: current.deck.illustrationCardCode,
      validation: this.#validate({
        ...current.deck,
        importedNeedsReview: false,
      }),
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
        illustrationCardCode: deck.illustrationCardCode,
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

  /* The cap the catalog draws, enforced again on the command itself: a drag, a
     context-menu add and the keyboard all reach `mutate` without passing
     through a tile, so a disabled affordance is a courtesy rather than a gate.
     Read after `applyDeckCommand` has accepted, so the ruleset's own refusals
     keep their wording and their order. */
  #ownershipDenial(deck: DeckCardLists, command: DeckCommand): string | null {
    if (this.#ownership.isUnlimited || command.type !== "add") return null;
    const limit = quantityLimit(this.#ruleset, command.cardCode);
    const used = [...deck.main, ...deck.extra, ...deck.side].filter(
      (code) => code === command.cardCode,
    ).length;
    return availableCopies(command.cardCode, this.#ownership, limit, used) > 0
      ? null
      : unavailableReason(this.#ownership.ownedCount(command.cardCode), limit);
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
    illustrationCardCode = deck.illustrationCardCode,
  ): DeckRecord {
    return Object.freeze({
      ...deck,
      ...cards,
      importedNeedsReview,
      illustrationCardCode,
      validation: this.#validate({ ...cards, importedNeedsReview }),
    });
  }

  /* Every verdict this controller writes comes through here, so the context's
     ownership cannot be passed at five call sites and forgotten at the sixth.
     That matters most on the paths that carry a whole card list rather than one
     add — import, autosave restore and duplicate — because none of them passes
     the add affordance that `#ownershipDenial` guards (ADR-050). They are
     accepted as the player asked and then reported illegal, which is what a
     deck the save cannot field is. */
  #validate(input: DeckValidationInput): DeckValidationSummary {
    return validateDeckDraft(
      input,
      this.#catalog,
      this.#ruleset,
      this.#ownership,
    );
  }

  #revalidateDeck(deck: DeckRecord): DeckRecord {
    return Object.freeze({
      ...deck,
      validation: this.#validate({
        ...deck,
        storedRulesetRevision: deck.validation.rulesetRevision,
      }),
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

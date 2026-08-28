import {
  catalogByCode,
  PROTOTYPE_RULESET,
} from "../../decks/catalog/pinned-ruleset.ts";
import { runtimeCatalog } from "../../decks/catalog/runtime-catalog.ts";
import { deckId, type DeckId } from "../../decks/deck-contracts.ts";
import { emptyDeckHistory } from "../../decks/deck-history.ts";
import {
  createBlankDeck,
  derivedDeckName,
  normalizeDeckName,
} from "../../decks/deck-model.ts";
import { validateDeckDraft } from "../../decks/deck-validation.ts";
import { IndexedDbDeckRepository } from "../../decks/indexeddb-deck-repository.ts";

/**
 * The three deck-library writes the free-play selection screen offers.
 *
 * Each one opens the library, acts, and closes it again, the way
 * `loadFreePlayDecks` reads it: the screen manages the decks it is picking
 * from, so a rename is one write between two listings rather than a session
 * the screen has to hold open. Nothing here re-reads the listing — the caller
 * does, because it also owns which deck each seat is left showing.
 *
 * The deck editor writes the same rows through `DeckBuilderController`, whose
 * `renameDeck`, `duplicate` and `deleteDeck` these mirror. That store is
 * another domain's (ADR-022) and carries an editor's state machine besides, so
 * the repository calls are repeated here rather than the store imported.
 */

/** `local:${id}:${revision}` → its two halves; `null` for a bundled key.

    Read from the end, because an id may hold `:` itself: `deckId` forbids only
    `\0`, so splitting from the front would guess where the key is a fact. */
export function parseLocalDeckKey(
  key: string,
): Readonly<{ id: DeckId; revision: number }> | null {
  const prefix = "local:";
  if (!key.startsWith(prefix)) return null;
  const cut = key.lastIndexOf(":");
  const id = key.slice(prefix.length, cut);
  const revision = Number(key.slice(cut + 1));
  if (id === "" || !Number.isSafeInteger(revision) || revision < 0) return null;
  return Object.freeze({ id: deckId(id), revision });
}

/* The screen offers none of these on a bundled deck — its tile is not
   deletable and its key names a preset — so this is the guard behind that
   rather than a message a player is ever meant to read. */
function localDeck(key: string): Readonly<{ id: DeckId; revision: number }> {
  const local = parseLocalDeckKey(key);
  if (local === null) throw new Error("Bundled decks cannot be modified");
  return local;
}

/** Renames the deck `key` names, at whatever revision storage holds now.

    The key's own revision is not the expected one: the deck may have been
    saved since the listing that produced the key, and a rename is a write the
    editor's `renameDeck` makes against the row as it stands. A deck that is
    already gone is not an error — the caller re-reads the listing next, and it
    will not show it. */
export async function renameLocalDeck(
  key: string,
  name: string,
): Promise<void> {
  const { id } = localDeck(key);
  const trimmed = normalizeDeckName(name);
  let repository: IndexedDbDeckRepository | null = null;
  try {
    repository = await IndexedDbDeckRepository.open();
    const stored = await repository.load(id);
    if (stored === null) return;
    await repository.save(
      stored.deck.revision,
      Object.freeze({ ...stored.deck, name: trimmed }),
      stored.history,
    );
  } finally {
    repository?.close();
  }
}

/** Copies the deck `key` names into a new deck of its own.

    A copy is a new deck rather than a revision of the old one: its own id, its
    own name, and no history at all — the edits that built the original belong
    to the original. Its cards are validated again rather than copied over,
    because the ruleset the source was stored under may not be this build's. */
export async function duplicateLocalDeck(key: string): Promise<void> {
  const { id } = localDeck(key);
  let repository: IndexedDbDeckRepository | null = null;
  try {
    const catalog = catalogByCode(await runtimeCatalog());
    repository = await IndexedDbDeckRepository.open();
    const source = await repository.load(id);
    if (source === null) return;
    const copy = createBlankDeck(
      derivedDeckName(source.deck.name, " Copy"),
      catalog,
      PROTOTYPE_RULESET,
    );
    await repository.create(
      Object.freeze({
        ...copy,
        main: Object.freeze([...source.deck.main]),
        extra: Object.freeze([...source.deck.extra]),
        side: Object.freeze([...source.deck.side]),
        validation: validateDeckDraft(
          { ...source.deck, importedNeedsReview: false },
          catalog,
          PROTOTYPE_RULESET,
        ),
      }),
      emptyDeckHistory(),
    );
  } finally {
    repository?.close();
  }
}

/** Deletes the deck `key` names, at the revision the key carries.

    The revision is the guard: a deck edited in another tab since the listing
    is a different deck from the one the player pressed Delete on, and the
    repository refuses it rather than dropping work they have not seen. */
export async function deleteLocalDeck(key: string): Promise<void> {
  const { id, revision } = localDeck(key);
  let repository: IndexedDbDeckRepository | null = null;
  try {
    repository = await IndexedDbDeckRepository.open();
    await repository.delete(id, revision);
  } finally {
    repository?.close();
  }
}

<script lang="ts">
  import { tick } from "svelte";
  import { handleModalKeydown } from "../focus-trap.ts";
  import {
    DeckSelectScreen,
    type DecklistRow,
    type DecklistView,
  } from "../../deck-select/index.ts";
  import type { DeckBuilderCardView } from "../../decks/catalog/ocg-card-mapper.ts";
  import type { DeckId, DeckRecord } from "../../decks/deck-contracts.ts";
  import { MAXIMUM_DECK_NAME_LENGTH } from "../../decks/deck-model.ts";
  import { deckLibraryTiles } from "./deck-library-tiles.ts";

  export let decks: readonly DeckRecord[];
  /** Every card this build packages, for the tile covers and for naming the
      cards in the docked decklist. Defaulted so a harness that mounts the
      library alone still renders it, art or no art. */
  export let catalog: ReadonlyMap<number, DeckBuilderCardView> = new Map();
  export let message: string | null = null;
  export let oncreate: (name: string) => unknown | Promise<unknown>;
  export let onopen: (id: DeckId) => unknown | Promise<unknown>;
  export let onimport: () => void;
  /** Consulting the cards this context owns. Reported rather than linked, like
      every other navigation the editor offers: the collection is two routes
      over one screen and only the host knows which world this library is
      bound to. */
  export let oncollection: () => void = () => undefined;
  /** Leaving the library, reported for the same reason. */
  export let onback: () => void = () => undefined;
  /** Which tile wears the badge; the controller owns the value, not the click. */
  export let defaultDeckId: DeckId | null = null;
  export let favouriteDeckIds: readonly DeckId[] = [];
  export let onfavourite: (id: DeckId, favourite: boolean) => void = () =>
    undefined;
  /* The three deck operations the grid's kebab and the screen's footer both
     reach. The screen owns the menu and the dialogs; performing the operation
     is the host's, so each one arrives here as a decision already confirmed. */
  export let onrename: (id: DeckId, name: string) => void = () => undefined;
  export let onduplicate: (id: DeckId) => void = () => undefined;
  export let ondelete: (id: DeckId, revision: number) => void = () => undefined;

  /* Which deck the grid is focused on. Focus only: the library fills no seat,
     so this decides the teal halo, the docked decklist and which deck the
     footer's Delete/Rename/Duplicate act on, and nothing else. */
  let selectedKey: string | null = null;
  let creating = false;
  let createName = "";
  let dialogHeading: HTMLHeadingElement;
  let dialogInput: HTMLInputElement;
  let dialogOpener: HTMLElement | null = null;
  let dialogBusy = false;

  $: createNameDuplicate = decks.some(
    (deck) =>
      createName.trim().length > 0 &&
      deck.name.toLocaleLowerCase() === createName.trim().toLocaleLowerCase(),
  );
  $: tiles = deckLibraryTiles(decks, catalog, {
    defaultDeckId,
    favouriteDeckIds,
  });

  /* The screen names a deck by the key it was given, which is the deck's id;
     the record behind it carries the revision a delete has to quote. */
  function forRecord(key: string, use: (deck: DeckRecord) => void): void {
    const deck = decks.find((candidate) => candidate.id === key);
    if (deck !== undefined) use(deck);
  }

  function rowOf(
    cards: ReadonlyMap<number, DeckBuilderCardView>,
    code: number,
  ): DecklistRow {
    return { code, name: cards.get(code)?.name ?? `Missing card ${code}` };
  }

  /* The decks are already in memory — they are the ones the library is
     rendering — so the promise the screen asks for is a resolved one.

     Both the pool and the catalog are arguments rather than captures, so the
     reactive statement below hands over a new resolver whenever either
     changes. That identity is what the screen re-resolves the docked list on,
     and at no other time: a deck deleted while it was the focused one would
     otherwise leave its decklist sitting in the dock. */
  function decklistResolver(
    pool: readonly DeckRecord[],
    cards: ReadonlyMap<number, DeckBuilderCardView>,
  ): (key: string) => Promise<DecklistView | null> {
    return (key) => {
      const deck = pool.find((candidate) => candidate.id === key);
      return Promise.resolve(
        deck === undefined
          ? null
          : {
              main: deck.main.map((code) => rowOf(cards, code)),
              extra: deck.extra.map((code) => rowOf(cards, code)),
              side: deck.side.map((code) => rowOf(cards, code)),
            },
      );
    };
  }

  $: decklistFor = decklistResolver(decks, catalog);

  function cardImageFor(code: number): string | null {
    return catalog.get(code)?.imageUrl ?? null;
  }

  function openCreateDialog(): void {
    creating = true;
    createName = "";
    void focusDialog();
  }

  async function focusDialog(): Promise<void> {
    dialogOpener = document.activeElement as HTMLElement | null;
    await tick();
    if (creating) dialogInput?.focus();
    else dialogHeading?.focus();
  }

  async function submitCreate(): Promise<void> {
    if (dialogBusy || createName.trim().length === 0) return;
    dialogBusy = true;
    try {
      await oncreate(createName);
      await closeDialog(() => (creating = false));
    } finally {
      dialogBusy = false;
    }
  }

  async function closeDialog(close: () => void): Promise<void> {
    close();
    await tick();
    dialogOpener?.focus();
    dialogOpener = null;
  }
</script>

<section class="library" data-cy="deck-library">
  {#if message}<p class="message" role="status" data-cy="deck-library-message">
      {message}
    </p>{/if}

  <!-- What the shared screen has no place for: this library is also the way in
       to the collection, to YDK import, and to a deck that does not exist yet.
       The filter and the sort moved into the screen's own tools row. -->
  <div class="tools" data-cy="deck-library-tools">
    <button
      type="button"
      class="secondary"
      data-cy="deck-library-collection"
      onclick={oncollection}>Collection</button
    >
    <button
      type="button"
      class="secondary"
      data-cy="deck-library-import"
      onclick={onimport}>Import Deck</button
    >
    <button
      type="button"
      data-cy="deck-library-create"
      onclick={openCreateDialog}>Create deck</button
    >
  </div>

  {#if decks.length === 0}
    <div class="empty" data-cy="deck-library-empty">
      <h2 data-cy="deck-library-empty-heading">No local decks</h2>
      <p data-cy="deck-library-empty-message">
        Create a blank deck or import YDK text.
      </p>
      <button
        type="button"
        data-cy="deck-library-empty-create"
        onclick={openCreateDialog}>Create blank deck</button
      >
    </div>
  {:else}
    <!-- The screen sizes itself against its box, so it is given one rather
         than being left to the flow: only the deck grid inside it scrolls. -->
    <div class="screen-slot" data-cy="deck-library-screen">
      <DeckSelectScreen
        mode="library"
        eyebrow="Deck builder"
        title="Deck library"
        {tiles}
        {selectedKey}
        {decklistFor}
        {cardImageFor}
        {onback}
        onselect={(key) => (selectedKey = key)}
        onopen={(key) => forRecord(key, (deck) => onopen(deck.id))}
        onrename={(key, name) =>
          forRecord(key, (deck) => onrename(deck.id, name))}
        onduplicate={(key) => forRecord(key, (deck) => onduplicate(deck.id))}
        ondelete={(key) =>
          forRecord(key, (deck) => ondelete(deck.id, deck.revision))}
        onfavourite={(key, favourite) =>
          forRecord(key, (deck) => onfavourite(deck.id, favourite))}
      />
    </div>
  {/if}
</section>

{#if creating}
  <div
    class="dialog"
    role="dialog"
    tabindex="-1"
    aria-modal="true"
    aria-labelledby="create-heading"
    data-cy="deck-library-create-dialog"
    onkeydown={(event) => {
      /* The screen behind this dialog listens for its shortcuts on the window,
         where Enter opens the focused deck. While a modal is up the keyboard
         is the modal's. */
      event.stopPropagation();
      handleModalKeydown(
        event,
        () => void closeDialog(() => (creating = false)),
      );
    }}
  >
    <h2
      id="create-heading"
      tabindex="-1"
      data-cy="deck-library-create-heading"
      bind:this={dialogHeading}
    >
      Create blank deck
    </h2>
    <form
      aria-busy={dialogBusy}
      data-cy="deck-library-create-form"
      onsubmit={(event) => {
        event.preventDefault();
        void submitCreate();
      }}
    >
      <label data-cy="deck-library-create-name-field"
        ><span data-cy="deck-library-create-name-label">Deck name</span><input
          data-cy="deck-library-create-name-input"
          bind:this={dialogInput}
          bind:value={createName}
          maxlength={MAXIMUM_DECK_NAME_LENGTH}
        /></label
      >
      {#if createNameDuplicate}
        <p
          class="name-warning"
          role="status"
          data-cy="deck-library-create-duplicate-name"
        >
          Another deck already uses this name. IDs remain independent.
        </p>
      {/if}
      <div class="actions" data-cy="deck-library-create-actions">
        <small data-cy="deck-library-create-hint"
          >Enter to create · Esc to cancel</small
        >
        <button
          type="button"
          class="secondary"
          disabled={dialogBusy}
          data-cy="deck-library-create-cancel"
          onclick={() => void closeDialog(() => (creating = false))}
          >Cancel</button
        >
        <button
          type="submit"
          disabled={dialogBusy || createName.trim().length === 0}
          data-cy="deck-library-create-submit"
          >{dialogBusy ? "Creating…" : "Create"}</button
        >
      </div>
    </form>
  </div>
{/if}

<style>
  /* The 1.5rem context banner `DeckEditorApp` renders above it, so the library
     ends exactly at the bottom of the stage and the deck grid — not the
     region — is what scrolls. */
  .library {
    display: flex;
    width: 100%;
    height: calc(var(--stage-h, 100svh) - 1.5rem);
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-3);
  }

  /* The screen is `height: 100%` against whatever box it is given, and this is
     the box: everything the library keeps above it takes its own height first. */
  .screen-slot {
    display: grid;
    min-height: 0;
    flex: 1 1 auto;
  }

  .tools,
  .actions {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  .actions {
    justify-content: space-between;
  }

  .tools button {
    min-height: 2.5rem;
  }

  h2,
  p {
    margin-top: 0;
  }

  label {
    display: grid;
    gap: 0.3rem;
  }

  label span {
    color: var(--muted);
  }

  input {
    min-height: 2.5rem;
    padding: 0.5rem 0.65rem;
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: 0.5rem;
    background: var(--surface-chain);
  }

  .empty,
  .message {
    padding: 1.5rem;
    border: 1px solid var(--border);
    border-radius: 0.7rem;
    background: var(--surface);
    text-align: center;
  }

  .dialog {
    position: fixed;
    z-index: 30;
    inset: 50% auto auto 50%;
    width: min(30rem, calc(100vw - 3rem));
    padding: 1rem;
    transform: translate(-50%, -50%);
    border: 1px solid var(--border);
    border-radius: 0.8rem;
    background: var(--surface);
    box-shadow: 0 1.5rem 5rem color-mix(in srgb, var(--shadow) 55%, transparent);
  }

  .dialog label {
    margin-bottom: 1rem;
  }

  .dialog input {
    width: 100%;
  }

  .name-warning {
    color: var(--warning);
    font-size: 0.8rem;
  }
</style>

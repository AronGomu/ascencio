<script lang="ts">
  import { tick } from "svelte";
  import { handleModalKeydown } from "../focus-trap.ts";
  import type { DeckId, DeckRecord } from "../../decks/deck-contracts.ts";
  import { MAXIMUM_DECK_NAME_LENGTH } from "../../decks/deck-model.ts";

  export let decks: readonly DeckRecord[];
  export let message: string | null = null;
  export let oncreate: (name: string) => unknown | Promise<unknown>;
  export let onopen: (id: DeckId) => unknown | Promise<unknown>;
  export let onrename: (
    deck: DeckRecord,
    name: string,
  ) => unknown | Promise<unknown>;
  export let onduplicate: (id: DeckId) => unknown | Promise<unknown>;
  export let ondelete: (deck: DeckRecord) => unknown | Promise<unknown>;
  export let onexport: (deck: DeckRecord) => void;
  export let onimport: () => void;

  let search = "";
  let sort: "modified" | "name" = "modified";
  let creating = false;
  let createName = "";
  let renaming: DeckRecord | null = null;
  let renameName = "";
  let deleting: DeckRecord | null = null;
  let dialogHeading: HTMLHeadingElement;
  let dialogInput: HTMLInputElement;
  let dialogOpener: HTMLElement | null = null;
  let dialogBusy = false;

  $: createNameDuplicate = decks.some(
    (deck) =>
      createName.trim().length > 0 &&
      deck.name.toLocaleLowerCase() === createName.trim().toLocaleLowerCase(),
  );
  $: renameNameDuplicate = decks.some(
    (deck) =>
      renaming !== null &&
      deck.id !== renaming.id &&
      renameName.trim().length > 0 &&
      deck.name.toLocaleLowerCase() === renameName.trim().toLocaleLowerCase(),
  );
  $: filtered = decks
    .filter((deck) =>
      deck.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
    )
    .sort((left, right) =>
      sort === "name"
        ? left.name.localeCompare(right.name)
        : right.updatedAt.localeCompare(left.updatedAt),
    );

  async function focusDialog(): Promise<void> {
    dialogOpener = document.activeElement as HTMLElement | null;
    await tick();
    if (creating || renaming !== null) dialogInput?.focus();
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

  async function submitRename(): Promise<void> {
    if (dialogBusy || renaming === null || renameName.trim().length === 0)
      return;
    dialogBusy = true;
    try {
      await onrename(renaming, renameName);
      await closeDialog(() => (renaming = null));
    } finally {
      dialogBusy = false;
    }
  }

  async function confirmDelete(): Promise<void> {
    if (dialogBusy || deleting === null) return;
    dialogBusy = true;
    try {
      await ondelete(deleting);
      await closeDialog(() => (deleting = null));
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

<section
  class="library"
  data-cy="deck-library"
  aria-labelledby="deck-library-heading"
>
  <header data-cy="deck-library-header">
    <div data-cy="deck-library-titles">
      <p data-cy="deck-library-eyebrow">Local decks</p>
      <h1 id="deck-library-heading" data-cy="deck-library-heading">
        Deck Library
      </h1>
      <span data-cy="deck-library-subtitle"
        >Visual Novel chooses a deck ID. This module stores and resolves decks.</span
      >
    </div>
    <div class="actions" data-cy="deck-library-actions">
      <button
        type="button"
        class="secondary"
        data-cy="deck-library-import"
        onclick={onimport}>Import YDK</button
      >
      <button
        type="button"
        data-cy="deck-library-create"
        onclick={() => {
          creating = true;
          createName = "";
          void focusDialog();
        }}>Create deck</button
      >
    </div>
  </header>

  {#if message}<p class="message" role="status" data-cy="deck-library-message">
      {message}
    </p>{/if}

  <div class="tools" data-cy="deck-library-tools">
    <label data-cy="deck-library-search-field">
      <span data-cy="deck-library-search-label">Search decks</span>
      <input
        type="search"
        bind:value={search}
        placeholder="Deck name"
        data-cy="deck-library-search-input"
      />
    </label>
    <label data-cy="deck-library-sort-field">
      <span data-cy="deck-library-sort-label">Sort</span>
      <select bind:value={sort} data-cy="deck-library-sort-select">
        <option value="modified" data-cy="deck-library-sort-option-modified"
          >Last modified</option
        >
        <option value="name" data-cy="deck-library-sort-option-name"
          >Name</option
        >
      </select>
    </label>
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
        onclick={() => {
          creating = true;
          void focusDialog();
        }}>Create blank deck</button
      >
    </div>
  {:else if filtered.length === 0}
    <div class="empty" data-cy="deck-library-no-matches">
      <h2 data-cy="deck-library-no-matches-heading">No matching decks</h2>
      <button
        type="button"
        class="secondary"
        data-cy="deck-library-clear-search"
        onclick={() => (search = "")}>Clear search</button
      >
    </div>
  {:else}
    <ul class="deck-list" data-cy="deck-library-list">
      {#each filtered as deck (deck.id)}
        <li data-cy={`deck-library-row-${deck.id}`}>
          <button
            type="button"
            class="deck-open"
            data-cy={`deck-library-open-${deck.id}`}
            onclick={() => onopen(deck.id)}
          >
            <strong data-cy={`deck-library-name-${deck.id}`}>{deck.name}</strong
            >
            <span data-cy={`deck-library-counts-${deck.id}`}
              >Main {deck.main.length} · Extra {deck.extra.length} · Side {deck
                .side.length}</span
            >
            <span
              class:error={deck.validation.status === "errors"}
              data-cy={`deck-library-status-${deck.id}`}
              >{deck.validation.status}</span
            >
            <small data-cy={`deck-library-updated-${deck.id}`}
              >Updated {new Date(deck.updatedAt).toLocaleString()}</small
            >
          </button>
          <div
            class="row-actions"
            data-cy={`deck-library-row-actions-${deck.id}`}
          >
            <button
              type="button"
              class="secondary"
              data-cy={`deck-library-rename-${deck.id}`}
              onclick={() => {
                renaming = deck;
                renameName = deck.name;
                void focusDialog();
              }}>Rename</button
            >
            <button
              type="button"
              class="secondary"
              data-cy={`deck-library-duplicate-${deck.id}`}
              onclick={() => onduplicate(deck.id)}>Duplicate</button
            >
            <button
              type="button"
              class="secondary"
              data-cy={`deck-library-export-${deck.id}`}
              onclick={() => onexport(deck)}>Export</button
            >
            <button
              type="button"
              class="danger"
              data-cy={`deck-library-delete-${deck.id}`}
              onclick={() => {
                deleting = deck;
                void focusDialog();
              }}>Delete</button
            >
          </div>
        </li>
      {/each}
    </ul>
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
    onkeydown={(event) =>
      handleModalKeydown(
        event,
        () => void closeDialog(() => (creating = false)),
      )}
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

{#if renaming}
  <div
    class="dialog"
    role="dialog"
    tabindex="-1"
    aria-modal="true"
    aria-labelledby="rename-heading"
    data-cy="deck-library-rename-dialog"
    onkeydown={(event) =>
      handleModalKeydown(
        event,
        () => void closeDialog(() => (renaming = null)),
      )}
  >
    <h2
      id="rename-heading"
      tabindex="-1"
      data-cy="deck-library-rename-heading"
      bind:this={dialogHeading}
    >
      Rename {renaming.name}
    </h2>
    <form
      aria-busy={dialogBusy}
      data-cy="deck-library-rename-form"
      onsubmit={(event) => {
        event.preventDefault();
        void submitRename();
      }}
    >
      <label data-cy="deck-library-rename-name-field"
        ><span data-cy="deck-library-rename-name-label">Deck name</span><input
          data-cy="deck-library-rename-name-input"
          bind:this={dialogInput}
          bind:value={renameName}
          maxlength={MAXIMUM_DECK_NAME_LENGTH}
        /></label
      >
      {#if renameNameDuplicate}
        <p
          class="name-warning"
          role="status"
          data-cy="deck-library-rename-duplicate-name"
        >
          Another deck already uses this name. IDs remain independent.
        </p>
      {/if}
      <div class="actions" data-cy="deck-library-rename-actions">
        <small data-cy="deck-library-rename-hint"
          >Enter to rename · Esc to cancel</small
        >
        <button
          type="button"
          class="secondary"
          disabled={dialogBusy}
          data-cy="deck-library-rename-cancel"
          onclick={() => void closeDialog(() => (renaming = null))}
          >Cancel</button
        >
        <button
          type="submit"
          disabled={dialogBusy || renameName.trim().length === 0}
          data-cy="deck-library-rename-submit"
          >{dialogBusy ? "Renaming…" : "Rename"}</button
        >
      </div>
    </form>
  </div>
{/if}

{#if deleting}
  <div
    class="dialog"
    role="dialog"
    tabindex="-1"
    aria-modal="true"
    aria-busy={dialogBusy}
    aria-labelledby="delete-heading"
    data-cy="deck-library-delete-dialog"
    onkeydown={(event) =>
      handleModalKeydown(
        event,
        () => void closeDialog(() => (deleting = null)),
      )}
  >
    <h2
      id="delete-heading"
      tabindex="-1"
      data-cy="deck-library-delete-heading"
      bind:this={dialogHeading}
    >
      Delete {deleting.name}?
    </h2>
    <p data-cy="deck-library-delete-message">
      Local deck and retained history will be removed.
    </p>
    <div class="actions" data-cy="deck-library-delete-actions">
      <button
        type="button"
        class="secondary"
        disabled={dialogBusy}
        data-cy="deck-library-delete-cancel"
        onclick={() => void closeDialog(() => (deleting = null))}>Cancel</button
      >
      <button
        type="button"
        class="danger"
        disabled={dialogBusy}
        data-cy="deck-library-delete-confirm"
        onclick={() => void confirmDelete()}
        >{dialogBusy ? "Deleting…" : `Delete ${deleting.name}`}</button
      >
    </div>
  </div>
{/if}

<style>
  .library {
    width: min(78rem, calc(100% - 2rem));
    margin-inline: auto;
    padding-block: 2rem;
  }

  header,
  .tools,
  .actions,
  .row-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  h1,
  h2,
  p {
    margin-top: 0;
  }

  header p,
  header span,
  label span,
  .deck-open span,
  .deck-open small {
    color: var(--muted);
  }

  header p {
    margin-bottom: 0.25rem;
    font-size: 0.78rem;
    font-weight: 750;
  }

  .tools {
    margin-block: 1.5rem 1rem;
  }

  label {
    display: grid;
    gap: 0.3rem;
  }

  input,
  select {
    min-height: 2.5rem;
    padding: 0.5rem 0.65rem;
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: 0.5rem;
    background: var(--surface-chain);
  }

  .deck-list {
    display: grid;
    gap: 0.7rem;
    padding: 0;
    list-style: none;
  }

  .deck-list li {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 0.75rem;
    padding: 0.75rem;
    border: 1px solid var(--border);
    border-radius: 0.65rem;
    background: var(--surface);
  }

  .deck-open {
    display: grid;
    min-width: 0;
    color: var(--text);
    background: transparent;
    text-align: left;
  }

  .deck-open:hover {
    background: var(--surface-raised);
  }

  .deck-open .error {
    color: var(--danger);
  }

  .row-actions button {
    min-height: 2.2rem;
    padding: 0.4rem 0.6rem;
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

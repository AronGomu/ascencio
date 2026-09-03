<script lang="ts">
  import { onMount } from "svelte";
  import { handleModalKeydown } from "../focus-trap.ts";
  import type {
    DeckAutosaveRecord,
    DeckId,
    DeckRecord,
  } from "../../decks/deck-contracts.ts";

  export let decks: readonly DeckRecord[];
  export let autosaves: readonly DeckAutosaveRecord[];
  export let onopendeck: (id: DeckId) => void;
  export let onrestore: (entry: DeckAutosaveRecord) => void;
  export let oncancel: () => void;

  let tab: "decks" | "autosaves" = "decks";
  let dialog: HTMLElement;

  /* The dialog renders after the editor layout, so without this a keyboard user
     would have to tab through the whole catalog to reach it, and Escape would
     do nothing until they got there. */
  onMount(() => dialog.focus());
</script>

<div
  class="dialog ui-dialog-panel ui-chamfer"
  role="dialog"
  aria-modal="true"
  tabindex="-1"
  aria-labelledby="load-deck-dialog-heading"
  data-cy="load-deck-dialog"
  bind:this={dialog}
  onkeydown={(e) => handleModalKeydown(e, oncancel)}
>
  <h2
    id="load-deck-dialog-heading"
    class="ui-dialog-title"
    data-cy="load-dialog-heading"
  >
    Load deck
  </h2>

  <div
    class="tabs"
    role="tablist"
    aria-label="Load deck tabs"
    data-cy="load-dialog-tabs"
  >
    <button
      type="button"
      role="tab"
      class:active={tab === "decks"}
      aria-selected={tab === "decks"}
      data-cy="load-dialog-tab-decks"
      onclick={() => (tab = "decks")}>Your decks</button
    >
    <button
      type="button"
      role="tab"
      class:active={tab === "autosaves"}
      aria-selected={tab === "autosaves"}
      data-cy="load-dialog-tab-autosaves"
      onclick={() => (tab = "autosaves")}>Autosaves</button
    >
  </div>

  {#if tab === "decks"}
    <ul class="list" data-cy="load-dialog-deck-list">
      {#each decks as deck (deck.id)}
        <li data-cy={`load-dialog-deck-item-${deck.id}`}>
          <button
            type="button"
            data-cy={`load-dialog-deck-${deck.id}`}
            onclick={() => onopendeck(deck.id)}
          >
            <strong data-cy={`load-dialog-deck-name-${deck.id}`}
              >{deck.name}</strong
            >
            <span data-cy={`load-dialog-deck-count-${deck.id}`}
              >Main {deck.main.length}</span
            >
          </button>
        </li>
      {/each}
    </ul>
  {:else}
    <ul class="list" data-cy="load-dialog-autosave-list">
      {#each autosaves as entry (entry.id)}
        <li data-cy={`load-dialog-autosave-item-${entry.id}`}>
          <button
            type="button"
            data-cy={`load-dialog-autosave-${entry.id}`}
            onclick={() => onrestore(entry)}
          >
            {new Date(entry.createdAt).toLocaleString()} · {entry.deckName}
          </button>
        </li>
      {:else}
        <li data-cy="load-dialog-autosave-no-items">
          <p data-cy="load-dialog-autosave-empty">No autosaves yet.</p>
        </li>
      {/each}
    </ul>
  {/if}

  <div class="footer" data-cy="load-dialog-footer">
    <button
      type="button"
      class="secondary"
      data-cy="load-dialog-cancel"
      onclick={oncancel}>Cancel</button
    >
  </div>
</div>

<style>
  .dialog {
    position: fixed;
    z-index: 30;
    inset: 50% auto auto 50%;
    width: min(32rem, calc(100vw - 3rem));
    max-height: min(28rem, calc(100vh - 4rem));
    display: flex;
    flex-direction: column;
    padding: 1rem;
    transform: translate(-50%, -50%);
    overflow: hidden;
  }

  h2 {
    margin: 0 0 0.7rem;
    font-size: 1rem;
  }

  .tabs {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }

  .tabs button {
    padding: 0.4rem 0.75rem;
    border: 1px solid var(--border);
    border-radius: 0.5rem;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
  }

  .tabs button.active {
    background: var(--surface-raised);
    color: var(--fg);
    border-color: var(--accent);
  }

  .list {
    flex: 1 1 0;
    overflow-y: auto;
    padding: 0;
    margin: 0 0 0.75rem;
    list-style: none;
    display: grid;
    gap: 0.4rem;
  }

  .list li button {
    width: 100%;
    display: grid;
    text-align: left;
    padding: 0.55rem 0.65rem;
    border: 1px solid var(--border);
    border-radius: 0.5rem;
    background: var(--surface-chain);
    color: var(--fg);
    cursor: pointer;
  }

  .list li button:hover {
    background: var(--surface-raised);
  }

  .list li button span {
    color: var(--muted);
    font-size: 0.8rem;
  }

  .footer {
    display: flex;
    justify-content: flex-end;
  }
</style>

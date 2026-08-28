<script lang="ts">
  import { onMount } from "svelte";
  import { handleModalKeydown } from "./focus-trap.ts";

  export let deckName: string;
  export let oncancel: () => void = () => undefined;
  export let onconfirm: () => void = () => undefined;

  let heading: HTMLHeadingElement;

  /* The heading rather than a button: the caret must not start on the
     destructive choice. */
  onMount(() => heading.focus());
</script>

<div
  class="dialog"
  role="dialog"
  tabindex="-1"
  aria-modal="true"
  aria-labelledby="deck-select-delete-heading"
  data-cy="deck-select-delete-confirm"
  onkeydown={(event) => handleModalKeydown(event, oncancel)}
>
  <h2
    id="deck-select-delete-heading"
    tabindex="-1"
    data-cy="deck-select-delete-heading"
    bind:this={heading}
  >
    Delete deck
  </h2>
  <p data-cy="deck-select-delete-body">
    Delete {deckName}? This cannot be undone.
  </p>
  <div class="actions" data-cy="deck-select-delete-actions">
    <button
      type="button"
      class="secondary"
      data-cy="deck-select-delete-cancel"
      onclick={oncancel}>Cancel</button
    >
    <button
      type="button"
      class="danger"
      data-cy="deck-select-delete-confirm-button"
      onclick={onconfirm}>Delete</button
    >
  </div>
</div>

<style>
  .dialog {
    position: fixed;
    z-index: 30;
    inset: 50% auto auto 50%;
    width: min(22rem, 92vw);
    padding: var(--space-3);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--surface-raised);
    transform: translate(-50%, -50%);
  }

  h2 {
    margin: 0 0 var(--space-2);
    font-size: var(--text-md);
  }

  p {
    margin: 0 0 var(--space-3);
    color: var(--muted);
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
  }

  .danger {
    border-color: var(--danger);
    color: var(--danger);
  }
</style>

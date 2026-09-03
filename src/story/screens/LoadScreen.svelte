<script lang="ts">
  import { tick } from "svelte";
  import { trapTabWithin } from "../overlays/focus-trap.ts";

  export let showCorrupt = false;
  export let onload: (slot: "manual" | "autosave") => void = () => undefined;
  /* Deleting a save is a round trip to IndexedDB now, so the caller may answer
     asynchronously; the slot only reads as empty once the delete confirms. */
  export let ondelete: () => boolean | Promise<boolean> = () => true;
  export let onconfirmchange: (open: boolean) => void = () => undefined;
  export let onback: () => void = () => undefined;
  let confirmingDelete = false;
  let manualDeleted = false;
  let deleteTrigger: HTMLButtonElement;
  let cancelDelete: HTMLButtonElement;
  let deleteDialog: HTMLDivElement;

  async function openDelete(): Promise<void> {
    confirmingDelete = true;
    onconfirmchange(true);
    await tick();
    cancelDelete.focus();
  }
  async function closeDelete(): Promise<void> {
    confirmingDelete = false;
    onconfirmchange(false);
    await tick();
    deleteTrigger.focus();
  }
  async function confirmDelete(): Promise<void> {
    /* The confirmation closes first: leaving it up while the delete is in
       flight would trap focus behind a dialog the player already dismissed. */
    confirmingDelete = false;
    onconfirmchange(false);
    if (await ondelete()) manualDeleted = true;
  }
  function handleDeleteKeydown(event: KeyboardEvent): void {
    if (!confirmingDelete) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopImmediatePropagation();
      void closeDelete();
      return;
    }
    trapTabWithin(deleteDialog, event);
  }
</script>

<svelte:window onkeydown={handleDeleteKeydown} />

<section
  class="screen load-screen"
  aria-labelledby="load-heading"
  inert={confirmingDelete}
  data-cy="story-load-screen"
>
  <header data-cy="story-load-header">
    <p class="eyebrow" data-cy="story-load-eyebrow">Mock local progress</p>
    <h1 id="load-heading" data-cy="story-load-heading">Load</h1>
  </header>
  <div class="slots" data-cy="story-load-slots">
    {#if manualDeleted}
      <article class="empty" data-cy="story-load-slot-manual-deleted">
        <h2 data-cy="story-load-slot-manual-deleted-heading">
          Manual slot 1 · Empty
        </h2>
        <p data-cy="story-load-slot-manual-deleted-message">
          Save deleted for this review session.
        </p>
        <button type="button" disabled data-cy="story-load-slot-manual-disabled"
          >Load manual slot 1</button
        >
      </article>
    {:else}
      <article data-cy="story-load-slot-manual">
        <div
          class="slot-preview"
          role="img"
          aria-label="Old Arena save preview"
          data-cy="story-load-slot-manual-preview"
        >
          Old Arena preview
        </div>
        <h2 data-cy="story-load-slot-manual-heading">Manual slot 1</h2>
        <p data-cy="story-load-slot-manual-location">Chapter 1 · Old Arena</p>
        <p data-cy="story-load-slot-manual-playtime">
          Playtime 00:18:42 · Yesterday, 21:14
        </p>
        <div class="actions" data-cy="story-load-slot-manual-actions">
          <button
            type="button"
            data-cy="story-load-slot-manual-load"
            onclick={() => onload("manual")}>Load manual slot 1</button
          ><button
            type="button"
            class="secondary"
            data-cy="story-load-slot-manual-delete"
            bind:this={deleteTrigger}
            onclick={() => void openDelete()}>Delete manual slot 1</button
          >
        </div>
      </article>
    {/if}
    <article data-cy="story-load-slot-autosave">
      <div
        class="slot-preview"
        role="img"
        aria-label="Concourse autosave preview"
        data-cy="story-load-slot-autosave-preview"
      >
        Concourse preview
      </div>
      <h2 data-cy="story-load-slot-autosave-heading">Autosave</h2>
      <p data-cy="story-load-slot-autosave-location">Chapter 1 · City Map</p>
      <p data-cy="story-load-slot-autosave-playtime">
        Playtime 00:21:08 · Today, 00:04
      </p>
      <button
        type="button"
        data-cy="story-load-slot-autosave-load"
        onclick={() => onload("autosave")}>Load autosave</button
      >
    </article>
    <article class="empty" data-cy="story-load-slot-empty">
      <h2 data-cy="story-load-slot-empty-heading">Empty slot</h2>
      <p data-cy="story-load-slot-empty-message">No manual save yet.</p>
      <button type="button" disabled data-cy="story-load-slot-empty-load"
        >Load empty slot</button
      >
    </article>
    {#if showCorrupt}<article class="error" data-cy="story-load-slot-corrupt">
        <h2 data-cy="story-load-slot-corrupt-heading">Reviewer example</h2>
        <p data-cy="story-load-slot-corrupt-message">
          Save is incompatible or corrupt. Reset this mock slot.
        </p>
        <button
          type="button"
          class="secondary"
          data-cy="story-load-slot-corrupt-reset">Reset corrupt example</button
        >
      </article>{/if}
  </div>
  <button
    type="button"
    class="story-danger"
    data-cy="story-load-back"
    onclick={onback}>Back</button
  >
</section>

{#if confirmingDelete}
  <div class="dialog-backdrop" data-cy="story-load-delete-backdrop">
    <div
      role="alertdialog"
      aria-labelledby="delete-heading"
      class="dialog"
      tabindex="-1"
      data-cy="story-load-delete-dialog"
      bind:this={deleteDialog}
    >
      <h2 id="delete-heading" data-cy="story-load-delete-heading">
        Delete save?
      </h2>
      <p data-cy="story-load-delete-message">
        This mock manual slot will become empty.
      </p>
      <div class="actions" data-cy="story-load-delete-actions">
        <button
          type="button"
          class="danger"
          data-cy="story-load-delete-confirm"
          onclick={() => void confirmDelete()}>Delete save</button
        ><button
          type="button"
          class="secondary"
          data-cy="story-load-delete-cancel"
          bind:this={cancelDelete}
          onclick={() => void closeDelete()}>Cancel delete</button
        >
      </div>
    </div>
  </div>
{/if}

<style>
  .load-screen {
    width: 100%;
    height: 100%;
    min-height: 0;
    overflow: auto;
    padding: clamp(1rem, 4cqw, 3rem);
  }
  .slots {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(16rem, 100%), 1fr));
    gap: 1rem;
    margin-block: 1rem;
  }
  article {
    padding: 1rem;
    border: 1px solid var(--story-border);
    border-radius: 0.75rem;
    background: var(--story-panel);
  }
  .slot-preview {
    min-height: 6rem;
    display: grid;
    place-items: center;
    border-radius: 0.4rem;
    background: linear-gradient(
      135deg,
      var(--field-glow),
      var(--surface-chain)
    );
    color: var(--story-muted);
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .empty {
    opacity: 0.8;
  }
  .error {
    border-color: var(--danger);
  }
  .dialog-backdrop {
    position: fixed;
    inset: 0;
    z-index: 20;
    display: grid;
    place-items: center;
    padding: 1rem;
    background: color-mix(in srgb, var(--shadow) 73%, transparent);
  }
  .dialog {
    width: min(30rem, 100%);
    padding: 1.5rem;
    border: 1px solid var(--story-border);
    border-radius: 0.75rem;
    background: var(--story-panel);
  }
  .danger {
    background: var(--danger-strong);
    border-color: var(--danger);
    color: var(--ink);
  }
</style>

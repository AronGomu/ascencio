<script lang="ts">
  import { tick } from "svelte";
  import OverlayShell from "./OverlayShell.svelte";
  import { trapTabWithin } from "./focus-trap.ts";
  export let unsaved = false;
  export let onaction: (
    action: "resume" | "save" | "load" | "settings" | "title",
  ) => void = () => undefined;
  export let onclose: () => void = () => undefined;
  export let restoreFocusTo: HTMLElement | null = null;
  let confirmTitle = false;
  let stayButton: HTMLButtonElement;
  let confirmationDialog: HTMLDivElement;
  async function requestTitle(): Promise<void> {
    if (!unsaved) onaction("title");
    else {
      confirmTitle = true;
      await tick();
      stayButton.focus();
    }
  }
  function handleConfirmationKeydown(event: KeyboardEvent): void {
    if (!confirmTitle) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopImmediatePropagation();
      confirmTitle = false;
      return;
    }
    trapTabWithin(confirmationDialog, event);
  }
</script>

<svelte:window onkeydown={handleConfirmationKeydown} />

<OverlayShell
  title="Paused"
  labelId="pause-title"
  {onclose}
  {restoreFocusTo}
  controlsSuspended={confirmTitle}
>
  <nav
    aria-label="Pause actions"
    inert={confirmTitle}
    data-cy="story-pause-menu"
  >
    <button
      type="button"
      data-cy="story-pause-resume"
      onclick={() => onaction("resume")}>Resume</button
    >
    <button
      type="button"
      class="secondary"
      data-cy="story-pause-save"
      onclick={() => onaction("save")}>Save</button
    >
    <button
      type="button"
      class="secondary"
      data-cy="story-pause-load"
      onclick={() => onaction("load")}>Load</button
    >
    <button
      type="button"
      class="secondary"
      data-cy="story-pause-settings"
      onclick={() => onaction("settings")}>Settings</button
    >
    <button
      type="button"
      class="secondary"
      data-cy="story-pause-return-title"
      onclick={() => void requestTitle()}>Return to Title</button
    >
  </nav>
  {#if confirmTitle}<div
      class="nested"
      role="alertdialog"
      aria-labelledby="return-title"
      tabindex="-1"
      data-cy="story-pause-return-confirm"
      bind:this={confirmationDialog}
    >
      <h3 id="return-title" data-cy="story-pause-return-confirm-heading">
        Return without saving?
      </h3>
      <p data-cy="story-pause-return-confirm-message">
        Progress since last mock save will be lost.
      </p>
      <button
        type="button"
        data-cy="story-pause-return-confirm-accept"
        onclick={() => onaction("title")}>Return without saving</button
      ><button
        type="button"
        class="secondary"
        data-cy="story-pause-return-confirm-stay"
        bind:this={stayButton}
        onclick={() => (confirmTitle = false)}>Stay in story</button
      >
    </div>{/if}
</OverlayShell>

<style>
  nav {
    display: grid;
    gap: 0.6rem;
  }
  .nested {
    margin-top: 1rem;
    padding: 1rem;
    border: 1px solid var(--danger);
    border-radius: 0.5rem;
    background: var(--danger-surface);
  }
  .nested button {
    margin: 0.25rem;
  }
</style>

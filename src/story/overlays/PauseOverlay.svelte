<script lang="ts">
  import { tick } from "svelte";
  import OverlayShell from "./OverlayShell.svelte";
  import { trapTabWithin } from "./focus-trap.ts";
  export let unsaved = false;
  export let onaction: (
    action: "resume" | "save" | "load" | "settings" | "main-menu",
  ) => void = () => undefined;
  export let onclose: () => void = () => undefined;
  export let restoreFocusTo: HTMLElement | null = null;
  let confirmMainMenu = false;
  let stayButton: HTMLButtonElement;
  let confirmationDialog: HTMLDivElement;
  async function requestMainMenu(): Promise<void> {
    if (!unsaved) onaction("main-menu");
    else {
      confirmMainMenu = true;
      await tick();
      stayButton.focus();
    }
  }
  function handleConfirmationKeydown(event: KeyboardEvent): void {
    if (!confirmMainMenu) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopImmediatePropagation();
      confirmMainMenu = false;
      return;
    }
    trapTabWithin(confirmationDialog, event);
  }
</script>

<svelte:window onkeydown={handleConfirmationKeydown} />

<OverlayShell
  title="Menu"
  labelId="pause-title"
  {onclose}
  {restoreFocusTo}
  controlsSuspended={confirmMainMenu}
>
  <nav
    aria-label="Pause actions"
    inert={confirmMainMenu}
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
      data-cy="story-pause-return-main-menu"
      onclick={() => void requestMainMenu()}>Return to Main Menu</button
    >
  </nav>
  {#if confirmMainMenu}<div
      class="nested"
      role="alertdialog"
      aria-labelledby="return-main-menu"
      tabindex="-1"
      data-cy="story-pause-return-confirm"
      bind:this={confirmationDialog}
    >
      <h3 id="return-main-menu" data-cy="story-pause-return-confirm-heading">
        Return to Main Menu without saving?
      </h3>
      <p data-cy="story-pause-return-confirm-message">
        Progress since last mock save will be lost.
      </p>
      <button
        type="button"
        data-cy="story-pause-return-confirm-accept"
        onclick={() => onaction("main-menu")}>Return without saving</button
      ><button
        type="button"
        class="secondary"
        data-cy="story-pause-return-confirm-stay"
        bind:this={stayButton}
        onclick={() => (confirmMainMenu = false)}>Stay in story</button
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

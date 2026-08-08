<script lang="ts">
  import { onMount } from "svelte";

  export let surrenderAvailable = false;
  export let responsePending = false;
  export let onopensettings: () => void;
  export let onsurrender: () => void;
  export let onclose: () => void;

  let panel: HTMLDivElement | undefined;
  let confirming = false;

  onMount(() => {
    panel?.querySelector("button")?.focus();
  });

  function handleBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) onclose();
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      event.preventDefault();
      onclose();
    }
  }

  function beginSurrenderConfirmation(): void {
    confirming = true;
  }

  function cancelSurrenderConfirmation(): void {
    confirming = false;
  }

  function confirmSurrender(): void {
    onsurrender();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events (Escape is handled globally via svelte:window) -->
<!-- svelte-ignore a11y_no_static_element_interactions (backdrop only dismisses; the dialog panel holds all interactive content) -->
<div
  class="dialog-backdrop"
  data-cy="menu-dialog-backdrop"
  onclick={handleBackdropClick}
>
  <div
    class="dialog-panel"
    role="dialog"
    aria-modal="true"
    aria-labelledby="menu-dialog-heading"
    data-cy="menu-dialog"
    bind:this={panel}
  >
    <h2 id="menu-dialog-heading" data-cy="menu-dialog-heading">Menu</h2>
    {#if confirming}
      <div role="alert" data-cy="menu-dialog-surrender-warning">
        This immediately awards the duel to your opponent.
      </div>
      <button
        type="button"
        class="danger"
        disabled={responsePending}
        data-cy="menu-dialog-surrender-confirm-button"
        onclick={confirmSurrender}>Confirm surrender</button
      >
      <button
        type="button"
        class="secondary"
        data-cy="menu-dialog-surrender-cancel-button"
        onclick={cancelSurrenderConfirmation}>Keep playing</button
      >
    {:else}
      <button
        type="button"
        class="neutral"
        data-cy="menu-dialog-settings-button"
        onclick={onopensettings}>Settings</button
      >
      {#if surrenderAvailable}
        <button
          type="button"
          class="danger"
          data-cy="menu-dialog-surrender-button"
          onclick={beginSurrenderConfirmation}>Surrender</button
        >
      {/if}
      <button
        type="button"
        class="secondary"
        data-cy="menu-dialog-close-button"
        onclick={onclose}>Close</button
      >
    {/if}
  </div>
</div>

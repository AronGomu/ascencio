<script lang="ts">
  import { onMount } from "svelte";

  export let surrenderAvailable = false;
  export let responsePending = false;
  export let onopensettings: () => void;
  /* Reports whether the surrender actually started. A refusal (no active duel,
     worker closed, disposal in flight) changes nothing, so the dialog has to
     stay up and say so rather than dismiss on an action that never happened. */
  export let onsurrender: () => boolean;
  export let onclose: () => void;

  let panel: HTMLDivElement | undefined;
  let confirming = false;
  let surrenderFailed = false;

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
    surrenderFailed = false;
  }

  function cancelSurrenderConfirmation(): void {
    confirming = false;
    surrenderFailed = false;
  }

  function confirmSurrender(): void {
    if (!onsurrender()) {
      surrenderFailed = true;
      return;
    }
    surrenderFailed = false;
    onclose();
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
      {#if surrenderFailed}
        <div role="alert" data-cy="menu-dialog-surrender-error">
          The duel could not be surrendered. Nothing has changed — try again in
          a moment.
        </div>
      {/if}
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

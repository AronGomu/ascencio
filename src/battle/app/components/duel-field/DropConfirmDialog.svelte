<script lang="ts">
  import { onMount } from "svelte";
  import type {
    BoardCardView,
    BoardZoneView,
  } from "../../../field/board-view-model.ts";
  import { cardActionLabel } from "../../presentation/card-action-label.ts";
  import type { InteractionChoice } from "../../prompts/interaction-spec.ts";

  /* Item 6: a drop names a zone, not an action, so a zone that can host two of
     the card's offers has to ask. Centred rather than anchored on the zone: the
     question is about the card, and the answer commits a play that cannot be
     taken back. */
  export let card: BoardCardView;
  export let zone: BoardZoneView;
  export let choices: readonly InteractionChoice[];
  export let disabled = false;
  export let onconfirm: (choice: InteractionChoice) => void;
  export let oncancel: () => void;

  let panel: HTMLDivElement | undefined;

  onMount(() => {
    panel?.querySelector("button")?.focus({ preventScroll: true });
  });

  function handleBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) oncancel();
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key !== "Escape") return;
    event.preventDefault();
    oncancel();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events (Escape is handled globally via svelte:window) -->
<!-- svelte-ignore a11y_no_static_element_interactions (backdrop only cancels; the panel holds all interactive content) -->
<div
  class="dialog-backdrop drop-confirm-backdrop"
  data-cy="drop-confirm-backdrop"
  onclick={handleBackdropClick}
>
  <div
    class="dialog-panel drop-confirm-dialog"
    role="dialog"
    aria-modal="true"
    aria-labelledby="drop-confirm-heading"
    data-cy="drop-confirm-dialog"
    bind:this={panel}
  >
    <h2 id="drop-confirm-heading" data-cy="drop-confirm-heading">
      {card.label}
    </h2>
    <p class="drop-confirm-dialog__zone" data-cy="drop-confirm-zone">
      {zone.label}
    </p>
    {#each choices as choice (choice.id)}
      <button
        type="button"
        title={choice.label}
        aria-label={choice.label}
        {disabled}
        onclick={() => onconfirm(choice)}
        data-cy={`drop-confirm-action-${choice.id}`}
        >{cardActionLabel(choice.action)}</button
      >
    {/each}
    <button
      type="button"
      class="danger"
      onclick={() => oncancel()}
      data-cy="drop-confirm-cancel">Cancel</button
    >
  </div>
</div>

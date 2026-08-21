<script lang="ts">
  import { onMount } from "svelte";
  import { trapTabWithin } from "../overlays/focus-trap.ts";
  import type { SaleDeckImpact } from "./sell-impact.ts";

  /* The last thing between the player and a deck they can no longer field.
     It informs rather than refuses — selling stays unrestricted — so both ways
     out are offered, and the one that keeps the cards is the one focus lands
     on. Modelled on the delete confirmation in `screens/LoadScreen.svelte`:
     an alert dialog over an inert screen, Escape cancels, Tab stays inside. */

  export let decks: readonly SaleDeckImpact[] = [];
  /** Names a sold card. Every sold code is an owned code, so the sell screen
      can already name it and this dialog never touches the catalog. */
  export let cardNameOf: (code: number) => string = (code) => `Card ${code}`;
  export let onconfirm: () => void = () => undefined;
  export let oncancel: () => void = () => undefined;

  let dialog: HTMLDivElement;
  let cancelButton: HTMLButtonElement;

  onMount(() => cancelButton.focus());

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      event.preventDefault();
      /* The sell screen is inert behind this, but the window is not: nothing
         else may read the key that dismissed the dialog. */
      event.stopImmediatePropagation();
      oncancel();
      return;
    }
    trapTabWithin(dialog, event);
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="dialog-backdrop" data-cy="story-sell-impact-backdrop">
  <div
    role="alertdialog"
    aria-labelledby="sell-impact-heading"
    aria-describedby="sell-impact-message"
    class="dialog"
    tabindex="-1"
    data-cy="story-sell-impact-dialog"
    bind:this={dialog}
  >
    <h2 id="sell-impact-heading" data-cy="story-sell-impact-heading">
      Sell cards these decks use?
    </h2>
    <p id="sell-impact-message" data-cy="story-sell-impact-message">
      Selling cannot be undone. These decks would be left using cards you no
      longer own, and cannot be duelled with until you rebuild them.
    </p>
    <ul class="deck-list" data-cy="story-sell-impact-decks">
      {#each decks as deck (deck.deckId)}
        <li data-cy={`story-sell-impact-deck-${deck.deckId}`}>
          <span
            class="deck-name"
            data-cy={`story-sell-impact-deck-name-${deck.deckId}`}
            >{deck.deckName}</span
          >
          <span
            class="deck-cards"
            data-cy={`story-sell-impact-deck-cards-${deck.deckId}`}
            >{deck.codes.map(cardNameOf).join(", ")}</span
          >
        </li>
      {/each}
    </ul>
    <div class="actions" data-cy="story-sell-impact-actions">
      <button
        type="button"
        class="secondary"
        data-cy="story-sell-impact-confirm"
        onclick={onconfirm}>Sell anyway</button
      ><button
        type="button"
        class="danger"
        data-cy="story-sell-impact-cancel"
        bind:this={cancelButton}
        onclick={oncancel}>Keep the cards</button
      >
    </div>
  </div>
</div>

<style>
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
    max-height: min(40rem, calc(100svh - 2rem));
    overflow: auto;
    padding: 1.5rem;
    border: 1px solid var(--story-border);
    border-radius: 0.75rem;
    background: var(--story-panel);
  }
  .deck-list {
    list-style: none;
    margin: 0 0 1.25rem;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .deck-list li {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    padding: 0.5rem 0;
    border-bottom: 1px solid var(--story-border);
  }
  .deck-name {
    font-weight: 600;
  }
  .deck-cards {
    font-size: 0.85rem;
    color: var(--story-muted);
  }
  .danger {
    background: var(--danger-strong);
    border-color: var(--danger);
    color: var(--ink);
  }
</style>

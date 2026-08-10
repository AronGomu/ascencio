<script lang="ts">
  import type {
    DeckId,
    DeckMetadata,
  } from "../../duel/presets/deck-catalog.ts";

  export let decks: readonly DeckMetadata[];
  export let playerDeckId: DeckId;
  export let opponentDeckId: DeckId;
  export let disabled = false;
  export let onselect: (player: DeckId, opponent: DeckId) => void = () =>
    undefined;
  export let onstart: () => void = () => undefined;
</script>

<section aria-labelledby="deck-picker-heading" data-cy="deck-picker">
  <h1 id="deck-picker-heading" data-cy="deck-picker-heading">Choose decks</h1>
  <div class="deck-picker-columns" data-cy="deck-picker-columns">
    <div data-cy="deck-picker-column-player">
      <h2 data-cy="deck-picker-player-heading">Your deck</h2>
      {#each decks as deck (deck.id)}
        <button
          type="button"
          {disabled}
          aria-pressed={playerDeckId === deck.id}
          data-cy={`deck-picker-option-player-${deck.id}`}
          onclick={() => onselect(deck.id, opponentDeckId)}>{deck.name}</button
        >
      {/each}
    </div>
    <div data-cy="deck-picker-column-opponent">
      <h2 data-cy="deck-picker-opponent-heading">Opponent deck</h2>
      {#each decks as deck (deck.id)}
        <button
          type="button"
          {disabled}
          aria-pressed={opponentDeckId === deck.id}
          data-cy={`deck-picker-option-opponent-${deck.id}`}
          onclick={() => onselect(playerDeckId, deck.id)}>{deck.name}</button
        >
      {/each}
    </div>
  </div>
  <button
    type="button"
    {disabled}
    data-cy="deck-picker-start-button"
    onclick={onstart}>Start</button
  >
</section>

<style>
  section {
    display: grid;
    gap: 1rem;
    width: min(48rem, 100%);
    margin: 1.5rem auto;
  }

  h1,
  h2 {
    margin: 0;
  }

  .deck-picker-columns {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1rem;
  }

  .deck-picker-columns > div {
    display: grid;
    gap: 0.5rem;
    align-content: start;
  }

  [aria-pressed="true"] {
    border-color: currentColor;
    box-shadow: inset 0 0 0 2px currentColor;
  }

  @media (max-width: 40rem) {
    .deck-picker-columns {
      grid-template-columns: 1fr;
    }
  }
</style>

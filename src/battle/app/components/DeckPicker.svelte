<script lang="ts">
  import type { SelectableDeck } from "../../decks/selectable-decks.ts";

  export let decks: readonly SelectableDeck[] = [];
  export let playerKey = "";
  export let opponentKey = "";
  export let disabled = false;
  /* Set once by the host when a persisted key no longer resolves, so the
     player is told their deck went away rather than left wondering why a
     different pair is selected. */
  export let fallbackNotice = false;
  export let startError: string | null = null;
  export let onselect: (playerKey: string, opponentKey: string) => void = () =>
    undefined;
  export let onstart: () => void = () => undefined;

  /* The host has already dropped every deck this build cannot play, so the
     local group is either legal rows or nothing at all: there is no disabled
     row here to explain, and no way to choose a deck the duel would refuse. */
  $: presetDecks = decks.filter((deck) => deck.source === "preset");
  $: localDecks = decks.filter((deck) => deck.source === "local");
</script>

<section aria-labelledby="deck-picker-heading" data-cy="deck-picker">
  <h1 id="deck-picker-heading" data-cy="deck-picker-heading">Choose decks</h1>

  {#if fallbackNotice}
    <p class="notice" role="status" data-cy="deck-picker-fallback-notice">
      A deck you had chosen is no longer available, so the bundled pair is
      selected again.
    </p>
  {/if}

  {#if startError !== null}
    <p class="notice error" role="alert" data-cy="deck-picker-start-error">
      {startError}
    </p>
  {/if}

  <section
    aria-labelledby="deck-picker-preset-label"
    data-cy="deck-picker-group-preset"
  >
    <h2
      class="group-label"
      id="deck-picker-preset-label"
      data-cy="deck-picker-preset-label"
    >
      Bundled decks
    </h2>
    <div class="deck-picker-columns" data-cy="deck-picker-columns">
      <div data-cy="deck-picker-column-player">
        <h3 data-cy="deck-picker-player-heading">Your deck</h3>
        {#each presetDecks as deck (deck.key)}
          <button
            type="button"
            {disabled}
            aria-pressed={playerKey === deck.key}
            data-cy={`deck-picker-option-player-${deck.key}`}
            onclick={() => onselect(deck.key, opponentKey)}>{deck.label}</button
          >
        {/each}
      </div>
      <div data-cy="deck-picker-column-opponent">
        <h3 data-cy="deck-picker-opponent-heading">Opponent deck</h3>
        {#each presetDecks as deck (deck.key)}
          <button
            type="button"
            {disabled}
            aria-pressed={opponentKey === deck.key}
            data-cy={`deck-picker-option-opponent-${deck.key}`}
            onclick={() => onselect(playerKey, deck.key)}>{deck.label}</button
          >
        {/each}
      </div>
    </div>
  </section>

  <!-- No local deck qualifies is the ordinary state on a fresh install, so it
       renders as the absence of a group rather than an empty heading. -->
  {#if localDecks.length > 0}
    <section
      aria-labelledby="deck-picker-local-label"
      data-cy="deck-picker-group-local"
    >
      <h2
        class="group-label"
        id="deck-picker-local-label"
        data-cy="deck-picker-local-label"
      >
        Your decks
      </h2>
      <div class="deck-picker-columns" data-cy="deck-picker-local-columns">
        <div data-cy="deck-picker-local-column-player">
          <h3 data-cy="deck-picker-local-player-heading">Your deck</h3>
          {#each localDecks as deck (deck.key)}
            <button
              type="button"
              {disabled}
              aria-pressed={playerKey === deck.key}
              data-cy={`deck-picker-option-player-${deck.key}`}
              onclick={() => onselect(deck.key, opponentKey)}
              >{deck.label}</button
            >
          {/each}
        </div>
        <div data-cy="deck-picker-local-column-opponent">
          <h3 data-cy="deck-picker-local-opponent-heading">Opponent deck</h3>
          {#each localDecks as deck (deck.key)}
            <button
              type="button"
              {disabled}
              aria-pressed={opponentKey === deck.key}
              data-cy={`deck-picker-option-opponent-${deck.key}`}
              onclick={() => onselect(playerKey, deck.key)}>{deck.label}</button
            >
          {/each}
        </div>
      </div>
    </section>
  {/if}

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

  section section {
    width: auto;
    margin: 0;
    gap: var(--space-2);
  }

  h1,
  h2,
  h3 {
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

  .group-label {
    color: var(--muted);
    font-size: var(--text-xs);
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  .notice {
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--surface-raised);
    color: var(--muted);
  }

  .notice.error {
    border-color: var(--danger-border);
    background: var(--danger-surface);
    color: var(--danger);
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

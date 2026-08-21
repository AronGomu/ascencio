<script lang="ts">
  import type { SelectableDeck } from "../../battle/index.ts";

  /* One seat of a free-play match. Rendered twice, so every `data-cy` it emits
     carries the seat: the contract wants one variable name per element, and two
     copies of `free-play-match-picker` in one document would be neither. */
  export let seat: "player" | "opponent";
  export let label: string;
  export let decks: readonly SelectableDeck[] = [];
  export let value = "";
  export let disabled = false;
  export let onselect: (key: string) => void = () => undefined;

  $: presetDecks = decks.filter((deck) => deck.source === "preset");
  /* No local deck qualifies is the ordinary state before a player has built
     one, so it renders as the absence of a group rather than an empty heading.
     The host has already dropped every deck this build cannot play, so there is
     no disabled row here to explain. */
  $: localDecks = decks.filter((deck) => deck.source === "local");
</script>

<div class="seat" data-cy={`free-play-match-${seat}-seat`}>
  <label
    for={`free-play-match-${seat}-select`}
    data-cy={`free-play-match-${seat}-label`}>{label}</label
  >
  <select
    id={`free-play-match-${seat}-select`}
    {disabled}
    {value}
    data-cy={`free-play-match-${seat}-picker`}
    onchange={(event) => onselect(event.currentTarget.value)}
  >
    {#if presetDecks.length > 0}
      <optgroup
        label="Bundled decks"
        data-cy={`free-play-match-${seat}-presets`}
      >
        {#each presetDecks as deck (deck.key)}
          <option
            value={deck.key}
            data-cy={`free-play-match-${seat}-option-${deck.key}`}
            >{deck.label}</option
          >
        {/each}
      </optgroup>
    {/if}
    {#if localDecks.length > 0}
      <optgroup label="Your decks" data-cy={`free-play-match-${seat}-locals`}>
        {#each localDecks as deck (deck.key)}
          <option
            value={deck.key}
            data-cy={`free-play-match-${seat}-option-${deck.key}`}
            >{deck.label}</option
          >
        {/each}
      </optgroup>
    {/if}
  </select>
</div>

<style>
  .seat {
    display: grid;
    gap: var(--space-1);
  }

  select {
    width: 100%;
    padding: var(--space-2);
  }
</style>

<script lang="ts">
  import StoryCardTile from "../components/StoryCardTile.svelte";
  import type { ShopRarity } from "../model/story-state.ts";

  export let cards: readonly {
    code: number;
    name: string;
    imageUrl: string | null;
    rarity: ShopRarity;
  }[] = [];
  export let oncontinue: () => void = () => undefined;
</script>

<main class="results-screen" data-cy="story-shop-results">
  <h1 data-cy="story-shop-results-heading">You opened {cards.length} cards</h1>
  <div class="results-grid" data-cy="story-shop-results-grid">
    {#each cards as card, index (index)}
      <div
        class="result-tile rarity-halo"
        data-cy={`story-shop-result-${card.code}-${index}`}
        data-rarity={card.rarity}
      >
        <StoryCardTile
          name={card.name}
          imageUrl={card.imageUrl}
          dataCyPrefix="story-shop-result"
          dataCyId={`${card.code}-${index}`}
        />
        <span
          class="result-name"
          data-cy={`story-shop-result-name-${card.code}-${index}`}
          >{card.name}</span
        >
      </div>
    {/each}
  </div>
  <div class="results-actions" data-cy="story-shop-results-actions">
    <button
      type="button"
      data-cy="story-shop-results-continue"
      onclick={oncontinue}>Continue</button
    >
  </div>
</main>

<style>
  .results-screen {
    min-height: 100svh;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding: clamp(1rem, 4vw, 2rem);
    background:
      radial-gradient(circle at 50% 10%, var(--field-glow), transparent 40%),
      var(--bg);
  }
  h1 {
    margin: 0;
    font-size: clamp(1.25rem, 4vw, 2rem);
  }
  .results-grid {
    flex: 1;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(7rem, 1fr));
    gap: 0.75rem;
    align-content: start;
  }
  @keyframes card-enter {
    from {
      opacity: 0;
      transform: translateY(0.75rem);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  @media (prefers-reduced-motion: no-preference) {
    .results-grid {
      animation: card-enter 0.4s ease-out;
    }
  }
  .result-tile {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding: 0.5rem;
    border: 1px solid var(--story-border);
    border-radius: 0.5rem;
    background: color-mix(in srgb, var(--bg) 85%, transparent);
  }
  .result-name {
    font-size: 0.65rem;
    font-weight: 600;
    line-height: 1.2;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .results-actions {
    display: flex;
    justify-content: center;
    padding: 1rem 0;
  }
</style>

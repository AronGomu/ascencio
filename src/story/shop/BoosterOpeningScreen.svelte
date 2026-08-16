<script lang="ts">
  import { PACK_SIZE } from "./data/shop-pricing.ts";
  import type { ShopRarity } from "../model/story-state.ts";

  export let cards: readonly {
    readonly code: number;
    readonly name: string;
    readonly imageUrl: string | null;
    readonly rarity: ShopRarity;
  }[] = [];
  export let onfinish: () => void = () => undefined;

  let revealed = 0;
  $: packCount = Math.ceil(cards.length / PACK_SIZE);
  $: currentPack = Math.min(Math.floor(revealed / PACK_SIZE) + 1, packCount);

  function advance(): void {
    if (revealed < cards.length) revealed += 1;
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      advance();
    }
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<main
  class="opening-screen"
  data-cy="story-shop-opening"
  onclick={advance}
  onkeydown={handleKeydown}
  tabindex="0"
>
  <p class="progress" data-cy="story-shop-opening-progress">
    Pack {currentPack} of {packCount}
  </p>

  {#if revealed < cards.length}
    <div class="opening-stack" data-cy="story-shop-opening-stack">
      <div
        class="face-down"
        aria-hidden="true"
        data-cy="story-shop-opening-facedown"
      ></div>
    </div>
  {/if}

  <div class="revealed-grid" data-cy="story-shop-opening-grid">
    {#each cards.slice(0, revealed) as card, index (index)}
      <div
        class="opening-tile rarity-halo reveal"
        data-cy={`story-shop-opening-card-${index}`}
        data-rarity={card.rarity}
      >
        {#if card.imageUrl !== null}
          <img
            src={card.imageUrl}
            alt={card.name}
            class="opening-art"
            data-cy={`story-shop-opening-art-${index}`}
          />
        {:else}
          <div
            class="opening-placeholder"
            aria-hidden="true"
            data-cy={`story-shop-opening-placeholder-${index}`}
          ></div>
        {/if}
        <span class="opening-name" data-cy={`story-shop-opening-name-${index}`}
          >{card.name}</span
        >
      </div>
    {/each}
  </div>

  {#if revealed >= cards.length && cards.length > 0}
    <div class="opening-actions" data-cy="story-shop-opening-actions">
      <button
        type="button"
        data-cy="story-shop-opening-finish"
        onclick={(e) => {
          e.stopPropagation();
          onfinish();
        }}
      >
        See results
      </button>
    </div>
  {/if}

  <button
    type="button"
    class="secondary skip-btn"
    data-cy="story-shop-opening-skip"
    onclick={(e) => {
      e.stopPropagation();
      onfinish();
    }}
  >
    Skip
  </button>
</main>

<style>
  .opening-screen {
    min-height: 100svh;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: clamp(1rem, 4vw, 2rem);
    background:
      radial-gradient(circle at 50% 10%, var(--field-glow), transparent 40%),
      var(--bg);
    cursor: pointer;
    user-select: none;
  }
  .progress {
    font-size: 1.1rem;
    font-weight: 700;
    margin: 0;
  }
  .opening-stack {
    display: flex;
    justify-content: center;
    padding: 1rem 0;
  }
  .face-down {
    width: 7rem;
    aspect-ratio: 421 / 614;
    border-radius: 0.5rem;
    background: color-mix(in srgb, var(--muted) 30%, transparent);
    border: 2px solid var(--story-border);
  }
  .revealed-grid {
    flex: 1;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(6rem, 1fr));
    gap: 0.5rem;
    align-content: start;
  }
  .opening-tile {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    padding: 0.4rem;
    border: 1px solid var(--story-border);
    border-radius: 0.5rem;
    background: color-mix(in srgb, var(--bg) 85%, transparent);
  }
  .opening-art {
    width: 100%;
    aspect-ratio: 421 / 614;
    object-fit: cover;
    border-radius: 0.25rem;
  }
  .opening-placeholder {
    width: 100%;
    aspect-ratio: 421 / 614;
    border-radius: 0.25rem;
    background: color-mix(in srgb, var(--muted) 20%, transparent);
  }
  .opening-name {
    font-size: 0.6rem;
    font-weight: 600;
    line-height: 1.2;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .opening-actions {
    display: flex;
    justify-content: center;
    padding: 1rem 0;
  }
  .skip-btn {
    align-self: flex-end;
  }
  @media (prefers-reduced-motion: no-preference) {
    .reveal {
      animation: card-flip 260ms ease;
    }
    @keyframes card-flip {
      from {
        transform: rotateY(90deg) translateY(0.5rem);
        opacity: 0;
      }
    }
  }
</style>

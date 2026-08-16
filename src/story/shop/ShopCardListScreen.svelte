<script lang="ts">
  import type { ShopRarity } from "../model/story-state.ts";

  export let setName = "";
  export let dp = 0;
  export let cards: readonly {
    code: number;
    name: string;
    imageUrl: string | null;
    rarity: ShopRarity;
    priceDp: number;
  }[] = [];
  export let onbuysingle: (code: number, rarity: ShopRarity) => void = () =>
    undefined;
  export let onback: () => void = () => undefined;

  let previewCode: number | null = cards[0]?.code ?? null;

  $: previewCard =
    previewCode !== null
      ? (cards.find((c) => c.code === previewCode) ?? cards[0] ?? null)
      : (cards[0] ?? null);
</script>

<div class="shop-cards" data-cy="story-shop-cards">
  <header class="cards-header" data-cy="story-shop-cards-header">
    <button
      type="button"
      class="secondary"
      data-cy="story-shop-cards-back"
      onclick={onback}>← Back</button
    >
    <h1 data-cy="story-shop-cards-heading">{setName}</h1>
  </header>

  <div class="cards-layout" data-cy="story-shop-cards-layout">
    <aside class="cards-preview" data-cy="story-shop-cards-preview">
      {#if previewCard !== null}
        {#if previewCard.imageUrl !== null}
          <img
            src={previewCard.imageUrl}
            alt={previewCard.name}
            class="preview-art"
            data-cy="story-shop-cards-preview-art"
          />
        {:else}
          <div
            class="preview-placeholder"
            data-cy="story-shop-cards-preview-placeholder"
          ></div>
        {/if}
        <p class="preview-name" data-cy="story-shop-cards-preview-name">
          {previewCard.name}
        </p>
        <p class="preview-rarity" data-cy="story-shop-cards-preview-rarity">
          {previewCard.rarity}
        </p>
      {/if}
    </aside>

    <div class="cards-grid" data-cy="story-shop-cards-grid">
      {#each cards as card (card.code)}
        <div
          class="card-tile rarity-halo"
          data-cy={`story-shop-card-${card.code}`}
          data-rarity={card.rarity}
          role="group"
          aria-label={card.name}
          onmouseenter={() => {
            previewCode = card.code;
          }}
          onfocusin={() => {
            previewCode = card.code;
          }}
        >
          {#if card.imageUrl !== null}
            <img
              src={card.imageUrl}
              alt={card.name}
              class="card-art"
              data-cy={`story-shop-card-art-${card.code}`}
            />
          {:else}
            <div
              class="card-placeholder"
              aria-hidden="true"
              data-cy={`story-shop-card-placeholder-${card.code}`}
            ></div>
          {/if}
          <span class="card-name" data-cy={`story-shop-card-name-${card.code}`}
            >{card.name}</span
          >
          <button
            type="button"
            class="buy-btn"
            data-cy={`story-shop-card-buy-${card.code}`}
            disabled={dp < card.priceDp}
            onclick={() => onbuysingle(card.code, card.rarity)}
            >{card.priceDp} DP</button
          >
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  .shop-cards {
    min-height: 100svh;
    display: flex;
    flex-direction: column;
    padding: clamp(1rem, 4vw, 2rem);
    background:
      radial-gradient(circle at 30% 20%, var(--field-glow), transparent 30%),
      var(--bg);
  }

  .cards-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .cards-header h1 {
    flex: 1;
    margin: 0;
    font-size: clamp(1.25rem, 4vw, 2rem);
  }

  .cards-layout {
    display: grid;
    grid-template-columns: minmax(14rem, 1fr) 3fr;
    gap: 1.5rem;
    flex: 1;
    overflow: hidden;
  }

  .cards-preview {
    position: sticky;
    top: 0;
    align-self: start;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem;
    border: 1px solid var(--story-border);
    border-radius: 0.6rem;
    background: color-mix(in srgb, var(--bg) 85%, transparent);
  }

  .preview-art {
    width: 100%;
    aspect-ratio: 421 / 614;
    object-fit: cover;
    border-radius: 0.4rem;
  }

  .preview-placeholder {
    width: 100%;
    aspect-ratio: 421 / 614;
    border-radius: 0.4rem;
    background: color-mix(in srgb, var(--muted) 20%, transparent);
  }

  .preview-name {
    margin: 0;
    font-weight: 600;
    font-size: 0.95rem;
  }

  .preview-rarity {
    margin: 0;
    font-size: 0.78rem;
    color: var(--muted);
    text-transform: capitalize;
  }

  .cards-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(7.5rem, 1fr));
    gap: 0.75rem;
    align-content: start;
    overflow-y: auto;
    max-height: calc(100svh - 8rem);
  }

  .card-tile {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding: 0.5rem;
    border: 1px solid var(--story-border);
    border-radius: 0.5rem;
    background: color-mix(in srgb, var(--bg) 85%, transparent);
  }

  @media (prefers-reduced-motion: no-preference) {
    .card-tile:hover,
    .card-tile:focus-within {
      transform: scale(1.6);
      z-index: 10;
      position: relative;
    }
  }

  .card-art {
    width: 100%;
    aspect-ratio: 421 / 614;
    object-fit: cover;
    border-radius: 0.3rem;
  }

  .card-placeholder {
    width: 100%;
    aspect-ratio: 421 / 614;
    border-radius: 0.3rem;
    background: color-mix(in srgb, var(--muted) 20%, transparent);
  }

  .card-name {
    font-size: 0.65rem;
    font-weight: 600;
    line-height: 1.2;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .buy-btn {
    width: 100%;
    min-height: 28px;
    padding: 0.2rem 0.4rem;
    font-size: 0.65rem;
    font-weight: 700;
  }
</style>

<script lang="ts">
  import type { ShopRarity } from "../model/story-state.ts";

  export let cards: readonly {
    code: number;
    name: string;
    imageUrl: string | null;
    rarity: ShopRarity;
    owned: number;
    unitPriceDp: number;
  }[] = [];
  export let onsell: (
    items: readonly { code: number; quantity: number; unitPriceDp: number }[],
  ) => void = () => undefined;
  export let onback: () => void = () => undefined;

  let selected: Record<number, number> = {};

  $: total = cards.reduce(
    (sum, c) => sum + (selected[c.code] ?? 0) * c.unitPriceDp,
    0,
  );

  function decrement(code: number): void {
    const cur = selected[code] ?? 0;
    if (cur <= 0) return;
    selected = { ...selected, [code]: cur - 1 };
  }

  function increment(code: number, owned: number): void {
    const cur = selected[code] ?? 0;
    if (cur >= owned) return;
    selected = { ...selected, [code]: cur + 1 };
  }

  function confirm(): void {
    const items = cards
      .map((c) => ({
        code: c.code,
        quantity: selected[c.code] ?? 0,
        unitPriceDp: c.unitPriceDp,
      }))
      .filter((i) => i.quantity > 0);
    onsell(items);
    selected = {};
  }
</script>

<section class="shop-sell" data-cy="story-shop-sell" aria-label="Sell cards">
  <header class="sell-header" data-cy="story-shop-sell-header">
    <h1 data-cy="story-shop-sell-heading">Sell Cards</h1>
    <button
      type="button"
      class="secondary"
      data-cy="story-shop-sell-back"
      onclick={onback}>← Back</button
    >
  </header>

  {#if cards.length === 0}
    <p class="empty" data-cy="story-shop-sell-empty">No cards owned yet.</p>
  {:else}
    <div class="sell-grid" data-cy="story-shop-sell-grid">
      {#each cards as card (card.code)}
        <div
          class="sell-tile rarity-halo"
          data-rarity={card.rarity}
          data-cy={`story-shop-sell-card-${card.code}`}
        >
          <p class="card-name" data-cy={`story-shop-sell-name-${card.code}`}>
            {card.name}
          </p>
          <p class="owned" data-cy={`story-shop-sell-owned-${card.code}`}>
            Owned {card.owned}
          </p>
          <p class="price" data-cy={`story-shop-sell-price-${card.code}`}>
            {card.unitPriceDp} DP
          </p>
          <div class="stepper" data-cy={`story-shop-sell-stepper-${card.code}`}>
            <button
              type="button"
              data-cy={`story-shop-sell-minus-${card.code}`}
              disabled={(selected[card.code] ?? 0) === 0}
              onclick={() => decrement(card.code)}>−</button
            >
            <span data-cy={`story-shop-sell-selected-${card.code}`}
              >{selected[card.code] ?? 0}</span
            >
            <button
              type="button"
              data-cy={`story-shop-sell-plus-${card.code}`}
              disabled={(selected[card.code] ?? 0) >= card.owned}
              onclick={() => increment(card.code, card.owned)}>+</button
            >
          </div>
        </div>
      {/each}
    </div>
  {/if}

  <footer class="sell-footer" data-cy="story-shop-sell-footer">
    <span data-cy="story-shop-sell-total">Total: {total} DP</span>
    <button
      type="button"
      data-cy="story-shop-sell-confirm"
      disabled={total === 0}
      onclick={confirm}>Sell</button
    >
  </footer>
</section>

<style>
  .shop-sell {
    display: flex;
    flex-direction: column;
    min-height: 100svh;
    padding: clamp(1rem, 4vw, 2.5rem);
    gap: 1.25rem;
    background: var(--bg);
  }
  .sell-header {
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  .sell-header h1 {
    margin: 0;
    flex: 1;
  }
  .sell-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr));
    gap: 1rem;
    flex: 1;
  }
  .sell-tile {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding: 0.75rem;
    border: 1px solid var(--border);
    border-radius: 0.5rem;
    background: var(--code-bg);
  }
  .card-name {
    margin: 0;
    font-weight: 600;
    font-size: 0.85rem;
    line-height: 1.3;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }
  .owned,
  .price {
    margin: 0;
    font-size: 0.8rem;
    color: var(--muted);
  }
  .stepper {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin-top: auto;
  }
  .stepper button {
    padding: 0.2rem 0.5rem;
    min-width: 2rem;
  }
  .stepper span {
    min-width: 1.5rem;
    text-align: center;
    font-weight: 700;
  }
  .sell-footer {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding-top: 0.75rem;
    border-top: 1px solid var(--border);
    font-weight: 600;
  }
  .empty {
    color: var(--muted);
    margin: auto;
    text-align: center;
  }
</style>

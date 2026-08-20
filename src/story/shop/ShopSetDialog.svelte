<script lang="ts">
  import OverlayShell from "../overlays/OverlayShell.svelte";
  import { PACK_PRICE_DP } from "./data/shop-pricing.ts";
  import type { ShopSetEntry } from "./data/shop-set-data.ts";

  export let set: ShopSetEntry;
  export let dp: number;
  export let onbuy: (setId: string, count: number) => void;
  export let onviewcards: (setId: string) => void = () => undefined;
  export let onclose: () => void;

  let custom = 1;

  $: canAffordOne = dp >= PACK_PRICE_DP;
  $: canAffordTen = dp >= PACK_PRICE_DP * 10;
  $: canAffordCustom =
    Number.isInteger(custom) && custom >= 1 && dp >= custom * PACK_PRICE_DP;
</script>

<OverlayShell title={set.name} labelId="shop-set-title" {onclose}>
  <p class="price-line" data-cy="story-shop-set-price">
    {PACK_PRICE_DP} DP / pack
  </p>

  {#if !canAffordOne}
    <p class="buy-error" role="alert" data-cy="story-shop-buy-error">
      Not enough DP. You have {dp} DP; packs cost {PACK_PRICE_DP} DP each.
    </p>
  {/if}

  <div class="buy-actions" data-cy="story-shop-buy-actions">
    <button
      type="button"
      disabled={!canAffordOne}
      data-cy="story-shop-buy-one"
      onclick={() => onbuy(set.id, 1)}>Buy 1 · {PACK_PRICE_DP} DP</button
    >

    <button
      type="button"
      disabled={!canAffordTen}
      data-cy="story-shop-buy-ten"
      onclick={() => onbuy(set.id, 10)}>Buy 10 · {PACK_PRICE_DP * 10} DP</button
    >
  </div>

  <div class="custom-row" data-cy="story-shop-buy-custom-row">
    <input
      type="number"
      min="1"
      bind:value={custom}
      data-cy="story-shop-buy-custom-input"
      aria-label="Custom pack count"
    />
    <button
      type="button"
      disabled={!canAffordCustom}
      data-cy="story-shop-buy-custom"
      onclick={() => onbuy(set.id, custom)}>Buy {custom}</button
    >
  </div>

  <button
    type="button"
    class="secondary"
    data-cy="story-shop-view-cards"
    onclick={() => onviewcards(set.id)}>View card list</button
  >
</OverlayShell>

<style>
  .price-line {
    margin: 0 0 1rem;
    font-weight: 600;
    color: var(--story-accent);
  }

  .buy-error {
    margin: 0 0 0.75rem;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--danger);
    border-radius: 0.4rem;
    background: color-mix(in srgb, var(--danger-surface) 80%, transparent);
    font-size: 0.9rem;
  }

  .buy-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem;
    margin-bottom: 0.75rem;
  }

  .custom-row {
    display: flex;
    gap: 0.6rem;
    align-items: center;
    margin-bottom: 1rem;
  }

  .custom-row input {
    width: 5rem;
    padding: 0.45rem 0.6rem;
    border: 1px solid var(--border);
    border-radius: 0.4rem;
    background: var(--code-bg);
    color: var(--fg);
    font-size: 1rem;
  }
</style>

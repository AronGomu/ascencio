<script lang="ts">
  import DeckIcon from "./icons/DeckIcon.svelte";
  import ShopIcon from "./icons/ShopIcon.svelte";
  export let dp = 0;
  export let inShop = false;
  export let onshop: () => void = () => undefined;
  export let ondecks: () => void = () => {
    globalThis.location.hash = "#/decks";
  };
</script>

<div class="top-bar" data-cy="story-top-bar">
  <span class="dp" data-cy="story-top-bar-dp">{dp} DP</span>
  {#if !inShop}
    <button
      type="button"
      class="secondary compact"
      data-cy="story-top-bar-shop"
      aria-label="Open shop"
      onclick={onshop}><ShopIcon cy="story-top-bar-shop-icon" /></button
    >
  {/if}
  <button
    type="button"
    class="secondary compact"
    data-cy="story-top-bar-decks"
    aria-label="Open deck builder"
    onclick={ondecks}><DeckIcon cy="story-top-bar-decks-icon" /></button
  >
  <slot />
</div>

<style>
  .top-bar {
    position: fixed;
    z-index: 30;
    top: max(0.5rem, env(safe-area-inset-top));
    left: max(0.5rem, env(safe-area-inset-left));
    display: flex;
    gap: 0.4rem;
    align-items: center;
  }
  .dp {
    padding: 0.25rem 0.6rem;
    border: 1px solid var(--border);
    border-radius: 999px;
    background: color-mix(in srgb, var(--bg) 87%, transparent);
    font-weight: 700;
    font-size: 0.85rem;
  }
</style>

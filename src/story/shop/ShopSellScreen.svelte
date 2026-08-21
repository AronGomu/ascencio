<script lang="ts">
  import { tick } from "svelte";
  import type { ShopRarity, StoryState } from "../model/story-state.ts";
  import { SELL_PRICE_DP } from "./data/shop-pricing.ts";
  import SellImpactDialog from "./SellImpactDialog.svelte";
  import { decksBrokenBySale, type SaleDeckImpact } from "./sell-impact.ts";

  type SellItem = {
    readonly code: number;
    readonly quantity: number;
    readonly rarity: ShopRarity;
  };

  /* `null` means the shop data has not loaded, not that the player owns
     nothing: a card's price follows its rarity, and rarity is only knowable
     from that data. Selling is irreversible, so the screen offers no rows at
     all until it can price them. */
  export let cards:
    | readonly {
        code: number;
        name: string;
        imageUrl: string | null;
        rarity: ShopRarity;
        owned: number;
      }[]
    | null = null;
  export let error: string | null = null;
  /* The save the cards would leave, or `null` where there is none to ask —
     free play owns every card and has no collection to spend. A sale then
     commits straight through, which is also what a save with no decks does. */
  export let state: StoryState | null = null;
  export let onsell: (items: readonly SellItem[]) => void = () => undefined;
  export let onretry: () => void = () => undefined;
  export let onback: () => void = () => undefined;

  let selected: Record<number, number> = {};
  /* The receipt the dialog is asking about, held rather than recomputed: the
     sale that commits must be the one the player was shown. */
  let pending: readonly SellItem[] | null = null;
  let impact: readonly SaleDeckImpact[] = [];
  let sellButton: HTMLButtonElement;

  $: total = (cards ?? []).reduce(
    (sum, c) => sum + (selected[c.code] ?? 0) * SELL_PRICE_DP[c.rarity],
    0,
  );
  $: cardNameByCode = new Map(
    (cards ?? []).map(({ code, name }) => [code, name] as const),
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
    const items = (cards ?? [])
      .map((c) => ({
        code: c.code,
        quantity: selected[c.code] ?? 0,
        rarity: c.rarity,
      }))
      .filter((i) => i.quantity > 0);
    /* Asked before the sale is dispatched, never after: once the reducer has
       the receipt the cards are gone, and a deck the player would have kept
       them for cannot be given them back. */
    const broken = state === null ? [] : decksBrokenBySale(state, items);
    if (broken.length === 0) {
      commit(items);
      return;
    }
    impact = broken;
    pending = items;
  }

  function commit(items: readonly SellItem[]): void {
    pending = null;
    onsell(items);
    selected = {};
  }

  function confirmSale(): void {
    if (pending !== null) commit(pending);
  }

  async function cancelSale(): Promise<void> {
    /* The steppers keep what they held: cancelling means the sale did not
       happen, not that the selection was thrown away. */
    pending = null;
    await tick();
    sellButton.focus();
  }
</script>

<section
  class="shop-sell"
  data-cy="story-shop-sell"
  aria-label="Sell cards"
  inert={pending !== null}
>
  <header class="sell-header" data-cy="story-shop-sell-header">
    <h1 data-cy="story-shop-sell-heading">Sell Cards</h1>
    <button
      type="button"
      class="secondary"
      data-cy="story-shop-sell-back"
      onclick={onback}>← Back</button
    >
  </header>

  {#if error !== null}
    <div class="state-block" role="alert" data-cy="story-shop-sell-error">
      <p data-cy="story-shop-sell-error-message">{error}</p>
      <button type="button" data-cy="story-shop-sell-retry" onclick={onretry}
        >Retry</button
      >
    </div>
  {:else if cards === null}
    <div class="state-block" aria-busy="true" data-cy="story-shop-sell-loading">
      <p data-cy="story-shop-sell-loading-text">Loading prices…</p>
    </div>
  {:else if cards.length === 0}
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
            {SELL_PRICE_DP[card.rarity]} DP
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

  {#if cards !== null && error === null}
    <footer class="sell-footer" data-cy="story-shop-sell-footer">
      <span data-cy="story-shop-sell-total">Total: {total} DP</span>
      <button
        type="button"
        data-cy="story-shop-sell-confirm"
        disabled={total === 0}
        bind:this={sellButton}
        onclick={confirm}>Sell</button
      >
    </footer>
  {/if}
</section>

{#if pending !== null}
  <SellImpactDialog
    decks={impact}
    cardNameOf={(code) => cardNameByCode.get(code) ?? `Card ${code}`}
    onconfirm={confirmSale}
    oncancel={() => void cancelSale()}
  />
{/if}

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
  .state-block {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    padding: 3rem;
    text-align: center;
  }
</style>

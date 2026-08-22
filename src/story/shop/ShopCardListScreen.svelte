<script lang="ts">
  import StoryCardTile from "../components/StoryCardTile.svelte";
  import {
    groupByRarity,
    type RarityDirection,
  } from "../collection/group-by-rarity.ts";
  import type { ShopRarity } from "../model/story-state.ts";

  interface SetCard {
    readonly code: number;
    readonly name: string;
    readonly imageUrl: string | null;
    readonly rarity: ShopRarity;
    readonly priceDp: number;
  }

  interface CardSection {
    /** `null` is the ungrouped list, which carries no heading because there is
        no tier to name. */
    readonly rarity: ShopRarity | null;
    readonly cards: readonly SetCard[];
  }

  /** Off, then each direction, then off again — the button is one control the
      player cycles rather than a toggle plus a direction switch. */
  type RarityGrouping = "off" | RarityDirection;

  export let setName = "";
  export let dp = 0;
  export let cards: readonly SetCard[] = [];
  export let onbuysingle: (code: number, rarity: ShopRarity) => void = () =>
    undefined;
  export let onback: () => void = () => undefined;

  const NEXT_GROUPING: Readonly<Record<RarityGrouping, RarityGrouping>> = {
    off: "common-first",
    "common-first": "rarest-first",
    "rarest-first": "off",
  };

  /* The label is the state: a button whose name never changed would leave a
     screen reader announcing "sort by rarity, pressed" for both directions. */
  const GROUPING_LABELS: Readonly<Record<RarityGrouping, string>> = {
    off: "Sort by rarity",
    "common-first": "Rarity: common first",
    "rarest-first": "Rarity: rarest first",
  };

  /* View state, not a preference: the set list opens in the order the set
     itself is packaged in, which is what an ungrouped list is for. */
  let rarityGrouping: RarityGrouping = "off";
  let previewCode: number | null = cards[0]?.code ?? null;
  let sections: readonly CardSection[];

  $: previewCard =
    previewCode !== null
      ? (cards.find((c) => c.code === previewCode) ?? cards[0] ?? null)
      : (cards[0] ?? null);
  /* One section list for both states, so the tile is written once: grouping off
     is the whole set under no heading, in the order it was handed in. */
  $: sections =
    rarityGrouping === "off"
      ? [{ rarity: null, cards }]
      : groupByRarity(cards, rarityGrouping);
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
    <button
      type="button"
      class="secondary rarity-sort"
      data-cy="story-shop-cards-rarity-sort"
      data-state={rarityGrouping}
      aria-pressed={rarityGrouping !== "off"}
      onclick={() => {
        rarityGrouping = NEXT_GROUPING[rarityGrouping];
      }}>{GROUPING_LABELS[rarityGrouping]}</button
    >
  </header>

  <div class="cards-layout" data-cy="story-shop-cards-layout">
    <aside class="cards-preview" data-cy="story-shop-cards-preview">
      {#if previewCard !== null}
        <StoryCardTile
          name={previewCard.name}
          imageUrl={previewCard.imageUrl}
          dataCyPrefix="story-shop-cards-preview"
          dataCyId={previewCard.code}
        />
        <p class="preview-name" data-cy="story-shop-cards-preview-name">
          {previewCard.name}
        </p>
        <p class="preview-rarity" data-cy="story-shop-cards-preview-rarity">
          {previewCard.rarity}
        </p>
      {/if}
    </aside>

    <div class="cards-grid" data-cy="story-shop-cards-grid">
      {#each sections as section (section.rarity)}
        {#if section.rarity !== null}
          <h2
            class="group-heading rarity-halo"
            data-rarity={section.rarity}
            data-cy={`story-shop-cards-group-${section.rarity}`}
          >
            {section.rarity}
          </h2>
        {/if}
        {#each section.cards as card (card.code)}
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
            <StoryCardTile
              name={card.name}
              imageUrl={card.imageUrl}
              dataCyPrefix="story-shop-card"
              dataCyId={card.code}
            />
            <span
              class="card-name"
              data-cy={`story-shop-card-name-${card.code}`}>{card.name}</span
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

  .rarity-sort {
    flex: none;
    font-size: 0.8rem;
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

  /* The heading sits in the tile grid rather than in a section of its own, so
     one scroller and one column track still describe the whole list. */
  .group-heading {
    grid-column: 1 / -1;
    margin: 0.5rem 0 0;
    padding: 0.2rem 0.5rem;
    border-radius: 0.4rem;
    font-size: 0.75rem;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
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

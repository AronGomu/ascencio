<script lang="ts">
  /** What the packs produced, in the set card list's shape. `feedback-vn.md`,
      Card Reveal item 1: "Whenever opening all boosters, do not show
      duplicates, instead show a quantity number. Add the same grouping by
      rarities button. Basically use the same screen layout."

      So: one tile per card however many times it repeated, a count on the ones
      that did, and the set list's own tri-state rarity control — the same
      component, not a second one that agrees today.

      The heading still counts every pull rather than every tile: a player who
      bought six packs opened fifty-four cards, and a list of forty tiles must
      not read as a shortfall. */
  import RaritySortButton from "../components/RaritySortButton.svelte";
  import StoryCardTile from "../components/StoryCardTile.svelte";
  import {
    groupByRarity,
    type RarityGrouping,
  } from "../collection/group-by-rarity.ts";
  import {
    groupOpenedCards,
    type OpenedCardQuantity,
  } from "./opened-card-quantities.ts";
  import type { ShopRarity } from "../model/story-state.ts";

  interface ResultCard {
    readonly code: number;
    readonly name: string;
    readonly imageUrl: string | null;
    readonly rarity: ShopRarity;
  }

  interface ResultSection {
    /** `null` is the ungrouped list, which carries no heading because there is
        no tier to name. */
    readonly rarity: ShopRarity | null;
    readonly cards: readonly OpenedCardQuantity<ResultCard>[];
  }

  export let cards: readonly ResultCard[] = [];
  export let oncontinue: () => void = () => undefined;

  /* View state, not a preference: the recap opens in the order the packs
     produced, which is the order the player just watched. */
  let rarityGrouping: RarityGrouping = "off";
  let sections: readonly ResultSection[];

  $: counted = groupOpenedCards(cards);
  /* One section list for both states, so the tile is written once. */
  $: sections =
    rarityGrouping === "off"
      ? [{ rarity: null, cards: counted }]
      : groupByRarity(counted, rarityGrouping);
</script>

<main class="results-screen" data-cy="story-shop-results">
  <header class="results-header" data-cy="story-shop-results-header">
    <h1 data-cy="story-shop-results-heading">
      You opened {cards.length} cards
    </h1>
    <RaritySortButton
      grouping={rarityGrouping}
      dataCy="story-shop-results-rarity-sort"
      onchange={(next) => {
        rarityGrouping = next;
      }}
    />
  </header>

  <div class="results-grid" data-cy="story-shop-results-grid">
    {#each sections as section (section.rarity)}
      {#if section.rarity !== null}
        <h2
          class="group-heading rarity-halo"
          data-rarity={section.rarity}
          data-cy={`story-shop-results-group-${section.rarity}`}
        >
          {section.rarity}
        </h2>
      {/if}
      {#each section.cards as card (card.code)}
        <div
          class="result-tile rarity-halo"
          data-cy={`story-shop-result-tile-${card.code}`}
          data-rarity={card.rarity}
          role="group"
          aria-label={card.quantity > 1
            ? `${card.name}, ${card.quantity} copies`
            : card.name}
        >
          <StoryCardTile
            name={card.name}
            imageUrl={card.imageUrl}
            dataCyPrefix="story-shop-result"
            dataCyId={card.code}
          />
          <span
            class="result-name"
            data-cy={`story-shop-result-name-${card.code}`}>{card.name}</span
          >
          {#if card.quantity > 1}
            <!-- The count is already in the tile's group label, so announcing
                 the badge as well would say it twice. -->
            <span
              class="result-quantity"
              aria-hidden="true"
              data-cy={`story-shop-results-quantity-${card.code}`}
              >×{card.quantity}</span
            >
          {/if}
        </div>
      {/each}
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
  .results-header {
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  h1 {
    flex: 1;
    margin: 0;
    font-size: clamp(1.25rem, 4vw, 2rem);
  }
  .results-grid {
    flex: 1;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(7.5rem, 1fr));
    gap: 0.75rem;
    align-content: start;
    overflow-y: auto;
  }
  /* The heading sits in the tile grid rather than in a section of its own, so
     one scroller and one column track still describe the whole list — the set
     card list's arrangement, which is what the owner asked to reuse. */
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
    position: relative;
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
  /* On the art rather than beside it: the count has to survive a grid that
     packs tiles as tightly as the set list's does. */
  .result-quantity {
    position: absolute;
    top: 0.3rem;
    right: 0.3rem;
    min-width: 1.5rem;
    padding: 0.05rem 0.3rem;
    border-radius: 0.75rem;
    background: color-mix(in srgb, var(--bg) 78%, var(--accent));
    border: 1px solid var(--story-border);
    font-size: 0.7rem;
    font-weight: 800;
    text-align: center;
  }
  .results-actions {
    display: flex;
    justify-content: center;
    padding: 1rem 0;
  }
</style>

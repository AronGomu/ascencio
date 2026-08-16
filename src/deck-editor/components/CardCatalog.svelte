<script lang="ts">
  import {
    catalogFilterOptions,
    EMPTY_CATALOG_FILTERS,
    filterDeckCatalog,
    type DeckCatalogFilters,
  } from "../../decks/catalog/deck-catalog.ts";
  import type { DeckBuilderCardView } from "../../decks/catalog/ocg-card-mapper.ts";
  import type { PinnedDeckRuleset } from "../../decks/catalog/pinned-ruleset.ts";
  import { quantityLimit } from "../../decks/catalog/pinned-ruleset.ts";
  import CardTile from "./CardTile.svelte";

  export let cards: readonly DeckBuilderCardView[];
  export let ruleset: PinnedDeckRuleset;
  export let selectedCode: number | null = null;
  export let copies: ReadonlyMap<number, number> = new Map();
  export let onselect: (card: DeckBuilderCardView) => void = () => undefined;
  export let ondragcard: (
    card: DeckBuilderCardView,
    event: DragEvent,
  ) => void = () => undefined;
  export let ondragcancel: () => void = () => undefined;
  export let onpickup: (card: DeckBuilderCardView) => void = () => undefined;
  export let onblocked: (
    card: DeckBuilderCardView,
    reason: string,
  ) => void = () => undefined;
  /* `null` above the breakpoint, where a tile click only selects. */
  export let ontap: ((card: DeckBuilderCardView) => void) | null = null;
  /* The catalog is a pane of its own below the breakpoint, so it fills the
     stage instead of reserving room for the two panels beside it. */
  export let filled = false;
  export let onhovercard: (card: DeckBuilderCardView) => void = () => undefined;
  export let onhoverend: () => void = () => undefined;

  let filters: DeckCatalogFilters = { ...EMPTY_CATALOG_FILTERS };
  $: options = catalogFilterOptions(cards);
  $: results = filterDeckCatalog(cards, filters);

  function addable(card: DeckBuilderCardView): boolean {
    return (copies.get(card.code) ?? 0) < quantityLimit(ruleset, card.code);
  }

  function blockedReason(card: DeckBuilderCardView): string {
    const limit = quantityLimit(ruleset, card.code);
    return limit === 0 ? "Card is forbidden." : `Copy limit ${limit} reached.`;
  }

  function setFilter<Key extends keyof DeckCatalogFilters>(
    key: Key,
    value: DeckCatalogFilters[Key],
  ): void {
    filters = { ...filters, [key]: value };
  }
</script>

<section
  class="catalog"
  class:filled
  aria-label="Card catalog"
  data-cy="deck-catalog"
>
  <header data-cy="deck-catalog-header">
    <span data-cy="deck-catalog-result-count">{results.length} results</span>
  </header>

  <label data-cy="deck-catalog-name-field">
    <span data-cy="deck-catalog-name-label">Name</span>
    <input
      type="search"
      value={filters.name}
      placeholder="Filter by card name"
      data-cy="deck-catalog-name-input"
      oninput={(event) => setFilter("name", event.currentTarget.value)}
    />
  </label>

  <div class="filters" data-cy="deck-catalog-filters">
    <label data-cy="deck-catalog-family-field">
      <span data-cy="deck-catalog-family-label">Card type</span>
      <select
        data-cy="deck-catalog-family-select"
        value={filters.family ?? ""}
        onchange={(event) =>
          setFilter(
            "family",
            (event.currentTarget.value || null) as DeckCatalogFilters["family"],
          )}
      >
        <option value="" data-cy="deck-catalog-family-option-all">All</option>
        <option value="monster" data-cy="deck-catalog-family-option-monster"
          >Monster</option
        >
        <option value="spell" data-cy="deck-catalog-family-option-spell"
          >Spell</option
        >
        <option value="trap" data-cy="deck-catalog-family-option-trap"
          >Trap</option
        >
      </select>
    </label>
    <label data-cy="deck-catalog-subtype-field">
      <span data-cy="deck-catalog-subtype-label">Subtype</span>
      <select
        data-cy="deck-catalog-subtype-select"
        value={filters.subtype ?? ""}
        onchange={(event) =>
          setFilter("subtype", event.currentTarget.value || null)}
      >
        <option value="" data-cy="deck-catalog-subtype-option-all">All</option>
        {#each options.subtypes as option (option)}
          <option
            value={option}
            data-cy={`deck-catalog-subtype-option-${option}`}>{option}</option
          >
        {/each}
      </select>
    </label>
    <label data-cy="deck-catalog-attribute-field">
      <span data-cy="deck-catalog-attribute-label">Attribute</span>
      <select
        data-cy="deck-catalog-attribute-select"
        value={filters.attribute ?? ""}
        onchange={(event) =>
          setFilter("attribute", event.currentTarget.value || null)}
      >
        <option value="" data-cy="deck-catalog-attribute-option-all">All</option
        >
        {#each options.attributes as option (option)}
          <option
            value={option}
            data-cy={`deck-catalog-attribute-option-${option}`}>{option}</option
          >
        {/each}
      </select>
    </label>
    <label data-cy="deck-catalog-race-field">
      <span data-cy="deck-catalog-race-label">Monster type</span>
      <select
        data-cy="deck-catalog-race-select"
        value={filters.race ?? ""}
        onchange={(event) =>
          setFilter("race", event.currentTarget.value || null)}
      >
        <option value="" data-cy="deck-catalog-race-option-all">All</option>
        {#each options.races as option (option)}
          <option value={option} data-cy={`deck-catalog-race-option-${option}`}
            >{option}</option
          >
        {/each}
      </select>
    </label>
  </div>

  {#if filters.name || filters.family || filters.subtype || filters.attribute || filters.race}
    <div class="filter-summary" data-cy="deck-catalog-filter-summary">
      <span data-cy="deck-catalog-filter-summary-label">Filters active</span>
      <button
        type="button"
        class="secondary small"
        data-cy="deck-catalog-clear-all"
        onclick={() => (filters = { ...EMPTY_CATALOG_FILTERS })}
        >Clear all</button
      >
    </div>
  {/if}

  {#if results.length === 0}
    <div class="empty-state" data-cy="deck-catalog-empty">
      <h3 data-cy="deck-catalog-empty-heading">No matching cards</h3>
      <p data-cy="deck-catalog-empty-message">
        Clear filters or try another card name.
      </p>
      <button
        type="button"
        data-cy="deck-catalog-clear-filters"
        onclick={() => (filters = { ...EMPTY_CATALOG_FILTERS })}
        >Clear filters</button
      >
    </div>
  {:else}
    <div
      class="results"
      aria-label="Card catalog results"
      data-cy="deck-catalog-results"
      onmouseleave={() => onhoverend()}
    >
      {#each results as card (card.code)}
        <CardTile
          {card}
          code={card.code}
          limit={quantityLimit(ruleset, card.code)}
          currentCopies={copies.get(card.code) ?? 0}
          selected={selectedCode === card.code}
          draggable={(copies.get(card.code) ?? 0) <
            quantityLimit(ruleset, card.code)}
          onselect={() => onselect(card)}
          ontap={ontap === null
            ? null
            : () =>
                addable(card)
                  ? ontap(card)
                  : onblocked(card, blockedReason(card))}
          ondragcard={(event) => ondragcard(card, event)}
          {ondragcancel}
          onpickup={() => onpickup(card)}
          onblocked={() => onblocked(card, blockedReason(card))}
          onhover={() => onhovercard(card)}
        />
      {/each}
    </div>
  {/if}
</section>

<style>
  .catalog {
    min-width: 0;
    height: calc(100vh - 5.5rem);
    overflow: hidden;
    padding: 1rem;
    border: 1px solid var(--border);
    border-radius: 0.8rem;
    background: var(--surface);
  }

  .catalog.filled {
    height: auto;
    overflow: visible;
  }

  header,
  .filter-summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }

  h3,
  p {
    margin: 0;
  }

  label span {
    color: var(--muted);
    font-size: 0.76rem;
    font-weight: 750;
  }

  label {
    display: grid;
    gap: 0.3rem;
    margin-top: 0.75rem;
  }

  input,
  select {
    width: 100%;
    min-height: 2.5rem;
    padding: 0.5rem 0.65rem;
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: 0.5rem;
    background: var(--surface-chain);
  }

  .filters {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0 0.55rem;
  }

  .filter-summary {
    margin-block: 0.65rem;
  }

  .small {
    min-height: 2rem;
    padding: 0.3rem 0.55rem;
  }

  .results {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.55rem;
    max-height: calc(100vh - 24rem);
    overflow-y: auto;
    padding: 0.2rem 0.35rem 0.5rem 0.1rem;
  }

  .filled .results {
    grid-template-columns: repeat(auto-fill, minmax(5.5rem, 1fr));
    max-height: none;
    overflow-y: visible;
  }

  .empty-state {
    margin-top: 1rem;
    padding: 1.5rem 0.75rem;
    text-align: center;
  }

  .empty-state p {
    margin: 0.4rem 0 1rem;
    color: var(--muted);
  }
</style>

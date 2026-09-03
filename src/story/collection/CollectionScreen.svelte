<script lang="ts">
  import { onDestroy } from "svelte";
  import type { CardOwnership } from "../../decks/card-ownership.ts";
  import type { DeckBuilderCardView } from "../../decks/catalog/ocg-card-mapper.ts";
  import { CardPreviewPanel, type CardPreviewView } from "../../shell/index.ts";
  import StoryCardTile from "../components/StoryCardTile.svelte";
  import type { ShopRarity } from "../model/story-state.ts";
  import { byName, groupByRarity } from "./group-by-rarity.ts";
  /* Scoped to `.story-app`, so the rarity halo tokens and the button styling
     travel with this screen wherever the shell mounts it. */
  import "../styles.css";

  /** What the context browsing owns. Free play's answers `Infinity` for every
      code, which is why no count is rendered there: "you own ∞ copies" is not
      a fact about a collection, it is the absence of one. */
  export let ownership: CardOwnership;
  export let cards: readonly DeckBuilderCardView[];
  export let rarityByCode: ReadonlyMap<number, ShopRarity>;
  export let onback: () => void = () => undefined;

  interface CollectionEntry {
    readonly card: DeckBuilderCardView;
    readonly name: string;
    readonly rarity: ShopRarity;
    /** Copies owned, or `0` in free play, where nothing is counted. */
    readonly owned: number;
  }

  interface CollectionSection {
    readonly key: string;
    /** `null` is the one flat list the ungrouped view renders, which carries no
        heading because there is no tier to name. */
    readonly rarity: ShopRarity | null;
    readonly cards: readonly CollectionEntry[];
  }

  /* The whole database is 14,794 cards, so free play's list is never rendered
     whole: the window grows as the grid is scrolled, exactly as the deck
     editor's catalog does. Without an observer nothing ever appends, so the
     cap below is all anything else can show. */
  const WINDOW_STEP = 60;
  const FALLBACK_CAP = 200;

  const observerSupported = typeof IntersectionObserver === "function";

  let showAll = false;
  let grouped = true;
  let selected: DeckBuilderCardView | null = null;
  let visibleCount = WINDOW_STEP;
  let scroller: HTMLElement | null = null;
  let sentinel: HTMLElement | null = null;
  let observer: IntersectionObserver | null = null;

  $: unlimited = ownership.isUnlimited;
  /* Free play owns everything, so its list is the database and the show-all
     control has nothing to add — it is not offered there at all. */
  $: listed =
    unlimited || showAll
      ? cards
      : cards.filter(({ code }) => ownership.ownedCount(code) > 0);
  /* Deliberately reads neither the selection nor the window: a hover, a click
     or a scroll must not re-walk the database. */
  $: entries = listed.map((card): CollectionEntry => ({
    card,
    name: card.name,
    rarity: rarityByCode.get(card.code) ?? "common",
    owned: unlimited ? 0 : ownership.ownedCount(card.code),
  }));
  $: ordered = grouped
    ? groupByRarity(entries, "common-first").flatMap((group) => group.cards)
    : [...entries].sort(byName);
  $: total = ordered.length;
  $: {
    /* A list that changed shape starts its window again rather than keeping a
       count measured against the previous one. */
    void showAll;
    void grouped;
    visibleCount = Math.min(WINDOW_STEP, total);
  }
  $: visible = observerSupported
    ? ordered.slice(0, visibleCount)
    : ordered.slice(0, FALLBACK_CAP);
  $: truncated = !observerSupported && total > FALLBACK_CAP;
  /* `ordered` already runs the tiers in order, so a section is a run of equal
     rarity inside the window rather than a second grouping pass. */
  $: sections = sectionRuns(visible, grouped);
  $: preview =
    selected === null
      ? null
      : ({
          code: selected.code,
          name: selected.name,
          description: selected.description,
        } satisfies CardPreviewView);

  $: observeSentinel(sentinel, scroller);

  onDestroy(() => observer?.disconnect());

  function sectionRuns(
    windowed: readonly CollectionEntry[],
    byRarity: boolean,
  ): readonly CollectionSection[] {
    if (windowed.length === 0) return [];
    if (!byRarity) return [{ key: "all", rarity: null, cards: windowed }];
    const runs: {
      key: string;
      rarity: ShopRarity;
      cards: CollectionEntry[];
    }[] = [];
    for (const entry of windowed) {
      const open = runs.at(-1);
      if (open !== undefined && open.rarity === entry.rarity)
        open.cards.push(entry);
      else
        runs.push({ key: entry.rarity, rarity: entry.rarity, cards: [entry] });
    }
    return runs;
  }

  function observeSentinel(
    element: HTMLElement | null,
    root: HTMLElement | null,
  ): void {
    observer?.disconnect();
    observer = null;
    if (!observerSupported || element === null || root === null) return;
    observer = new IntersectionObserver(
      (records) => {
        if (records.some((record) => record.isIntersecting))
          visibleCount = Math.min(visibleCount + WINDOW_STEP, total);
      },
      { root, rootMargin: "200px" },
    );
    observer.observe(element);
  }

  function select(card: DeckBuilderCardView): void {
    selected = card;
  }
</script>

<div class="story-app collection" data-cy="collection-screen">
  <header class="collection-header" data-cy="collection-header">
    <button
      type="button"
      class="story-danger"
      data-cy="collection-back"
      onclick={onback}>← Back</button
    >
    <h1 data-cy="collection-heading">
      {unlimited ? "Card database" : "Your collection"}
    </h1>
  </header>

  <div class="collection-controls" data-cy="collection-controls">
    {#if !unlimited}
      <label class="toggle" data-cy="collection-show-all-field">
        <input
          type="checkbox"
          data-cy="collection-show-all"
          bind:checked={showAll}
        />
        Show every existing card
      </label>
    {/if}
    <label class="toggle" data-cy="collection-group-field">
      <input
        type="checkbox"
        data-cy="collection-group-toggle"
        bind:checked={grouped}
      />
      Group by rarity
    </label>
    <p class="collection-summary" data-cy="collection-summary">
      {visible.length} of {total} cards
    </p>
  </div>

  <div class="collection-layout" data-cy="collection-layout">
    <aside class="collection-preview" data-cy="collection-preview">
      <CardPreviewPanel {preview} staticImageUrl={selected?.imageUrl ?? null} />
    </aside>

    <div class="collection-grid" data-cy="collection-grid" bind:this={scroller}>
      {#if total === 0}
        <p class="collection-empty" data-cy="collection-empty">
          {unlimited
            ? "The card database is empty."
            : "You do not own any cards yet."}
        </p>
      {/if}
      {#each sections as section (section.key)}
        <section
          class="collection-section"
          data-cy={`collection-section-${section.key}`}
        >
          {#if section.rarity !== null}
            <h2
              class="collection-rarity rarity-halo"
              data-rarity={section.rarity}
              data-cy={`collection-rarity-${section.rarity}`}
            >
              {section.rarity}
            </h2>
          {/if}
          <div
            class="collection-tiles"
            data-cy={`collection-tiles-${section.key}`}
          >
            {#each section.cards as entry (entry.card.code)}
              <button
                type="button"
                class="collection-tile rarity-halo"
                class:collection-tile--unowned={!unlimited && entry.owned === 0}
                data-rarity={entry.rarity}
                data-cy={`collection-card-${entry.card.code}`}
                aria-label={entry.name}
                onclick={() => select(entry.card)}
                onmouseenter={() => select(entry.card)}
                onfocus={() => select(entry.card)}
              >
                <StoryCardTile
                  name={entry.name}
                  imageUrl={entry.card.imageUrl}
                  dataCyPrefix="collection"
                  dataCyId={entry.card.code}
                />
                <span
                  class="tile-name"
                  data-cy={`collection-name-${entry.card.code}`}
                  >{entry.name}</span
                >
                {#if entry.owned > 0}
                  <span
                    class="tile-count"
                    data-cy={`collection-count-${entry.card.code}`}
                    >{entry.owned}</span
                  >
                {/if}
              </button>
            {/each}
          </div>
        </section>
      {/each}
      <div
        class="collection-sentinel"
        data-cy="collection-sentinel"
        bind:this={sentinel}
      ></div>
      {#if truncated}
        <p class="collection-truncated" data-cy="collection-truncated">
          Showing the first {FALLBACK_CAP} of {total} cards.
        </p>
      {/if}
    </div>
  </div>
</div>

<style>
  .collection {
    width: 100%;
    height: 100%;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    padding: clamp(1rem, 4cqw, 2rem);
    background:
      radial-gradient(circle at 30% 20%, var(--field-glow), transparent 30%),
      var(--bg);
  }

  .collection-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .collection-header h1 {
    flex: 1;
    margin: 0;
    font-size: clamp(1.25rem, 4cqw, 2rem);
  }

  .collection-controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.85rem;
  }

  .collection-summary {
    margin: 0 0 0 auto;
    color: var(--muted);
    font-size: 0.78rem;
  }

  /* The same two-column split the set list uses: a sticky preview beside a
     scrolling grid of tiles. */
  .collection-layout {
    display: grid;
    grid-template-columns: minmax(14rem, 1fr) 3fr;
    gap: 1.5rem;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .collection-preview {
    position: sticky;
    top: 0;
    align-self: start;
  }

  .collection-grid {
    min-height: 0;
    overflow-y: auto;
  }

  .collection-section {
    margin-bottom: 1.25rem;
  }

  .collection-rarity {
    margin: 0 0 0.6rem;
    padding: 0.2rem 0.5rem;
    border-radius: 0.4rem;
    font-size: 0.75rem;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .collection-tiles {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(7.5rem, 1fr));
    gap: 0.75rem;
    align-content: start;
  }

  /* Tile proportions and spacing are the set list's; the element is a button
     because a tile is selectable here, so the story's own button styling has
     to be undone rather than inherited. */
  .collection-tile {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    min-height: 0;
    padding: 0.5rem;
    border: 1px solid var(--story-border);
    border-radius: 0.5rem;
    background: color-mix(in srgb, var(--bg) 85%, transparent);
    color: var(--story-text);
    font-weight: 400;
    text-align: left;
  }

  .collection-tile--unowned {
    opacity: 0.4;
  }

  @media (prefers-reduced-motion: no-preference) {
    .collection-tile:hover,
    .collection-tile:focus-visible {
      transform: scale(1.6);
      z-index: 10;
      position: relative;
    }
  }

  .tile-name {
    font-size: 0.65rem;
    font-weight: 600;
    line-height: 1.2;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tile-count {
    font-size: 0.7rem;
    font-weight: 800;
    color: var(--story-accent);
  }

  .tile-count::before {
    content: "×";
  }

  .collection-sentinel {
    height: 1px;
  }

  .collection-empty,
  .collection-truncated {
    margin: 0;
    color: var(--muted);
    font-size: 0.85rem;
  }
</style>

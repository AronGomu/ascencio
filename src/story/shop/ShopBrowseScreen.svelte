<script lang="ts">
  import type { ShopSetEntry } from "./data/shop-set-data.ts";
  import ShopSetDialog from "./ShopSetDialog.svelte";

  export let sets: readonly ShopSetEntry[] | null = null;
  export let error: string | null = null;
  export let dp = 0;
  export let onbuy: (setId: string, count: number) => void;
  export let onviewcards: (setId: string) => void = () => undefined;
  export let onretry: () => void = () => undefined;
  export let onback: () => void;

  let dialogSetId: string | null = null;

  $: released = (sets ?? []).filter((s) => s.released);
  $: latestRow = [...released].reverse();

  function openDialog(entry: ShopSetEntry): void {
    if (!entry.released) return;
    dialogSetId = entry.id;
  }

  $: dialogEntry =
    dialogSetId !== null
      ? (sets ?? []).find((s) => s.id === dialogSetId)
      : undefined;
</script>

<section
  class="shop-browse"
  aria-label="Set browser"
  data-cy="story-shop-browse"
>
  <header class="browse-header" data-cy="story-shop-browse-header">
    <h1 data-cy="story-shop-browse-heading">Card Shop</h1>
    <button
      type="button"
      class="secondary"
      data-cy="story-shop-browse-back"
      onclick={onback}>← Back</button
    >
  </header>

  {#if error !== null}
    <div class="state-block" role="alert" data-cy="story-shop-browse-error">
      <p data-cy="story-shop-browse-error-message">{error}</p>
      <button type="button" data-cy="story-shop-browse-retry" onclick={onretry}
        >Retry</button
      >
    </div>
  {:else if sets === null}
    <div
      class="state-block"
      aria-busy="true"
      data-cy="story-shop-browse-loading"
    >
      <p data-cy="story-shop-browse-loading-text">Loading sets…</p>
    </div>
  {:else}
    {#if latestRow.length > 0}
      <section
        aria-label="Latest released sets"
        data-cy="story-shop-latest-row"
      >
        <h2 class="row-heading" data-cy="story-shop-latest-row-heading">
          Latest Released
        </h2>
        <div class="latest-scroll" data-cy="story-shop-latest-scroll">
          {#each latestRow as set (set.id)}
            <button
              type="button"
              class="set-tile set-tile--latest"
              data-cy={`story-shop-latest-${set.id}`}
              onclick={() => openDialog(set)}
            >
              <span
                class="tile-name"
                data-cy={`story-shop-latest-name-${set.id}`}>{set.name}</span
              >
              <span
                class="tile-year"
                data-cy={`story-shop-latest-year-${set.id}`}
                >{set.releaseYear}</span
              >
            </button>
          {/each}
        </div>
      </section>
    {/if}

    <section aria-label="All sets" data-cy="story-shop-set-grid-section">
      <h2 class="row-heading" data-cy="story-shop-set-grid-heading">
        All Sets
      </h2>
      <div class="set-grid" data-cy="story-shop-set-grid">
        {#each sets as set (set.id)}
          <button
            type="button"
            class="set-tile"
            class:set-tile--unreleased={!set.released}
            aria-disabled={!set.released || undefined}
            data-cy={`story-shop-set-${set.id}`}
            onclick={() => openDialog(set)}
          >
            <span class="tile-name" data-cy={`story-shop-set-name-${set.id}`}
              >{set.name}</span
            >
            <span class="tile-year" data-cy={`story-shop-set-year-${set.id}`}>
              {set.releaseYear}{#if !set.released}
                🔒{/if}
            </span>
          </button>
        {/each}
      </div>
    </section>
  {/if}
</section>

{#if dialogSetId !== null && dialogEntry !== undefined}
  <ShopSetDialog
    set={dialogEntry}
    {dp}
    {onbuy}
    {onviewcards}
    onclose={() => {
      dialogSetId = null;
    }}
  />
{/if}

<style>
  .shop-browse {
    min-height: 100svh;
    padding: clamp(1rem, 4vw, 2.5rem);
    background:
      radial-gradient(circle at 70% 20%, var(--field-glow), transparent 30%),
      var(--bg);
  }

  .browse-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .browse-header h1 {
    flex: 1;
    margin: 0;
  }

  .row-heading {
    margin: 0 0 0.75rem;
    font-size: 0.9rem;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--muted);
  }

  .latest-scroll {
    display: flex;
    gap: 0.75rem;
    overflow-x: auto;
    padding-bottom: 0.5rem;
    margin-bottom: 2rem;
  }

  .set-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
    gap: 0.75rem;
    margin-bottom: 2rem;
  }

  .set-tile {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    padding: 0.85rem 1rem;
    border: 1px solid var(--story-border);
    border-radius: 0.6rem;
    background: color-mix(in srgb, var(--bg) 85%, transparent);
    text-align: left;
    cursor: pointer;
    transition: border-color 0.15s;
  }

  .set-tile:hover:not([aria-disabled]) {
    border-color: var(--story-accent);
  }

  .set-tile--latest {
    min-width: 10rem;
    flex-shrink: 0;
    border-color: var(--story-accent);
  }

  .set-tile--unreleased {
    opacity: 0.45;
    cursor: default;
  }

  .tile-name {
    font-weight: 600;
    font-size: 0.9rem;
  }

  .tile-year {
    font-size: 0.78rem;
    color: var(--muted);
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

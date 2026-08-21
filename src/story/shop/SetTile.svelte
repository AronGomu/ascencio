<script lang="ts">
  import type { ShopSetEntry } from "./data/shop-set-data.ts";

  export let set: ShopSetEntry;
  export let imageUrl: string | null;
  /* The same tile shows up twice in one document — once in the latest row and
     once in the all-sets grid — so the caller names which one it is. Every
     `data-cy` below carries the variant, which is what keeps the two copies
     of a set distinguishable (and unique) in the rendered page. */
  export let variant: "set" | "latest";
  export let onselect: () => void;

  /* Set art is a URL by convention rather than a manifest lookup, and a host
     serving the SPA fallback answers a missing image with `200 text/html`
     instead of a 404 — so the status code proves nothing and the failed decode
     is the only honest signal. The failure is remembered as the URL that
     failed, not as a flag, so a tile handed a different set is not still
     hiding art because the set before it had none. */
  let failedArtUrl: string | null = null;
  $: artUrl = imageUrl === failedArtUrl ? null : imageUrl;
</script>

<button
  type="button"
  class="set-tile"
  class:set-tile--latest={variant === "latest"}
  class:set-tile--unreleased={!set.released}
  class:set-tile--illustrated={artUrl !== null}
  aria-disabled={!set.released || undefined}
  data-cy={`story-shop-${variant}-${set.id}`}
  onclick={onselect}
>
  {#if artUrl !== null}
    <img
      class="set-art"
      loading="lazy"
      decoding="async"
      src={artUrl}
      alt=""
      onerror={() => (failedArtUrl = artUrl)}
      data-cy={`story-shop-${variant}-image-${set.id}`}
    />
  {:else}
    <span
      class="set-fallback"
      aria-hidden="true"
      data-cy={`story-shop-${variant}-fallback-${set.id}`}
    ></span>
  {/if}
  <span
    class="tile-caption"
    data-cy={`story-shop-${variant}-caption-${set.id}`}
  >
    <span class="tile-name" data-cy={`story-shop-${variant}-name-${set.id}`}
      >{set.name}</span
    >
    <span class="tile-year" data-cy={`story-shop-${variant}-year-${set.id}`}>
      {set.releaseYear}{#if !set.released}
        🔒{/if}
    </span>
  </span>
</button>

<style>
  /* The 50 packaged set images measure between 0.538 and 0.588 wide-to-tall,
     so one 9:16 face fits them all within a few percent and `contain` keeps
     the odd one out letterboxed rather than cropped. */
  .set-tile {
    display: grid;
    grid-template-areas: "face";
    padding: 0;
    overflow: hidden;
    aspect-ratio: 9 / 16;
    border: 1px solid var(--story-border);
    border-radius: 0.6rem;
    background: color-mix(in srgb, var(--bg) 85%, transparent);
    color: var(--story-text);
    font-weight: 400;
    text-align: left;
    cursor: pointer;
    isolation: isolate;
    transition: border-color 0.15s;
  }

  .set-tile > * {
    grid-area: face;
    min-width: 0;
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

  .set-art {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .set-fallback {
    width: 100%;
    height: 100%;
    background: linear-gradient(
      145deg,
      color-mix(in srgb, var(--story-accent) 18%, transparent),
      transparent 55%
    );
  }

  .tile-caption {
    display: flex;
    align-self: end;
    flex-direction: column;
    gap: 0.2rem;
    padding: 0.5rem 0.6rem;
  }

  /* Over art the caption is a legible strip; on a typographic tile there is
     nothing to sit on, so the name is the tile. */
  .set-tile--illustrated .tile-caption {
    background: linear-gradient(
      to top,
      color-mix(in srgb, var(--shadow) 88%, transparent),
      transparent
    );
  }

  .set-tile:not(.set-tile--illustrated) .tile-caption {
    align-self: center;
    text-align: center;
  }

  .set-tile:not(.set-tile--illustrated) .tile-name {
    font-size: 1.05rem;
  }

  .tile-name {
    display: -webkit-box;
    overflow: hidden;
    font-size: 0.9rem;
    font-weight: 600;
    line-height: 1.2;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
    line-clamp: 3;
  }

  .tile-year {
    font-size: 0.78rem;
    color: var(--muted);
  }
</style>

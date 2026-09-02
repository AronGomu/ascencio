<script lang="ts">
  import type { DeckTileModel } from "./deck-select-contracts.ts";

  export let tile: DeckTileModel;
  /** Visual selection halo: null = none. Selected focus uses orange (--selected). */
  export let halo: "you" | "opponent" | "focus" | null = null;
  /** Checkmark top-right shown when true. */
  export let selected = false;
  /** "Yours" badge while filling the opponent seat. */
  export let yours = false;
  /** Hide favourite star in seat-card contexts. */
  export let showFavourite = true;
  export let showMenu = true;
  export let disabled = false;
  export let onpress: () => void = () => undefined;
  export let ondblpress: () => void = () => undefined;
  export let onfavourite: (favourite: boolean) => void = () => undefined;
  /** Kebab pressed; anchor element passed so the menu (T13) can position. */
  export let onmenu: (anchor: HTMLElement) => void = () => undefined;
  /** Identity every `data-cy` here is built from; null uses the deck's key.
      One deck can render twice in a document — the grid tile and the seat card
      showing the same pick — and the element contract wants one value each. */
  export let cyKey: string | null = null;

  /* Built in the script rather than interpolated three times in the markup:
     the stats line is one sentence, and formatter whitespace around `{…}`
     would land inside it. */
  $: countsLine = `Main ${tile.counts.main} · Extra ${tile.counts.extra} · Side ${tile.counts.side}`;
  /* A deck that fails validation cannot be picked, so the press surface itself
     carries the fact — the dimming is the sighted echo, never the source. */
  let failedArtUrls: readonly string[] = [];
  $: fullCardFallbackUrl =
    tile.coverImageUrl?.replace(
      "/runtime/images-cropped/",
      "/runtime/images/",
    ) ?? null;
  $: artUrl =
    tile.coverImageUrl !== null && !failedArtUrls.includes(tile.coverImageUrl)
      ? tile.coverImageUrl
      : fullCardFallbackUrl !== null &&
          !failedArtUrls.includes(fullCardFallbackUrl)
        ? fullCardFallbackUrl
        : null;
  $: pressDisabled = disabled || !tile.legal;
  $: cyId = cyKey ?? tile.key;
</script>

<article
  class="deck-tile"
  class:halo-you={halo === "you"}
  class:halo-opponent={halo === "opponent"}
  class:halo-focus={halo === "focus"}
  class:is-default={tile.isDefault}
  class:illegal={!tile.legal}
  data-cy={`deck-tile-${cyId}`}
>
  <button
    type="button"
    class="press"
    disabled={pressDisabled}
    onclick={() => onpress()}
    ondblclick={() => ondblpress()}
    data-cy={`deck-tile-press-${cyId}`}
  >
    {#if artUrl !== null}
      <img
        class="art"
        loading="lazy"
        decoding="async"
        src={artUrl}
        alt=""
        onerror={() =>
          artUrl !== null && (failedArtUrls = [...failedArtUrls, artUrl])}
        data-cy={`deck-tile-art-${cyId}`}
      />
    {:else}
      <!-- Authored geometry rather than a packaged asset: a deck with no cover
           card still has to fill the whole tile behind its content. -->
      <svg
        class="art"
        viewBox="0 0 200 100"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
        data-cy={`deck-tile-art-placeholder-${cyId}`}
      >
        <rect
          class="art-field"
          width="200"
          height="100"
          data-cy={`deck-tile-art-field-${cyId}`}
        />
        <path
          class="art-sigil"
          d="M140 18 L178 50 L140 82 L102 50 Z"
          data-cy={`deck-tile-art-sigil-${cyId}`}
        />
      </svg>
    {/if}
    <span class="name text-backdrop" data-cy={`deck-tile-name-${cyId}`}
      >{tile.name}</span
    >
    <span class="body text-backdrop" data-cy={`deck-tile-body-${cyId}`}>
      <span class="counts" data-cy={`deck-tile-counts-${cyId}`}
        >{countsLine}</span
      >
      <span class="meta" data-cy={`deck-tile-meta-${cyId}`}>{tile.meta}</span>
      <span class="badges" data-cy={`deck-tile-badges-${cyId}`}>
        {#if tile.isDefault}
          <span
            class="badge badge-default"
            data-cy={`deck-tile-badge-default-${cyId}`}>Default</span
          >
        {/if}
        {#if !tile.legal}
          <span
            class="badge badge-illegal"
            data-cy={`deck-tile-badge-illegal-${cyId}`}>Illegal</span
          >
        {/if}
        {#if tile.bundled}
          <span class="badge" data-cy={`deck-tile-badge-bundled-${cyId}`}
            >Bundled</span
          >
        {/if}
        {#if tile.lockedBy !== null}
          <span class="badge" data-cy={`deck-tile-badge-locked-${cyId}`}
            >🔒 {tile.lockedBy}</span
          >
        {/if}
        {#if yours}
          <span class="badge" data-cy={`deck-tile-badge-yours-${cyId}`}
            >Yours</span
          >
        {/if}
      </span>
    </span>
  </button>

  {#if tile.isDefault}
    <span
      class="corner star"
      aria-label={`Default deck: ${tile.name}`}
      data-cy={`deck-tile-default-star-${cyId}`}>★</span
    >
  {:else if showFavourite}
    <!-- Its own button outside the press surface, so the star stays reachable
         by keyboard and a press on it never picks the deck. -->
    <button
      type="button"
      class="corner star"
      aria-pressed={tile.favourite}
      aria-label={`Favourite ${tile.name}`}
      onclick={(event) => {
        event.stopPropagation();
        onfavourite(!tile.favourite);
      }}
      data-cy={`deck-tile-fav-${cyId}`}>{tile.favourite ? "★" : "☆"}</button
    >
  {/if}

  {#if selected}
    <span class="corner check" data-cy={`deck-tile-check-${cyId}`}>✓</span>
  {/if}

  {#if showMenu}
    <button
      type="button"
      class="corner kebab"
      aria-label={`Actions for ${tile.name}`}
      onclick={(event) => {
        event.stopPropagation();
        onmenu(event.currentTarget);
      }}
      data-cy={`deck-tile-menu-${cyId}`}>⋮</button
    >
  {/if}
</article>

<style>
  .deck-tile {
    --corner-size: 2.75rem;
    --deck-tile-body-height: calc(
      var(--corner-size) + var(--corner-size) + var(--space-2)
    );
    --deck-tile-body-width: calc(
      100% - var(--corner-size) - var(--space-2) - var(--space-2) -
        var(--space-2)
    );

    position: relative;
    display: grid;
    width: 100%;
    min-width: 0;
    aspect-ratio: 1 / 1;
    overflow: hidden;
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--surface-raised);
    isolation: isolate;
  }

  .press {
    display: grid;
    grid-template-areas: "tile";
    grid-template-rows: minmax(0, 1fr);
    width: 100%;
    height: 100%;
    padding: 0;
    border: 0;
    color: inherit;
    background: none;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .press > * {
    grid-area: tile;
    min-width: 0;
  }

  .press:disabled {
    cursor: default;
  }

  .art {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center;
    opacity: 0.75;
  }

  .art-field {
    fill: var(--surface-panel);
  }

  .art-sigil {
    fill: color-mix(in srgb, var(--accent) 22%, transparent);
  }

  .body {
    z-index: 1;
    display: flex;
    box-sizing: border-box;
    width: var(--deck-tile-body-width);
    height: var(--deck-tile-body-height);
    flex-direction: column;
    align-self: end;
    justify-self: start;
    gap: var(--space-1);
    margin: var(--space-2);
    padding: var(--space-2);
    overflow: hidden;
  }

  .name {
    z-index: 1;
    display: -webkit-box;
    max-width: 70%;
    margin: var(--space-2);
    padding: var(--space-1) var(--space-2);
    overflow: hidden;
    align-self: start;
    justify-self: start;
    font-size: 1rem;
    font-weight: 650;
    line-height: 1.15;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
  }

  .text-backdrop {
    border-radius: var(--radius-sm);
    background: color-mix(in srgb, var(--shadow) 65%, transparent);
  }

  .name,
  .counts,
  .meta,
  .badge {
    text-shadow:
      0 1px 2px var(--shadow),
      0 0 0.4rem var(--shadow);
  }

  .counts,
  .meta {
    overflow: hidden;
    color: var(--muted);
    font-size: var(--text-xs);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .badges {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1);
  }

  .badge {
    padding: 0 0.3rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    color: var(--muted);
    font-size: var(--text-xs);
  }

  .badge-default {
    border-color: var(--selected);
    color: var(--selected);
  }

  .badge-illegal {
    border-color: var(--danger);
    color: var(--danger);
  }

  .corner {
    position: absolute;
    z-index: 2;
    display: grid;
    width: var(--corner-size);
    height: var(--corner-size);
    place-items: center;
    padding: 0;
    border: 0;
    border-radius: var(--radius-sm);
    color: var(--text);
    background: color-mix(in srgb, var(--shadow) 55%, transparent);
    font-size: var(--text-sm);
    line-height: 1;
  }

  .star {
    top: var(--space-2);
    left: var(--space-2);
  }

  button.star {
    top: auto;
    right: var(--space-2);
    bottom: calc(var(--space-2) + var(--corner-size) + var(--space-2));
    left: auto;
    cursor: pointer;
  }

  .star[aria-pressed="true"],
  .star:not(button) {
    color: var(--selected);
  }

  .check {
    top: var(--space-2);
    right: var(--space-2);
    color: var(--selected);
  }

  .kebab {
    right: var(--space-2);
    bottom: var(--space-2);
    cursor: pointer;
  }

  .deck-tile.halo-you {
    border-color: var(--seat-you);
    box-shadow: 0 0 0.55rem color-mix(in srgb, var(--seat-you) 55%, transparent);
  }

  .deck-tile.halo-opponent {
    border-color: var(--seat-opponent);
    box-shadow: 0 0 0.55rem
      color-mix(in srgb, var(--seat-opponent) 55%, transparent);
  }

  .deck-tile.halo-focus {
    border-color: var(--selected);
    box-shadow: 0 0 0.55rem color-mix(in srgb, var(--selected) 65%, transparent);
  }

  /* Last on purpose: the gold hairline marks the scope's default deck whatever
     is picked right now, so it takes the border from any halo while leaving
     that halo's glow — the thing that says "this is the current pick" — alone. */
  .deck-tile.is-default {
    border-color: var(--selected);
  }

  .deck-tile.illegal {
    opacity: 0.55;
  }
</style>

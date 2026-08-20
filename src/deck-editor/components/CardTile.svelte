<script lang="ts">
  import type { DeckBuilderCardView } from "../../decks/catalog/ocg-card-mapper.ts";

  export let card: DeckBuilderCardView | null;
  export let code: number;
  export let limit: 0 | 1 | 2 | 3 = 3;
  export let currentCopies = 0;
  export let selected = false;
  export let draggable = true;
  export let compact = false;
  export let zone: string | null = null;
  export let onselect: () => void = () => undefined;
  /* Touch reuses the tile itself as the gesture: where a tap means something
     other than "show me this card", the pane hands in that meaning. `null`
     keeps the pointer/keyboard model exactly as it is. */
  export let ontap: (() => void) | null = null;
  export let ondragcard: (event: DragEvent) => void = () => undefined;
  export let ondragcancel: () => void = () => undefined;
  export let onhover: (() => void) | null = null;
  export let oncontext: (() => void) | null = null;
  export let maxed = false;

  $: name = card?.name ?? `Missing card ${code}`;
  $: limitLabel =
    limit === 0
      ? "Forbidden"
      : limit === 1
        ? "Limited"
        : limit === 2
          ? "Semi-Limited"
          : "Unlimited";
</script>

<button
  type="button"
  class:compact
  class:selected
  class:missing={card === null}
  class:maxed
  class="card-tile"
  {draggable}
  aria-label={`${name}. ${limitLabel}, maximum ${limit}. ${currentCopies} copies in deck.`}
  aria-pressed={selected}
  data-cy={`deck-tile-${code}`}
  data-card-code={code}
  data-deck-zone={zone}
  onclick={() => (ontap === null ? onselect() : ontap())}
  onmouseenter={() => onhover?.()}
  ondragstart={ondragcard}
  ondragend={ondragcancel}
  oncontextmenu={(event) => {
    if (oncontext !== null) {
      event.preventDefault();
      oncontext();
    }
  }}
>
  <span
    class={`limit-badge limit-${limit}`}
    aria-hidden="true"
    data-cy={`deck-tile-limit-${code}`}>{limit}</span
  >
  {#if card?.imageUrl}
    <img
      class="card-art"
      loading="lazy"
      decoding="async"
      src={card.imageUrl}
      alt=""
      data-cy={`deck-tile-image-${code}`}
    />
  {:else}
    <span
      class="art-placeholder"
      aria-hidden="true"
      data-cy={`deck-tile-art-${code}`}
    >
      <span data-cy={`deck-tile-art-glyph-${code}`}
        >{card === null ? "!" : card.family.slice(0, 1).toUpperCase()}</span
      >
    </span>
  {/if}
  <span
    class="card-name"
    class:overlay={card?.imageUrl != null}
    data-cy={`deck-tile-name-${code}`}>{name}</span
  >
</button>

<style>
  .card-tile {
    position: relative;
    display: grid;
    grid-template-areas: "card";
    width: 100%;
    min-width: 0;
    min-height: 0;
    aspect-ratio: 59 / 86;
    padding: 0;
    overflow: hidden;
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: 0.38rem;
    background: var(--surface-raised);
    font-weight: 650;
    isolation: isolate;
  }

  .card-tile > * {
    grid-area: card;
    min-width: 0;
  }

  .card-art {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center;
  }

  .card-tile:hover:not(:disabled),
  .card-tile.selected {
    border-color: var(--accent);
    background: var(--surface-highlight);
  }

  .card-tile.missing {
    border-style: dashed;
    border-color: var(--danger);
    background: var(--danger-surface);
  }

  .card-tile.maxed {
    border-color: var(--danger);
  }

  .card-tile.maxed:hover:not(:disabled) {
    border-color: var(--danger);
    background: var(--danger-surface);
  }

  .art-placeholder {
    display: grid;
    width: 100%;
    height: 100%;
    min-height: 0;
    place-items: center;
    background:
      linear-gradient(
        145deg,
        color-mix(in srgb, var(--accent) 16%, transparent),
        transparent 52%
      ),
      var(--surface-panel);
    font-size: clamp(1rem, 2vw, 2rem);
  }

  .missing .art-placeholder {
    background: var(--danger-surface);
  }

  .card-name {
    display: -webkit-box;
    align-self: end;
    min-height: 2.1rem;
    padding: 0.3rem;
    overflow: hidden;
    font-size: clamp(0.56rem, 0.72vw, 0.74rem);
    line-height: 1.15;
    text-align: left;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
  }

  .card-name.overlay {
    background: linear-gradient(
      to top,
      color-mix(in srgb, var(--shadow) 88%, transparent),
      transparent
    );
    color: var(--text);
  }

  .compact .card-name {
    font-size: 0.58rem;
  }

  .limit-badge {
    position: absolute;
    z-index: 1;
    top: 0.22rem;
    left: 0.22rem;
    display: grid;
    width: 1.35rem;
    height: 1.35rem;
    place-items: center;
    border: 2px solid currentColor;
    border-radius: 999px;
    color: var(--bg);
    background: var(--text);
    font-size: 0.72rem;
    font-weight: 900;
  }

  .limit-0 {
    color: var(--ink);
    background: var(--danger-border);
  }

  .limit-1 {
    background: var(--danger);
  }

  .limit-2 {
    background: var(--selected);
  }

  .limit-3 {
    background: var(--accent);
  }
</style>

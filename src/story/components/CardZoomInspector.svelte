<script lang="ts">
  /** One card, magnified over the screen it was pointed at, with its text
      floating beside it. `feedback-vn.md`, Card Reveal item 3.

      Not the docked `CardPreviewPanel`: that one owns a column of a layout and
      is always there, this one is transient decoration with no reserved space,
      for the screens that have no column to spare. It renders the card through
      the same `StoryCardTile` every other story surface uses, so the zoom is
      the card the player was already looking at, only bigger.

      Presentation only. It reads a rectangle and a card and draws; the screen
      above it decides which card is pointed at, and — because a hover-only
      affordance is unreachable on a touch screen and by keyboard — is expected
      to mount this on focus as well. Nothing here takes the pointer or the
      focus: the root is `pointer-events: none`, so a card underneath keeps
      every event, including the `mouseleave` that ends the hover. */
  import type { DeckBuilderCardView } from "../../decks/catalog/ocg-card-mapper.ts";
  import type { ShopRarity } from "../model/story-state.ts";
  import StoryCardTile from "./StoryCardTile.svelte";
  import {
    placeZoomWindow,
    placeZoomedCard,
    ZOOM_VIEWPORT_GUTTER,
    type ZoomRect,
  } from "./zoom-window-position.ts";

  export let card: DeckBuilderCardView;
  /** The card the zoom grew out of, in viewport pixels — a
      `getBoundingClientRect()` of the art itself rather than of the labelled
      tile around it, so the magnified box keeps the card's proportions and the
      whole card still fits inside the halo. */
  export let anchor: ZoomRect;
  /** `null` where the screen has no rarity to tell, which keeps the halo off
      rather than drawing a colourless one. */
  export let rarity: ShopRarity | null = null;
  export let scale = 2;

  /* The window's width is declared rather than measured, so the flip is decided
     before the first paint: a window that measured itself would have to render
     on the wrong side once to find out. Keeping it a constant is also what keeps
     the measure below from feeding back — placement can move the window, and a
     move cannot change how tall the text wraps.

     Its height is measured, because that is the text's to decide, and only the
     bottom-edge clamp reads it. */
  const WINDOW_WIDTH = 260;

  /* Seeded from the window rather than left at zero, so the first paint places
     against the real viewport; the binding keeps it true across a resize. */
  let viewportWidth = globalThis.innerWidth;
  let viewportHeight = globalThis.innerHeight;
  let windowHeight = 0;

  $: viewport = { width: viewportWidth, height: viewportHeight };
  $: zoom = placeZoomedCard(anchor, viewport, scale);
  $: placement = placeZoomWindow(zoom, viewport, {
    width: WINDOW_WIDTH,
    height: windowHeight,
  });
  $: cardStyle = `left: ${zoom.left}px; top: ${zoom.top}px; width: ${zoom.width}px; height: ${zoom.height}px;`;
  /* The cap is what keeps the very first paint honest: the height is only known
     after the window has been measured once, so until then the clamp above has
     nothing to clamp, and a tall window would hang off the bottom for a frame.
     Room-below-the-top-edge is knowable immediately and bounds it either way. */
  $: windowStyle = `left: ${placement.left}px; top: ${placement.top}px; width: ${WINDOW_WIDTH}px; max-height: ${viewportHeight - placement.top - ZOOM_VIEWPORT_GUTTER}px;`;
  $: stats = monsterStatsLine(card);

  /** Attribute, race, rating and the battle numbers, in the duel's own order
      and separator. A spell or trap has none of them and gets no row at all —
      its card kind is legible on the magnified card itself. */
  function monsterStatsLine(view: DeckBuilderCardView): string | null {
    if (view.family !== "monster") return null;
    const parts: string[] = [];
    if (view.attribute !== null) parts.push(view.attribute);
    if (view.race !== null) parts.push(view.race);
    if (view.ratingLabel !== null && view.levelRankLink !== null)
      parts.push(`${view.ratingLabel} ${view.levelRankLink}`);
    if (view.attack !== null)
      parts.push(
        view.defense === null
          ? `ATK ${battleValue(view.attack)}`
          : `ATK ${battleValue(view.attack)} / DEF ${battleValue(view.defense)}`,
      );
    return parts.length > 0 ? parts.join(" \u00b7 ") : null;
  }

  /** The OCG spells `?` as a negative number, which is what the duel's own
      stats line renders as `?` too — the same card must not read `ATK ?` in a
      duel and `ATK -2` here. */
  function battleValue(value: number): string {
    return value < 0 ? "?" : String(value);
  }
</script>

<svelte:window
  bind:innerWidth={viewportWidth}
  bind:innerHeight={viewportHeight}
/>

<!-- Decoration, and marked as such: it repeats the name the card underneath
     already carries, and it is put up by a pointer or by focus moving, neither
     of which a screen-reader reading order follows. The screen that mounts it
     owns the non-visual path to the same text. -->
<div
  class="card-zoom-inspector"
  data-cy="card-zoom-inspector"
  aria-hidden="true"
>
  <div
    class="card-zoom-inspector__card rarity-halo"
    data-cy="card-zoom-inspector-card"
    data-rarity={rarity}
    style={cardStyle}
  >
    <StoryCardTile
      name={card.name}
      imageUrl={card.imageUrl}
      dataCyPrefix="card-zoom-inspector"
      dataCyId={card.code}
    />
  </div>
  <div
    class="card-zoom-inspector__window"
    data-cy="card-zoom-inspector-window"
    data-side={placement.side}
    style={windowStyle}
    bind:clientHeight={windowHeight}
  >
    <p class="card-zoom-inspector__name" data-cy="card-zoom-inspector-name">
      {card.name}
    </p>
    {#if stats !== null}
      <p class="card-zoom-inspector__stats" data-cy="card-zoom-inspector-stats">
        {stats}
      </p>
    {/if}
    <p class="card-zoom-inspector__text" data-cy="card-zoom-inspector-text">
      {card.description}
    </p>
  </div>
</div>

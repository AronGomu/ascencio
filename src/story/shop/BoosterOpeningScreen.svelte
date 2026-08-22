<script lang="ts">
  /** A pack, face down, one card per tile. `feedback-vn.md`, Card Reveal
      items 1 and 2.

      The screen used to be a counter: one click anywhere turned the next card
      over, wherever the pointer was. The pack is the moment the shop exists
      for, so every card is on screen from the start and the player decides
      which one to turn — or ticks the box and watches the pack open itself.

      Presentation only. Which cards a pack holds was decided before this
      screen mounted; nothing here can change a pull, and the flip state is
      deliberately component-local — a reload during a reveal is the reveal
      starting over, not a save migration. */
  import { onDestroy } from "svelte";
  import CardZoomInspector from "../components/CardZoomInspector.svelte";
  import StoryCardTile from "../components/StoryCardTile.svelte";
  import type { ZoomRect } from "../components/zoom-window-position.ts";
  import {
    createStoryPlaybackSettingsStore,
    type StoryPlaybackSettingsStore,
  } from "../playback/story-playback-settings-store.ts";
  import { createAutoFlip, type AutoFlip } from "./auto-flip.ts";
  import { PACK_SIZE } from "./data/shop-pricing.ts";
  import type { DeckBuilderCardView } from "../../decks/catalog/ocg-card-mapper.ts";
  import type { ShopRarity } from "../model/story-state.ts";

  export let cards: readonly {
    readonly code: number;
    readonly name: string;
    readonly imageUrl: string | null;
    readonly rarity: ShopRarity;
    /** The catalog's whole card, for the zoom that reads out its effect text.
        Optional and nullable because the pull is known before the catalog is:
        without it the tile still turns over, it just cannot be magnified. */
    readonly view?: DeckBuilderCardView | null;
  }[] = [];
  export let onfinish: () => void = () => undefined;
  /** Handed in by the story app so the whole domain shares one owner of the
      reader's preferences; defaulted for a standalone render, the way the
      settings overlay defaults it. */
  export let settings: StoryPlaybackSettingsStore =
    createStoryPlaybackSettingsStore();

  let flipped: boolean[] = [];
  /* The art boxes, so the zoom can grow out of the card rather than out of the
     labelled tile around it — the frame keeps the card's proportions only if
     the rectangle it was measured from had them. */
  let artElements: (HTMLElement | null)[] = [];
  let pointed: number | null = null;
  let pointedAnchor: ZoomRect | null = null;
  let autoFlip: AutoFlip | null = null;
  let packKey = "";

  /* Keyed on which cards are in hand rather than on the array's identity: the
     shop rebuilds its card list whenever anything else about the save changes,
     and a half-revealed pack must not turn back over because the catalog
     finished loading behind it. */
  $: syncPack(cards.map((card) => card.code).join("-"));
  $: syncAutoRun($settings.autoFlip);
  $: flippedCount = flipped.filter(Boolean).length;
  $: packCount = Math.ceil(cards.length / PACK_SIZE);
  $: currentPack = Math.min(
    Math.floor(flippedCount / PACK_SIZE) + 1,
    packCount,
  );
  /* Face down, the magnified card would be the face the halo is standing in
     for, so the zoom waits for the flip the halo advertises. */
  $: zoomIndex = pointed !== null && flipped[pointed] === true ? pointed : null;
  $: zoomCard = zoomIndex === null ? null : (cards[zoomIndex]?.view ?? null);
  $: zoomRarity =
    zoomIndex === null ? null : (cards[zoomIndex]?.rarity ?? null);

  onDestroy(() => autoFlip?.stop());

  function syncPack(key: string): void {
    if (key === packKey) return;
    packKey = key;
    flipped = cards.map(() => false);
    pointed = null;
    pointedAnchor = null;
    autoFlip?.stop();
    autoFlip = createAutoFlip({ total: cards.length, onFlip: flip });
    if ($settings.autoFlip) autoFlip.start();
  }

  function syncAutoRun(on: boolean): void {
    if (on) autoFlip?.start();
    else autoFlip?.stop();
  }

  /* Idempotent, because the two ways to turn a card over overlap: the clock
     walks the pack left to right whatever the player has already clicked. */
  function flip(index: number): void {
    if (flipped[index] !== false) return;
    flipped[index] = true;
  }

  function point(index: number): void {
    pointed = index;
    pointedAnchor = rectOf(artElements[index] ?? null);
  }

  /* Guarded by which card is leaving: the pointer moving from one tile to the
     next fires the new tile's enter before the old tile's leave, and an
     unguarded reset would drop the zoom that had just been put up. */
  function unpoint(index: number): void {
    if (pointed !== index) return;
    pointed = null;
    pointedAnchor = null;
  }

  function rectOf(element: HTMLElement | null): ZoomRect | null {
    if (element === null) return null;
    const { left, top, width, height } = element.getBoundingClientRect();
    return { left, top, width, height };
  }
</script>

<main class="opening-screen" data-cy="story-shop-opening">
  <header class="opening-header" data-cy="story-shop-opening-header">
    <p class="progress" data-cy="story-shop-opening-progress">
      Pack {currentPack} of {packCount}
    </p>
    <label class="auto-flip" data-cy="story-shop-opening-auto-flip-field"
      ><input
        aria-label="Flip the cards for me"
        type="checkbox"
        data-cy="story-shop-opening-auto-flip"
        checked={$settings.autoFlip}
        onchange={(event) => settings.setAutoFlip(event.currentTarget.checked)}
      /> Flip them for me</label
    >
  </header>

  <div class="revealed-grid" data-cy="story-shop-opening-grid">
    {#each cards as card, index (index)}
      <button
        type="button"
        class="opening-tile rarity-halo"
        class:is-flipped={flipped[index]}
        data-cy={`story-shop-opening-card-${index}`}
        data-rarity={pointed === index ? card.rarity : null}
        aria-label={flipped[index]
          ? null
          : `Reveal card ${index + 1}, ${card.rarity}`}
        onclick={() => flip(index)}
        onmouseenter={() => point(index)}
        onmouseleave={() => unpoint(index)}
        onfocus={() => point(index)}
        onblur={() => unpoint(index)}
      >
        <span
          class="tile-art"
          data-cy={`story-shop-opening-frame-${index}`}
          bind:this={artElements[index]}
        >
          <span
            class="face card-back"
            aria-hidden="true"
            data-cy={`story-shop-opening-back-${index}`}
          ></span>
          <span
            class="face card-front"
            data-cy={`story-shop-opening-front-${index}`}
          >
            {#if flipped[index]}
              <StoryCardTile
                name={card.name}
                imageUrl={card.imageUrl}
                dataCyPrefix="story-shop-opening"
                dataCyId={index}
              />
            {/if}
          </span>
        </span>
        {#if flipped[index]}
          <span
            class="opening-name"
            data-cy={`story-shop-opening-name-${index}`}>{card.name}</span
          >
        {/if}
      </button>
    {/each}
  </div>

  {#if flippedCount >= cards.length && cards.length > 0}
    <div class="opening-actions" data-cy="story-shop-opening-actions">
      <button
        type="button"
        data-cy="story-shop-opening-finish"
        onclick={onfinish}>See results</button
      >
    </div>
  {/if}

  <button
    type="button"
    class="secondary skip-btn"
    data-cy="story-shop-opening-skip"
    onclick={onfinish}>Skip</button
  >

  {#if zoomCard !== null && pointedAnchor !== null}
    <CardZoomInspector
      card={zoomCard}
      anchor={pointedAnchor}
      rarity={zoomRarity}
    />
  {/if}
</main>

<style>
  .opening-screen {
    min-height: 100svh;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    /* The owner asked for the row to take the whole width: the frame around it
       is the smallest one that still keeps the cards off the screen edge. */
    padding: clamp(0.5rem, 1.5vw, 1rem);
    background:
      radial-gradient(circle at 50% 10%, var(--field-glow), transparent 40%),
      var(--bg);
    user-select: none;
  }
  .opening-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }
  .progress {
    font-size: 1.1rem;
    font-weight: 700;
    margin: 0;
  }
  .auto-flip {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.85rem;
    font-weight: 600;
  }
  .auto-flip input {
    width: 1.25rem;
    height: 1.25rem;
  }
  .revealed-grid {
    flex: 1;
    display: grid;
    /* One column below the desktop breakpoint, which is the owner's scrollable
       mobile column; the nine-across row is the media query at the bottom. */
    grid-template-columns: minmax(0, 1fr);
    gap: 0.5rem;
    justify-content: center;
    justify-items: center;
    /* `safe`: a column of nine taller than the viewport scrolls from its top
       rather than centring its overflow out of reach. */
    align-content: safe center;
    overflow-y: auto;
  }
  .opening-tile {
    width: 100%;
    /* Uncapped, a single column would draw one card the width of a tablet. */
    max-width: min(100%, 22rem);
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    padding: 0.4rem;
    border: 1px solid var(--story-border);
    border-radius: 0.5rem;
    background: color-mix(in srgb, var(--bg) 85%, transparent);
    color: inherit;
    font: inherit;
    text-align: center;
    cursor: pointer;
    perspective: 900px;
  }
  .tile-art {
    position: relative;
    display: block;
    width: 100%;
    aspect-ratio: 421 / 614;
    transform-style: preserve-3d;
  }
  .opening-tile.is-flipped .tile-art {
    transform: rotateY(180deg);
  }
  .face {
    position: absolute;
    inset: 0;
    display: block;
    backface-visibility: hidden;
    border-radius: 0.3rem;
    overflow: hidden;
  }
  .card-back {
    background:
      repeating-linear-gradient(
        45deg,
        color-mix(in srgb, var(--accent) 22%, transparent) 0 6px,
        transparent 6px 12px
      ),
      color-mix(in srgb, var(--muted) 30%, transparent);
    border: 2px solid var(--story-border);
  }
  /* Pre-turned, so the half-turn that shows it lands on the card the right way
     round rather than mirrored. */
  .card-front {
    transform: rotateY(180deg);
  }
  .opening-name {
    font-size: 0.6rem;
    font-weight: 600;
    line-height: 1.2;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .opening-actions {
    display: flex;
    justify-content: center;
    padding: 0.5rem 0;
  }
  .skip-btn {
    align-self: flex-end;
  }
  /* Switched on only for a reader who has not asked for less motion, rather
     than switched off again afterwards: the story's blanket `reduce` block
     already zeroes durations, so a branch the other way round would be dead
     CSS. The pacing of an auto-flip run is a timer and is untouched by either. */
  @media (prefers-reduced-motion: no-preference) {
    .tile-art {
      transition: transform 420ms ease;
    }
    .opening-tile {
      transition: box-shadow 220ms ease;
    }
  }
  @media (min-width: 1024px) {
    .revealed-grid {
      grid-template-columns: repeat(9, minmax(0, 1fr));
    }
  }
</style>

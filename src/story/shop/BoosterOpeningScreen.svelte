<script lang="ts">
  /** A pack, face down, one card per tile. `feedback-vn.md`, Card Reveal
      items 1 and 2.

      The screen used to be a counter: one click anywhere turned the next card
      over, wherever the pointer was. The pack is the moment the shop exists
      for, so every card is on screen from the start and the player decides
      which one to turn — or ticks the box and watches the pack open itself.

      One pack at a time, however many were bought: "you open 1 booster at a
      time and there is an open all option to open all remaining boosters".
      Nine tiles is a pack; the rest wait behind Next pack, or are handed over
      uncounted to the results list by Open all remaining.

      One pack on its own gets none of that. Nine tiles is the whole opening,
      so a results list would repeat the screen the player is looking at and
      Skip would lead out of a reveal with nowhere left to go: "Remove the
      button 'See result' or 'skip' if opening only 1 pack. Just have a back
      button."

      Presentation only. Which cards a pack holds was decided before this
      screen mounted; nothing here can change a pull, and the flip state is
      deliberately component-local — a reload during a reveal is the reveal
      starting over, not a save migration. That goes for which pack is open
      too: every card was credited to the collection before this screen
      mounted, so a reveal abandoned halfway loses the ceremony and nothing
      else. */
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
  /** The single pack's one exit. Separate from `onfinish` because it lands
      somewhere else — there is no results list to see, so Back leaves the
      opening outright rather than moving on to the recap. */
  export let onback: () => void = () => undefined;
  /** Handed in by the story app so the whole domain shares one owner of the
      reader's preferences; defaulted for a standalone render, the way the
      settings overlay defaults it. */
  export let settings: StoryPlaybackSettingsStore =
    createStoryPlaybackSettingsStore();

  let packIndex = 0;
  let flipped: boolean[] = [];
  /* The art boxes, so the zoom can grow out of the card rather than out of the
     labelled tile around it — the frame keeps the card's proportions only if
     the rectangle it was measured from had them. */
  let artElements: (HTMLElement | null)[] = [];
  let pointed: number | null = null;
  let pointedAnchor: ZoomRect | null = null;
  let autoFlip: AutoFlip | null = null;
  let openingKey = "";

  /* Keyed on which cards are in hand rather than on the array's identity: the
     shop rebuilds its card list whenever anything else about the save changes,
     and a half-revealed pack must not turn back over — nor jump back to pack
     one — because the catalog finished loading behind it. */
  $: syncOpening(cards.map((card) => card.code).join("-"));
  $: syncAutoRun($settings.autoFlip);
  $: packCount = Math.ceil(cards.length / PACK_SIZE);
  $: packCards = cards.slice(
    packIndex * PACK_SIZE,
    (packIndex + 1) * PACK_SIZE,
  );
  $: flippedCount = flipped.filter(Boolean).length;
  $: packRevealed = packCards.length > 0 && flippedCount >= packCards.length;
  $: onLastPack = packIndex >= packCount - 1;
  /* Face down, the magnified card would be the face the halo is standing in
     for, so the zoom waits for the flip the halo advertises. */
  $: zoomIndex = pointed !== null && flipped[pointed] === true ? pointed : null;
  $: zoomCard =
    zoomIndex === null ? null : (packCards[zoomIndex]?.view ?? null);
  $: zoomRarity =
    zoomIndex === null ? null : (packCards[zoomIndex]?.rarity ?? null);

  onDestroy(() => autoFlip?.stop());

  function syncOpening(key: string): void {
    if (key === openingKey) return;
    openingKey = key;
    packIndex = 0;
    startPack();
  }

  function nextPack(): void {
    if (packIndex + 1 >= packCount) return;
    packIndex += 1;
    startPack();
  }

  /* Sized from `cards` rather than from the derived `packCards`, so a pack
     starts from the same statement that moved to it instead of from whichever
     reactive statement Svelte happens to run next. */
  function startPack(): void {
    const total = Math.max(
      0,
      Math.min(PACK_SIZE, cards.length - packIndex * PACK_SIZE),
    );
    flipped = Array.from({ length: total }, () => false);
    pointed = null;
    pointedAnchor = null;
    autoFlip?.stop();
    autoFlip = createAutoFlip({ total, onFlip: flip });
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
      Pack {packIndex + 1} of {packCount}
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
    <!-- Keyed on the slot rather than on the card, and it has to be: a pack
         draws from its pool with replacement, so the same code twice in nine
         is ordinary — it is why the results list counts copies at all — and
         `(card.code)` throws `each_key_duplicate` on that pack. -->
    {#each packCards as card, index (index)}
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

  {#if packRevealed && packCount > 1}
    <div class="opening-actions" data-cy="story-shop-opening-actions">
      {#if onLastPack}
        <button
          type="button"
          data-cy="story-shop-opening-see-all"
          onclick={onfinish}>See all opened cards</button
        >
      {:else}
        <button
          type="button"
          data-cy="story-shop-opening-next-pack"
          onclick={nextPack}>Next pack</button
        >
        <!-- Straight to the recap, which already holds every card of every
             pack: the packs left are opened, just not one card at a time. -->
        <button
          type="button"
          class="secondary"
          data-cy="story-shop-opening-open-all"
          onclick={onfinish}>Open all remaining</button
        >
      {/if}
    </div>
  {/if}

  <!-- Skip is a way past the packs still to come, so one pack has nothing to
       skip: it gets Back instead, and Back is there from the first frame —
       every card was credited before this screen mounted, so leaving without
       turning any of them over costs the player nothing. -->
  {#if packCount > 1}
    <button
      type="button"
      class="secondary exit-btn"
      data-cy="story-shop-opening-skip"
      onclick={onfinish}>Skip</button
    >
  {:else}
    <button
      type="button"
      class="story-danger exit-btn"
      data-cy="story-shop-opening-back"
      onclick={onback}>← Back</button
    >
  {/if}

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
    gap: 0.75rem;
    padding: 0.5rem 0;
  }
  .exit-btn {
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
    /* Only the turn face-up is a reveal. Next pack resets the same nine tiles,
       and a transition read from the face-down state would spend 420ms
       rotating the last pack's now-empty fronts back over before the new pack
       appeared. A transition is read from the state being moved to, so the
       flip up still animates. */
    .opening-tile:not(.is-flipped) .tile-art {
      transition: none;
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

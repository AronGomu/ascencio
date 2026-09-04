<script lang="ts">
  import mapAsset from "../assets/city-map-placeholder.svg";
  import type { LocationId, StoryLocationState } from "../model/story-state.ts";

  type SelectionOwner = "hover" | "focus" | "tap";

  export let locations: readonly StoryLocationState[] = [];
  export let returnLabel = "Dialog";
  export let onselect: (id: LocationId) => void = () => undefined;
  export let onreturn: () => void = () => undefined;

  const details: Record<
    LocationId,
    {
      readonly name: string;
      readonly marker: string;
      readonly summary: string;
      readonly lockedReason?: string;
      readonly x: string;
      readonly y: string;
      readonly popoverX: string;
      readonly popoverY: string;
    }
  > = {
    "old-arena": {
      name: "Old Arena",
      marker: "battle",
      summary: "A dormant transmitter is staging an unanswered duel.",
      x: "29%",
      y: "55%",
      popoverX: "35%",
      popoverY: "32%",
    },
    archive: {
      name: "Archive",
      marker: "story",
      summary: "Signal records from the first city tournament.",
      lockedReason: "Requires decoded arena signal.",
      x: "74%",
      y: "34%",
      popoverX: "48%",
      popoverY: "7%",
    },
    "hidden-gate": {
      name: "Hidden Gate",
      marker: "story",
      summary: "Reviewer-only hidden location.",
      x: "52%",
      y: "25%",
      popoverX: "55%",
      popoverY: "30%",
    },
    "card-shop": {
      name: "Card Shop",
      marker: "shop",
      summary: "Packs, singles, and a keeper who knows every reprint.",
      x: "62%",
      y: "72%",
      popoverX: "37%",
      popoverY: "48%",
    },
  };

  let selectedId: LocationId | null = null;
  let selectionOwner: SelectionOwner | null = null;
  let lastPointerType: string | null = null;
  $: visibleLocations = locations.filter(({ access }) => access !== "hidden");
  $: selectedLocation =
    selectedId === null
      ? null
      : (visibleLocations.find(({ id }) => id === selectedId) ?? null);
  $: if (selectedId !== null && selectedLocation === null) closeSelection();

  function label(location: StoryLocationState): string {
    const detail = details[location.id];
    return `${detail.name}, ${detail.marker} marker, ${location.access}${location.completed ? ", completed" : ", not completed"}`;
  }

  function popoverId(id: LocationId): string {
    return `story-map-popover-content-${id}`;
  }

  function select(location: StoryLocationState, owner: SelectionOwner): void {
    selectedId = location.id;
    selectionOwner = owner;
  }

  function closeSelection(): void {
    selectedId = null;
    selectionOwner = null;
  }

  function handlePointerEnter(
    event: PointerEvent,
    location: StoryLocationState,
  ): void {
    if (event.pointerType !== "touch") select(location, "hover");
  }

  function handlePointerLeave(location: StoryLocationState): void {
    if (selectionOwner === "hover" && selectedId === location.id)
      closeSelection();
  }

  function handlePointerDown(event: PointerEvent): void {
    lastPointerType = event.pointerType;
  }

  function handleFocus(location: StoryLocationState): void {
    if (lastPointerType !== "touch") select(location, "focus");
  }

  function handleBlur(location: StoryLocationState): void {
    if (selectionOwner === "focus" && selectedId === location.id)
      closeSelection();
  }

  function handleClick(event: MouseEvent, location: StoryLocationState): void {
    const pointerType =
      "pointerType" in event && typeof event.pointerType === "string"
        ? event.pointerType
        : lastPointerType;
    if (pointerType === "touch") {
      if (
        selectedId === location.id &&
        selectionOwner === "tap" &&
        location.access === "available"
      )
        onselect(location.id);
      else select(location, "tap");
    } else if (location.access === "available") onselect(location.id);
    else if (selectedId !== location.id)
      select(location, selectionOwner ?? "focus");
    lastPointerType = null;
  }

  function handleDocumentClick(event: MouseEvent): void {
    if (selectionOwner !== "tap" || !(event.target instanceof Element)) return;
    if (event.target.closest(".hotspot, .map-popover") === null)
      closeSelection();
  }

  function handleDocumentKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape") closeSelection();
  }
</script>

<svelte:document
  onclick={handleDocumentClick}
  onkeydown={handleDocumentKeydown}
/>

<section
  class="map-screen"
  aria-label="City signal map"
  data-cy="story-map-screen"
>
  <div class="map-art" data-cy="story-map-art">
    <img
      src={mapAsset}
      alt="Illustrated city map of the river district"
      data-cy="story-map-image"
    />
    <div
      class="hotspots"
      aria-label="Map hotspots"
      data-cy="story-map-hotspots"
    >
      {#each visibleLocations as location (location.id)}
        <button
          type="button"
          class:locked={location.access === "locked"}
          class:completed={location.completed}
          class:selected={selectedId === location.id}
          class="hotspot"
          style:left={details[location.id].x}
          style:top={details[location.id].y}
          data-location-id={location.id}
          data-cy={`story-map-hotspot-${location.id}`}
          aria-label={label(location)}
          aria-disabled={location.access !== "available"}
          aria-pressed={selectedId === location.id}
          aria-describedby={selectedId === location.id
            ? popoverId(location.id)
            : undefined}
          onpointerenter={(event) => handlePointerEnter(event, location)}
          onpointerleave={() => handlePointerLeave(location)}
          onpointerdown={handlePointerDown}
          onfocus={() => handleFocus(location)}
          onblur={() => handleBlur(location)}
          onclick={(event) => handleClick(event, location)}
        >
          <span
            class="hotspot-marker"
            aria-hidden="true"
            data-cy={`story-map-hotspot-marker-${location.id}`}
          ></span>
        </button>
      {/each}
    </div>
    {#if selectedLocation}
      <section
        id={popoverId(selectedLocation.id)}
        class="map-popover"
        role="tooltip"
        style:left={details[selectedLocation.id].popoverX}
        style:top={details[selectedLocation.id].popoverY}
        data-cy={`story-map-popover-${selectedLocation.id}`}
      >
        <h2 data-cy={`story-map-popover-name-${selectedLocation.id}`}>
          {details[selectedLocation.id].name}
        </h2>
        <p
          class="popover-meta"
          data-cy={`story-map-popover-meta-${selectedLocation.id}`}
        >
          {details[selectedLocation.id].marker} · {selectedLocation.access}{selectedLocation.completed
            ? " · completed"
            : ""}
        </p>
        <p data-cy={`story-map-popover-summary-${selectedLocation.id}`}>
          {details[selectedLocation.id].summary}
        </p>
        {#if selectedLocation.access === "locked"}
          <p
            class="locked-reason"
            data-cy={`story-map-popover-locked-reason-${selectedLocation.id}`}
          >
            Locked: {details[selectedLocation.id].lockedReason ??
              "Unavailable in this story state."}
          </p>
        {/if}
      </section>
    {/if}
  </div>
  <button
    type="button"
    class="story-danger map-return"
    data-cy="story-map-return"
    onclick={onreturn}>Return to {returnLabel}</button
  >
</section>

<style>
  .map-screen {
    display: flex;
    flex-direction: column;
    gap: clamp(0.45rem, 1.25cqh, 0.8rem);
    width: 100%;
    height: 100%;
    min-height: 0;
    overflow: hidden;
    padding: clamp(0.5rem, 1.6cqw, 1rem);
    background: var(--bg);
  }

  .map-art {
    position: relative;
    flex: 1 1 auto;
    min-height: 0;
    overflow: hidden;
    border: 1px solid var(--gold-line);
    border-radius: var(--radius-md);
    background: var(--surface);
    box-shadow: 0 0.5rem 1.5rem
      color-mix(in srgb, var(--shadow) 45%, transparent);
  }

  .map-art img {
    position: absolute;
    inset: 0;
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .hotspots {
    position: absolute;
    inset: 0;
    z-index: 2;
  }

  .hotspot {
    position: absolute;
    display: grid;
    place-items: center;
    width: clamp(44px, 5cqw, 56px);
    min-height: clamp(44px, 5cqw, 56px);
    padding: 0;
    border: 1px solid var(--accent);
    border-radius: 50%;
    background: color-mix(in srgb, var(--surface-raised) 88%, transparent);
    color: var(--accent);
    transform: translate(-50%, -50%);
    box-shadow:
      0 0.45rem 1rem color-mix(in srgb, var(--shadow) 55%, transparent),
      0 0 0 0.35rem color-mix(in srgb, var(--accent) 18%, transparent);
    backdrop-filter: blur(8px);
  }

  .hotspot:hover,
  .hotspot.selected {
    background: var(--accent);
    color: var(--ink-on-accent);
  }

  .hotspot.locked {
    border-color: var(--muted);
    background: color-mix(in srgb, var(--surface-raised) 90%, transparent);
    color: var(--muted);
    box-shadow: 0 0.45rem 1rem
      color-mix(in srgb, var(--shadow) 55%, transparent);
  }

  .hotspot.locked.selected {
    border-color: var(--selected);
    color: var(--selected);
  }

  .hotspot.completed {
    box-shadow:
      inset 0 0 0 3px var(--legal),
      0 0.45rem 1rem color-mix(in srgb, var(--shadow) 55%, transparent);
  }

  .hotspot-marker {
    width: 0.72rem;
    height: 0.72rem;
    border: 2px solid currentColor;
    transform: rotate(45deg);
  }

  .map-popover {
    position: absolute;
    z-index: 3;
    width: clamp(15rem, 24cqw, 18rem);
    max-width: calc(100% - 1rem);
    padding: clamp(0.7rem, 1.6cqw, 1rem);
    border: 1px solid var(--gold-line);
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--surface-raised) 94%, transparent);
    color: var(--text);
    box-shadow: 0 0.65rem 1.8rem
      color-mix(in srgb, var(--shadow) 62%, transparent);
    pointer-events: none;
    backdrop-filter: blur(12px);
    animation: map-popover-in 140ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes map-popover-in {
    from {
      opacity: 0.2;
      filter: blur(3px);
    }
  }

  .map-popover h2 {
    margin: 0 0 0.2rem;
    color: var(--accent);
    font: 400 clamp(1rem, 2.2cqw, 1.3rem)/1.1 var(--font-display);
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .map-popover p {
    margin: 0.45rem 0 0;
    font-size: clamp(0.78rem, 1.7cqw, 0.95rem);
    line-height: 1.3;
  }

  .map-popover .popover-meta {
    margin-top: 0;
    color: var(--muted);
    font-size: clamp(0.72rem, 1.5cqw, 0.84rem);
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .map-popover .locked-reason {
    color: var(--selected);
    font-weight: 650;
  }

  .map-return {
    flex: 0 0 auto;
    align-self: flex-start;
    min-height: 44px;
  }

  @media (max-width: 48rem) {
    .map-popover {
      right: 0.5rem;
      bottom: 0.5rem;
      left: 0.5rem !important;
      top: auto !important;
      width: auto;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .map-popover {
      animation: none;
    }
  }
</style>

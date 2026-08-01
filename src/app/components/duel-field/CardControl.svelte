<script lang="ts">
  import { onDestroy } from "svelte";
  import type { BoardCardView } from "../../../field/board-view-model.ts";
  import type {
    CardImageLease,
    CardImageLibrary,
  } from "../../images/card-image-cache.ts";
  import type { ActiveInteractionSpec } from "../../prompts/interaction-spec.ts";

  export let card: BoardCardView;
  export let imageUrl: string;
  export let imageLibrary: Pick<CardImageLibrary, "lease"> | null = null;
  export let interactionKind: ActiveInteractionSpec["kind"] | null = null;
  export let actionable = false;
  export let selected = false;
  export let disabled = false;
  export let onactivate: (element: HTMLButtonElement) => void = () => undefined;
  export let oninspect: () => void = () => undefined;

  let pointerOrigin: { readonly x: number; readonly y: number } | null = null;
  let pointerMoved = false;
  let activeImageLibrary: Pick<CardImageLibrary, "lease"> | null = null;
  let activeImageCode: number | undefined;
  let imageLease: CardImageLease | null = null;
  let renderedImageUrl = imageUrl;

  $: synchronizeImageLease(
    imageLibrary,
    card.image.kind === "face" ? card.image.code : undefined,
    imageUrl,
  );
  $: positionStyle = `--field-x: ${card.x * 100}%; --field-y: ${card.y * 100}%; --field-width: ${card.width * 100}%; --field-height: ${card.height * 100}%;`;
  $: accessibleLabel =
    card.facing === "opponent" &&
    !card.label.toLocaleLowerCase().includes("opponent")
      ? `Opponent controlled, ${card.label}`
      : card.label;
  $: activationLabel =
    interactionKind === "cardAction"
      ? `Open actions for ${accessibleLabel}`
      : interactionKind === "counterAllocation"
        ? `Allocate counter to ${accessibleLabel}`
        : `Select ${accessibleLabel}`;

  onDestroy(() => imageLease?.release());

  function synchronizeImageLease(
    library: Pick<CardImageLibrary, "lease"> | null,
    code: number | undefined,
    fallbackUrl: string,
  ): void {
    if (library !== activeImageLibrary || code !== activeImageCode) {
      imageLease?.release();
      activeImageLibrary = library;
      activeImageCode = code;
      imageLease =
        library !== null && code !== undefined ? library.lease(code) : null;
    }
    renderedImageUrl = imageLease?.url ?? fallbackUrl;
  }

  function useFallbackImage(event: Event): void {
    const image = event.currentTarget as HTMLImageElement;
    image.onerror = null;
    renderedImageUrl = imageUrl;
  }

  function pointerDown(event: PointerEvent): void {
    pointerOrigin = { x: event.clientX, y: event.clientY };
    pointerMoved = false;
  }

  function pointerMove(event: PointerEvent): void {
    if (pointerOrigin === null) return;
    if (
      Math.hypot(
        event.clientX - pointerOrigin.x,
        event.clientY - pointerOrigin.y,
      ) > 8
    ) {
      pointerMoved = true;
    }
  }

  function activate(
    event: MouseEvent & { currentTarget: HTMLButtonElement },
  ): void {
    pointerOrigin = null;
    if (pointerMoved) {
      pointerMoved = false;
      return;
    }
    onactivate(event.currentTarget);
  }
</script>

<article
  class:is-hidden={card.hidden}
  class:is-opponent={card.facing === "opponent"}
  class:is-sideways={card.orientation === "sideways"}
  class:is-actionable={actionable}
  class:is-selected={selected}
  class="duel-field-card"
  aria-label={accessibleLabel}
  data-card-id={card.id}
  data-facing={card.facing}
  data-hidden={card.hidden}
  data-orientation={card.orientation}
  data-position={card.position}
  data-card-zone-id={card.zoneId}
  style={positionStyle}
>
  <div class="duel-field-card__art">
    <img
      src={renderedImageUrl}
      alt={card.hidden ? "" : accessibleLabel}
      aria-hidden={card.hidden}
      decoding="async"
      onerror={useFallbackImage}
    />
  </div>
  <span class="duel-field-card__label" aria-hidden="true">
    {card.hidden ? "Hidden card" : card.label}
  </span>
  {#if actionable}
    <button
      type="button"
      class="duel-field-card__target"
      aria-label={activationLabel}
      aria-pressed={interactionKind === "cardSelection" ? selected : undefined}
      {disabled}
      onpointerdown={pointerDown}
      onpointermove={pointerMove}
      onclick={activate}
    ></button>
    {#if interactionKind !== "cardAction"}
      <button
        type="button"
        class="duel-field-card__inspect"
        aria-label={`Inspect ${accessibleLabel}`}
        onclick={oninspect}>Inspect</button
      >
    {/if}
  {/if}
</article>

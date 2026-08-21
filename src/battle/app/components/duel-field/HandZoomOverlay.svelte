<script lang="ts">
  import { onDestroy } from "svelte";
  import type { BoardCardView } from "../../../field/board-view-model.ts";
  import type {
    CardImageLease,
    CardImageLibrary,
  } from "../../images/card-image-cache.ts";
  import type { InteractionChoice } from "../../prompts/interaction-spec.ts";
  import CardActionChips from "./CardActionChips.svelte";

  export let card: BoardCardView;
  export let anchor: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
  export let imageLibrary: Pick<CardImageLibrary, "lease"> | null = null;
  export let cardBackUrl: string;
  export let placeholderUrl: string;
  /* Clamp ceiling in the same coordinate space as `anchor`. The overlay is
     `position: fixed` inside the stage the phone layout turns a quarter turn,
     so that stage — not the viewport — is its containing block, and reading
     `innerWidth` here would clamp a frame-space left edge against a viewport
     axis (`readFrameWidth` in `presentation/stage-frame.ts`). */
  export let frameWidth: number;
  export let choices: readonly InteractionChoice[] = [];
  export let disabled = false;
  export let scale = 1.6;
  export let onchoose: (choice: InteractionChoice) => void = () => undefined;
  export let ondismiss: () => void = () => undefined;
  /* Carries the crossing's `relatedTarget`: the field decides on that, in the
     same dispatch, whether the pointer left the card+overlay union or merely
     moved between its two halves (ADR-032 §5). */
  export let onzoomleave: (related: EventTarget | null) => void = () =>
    undefined;

  let activeImageLibrary: Pick<CardImageLibrary, "lease"> | null = null;
  let activeImageCode: number | undefined;
  let imageLease: CardImageLease | null = null;
  let renderedImageUrl = placeholderUrl;

  /* The zoom resolves its own art the way a mounted card does: a lease per
     previewed code, released as soon as the preview moves on. A hidden card
     leases nothing — its identity is the one thing the overlay may not ask
     the library about. */
  $: synchronizeImageLease(
    imageLibrary,
    card.image.kind === "face" ? card.image.code : undefined,
    card.image.kind === "back" ? cardBackUrl : placeholderUrl,
  );
  $: w = anchor.width * scale;
  $: h = anchor.height * scale;
  $: left = Math.max(
    8,
    Math.min(anchor.left + anchor.width / 2 - w / 2, frameWidth - w - 8),
  );
  $: top = Math.max(8, anchor.top + anchor.height - h);
  /* Distance from the overlay's bottom edge up to the anchor card's top edge,
     which is where the bridge below has to stop: measured from the placed box
     so it stays exact when the top gutter clamp has moved it. */
  $: bridgeBottom = top + h - anchor.top;
  /* `--hand-zoom-width` repeats the box's own width because the action rows
     scale their label off it: a percentage sizes the row but can never size
     the text inside it. */
  $: overlayStyle = `left: ${left}px; top: ${top}px; width: ${w}px; height: ${h}px; --hand-zoom-width: ${w}px; --hand-zoom-bridge-bottom: ${bridgeBottom}px;`;

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
    renderedImageUrl = placeholderUrl;
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions (presentation layer: the
     leave only reports where the pointer went, and the keyboard flow never
     opens this overlay at all — ADR-032 §4) -->
<div
  class="hand-zoom-overlay"
  data-cy={`hand-zoom-overlay-${card.id}`}
  style={overlayStyle}
  onpointerleave={(event) => onzoomleave(event.relatedTarget)}
>
  {#if choices.length > 0}
    <!-- The only pointer-catching span of the overlay, and it deliberately
         stops at the card's top edge: it joins the chips to the card so the
         pointer can travel to an action without ever leaving the union. -->
    <div
      class="hand-zoom-overlay__bridge"
      data-cy={`hand-zoom-overlay-bridge-${card.id}`}
    >
      <CardActionChips
        cardId={card.id}
        cardLabel={card.label}
        dataCyScope="hand-zoom-overlay"
        layout="stack"
        {choices}
        {disabled}
        {onchoose}
        {ondismiss}
      />
    </div>
  {/if}
  <img
    class="hand-zoom-overlay__art"
    data-cy={`hand-zoom-overlay-image-${card.id}`}
    src={renderedImageUrl}
    decoding="async"
    onerror={useFallbackImage}
    alt={card.label}
  />
  <span
    class="hand-zoom-overlay__name"
    data-cy={`hand-zoom-overlay-name-${card.id}`}>{card.label}</span
  >
</div>

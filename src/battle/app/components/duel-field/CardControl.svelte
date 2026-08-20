<script lang="ts">
  import { onDestroy, tick } from "svelte";
  import type { BoardCardView } from "../../../field/board-view-model.ts";
  import type { FieldPlacement } from "../../../field/duel-field-geometry.ts";
  import type {
    CardImageLease,
    CardImageLibrary,
  } from "../../images/card-image-cache.ts";
  import type {
    ActiveInteractionSpec,
    InteractionChoice,
  } from "../../prompts/interaction-spec.ts";
  import type { CardDragOrigin } from "../../presentation/drag-ghost-physics.ts";
  import CardActionChips from "./CardActionChips.svelte";

  export let card: BoardCardView;
  export let layout: "field" | "hand" = "field";
  export let placement: FieldPlacement | null = null;
  export let imageUrl: string;
  export let imageLibrary: Pick<CardImageLibrary, "lease"> | null = null;
  export let interactionKind: ActiveInteractionSpec["kind"] | null = null;
  export let actionable = false;
  export let selected = false;
  export let active = false;
  export let disabled = false;
  export let choices: readonly InteractionChoice[] = [];
  export let pinned = false;
  export let draggable = false;
  export let onactivate: (element: HTMLButtonElement) => void = () => undefined;
  export let onchoose: (choice: InteractionChoice) => void = () => undefined;
  export let ondismiss: () => void = () => undefined;
  export let ondragstart: (origin: CardDragOrigin) => void = () => undefined;
  export let ondragmove: (x: number, y: number) => void = () => undefined;
  export let ondragend: (x: number, y: number) => void = () => undefined;
  export let onpreview: (card: BoardCardView) => void = () => undefined;
  export let onzoomenter: (element: HTMLElement) => void = () => undefined;
  export let onzoomleave: (related: EventTarget | null) => void = () =>
    undefined;

  let articleEl: HTMLElement | undefined;
  let pointerOrigin: { readonly x: number; readonly y: number } | null = null;
  let pointerMoved = false;
  let dragging = false;
  let activeImageLibrary: Pick<CardImageLibrary, "lease"> | null = null;
  let activeImageCode: number | undefined;
  let imageLease: CardImageLease | null = null;
  let renderedImageUrl = imageUrl;
  /* `bind:this` writes `null` — not `undefined` — as the element unmounts, and
     an unpin very often coincides with the card leaving the board. */
  let targetElement: HTMLButtonElement | null = null;
  let chips: CardActionChips | null = null;
  let wasPinned = false;

  $: synchronizeImageLease(
    imageLibrary,
    card.image.kind === "face" ? card.image.code : undefined,
    imageUrl,
  );
  $: positionStyle = fieldPositionStyle(layout, placement);

  $: accessibleLabel =
    card.facing === "opponent" &&
    !card.label.toLocaleLowerCase().includes("opponent")
      ? `Opponent controlled, ${card.label}`
      : card.label;
  $: activationLabel =
    interactionKind === "cardAction"
      ? `Legal action, Open actions for ${accessibleLabel}`
      : interactionKind === "counterAllocation"
        ? `Legal action, Allocate counter to ${accessibleLabel}`
        : `Legal action, Select ${accessibleLabel}`;
  /* Guard on the pin *transition*, never on `pinned` alone: this block reruns
     on every unrelated re-render and would otherwise steal focus each time. */
  $: if (pinned !== wasPinned) synchronizePinnedFocus(pinned);

  onDestroy(() => imageLease?.release());

  function fieldPositionStyle(
    value: "field" | "hand",
    valuePlacement: FieldPlacement | null,
  ): string | undefined {
    if (value === "hand") return undefined;
    if (valuePlacement === null)
      throw new Error(`Missing field render placement for card ${card.id}`);
    return `--field-x: ${valuePlacement.x}px; --field-y: ${valuePlacement.y}px; --field-width: ${valuePlacement.width * (72 / 104)}px; --field-height: ${valuePlacement.height}px;`;
  }

  function synchronizePinnedFocus(next: boolean): void {
    wasPinned = next;
    if (next) void tick().then(() => chips?.focusFirstChip());
    else returnFocusToTarget();
  }

  /* Unpinning happens on Escape and once a chosen action resolves. Only pull
     focus back when a chip still holds it, so an unpin caused by something
     else on the board never yanks focus away from wherever the player is. */
  function returnFocusToTarget(): void {
    const target = targetElement;
    if (target === null || !target.isConnected) return;
    const article = target.closest(".duel-field-card");
    const focused = document.activeElement;
    if (
      article === null ||
      !(focused instanceof HTMLElement) ||
      !article.contains(focused) ||
      focused.closest(".card-action-chips") === null
    ) {
      return;
    }
    target.focus({ preventScroll: true });
  }

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

  /* Preview is a read-only side effect of hovering, pressing or focusing a
     card whose identity the local player may already see. It never consumes
     the event and never touches the drag bookkeeping below. */
  function reportPreview(): void {
    onpreview(card);
  }

  function handleArticlePointerEnter(): void {
    reportPreview();
    if (
      layout === "hand" &&
      card.code !== undefined &&
      articleEl !== undefined
    ) {
      onzoomenter(articleEl);
    }
  }

  function handleArticlePointerLeave(event: PointerEvent): void {
    if (layout === "hand" && card.code !== undefined) {
      onzoomleave(event.relatedTarget);
    }
  }

  function pointerDown(
    event: PointerEvent & { currentTarget: HTMLButtonElement },
  ): void {
    pointerOrigin = { x: event.clientX, y: event.clientY };
    pointerMoved = false;
    /* Capture keeps the move and up events on this button even once the
       pointer has travelled onto a zone. jsdom implements neither capture
       method, hence the optional calls. */
    if (draggable) event.currentTarget.setPointerCapture?.(event.pointerId);
    reportPreview();
  }

  function pointerMove(
    event: PointerEvent & { currentTarget: HTMLButtonElement },
  ): void {
    if (pointerOrigin === null) return;
    if (
      Math.hypot(
        event.clientX - pointerOrigin.x,
        event.clientY - pointerOrigin.y,
      ) > 8
    ) {
      pointerMoved = true;
    }
    if (!pointerMoved || !draggable) return;
    if (!dragging) {
      dragging = true;
      ondragstart(buildDragOrigin(event));
    }
    ondragmove(event.clientX, event.clientY);
  }

  /* First-threshold-crossing snapshot: article rect + pointer grab offset
     relative to that rect, plus the currently rendered art (back art for a
     hidden card, never the known face). `performance.now()` — not the event
     timestamp, which jsdom never populates and which is clock-origin
     dependent across browsers — anchors the physics module's first frame. */
  function buildDragOrigin(
    event: PointerEvent & { currentTarget: HTMLButtonElement },
  ): CardDragOrigin {
    const article =
      event.currentTarget.closest<HTMLElement>(".duel-field-card") ??
      event.currentTarget;
    const rect = article.getBoundingClientRect();
    return {
      pointer: {
        x: event.clientX,
        y: event.clientY,
        timeMs: performance.now(),
      },
      sourceLeft: rect.left,
      sourceTop: rect.top,
      width: rect.width,
      height: rect.height,
      pointerOffsetX: event.clientX - rect.left,
      pointerOffsetY: event.clientY - rect.top,
      imageUrl: renderedImageUrl,
    };
  }

  function pointerUp(
    event: PointerEvent & { currentTarget: HTMLButtonElement },
  ): void {
    if (!dragging) return;
    ondragend(event.clientX, event.clientY);
    dragging = false;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  }

  /* A cancelled pointer has no meaningful drop coordinate; the field reads
     `NaN` as "the gesture was abandoned". */
  function pointerCancel(): void {
    if (!dragging) return;
    dragging = false;
    ondragend(Number.NaN, Number.NaN);
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

<!-- svelte-ignore a11y_no_noninteractive_tabindex (passive card participates in spatial roving focus) -->
<article
  bind:this={articleEl}
  onpointerenter={handleArticlePointerEnter}
  onpointerleave={handleArticlePointerLeave}
  onfocusin={reportPreview}
  class:is-hidden={card.hidden}
  class:is-opponent={card.facing === "opponent"}
  class:is-sideways={card.orientation === "sideways"}
  class:is-defense={card.position === "faceUpDefense"}
  class:is-set={card.position === "faceDownDefense"}
  class:is-actionable={actionable}
  class:is-dragging={dragging}
  class:is-pinned={pinned}
  class:is-selected={selected}
  class:is-navigation-active={active}
  class:is-identity-known={card.code !== undefined}
  class:is-hand-item={layout === "hand"}
  class="duel-field-card"
  aria-label={accessibleLabel}
  data-card-id={card.id}
  data-field-target={actionable ? undefined : card.targetId}
  tabindex={actionable ? undefined : active ? 0 : -1}
  data-facing={card.facing}
  data-hidden={card.hidden}
  data-orientation={card.orientation}
  data-position={card.position}
  data-card-zone-id={card.zoneId}
  data-dragging={dragging ? "true" : undefined}
  style={positionStyle}
  data-cy={`field-card-${card.id}`}
>
  <div class="duel-field-card__art" data-cy={`card-control-art-${card.id}`}>
    <img
      src={renderedImageUrl}
      alt={card.hidden ? "" : accessibleLabel}
      aria-hidden={card.hidden}
      decoding="async"
      onerror={useFallbackImage}
      data-cy={`card-control-image-${card.id}`}
    />
  </div>
  {#if card.code !== undefined}
    <span
      class="duel-field-card__label"
      aria-hidden="true"
      data-cy={`card-control-label-${card.id}`}
    >
      {card.label}
    </span>
  {/if}
  {#if actionable}
    <button
      type="button"
      class="duel-field-card__target"
      aria-label={activationLabel}
      aria-pressed={interactionKind === "cardSelection" ? selected : undefined}
      data-field-target={card.targetId}
      tabindex={active ? 0 : -1}
      {disabled}
      bind:this={targetElement}
      onpointerdown={pointerDown}
      onpointermove={pointerMove}
      onpointerup={pointerUp}
      onpointercancel={pointerCancel}
      onclick={activate}
      data-cy={`field-card-target-${card.id}`}
    ></button>
    {#if choices.length > 0}
      <CardActionChips
        cardId={card.id}
        cardLabel={accessibleLabel}
        {choices}
        {disabled}
        {onchoose}
        {ondismiss}
        bind:this={chips}
      />
    {/if}
  {/if}
</article>

<script lang="ts">
  import { onDestroy, tick } from "svelte";
  import type { BoardCardView } from "../../../field/board-view-model.ts";
  import type {
    CardImageLease,
    CardImageLibrary,
  } from "../../images/card-image-cache.ts";
  import type {
    ActiveInteractionSpec,
    InteractionChoice,
  } from "../../prompts/interaction-spec.ts";
  import CardActionChips from "./CardActionChips.svelte";

  export let card: BoardCardView;
  export let imageUrl: string;
  export let imageLibrary: Pick<CardImageLibrary, "lease"> | null = null;
  export let interactionKind: ActiveInteractionSpec["kind"] | null = null;
  export let actionable = false;
  export let selected = false;
  export let active = false;
  export let disabled = false;
  export let choices: readonly InteractionChoice[] = [];
  export let pinned = false;
  export let onactivate: (element: HTMLButtonElement) => void = () => undefined;
  export let onchoose: (choice: InteractionChoice) => void = () => undefined;
  export let ondismiss: () => void = () => undefined;

  let pointerOrigin: { readonly x: number; readonly y: number } | null = null;
  let pointerMoved = false;
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
  $: positionStyle = `--field-x: ${card.x * 100}%; --field-y: ${card.y * 100}%; --field-width: ${card.width * 100}%; --field-height: ${card.height * 100}%;`;
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

<!-- svelte-ignore a11y_no_noninteractive_tabindex (passive card participates in spatial roving focus) -->
<article
  class:is-hidden={card.hidden}
  class:is-opponent={card.facing === "opponent"}
  class:is-sideways={card.orientation === "sideways"}
  class:is-actionable={actionable}
  class:is-pinned={pinned}
  class:is-selected={selected}
  class:is-navigation-active={active}
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
  style={positionStyle}
  data-cy={`field-card-${card.id}`}
>
  <div class="duel-field-card__art" data-cy="card-control-art">
    <img
      src={renderedImageUrl}
      alt={card.hidden ? "" : accessibleLabel}
      aria-hidden={card.hidden}
      decoding="async"
      onerror={useFallbackImage}
      data-cy="card-control-image"
    />
  </div>
  <span
    class="duel-field-card__label"
    aria-hidden="true"
    data-cy="card-control-label"
  >
    {card.hidden ? "Hidden card" : card.label}
  </span>
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

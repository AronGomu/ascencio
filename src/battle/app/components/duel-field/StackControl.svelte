<script lang="ts">
  import { onDestroy } from "svelte";
  import type { BoardStackView } from "../../../field/board-view-model.ts";
  import type { FieldPlacement } from "../../../field/duel-field-geometry.ts";
  import type {
    CardImageLease,
    CardImageLibrary,
  } from "../../images/card-image-cache.ts";

  export let stack: BoardStackView;
  export let placement: FieldPlacement;
  export let active = false;
  export let actionable = false;
  export let onpreview: () => void = () => undefined;
  export let onactivate: () => void = () => undefined;
  export let imageLibrary: Pick<CardImageLibrary, "lease"> | null = null;
  export let placeholderUrl = "";
  export let cardBackUrl = "";

  let activeImageLibrary: Pick<CardImageLibrary, "lease"> | null = null;
  let activeImageCode: number | undefined;
  let imageLease: CardImageLease | null = null;
  let renderedImageUrl = placeholderUrl;
  let pointerOrigin: { readonly x: number; readonly y: number } | null = null;
  let pointerMoved = false;

  $: positionStyle = `--field-x: ${placement.x}px; --field-y: ${placement.y}px; --field-width: ${placement.width * (72 / 104)}px; --field-height: ${placement.height}px;`;
  $: synchronizeImageLease(imageLibrary, stack.topCardCode, placeholderUrl);
  $: clickable = stack.count > 0;
  /* The halo says "a legal target sits in here", which is only ever readable
     on a pile that shows what it holds. A deck, an extra deck, or a
     face-down banished pile never renders its top card art (board-view-model
     always suppresses topCardCode for "deck"/"extra"), so it tells the player
     nothing they can act on and wears no halo — it stays a button, and
     opening it is still how the target is reached. */
  $: haloed = actionable && stack.topCardCode !== undefined;

  onDestroy(() => imageLease?.release());

  function activate(): void {
    pointerOrigin = null;
    if (pointerMoved) {
      pointerMoved = false;
      return;
    }
    onactivate();
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
    renderedImageUrl = placeholderUrl;
  }
</script>

<svelte:element
  this={clickable ? "button" : "div"}
  type={clickable ? "button" : undefined}
  class:is-navigation-active={active}
  class:is-actionable={haloed}
  class:is-opponent={stack.player === 1}
  class="duel-field-stack"
  role={clickable ? undefined : "group"}
  aria-label={stack.accessibleLabel}
  data-field-target={stack.targetId}
  tabindex={active ? 0 : -1}
  data-player={stack.player}
  data-stack-id={stack.id}
  data-stack-zone={stack.zone}
  data-actionable={actionable ? "true" : undefined}
  style={positionStyle}
  onpointerdown={clickable
    ? (event: PointerEvent) => {
        pointerOrigin = { x: event.clientX, y: event.clientY };
        pointerMoved = false;
      }
    : undefined}
  onpointermove={clickable
    ? (event: PointerEvent) => {
        if (
          pointerOrigin !== null &&
          Math.hypot(
            event.clientX - pointerOrigin.x,
            event.clientY - pointerOrigin.y,
          ) > 8
        ) {
          pointerMoved = true;
        }
      }
    : undefined}
  onclick={clickable ? activate : undefined}
  onpointerenter={onpreview}
  onfocusin={onpreview}
  data-cy={`field-stack-${stack.id}`}
>
  {#if stack.topCardCode !== undefined}
    <div
      class="duel-field-stack__art"
      data-cy={`stack-control-art-${stack.id}`}
    >
      <img
        src={renderedImageUrl}
        alt=""
        aria-hidden="true"
        decoding="async"
        onerror={useFallbackImage}
        data-cy={`stack-control-image-${stack.id}`}
      />
    </div>
  {:else if stack.count > 0 && (stack.zone === "deck" || stack.zone === "extra")}
    <div
      class="duel-field-stack__art"
      data-cy={`stack-control-back-${stack.id}`}
    >
      <img
        src={cardBackUrl}
        alt=""
        aria-hidden="true"
        decoding="async"
        data-cy={`stack-control-back-image-${stack.id}`}
      />
    </div>
  {/if}
  <span
    class="duel-field-stack__name"
    aria-hidden="true"
    data-cy={`stack-control-name-${stack.id}`}
  >
    {stack.zone === "graveyard" ? "GY" : stack.zone}
  </span>
  <strong
    class="duel-field-stack__count"
    aria-hidden="true"
    data-cy={`stack-control-count-${stack.id}`}
  >
    {stack.count}
  </strong>
</svelte:element>

<script lang="ts">
  import { onDestroy } from "svelte";
  import type { BoardStackView } from "../../../field/board-view-model.ts";
  import type {
    CardImageLease,
    CardImageLibrary,
  } from "../../images/card-image-cache.ts";

  export let stack: BoardStackView;
  export let active = false;
  export let actionable = false;
  export let onpreview: () => void = () => undefined;
  export let onactivate: () => void = () => undefined;
  export let imageLibrary: Pick<CardImageLibrary, "lease"> | null = null;
  export let placeholderUrl = "";

  let activeImageLibrary: Pick<CardImageLibrary, "lease"> | null = null;
  let activeImageCode: number | undefined;
  let imageLease: CardImageLease | null = null;
  let renderedImageUrl = placeholderUrl;
  let pointerOrigin: { readonly x: number; readonly y: number } | null = null;
  let pointerMoved = false;

  $: positionStyle = `--field-x: ${stack.x * 100}%; --field-y: ${stack.y * 100}%; --field-width: ${stack.width * 100}%; --field-height: ${stack.height * 100}%;`;
  $: synchronizeImageLease(imageLibrary, stack.topCardCode, placeholderUrl);
  $: clickable = stack.count > 0;

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
  class:is-actionable={actionable}
  class="duel-field-stack"
  role={clickable ? undefined : "group"}
  aria-label={stack.label}
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

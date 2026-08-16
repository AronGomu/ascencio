<script lang="ts">
  import { onDestroy } from "svelte";
  import OverlayScrollbar from "./OverlayScrollbar.svelte";
  import type {
    CardPreviewImageSource,
    CardPreviewView,
  } from "./card-preview-view.ts";

  type CardImageLease = ReturnType<CardPreviewImageSource["lease"]>;

  export let preview: CardPreviewView | null = null;
  export let imageLibrary: CardPreviewImageSource | null = null;
  export let placeholderUrl = "";
  /** Art the caller already resolved to a URL, for a domain that has no image
      library to lease from. The lease wins when both are present. */
  export let staticImageUrl: string | null = null;

  let activeImageLibrary: CardPreviewImageSource | null = null;
  let activeImageCode: number | undefined;
  let imageLease: CardImageLease | null = null;
  let leasedImageUrl: string | undefined;
  let textScroller: HTMLElement | null = null;

  $: synchronizeImageLease(imageLibrary, preview?.code);
  $: imageUrl =
    leasedImageUrl ?? staticImageUrl ?? (placeholderUrl || undefined);

  onDestroy(() => imageLease?.release());

  /* Copied from the retired card inspector: one lease at a time, released the
     moment the previewed code or the library changes and again on destroy, so
     the object URL never outlives the image that is actually mounted. */
  function synchronizeImageLease(
    library: CardPreviewImageSource | null,
    code: number | undefined,
  ): void {
    if (library === activeImageLibrary && code === activeImageCode) return;
    imageLease?.release();
    activeImageLibrary = library;
    activeImageCode = code;
    imageLease =
      library !== null && code !== undefined && code > 0
        ? library.lease(code)
        : null;
    leasedImageUrl = imageLease?.url;
  }

  function useFallbackImage(event: Event): void {
    const image = event.currentTarget as HTMLImageElement;
    image.onerror = null;
    if (placeholderUrl) image.src = placeholderUrl;
    else image.remove();
  }

  function scrollTextByKeyboard(event: KeyboardEvent): void {
    const scroller = event.currentTarget as HTMLElement;
    if (event.key === "Home") scroller.scrollTop = 0;
    else if (event.key === "End") scroller.scrollTop = scroller.scrollHeight;
    else if (event.key === "PageUp")
      scroller.scrollTop -= scroller.clientHeight;
    else if (event.key === "PageDown")
      scroller.scrollTop += scroller.clientHeight;
    else return;
    event.preventDefault();
  }
</script>

<aside
  class="card-preview-panel"
  aria-label="Card preview"
  data-cy="card-preview-panel"
>
  {#if preview === null}
    <p data-cy="card-preview-empty">Hover a card to see its details.</p>
  {:else}
    <div class="card-preview-panel__art" data-cy="card-preview-art">
      {#if imageUrl}<img
          src={imageUrl}
          alt={preview.name}
          decoding="async"
          onerror={useFallbackImage}
          data-cy="card-preview-image"
        />{/if}
    </div>
    <div class="card-preview-panel__body" data-cy="card-preview-body">
      <h2 data-cy="card-preview-name">{preview.name}</h2>
      <div
        class="card-preview-panel__text-region"
        data-cy="card-preview-text-region"
      >
        <!-- svelte-ignore a11y_no_noninteractive_tabindex a11y_no_noninteractive_element_interactions (native effect-text scroller is intentionally keyboard reachable) -->
        <div
          class="card-preview-panel__text"
          tabindex="0"
          role="region"
          aria-label="Card effect text"
          onkeydown={scrollTextByKeyboard}
          bind:this={textScroller}
          data-cy="card-preview-text"
        >
          {preview.description}
        </div>
        <OverlayScrollbar
          axis="vertical"
          scrollElement={textScroller}
          contentSizeKey={`${preview.code}:${preview.description.length}`}
          dataCyPrefix="card-preview-text"
        />
      </div>
    </div>
  {/if}
</aside>

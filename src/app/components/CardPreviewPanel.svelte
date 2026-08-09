<script lang="ts">
  import { onDestroy } from "svelte";
  import type { CardPreviewView } from "../presentation/card-preview.ts";
  import type {
    CardImageLease,
    CardImageLibrary,
  } from "../images/card-image-cache.ts";

  export let preview: CardPreviewView | null = null;
  export let imageLibrary: Pick<CardImageLibrary, "lease"> | null = null;
  export let placeholderUrl = "";

  let activeImageLibrary: Pick<CardImageLibrary, "lease"> | null = null;
  let activeImageCode: number | undefined;
  let imageLease: CardImageLease | null = null;
  let leasedImageUrl: string | undefined;

  $: synchronizeImageLease(imageLibrary, preview?.code);
  $: imageUrl = leasedImageUrl ?? (placeholderUrl || undefined);

  onDestroy(() => imageLease?.release());

  /* Copied from the retired card inspector: one lease at a time, released the
     moment the previewed code or the library changes and again on destroy, so
     the object URL never outlives the image that is actually mounted. */
  function synchronizeImageLease(
    library: Pick<CardImageLibrary, "lease"> | null,
    code: number | undefined,
  ): void {
    if (library === activeImageLibrary && code === activeImageCode) return;
    imageLease?.release();
    activeImageLibrary = library;
    activeImageCode = code;
    imageLease =
      library !== null && code !== undefined ? library.lease(code) : null;
    leasedImageUrl = imageLease?.url;
  }

  function useFallbackImage(event: Event): void {
    const image = event.currentTarget as HTMLImageElement;
    image.onerror = null;
    if (placeholderUrl) image.src = placeholderUrl;
    else image.remove();
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
    <div class="card-preview-panel__copy" data-cy="card-preview-copy">
      <h2 data-cy="card-preview-name">{preview.name}</h2>
      <div data-cy="card-preview-text">{preview.description}</div>
    </div>
  {/if}
</aside>

<script lang="ts">
  import { onDestroy } from "svelte";
  import type { BoardMaterialView } from "../../../field/board-view-model.ts";
  import type {
    CardImageLease,
    CardImageLibrary,
  } from "../../images/card-image-cache.ts";

  export let material: BoardMaterialView;
  export let index: number;
  export let imageLibrary: Pick<CardImageLibrary, "lease"> | null = null;
  export let cardBackUrl = "";
  export let placeholderUrl = "";

  let activeImageLibrary: Pick<CardImageLibrary, "lease"> | null = null;
  let activeImageCode: number | undefined;
  let imageLease: CardImageLease | null = null;
  let renderedImageUrl = cardBackUrl;

  $: faceCode =
    material.identityVisible && material.code !== undefined
      ? Number(material.code)
      : undefined;
  $: synchronizeImageLease(
    imageLibrary,
    faceCode,
    faceCode === undefined ? cardBackUrl : placeholderUrl,
  );

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

<div
  class="duel-field-card__material"
  aria-hidden="true"
  style={`--material-index: ${index};`}
  data-material-sequence={material.sequence}
  data-cy={`field-card-material-${material.id}`}
>
  <img
    src={renderedImageUrl}
    alt={material.identityVisible ? material.label : ""}
    decoding="async"
    onerror={faceCode === undefined ? undefined : useFallbackImage}
    data-cy={`field-card-material-image-${material.id}`}
  />
</div>

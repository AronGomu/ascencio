<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { isCardIdentityVisible } from "../../../duel/card-visibility.ts";
  import type { PublicCard } from "../../../duel/contracts/public-duel-state.ts";
  import type {
    CardImageLease,
    CardImageLibrary,
  } from "../../images/card-image-cache.ts";

  interface CardText {
    readonly name: string;
    readonly description?: string;
  }

  export let card: PublicCard;
  export let cardTexts: ReadonlyMap<number, CardText> = new Map();
  export let imageLibrary: Pick<CardImageLibrary, "lease"> | null = null;
  export let placeholderUrl = "";
  export let resolveCardImage: (card: PublicCard) => string | undefined = () =>
    undefined;
  export let onclose: () => void = () => undefined;

  let heading: HTMLHeadingElement | undefined;
  let activeImageLibrary: Pick<CardImageLibrary, "lease"> | null = null;
  let activeImageCode: number | undefined;
  let imageLease: CardImageLease | null = null;
  let leasedImageUrl: string | undefined;
  $: identityVisible =
    card.code !== undefined &&
    isCardIdentityVisible(0, card.controller, card.location, card.position);
  $: text =
    identityVisible && card.code !== undefined
      ? cardTexts.get(card.code)
      : undefined;
  $: name = text?.name ?? "Public card";
  $: description = text?.description;
  $: synchronizeImageLease(
    imageLibrary,
    identityVisible ? card.code : undefined,
  );
  $: imageUrl = identityVisible
    ? (resolveCardImage(card) ??
      leasedImageUrl ??
      (placeholderUrl || undefined))
    : undefined;

  onMount(() => heading?.focus());
  onDestroy(() => imageLease?.release());

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

  function words(value: string): string {
    return value.replaceAll(/([a-z])([A-Z])/g, "$1 $2").toLocaleLowerCase();
  }

  function counterLabel(nameValue: string, count: number): string {
    return `${count} ${nameValue}${count === 1 || nameValue.endsWith("s") ? "" : "s"}`;
  }

  function materialName(index: number): string {
    const material = card.overlayMaterials[index];
    if (
      material === undefined ||
      !material.identityVisible ||
      material.code === undefined
    )
      return "Hidden material";
    return cardTexts.get(material.code)?.name ?? `Card ${material.code}`;
  }
</script>

{#if identityVisible}
  <aside
    id="card-inspector"
    class="card-inspector"
    aria-labelledby="card-inspector-heading"
    data-cy="card-inspector"
  >
    <div class="card-inspector__copy" data-cy="card-inspector-copy">
      <p class="eyebrow" data-cy="card-inspector-eyebrow">
        Public card details
      </p>
      <h2
        id="card-inspector-heading"
        tabindex="-1"
        bind:this={heading}
        data-cy="card-inspector-heading"
      >
        {name}
      </h2>
      <p data-cy="card-inspector-location">
        {words(card.location)} · {words(card.position)}
      </p>
      {#if description}<p data-cy="card-inspector-description">
          {description}
        </p>{/if}
      {#if card.counters.length > 0}
        <ul
          class="state-badges"
          aria-label="Counters"
          data-cy="card-inspector-counters-list"
        >
          {#each card.counters as counter (`${counter.type}:${counter.name}`)}
            <li
              data-cy={`card-inspector-counter-${counter.type}-${counter.name}`}
            >
              <span aria-hidden="true" data-cy="card-inspector-counter-icon"
                >◆</span
              >
              {counterLabel(counter.name, counter.count)}
            </li>
          {/each}
        </ul>
      {/if}
      {#if card.overlayMaterials.length > 0}
        <ol
          class="material-list"
          aria-label="Materials"
          data-cy="card-inspector-materials-list"
        >
          {#each card.overlayMaterials as material, index (material.instanceId)}
            <li data-cy={`card-inspector-material-${material.instanceId}`}>
              Material {index + 1}: {materialName(index)}
            </li>
          {/each}
        </ol>
      {/if}
    </div>
    {#if imageUrl}<img
        src={imageUrl}
        alt={name}
        decoding="async"
        onerror={useFallbackImage}
        data-cy="card-inspector-image"
      />{/if}
    <button
      type="button"
      class="secondary"
      onclick={onclose}
      data-cy="card-inspector-close-button">Close card details</button
    >
  </aside>
{/if}

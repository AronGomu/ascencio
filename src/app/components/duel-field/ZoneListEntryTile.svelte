<script lang="ts">
  import { onDestroy } from "svelte";
  import type { ZoneListEntry } from "../../../field/zone-list.ts";
  import type {
    CardImageLease,
    CardImageLibrary,
  } from "../../images/card-image-cache.ts";
  import type { InteractionChoice } from "../../prompts/interaction-spec.ts";
  import CardActionChips from "./CardActionChips.svelte";

  export let entry: ZoneListEntry;
  export let choices: readonly InteractionChoice[] = [];
  export let imageLibrary: Pick<CardImageLibrary, "lease"> | null = null;
  export let cardBackUrl = "";
  export let placeholderUrl = "";
  export let disabled = false;
  export let onchoose: (choice: InteractionChoice) => void = () => undefined;
  export let onpreview: () => void = () => undefined;

  let activeImageLibrary: Pick<CardImageLibrary, "lease"> | null = null;
  let activeImageCode: number | undefined;
  let imageLease: CardImageLease | null = null;
  let renderedImageUrl = cardBackUrl;

  $: synchronizeImageLease(imageLibrary, entry.code, cardBackUrl);

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

<!-- svelte-ignore a11y_no_noninteractive_tabindex (entry participates in the dialog's roving preview-on-hover/focus behavior) -->
<div
  class="zone-list-entry"
  class:is-actionable={choices.length > 0}
  role="group"
  data-cy={`zone-list-entry-${entry.id}`}
  onpointerenter={onpreview}
  onfocusin={onpreview}
  tabindex="0"
>
  <img
    src={renderedImageUrl}
    alt={entry.identityVisible ? entry.label : ""}
    aria-hidden={!entry.identityVisible}
    decoding="async"
    onerror={useFallbackImage}
    data-cy={`zone-list-entry-image-${entry.id}`}
  />
  <span
    class="zone-list-entry__position"
    aria-hidden="true"
    data-cy={`zone-list-entry-position-${entry.id}`}
  >
    {entry.position}
  </span>
  {#if choices.length > 0}
    <CardActionChips
      cardId={entry.id}
      cardLabel={entry.label}
      {choices}
      {disabled}
      {onchoose}
      ondismiss={() => undefined}
    />
  {/if}
</div>

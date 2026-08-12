<script lang="ts">
  import { onDestroy } from "svelte";
  import type { ChoiceId } from "../../../duel/contracts/ids.ts";
  import type { ZoneListEntry } from "../../../field/zone-list.ts";
  import type {
    CardImageLease,
    CardImageLibrary,
  } from "../../images/card-image-cache.ts";
  import type { InteractionChoice } from "../../prompts/interaction-spec.ts";
  import CardActionChips from "./CardActionChips.svelte";

  export let entry: ZoneListEntry;
  export let choices: readonly InteractionChoice[] = [];
  export let selected = false;
  /* T16: browse keeps the action chips; target renders one 44px answer button
     per legal choice on this address. */
  export let mode: "browse" | "target" = "browse";
  export let zoneBadge = "";
  export let zoneLabel = "";
  export let selectedChoiceIds: readonly ChoiceId[] = [];
  export let ontargetchoice: (choice: InteractionChoice) => void = () =>
    undefined;
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

  function targetLabel(choice: InteractionChoice): string {
    const address = `${entry.label} in ${zoneLabel}`;
    return choices.length === 1 ? address : `${choice.label}: ${address}`;
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
  class:is-selected={selected}
  class:is-target={mode === "target"}
  class:is-opponent={entry.controller === 1}
  role="group"
  data-controller={entry.controller}
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
  {#if mode === "target"}
    <span
      class="zone-list-entry__zone"
      aria-hidden="true"
      data-cy={`zone-list-entry-zone-${entry.id}`}
    >
      {zoneBadge}
    </span>
    <div
      class="zone-list-entry__targets"
      class:is-single={choices.length === 1}
      data-cy={`zone-list-entry-targets-${entry.id}`}
    >
      {#each choices as choice (choice.id)}
        <button
          type="button"
          class="zone-list-entry__target"
          {disabled}
          aria-pressed={selectedChoiceIds.includes(choice.id)}
          aria-label={targetLabel(choice)}
          onclick={() => ontargetchoice(choice)}
          data-cy={`zone-list-entry-target-choice-${entry.id}-${choice.id}`}
        >
          {choices.length === 1 ? "" : choice.label}
        </button>
      {/each}
    </div>
  {:else if choices.length > 0}
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

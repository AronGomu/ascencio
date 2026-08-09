<script lang="ts">
  import { onDestroy, tick } from "svelte";
  import { SvelteMap } from "svelte/reactivity";
  import { isCardIdentityVisible } from "../../../duel/card-visibility.ts";
  import type {
    PlayerIndex,
    PublicCard,
  } from "../../../duel/contracts/public-duel-state.ts";
  import type {
    CardImageLease,
    CardImageLibrary,
  } from "../../images/card-image-cache.ts";

  interface CardText {
    readonly name: string;
  }

  type TrayZone = "deck" | "extra" | "graveyard" | "banished";

  const PAGE_SIZE = 24;

  export let label: string;
  export let player: PlayerIndex;
  export let zone: TrayZone;
  export let count: number;
  export let cards: readonly PublicCard[] = [];
  export let cardTexts: ReadonlyMap<number, CardText> = new Map();
  export let imageLibrary: Pick<CardImageLibrary, "lease"> | null = null;
  export let placeholderUrl = "";
  export let resolveCardImage: (card: PublicCard) => string | undefined = () =>
    undefined;
  export let oninspect: (
    card: PublicCard,
    trigger: HTMLButtonElement,
  ) => void = () => undefined;

  let open = false;
  let page = 0;
  let openButton: HTMLButtonElement;
  let trayElement: HTMLDivElement;
  let activeImageLibrary: Pick<CardImageLibrary, "lease"> | null = null;
  let imageLeases = new SvelteMap<number, CardImageLease>();
  let leasedImageUrls = new Map<number, string>();

  /* One tray is mounted per player and zone, so every element inside a tray
     suffixes this pair to stay unique inside the rendered document. */
  $: trayId = `${player}-${zone}`;
  $: visibleCards = cards.filter(canRevealCard);
  $: totalPages = Math.max(1, Math.ceil(visibleCards.length / PAGE_SIZE));
  $: if (page >= totalPages) page = totalPages - 1;
  $: pageCards = open
    ? visibleCards.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
    : [];
  $: synchronizeImageLeases(imageLibrary, pageCards);
  $: pageImages = pageCards.map((card) => cardImageUrl(card));
  $: collectionCanOpen = zone !== "deck" && visibleCards.length > 0;
  $: firstVisible = page * PAGE_SIZE + 1;
  $: lastVisible = Math.min((page + 1) * PAGE_SIZE, visibleCards.length);

  onDestroy(releaseImageLeases);

  function synchronizeImageLeases(
    library: Pick<CardImageLibrary, "lease"> | null,
    mountedCards: readonly PublicCard[],
  ): void {
    if (library !== activeImageLibrary) {
      releaseImageLeases();
      activeImageLibrary = library;
    }
    const codes = new Set(
      mountedCards
        .map(({ code }) => code)
        .filter((code): code is NonNullable<typeof code> => code !== undefined)
        .map(Number),
    );
    for (const [code, lease] of imageLeases) {
      if (codes.has(code)) continue;
      lease.release();
      imageLeases.delete(code);
    }
    if (library !== null) {
      for (const code of codes) {
        if (!imageLeases.has(code)) imageLeases.set(code, library.lease(code));
      }
    }
    leasedImageUrls = new Map(
      [...imageLeases].map(([code, lease]) => [code, lease.url]),
    );
  }

  function releaseImageLeases(): void {
    for (const lease of imageLeases.values()) lease.release();
    imageLeases.clear();
    leasedImageUrls = new Map();
  }

  function cardImageUrl(card: PublicCard): string | undefined {
    const resolved = resolveCardImage(card);
    if (resolved !== undefined) return resolved;
    if (card.code === undefined) return undefined;
    return (
      leasedImageUrls.get(Number(card.code)) ?? (placeholderUrl || undefined)
    );
  }

  function useFallbackImage(event: Event): void {
    const image = event.currentTarget as HTMLImageElement;
    image.onerror = null;
    if (placeholderUrl) image.src = placeholderUrl;
    else image.remove();
  }

  function canRevealCard(card: PublicCard): boolean {
    return (
      zone !== "deck" &&
      card.code !== undefined &&
      isCardIdentityVisible(0, card.controller, card.location, card.position)
    );
  }

  function cardName(card: PublicCard): string {
    if (card.code === undefined) return "Visible card";
    return cardTexts.get(card.code)?.name ?? `Card ${card.code}`;
  }

  async function show(): Promise<void> {
    page = 0;
    open = true;
    await tick();
    focusFirstCard();
  }

  async function close(returnFocus = true): Promise<void> {
    open = false;
    page = 0;
    await tick();
    if (returnFocus) openButton?.focus();
  }

  async function changePage(nextPage: number): Promise<void> {
    page = nextPage;
    await tick();
    focusFirstCard();
  }

  function focusFirstCard(): void {
    trayElement?.querySelector<HTMLButtonElement>(".card-tray__card")?.focus();
  }

  function inspect(card: PublicCard): void {
    oninspect(card, openButton);
    void close(false);
  }
</script>

<svelte:window
  onkeydown={(event) => {
    if (open && event.key === "Escape") {
      event.preventDefault();
      void close();
    }
  }}
/>

<section
  class="card-tray-summary"
  aria-label={`${label}, ${count} ${count === 1 ? "card" : "cards"}`}
  data-cy={`card-tray-${trayId}`}
>
  <div data-cy={`card-tray-summary-row-${trayId}`}>
    <strong data-cy={`card-tray-label-${trayId}`}>{label}</strong>
    <span data-cy={`card-tray-count-${trayId}`}>{count}</span>
  </div>
  {#if collectionCanOpen}
    <button
      type="button"
      class="secondary compact-button"
      bind:this={openButton}
      aria-expanded={open}
      aria-controls={`card-tray-${trayId}`}
      aria-label={`${open ? "Close" : "Open"} ${label} tray, ${count} ${count === 1 ? "card" : "cards"}`}
      onclick={() => (open ? void close() : void show())}
      data-cy={`card-tray-toggle-button-${trayId}`}
      >{open ? "Close" : "View"}</button
    >
  {:else}
    <span class="count-only" data-cy={`card-tray-count-only-${trayId}`}
      >Count only</span
    >
  {/if}

  {#if open}
    <div
      id={`card-tray-${trayId}`}
      class="card-tray"
      role="region"
      bind:this={trayElement}
      aria-label={`${label} tray`}
      data-cy={`card-tray-panel-${trayId}`}
    >
      <div class="card-tray__heading" data-cy={`card-tray-heading-${trayId}`}>
        <p data-cy={`card-tray-page-count-${trayId}`}>
          {firstVisible}–{lastVisible} of {visibleCards.length}
        </p>
        <button
          type="button"
          class="secondary compact-button"
          aria-label={`Close ${label} tray`}
          onclick={() => void close()}
          data-cy={`card-tray-close-button-${trayId}`}>Close</button
        >
      </div>
      <ul class="card-tray__cards" data-cy={`card-tray-cards-list-${trayId}`}>
        {#each pageCards as card, index (card.instanceId)}
          <li data-cy={`card-tray-card-${card.instanceId}`}>
            <button
              type="button"
              class="card-tray__card"
              aria-label={`Inspect ${cardName(card)}`}
              onclick={() => inspect(card)}
              data-cy={`card-tray-card-button-${card.instanceId}`}
            >
              {#if pageImages[index]}
                <img
                  src={pageImages[index]}
                  alt=""
                  decoding="async"
                  onerror={useFallbackImage}
                  data-cy={`card-tray-card-image-${card.instanceId}`}
                />
              {/if}
              <span data-cy={`card-tray-card-label-${card.instanceId}`}
                >{cardName(card)}</span
              >
            </button>
          </li>
        {/each}
      </ul>
      {#if totalPages > 1}
        <div
          class="card-tray__pagination"
          aria-label={`${label} pages`}
          data-cy={`card-tray-pagination-${trayId}`}
        >
          <button
            type="button"
            class="secondary compact-button"
            disabled={page === 0}
            onclick={() => void changePage(page - 1)}
            data-cy={`card-tray-page-previous-button-${trayId}`}
            >Previous</button
          >
          <span data-cy={`card-tray-page-indicator-${trayId}`}
            >Page {page + 1} of {totalPages}</span
          >
          <button
            type="button"
            class="secondary compact-button"
            disabled={page === totalPages - 1}
            onclick={() => void changePage(page + 1)}
            data-cy={`card-tray-page-next-button-${trayId}`}>Next</button
          >
        </div>
      {/if}
    </div>
  {/if}
</section>

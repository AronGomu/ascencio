<script lang="ts">
  import { tick } from "svelte";
  import { isCardIdentityVisible } from "../../../duel/card-visibility.ts";
  import type {
    PlayerIndex,
    PublicCard,
  } from "../../../duel/contracts/public-duel-state.ts";

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

  $: visibleCards = cards.filter(canRevealCard);
  $: totalPages = Math.max(1, Math.ceil(visibleCards.length / PAGE_SIZE));
  $: if (page >= totalPages) page = totalPages - 1;
  $: pageCards = open
    ? visibleCards.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
    : [];
  $: pageImages = pageCards.map((card) => resolveCardImage(card));
  $: collectionCanOpen = zone !== "deck" && visibleCards.length > 0;
  $: firstVisible = page * PAGE_SIZE + 1;
  $: lastVisible = Math.min((page + 1) * PAGE_SIZE, visibleCards.length);

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

  function inspect(card: PublicCard, trigger: HTMLButtonElement): void {
    oninspect(card, trigger);
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
>
  <div>
    <strong>{label}</strong>
    <span>{count}</span>
  </div>
  {#if collectionCanOpen}
    <button
      type="button"
      class="secondary compact-button"
      bind:this={openButton}
      aria-expanded={open}
      aria-controls={`card-tray-${player}-${zone}`}
      aria-label={`${open ? "Close" : "Open"} ${label} tray, ${count} ${count === 1 ? "card" : "cards"}`}
      onclick={() => (open ? void close() : void show())}
      >{open ? "Close" : "View"}</button
    >
  {:else}
    <span class="count-only">Count only</span>
  {/if}

  {#if open}
    <div
      id={`card-tray-${player}-${zone}`}
      class="card-tray"
      role="region"
      bind:this={trayElement}
      aria-label={`${label} tray`}
    >
      <div class="card-tray__heading">
        <p>{firstVisible}–{lastVisible} of {visibleCards.length}</p>
        <button
          type="button"
          class="secondary compact-button"
          aria-label={`Close ${label} tray`}
          onclick={() => void close()}>Close</button
        >
      </div>
      <ul class="card-tray__cards">
        {#each pageCards as card, index (card.instanceId)}
          <li>
            <button
              type="button"
              class="card-tray__card"
              aria-label={`Inspect ${cardName(card)}`}
              onclick={(event) =>
                inspect(card, event.currentTarget as HTMLButtonElement)}
            >
              {#if pageImages[index]}
                <img src={pageImages[index]} alt="" decoding="async" />
              {/if}
              <span>{cardName(card)}</span>
            </button>
          </li>
        {/each}
      </ul>
      {#if totalPages > 1}
        <div class="card-tray__pagination" aria-label={`${label} pages`}>
          <button
            type="button"
            class="secondary compact-button"
            disabled={page === 0}
            onclick={() => void changePage(page - 1)}>Previous</button
          >
          <span>Page {page + 1} of {totalPages}</span>
          <button
            type="button"
            class="secondary compact-button"
            disabled={page === totalPages - 1}
            onclick={() => void changePage(page + 1)}>Next</button
          >
        </div>
      {/if}
    </div>
  {/if}
</section>

<script lang="ts">
  import { onMount } from "svelte";
  import DecklistPanel from "./DecklistPanel.svelte";
  import DeckTile from "./DeckTile.svelte";
  import DeckTileMenu from "./DeckTileMenu.svelte";
  import DeleteDeckConfirm from "./DeleteDeckConfirm.svelte";
  import RenameDeckDialog from "./RenameDeckDialog.svelte";
  import type {
    DeckSelectMode,
    DeckSort,
    DeckTileModel,
    DecklistView,
    OpponentView,
  } from "./deck-select-contracts.ts";
  import { handleModalKeydown } from "./focus-trap.ts";
  import { orderDeckTiles, pinSelectedFirst } from "./order-deck-tiles.ts";

  export let mode: DeckSelectMode;
  export let eyebrow: string;
  export let title: string;
  /** Unordered; the screen ranks and filters them itself. */
  export let tiles: readonly DeckTileModel[];
  export let sort: DeckSort = "modified";
  /** The active pick in duel-start, the focused deck in the library. */
  export let selectedKey: string | null;
  export let startLabel = "Start the duel";
  export let canStart = false;
  /** Footer notice: why the duel cannot start, when something blocks it. */
  export let blockNotice: string | null = null;
  /** False hides both back controls. The story's briefing commits to the
      encounter it is seating, and its own way back sits outside this screen. */
  export let showBack = true;
  /** The origin the way back returns to, named rather than pointed at: only
      the host knows which screen it opened this one from. */
  export let backLabel = "Menu";
  /** False hides the footer's Delete/Rename/Duplicate cluster and every tile's
      kebab — a scope whose decks are managed somewhere else. Open and Start
      stay: they are how this screen is left, not how a deck is edited. */
  export let manageable = true;
  export let onselect: (key: string) => void = () => undefined;
  export let onstart: () => void = () => undefined;
  export let onback: () => void = () => undefined;
  export let onopen: (key: string) => void = () => undefined;
  export let onrename: (key: string, name: string) => void = () => undefined;
  export let onduplicate: (key: string) => void = () => undefined;
  export let ondelete: (key: string) => void = () => undefined;
  /** Making a deck belongs to whoever owns somewhere to make it; null is a
      host that owns none, and renders no Create at all. */
  export let oncreate: (() => void) | null = null;
  export let onfavourite: (key: string, favourite: boolean) => void = () =>
    undefined;
  /** Duel-start only; null hides the whole right column (library mode passes null). */
  export let opponent: OpponentView | null = null;
  /** Free-play picker options; empty + opponent.locked → no picker (story). */
  export let opponents: readonly OpponentView[] = [];
  /** Opponent's current deck tile; rendered as the red seat card. */
  export let opponentDeck: DeckTileModel | null = null;
  /** Your current deck tile; rendered as the blue seat card. */
  export let playerDeck: DeckTileModel | null = null;
  /** Which seat grid presses fill. Host owns it; card toggle reports. */
  export let seat: "player" | "opponent" = "player";
  export let onseat: (seat: "player" | "opponent") => void = () => undefined;
  export let onpickopponent: (id: string) => void = () => undefined;
  /** Test override for the phone layout: null follows the media query. */
  export let forceNarrow: boolean | null = null;
  /** Full decklist for a tile key; null = no preview for that tile. Async so
      hosts may lazy-load; the screen ignores stale resolutions, so only the
      currently hovered key's answer ever renders. */
  export let decklistFor:
    ((key: string) => Promise<DecklistView | null>) | null = null;
  /** Full-size text-free card art URL for a code; null = no art float. */
  export let cardImageFor: ((code: number) => string | null) | null = null;

  let filter = "";
  let filterField: HTMLInputElement;
  /** Which tile's kebab is open, and the kebab itself for the sheet to sit
      under. Null closes the sheet. */
  let menu: { key: string; anchor: HTMLElement } | null = null;
  let renaming: string | null = null;
  let deleting: string | null = null;
  let picking = false;
  let grid: HTMLElement | null = null;
  /* The deck the pointer is on, the tile it is on, and that deck's list once
     it resolves. The token is what a late answer is measured against. */
  let hoverToken = 0;
  let hoverKey: string | null = null;
  let hoverAnchor: HTMLElement | null = null;
  let hoverList: DecklistView | null = null;
  /** The dock's resting content: the list of whatever `selectedKey` names. */
  let restToken = 0;
  let restList: DecklistView | null = null;
  let art: { readonly url: string; readonly place: string } | null = null;
  /* The portrait opened the picker and is where the caret was, so it is bound
     here to take focus back however the picker closes. */
  let portrait: HTMLElement | null = null;
  let picker: HTMLElement | null = null;

  const NARROW_QUERY = "(max-width: 40rem)";
  /* A hover preview is a pointer's affordance: a finger has no hover to raise
     it with and none to take it away again, so a coarse pointer gets none. */
  const COARSE_QUERY = "(pointer: coarse)";
  /* The gap between a float and what it is floating beside, and the width the
     `.float` rule below declares — the flip needs it as a number. */
  const FLOAT_GAP = 12;
  const FLOAT_WIDTH = 320;
  const ART_HEIGHT = 340;
  let matchedNarrow = false;
  let matchedCoarse = false;

  function track(query: string, apply: (matches: boolean) => void): () => void {
    const media = window.matchMedia(query);
    apply(media.matches);
    const change = (event: MediaQueryListEvent) => apply(event.matches);
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }

  /* One listener per fact for the whole screen rather than one per row: the
     phone layout and the pointer's shape are properties of the viewport, and
     everything that reads them here is the same fact. Guarded because a test
     document has no `matchMedia` at all, and drives `forceNarrow` instead. */
  onMount(() => {
    if (typeof window.matchMedia !== "function") return;
    const stop = [
      track(NARROW_QUERY, (matches) => (matchedNarrow = matches)),
      track(COARSE_QUERY, (matches) => (matchedCoarse = matches)),
    ];
    return () => {
      for (const off of stop) off();
    };
  });

  $: narrow = forceNarrow ?? matchedNarrow;
  /** The deck filling the seat the grid is currently picking for. */
  $: activeKey =
    seat === "opponent" ? (opponentDeck?.key ?? null) : selectedKey;

  $: ranked = orderDeckTiles(
    tiles.filter((candidate) =>
      candidate.name
        .toLocaleLowerCase()
        .includes(filter.trim().toLocaleLowerCase()),
    ),
    sort,
  );
  /* One column on a phone, so the current pick would scroll out of reach while
     the rest of the list is browsed; the wide grid shows it without help. */
  $: shown = narrow ? pinSelectedFirst(ranked, activeKey) : ranked;
  /* Built here rather than interpolated in the markup: the count is one token
     and formatter whitespace around `{…}` would land inside it. */
  $: countLabel = `${shown.length}/${tiles.length}`;
  $: backText = `← Return to ${backLabel}`;

  /* Every lookup takes the pool as an argument so the reactive statements below
     re-run when the host hands over a new `tiles` — a renamed or deleted deck
     must not leave a stale model behind a dialog. */
  function tileFor(
    pool: readonly DeckTileModel[],
    key: string | null,
  ): DeckTileModel | null {
    if (key === null) return null;
    return pool.find((candidate) => candidate.key === key) ?? null;
  }

  $: seatPanel = mode === "duel-start" && opponent !== null;
  /* A host that hands over no resolver wants no previews at all, so the whole
     mechanism turns off with it. */
  $: previews = decklistFor !== null && !narrow && !matchedCoarse;
  $: docked = mode === "library" && decklistFor !== null && !narrow;
  /* Hovering borrows the dock and leaving gives it back, so the resting list
     is resolved once for the pick rather than re-fetched on every move. */
  $: dockList = (previews ? hoverList : null) ?? restList;
  $: void loadRest(decklistFor, selectedKey, docked);
  $: floatStyle = floatPlacement(hoverAnchor);
  $: selectedTile = tileFor(tiles, selectedKey);
  $: menuTile = tileFor(tiles, menu === null ? null : menu.key);
  $: renameTile = tileFor(tiles, renaming);
  $: deleteTile = tileFor(tiles, deleting);

  /* While the opponent seat is the one being filled the grid answers their
     question instead of yours: the halo follows their deck, and your own pick
     keeps the badge that stops it disappearing from view. */
  function haloFor(
    candidate: DeckTileModel,
  ): "you" | "opponent" | "focus" | null {
    if (seat === "opponent")
      return candidate.key === opponentDeck?.key ? "focus" : null;
    if (candidate.key !== selectedKey) return null;
    return "focus";
  }

  function selectedFor(candidate: DeckTileModel): boolean {
    return candidate.key === activeKey;
  }

  /* The card is the control: pressing the opponent's deck fills their seat,
     pressing it again returns to picking for yourself. */
  function toggleOpponentSeat(): void {
    onseat(seat === "opponent" ? "player" : "opponent");
  }

  function closePicker(): void {
    picking = false;
    portrait?.focus();
  }

  function pickOpponent(id: string): void {
    onpickopponent(id);
    closePicker();
  }

  /* The picker is modal, so the caret has to be inside it before Escape or
     Tab mean anything; the first option is where a press would have landed,
     and the dialog itself is the fallback that keeps Escape reachable. */
  $: if (picking && picker !== null)
    (picker.querySelector<HTMLElement>("button") ?? picker).focus();

  function pickerPointerDown(event: Event): void {
    if (!picking) return;
    const origin = event.target;
    if (origin instanceof Node && picker?.contains(origin)) return;
    closePicker();
  }

  /* The grid cell the pointer is inside, found by position: the tiles are the
     grid's own children in `shown` order, so the cell containing the event's
     target names the deck without reaching into the tile's markup. */
  function cellAt(target: EventTarget | null): {
    key: string;
    cell: HTMLElement;
  } | null {
    if (grid === null || !(target instanceof Node)) return null;
    const cells = [...grid.children];
    const index = cells.findIndex((candidate) => candidate.contains(target));
    const key = shown[index]?.key;
    const cell = cells[index];
    if (key === undefined || !(cell instanceof HTMLElement)) return null;
    return { key, cell };
  }

  /* `pointerenter` and `pointerleave` do not bubble, so the grid listens for
     them in the capture phase: one listener for every tile, and the tiles stay
     the grid's direct children instead of each gaining a wrapper to hang a
     handler on. Both fire again for a tile's own children, which is why the
     key and the target are checked before anything moves. */
  function enterTile(event: PointerEvent): void {
    if (!previews) return;
    const found = cellAt(event.target);
    if (found === null || found.key === hoverKey) return;
    void preview(found.key, found.cell);
  }

  function leaveTile(event: PointerEvent): void {
    const target = event.target;
    if (target !== grid && cellAt(target)?.cell !== target) return;
    clearPreview();
  }

  async function preview(key: string, cell: HTMLElement): Promise<void> {
    const resolve = decklistFor;
    if (resolve === null) return;
    const token = ++hoverToken;
    hoverKey = key;
    hoverAnchor = cell;
    hoverList = null;
    const resolved = await resolve(key);
    /* A slow deck resolving after the pointer moved on is answering a question
       nobody is asking any more. */
    if (token !== hoverToken) return;
    hoverList = resolved;
  }

  function clearPreview(): void {
    hoverToken += 1;
    hoverKey = null;
    hoverAnchor = null;
    hoverList = null;
    art = null;
  }

  async function loadRest(
    resolve: ((key: string) => Promise<DecklistView | null>) | null,
    key: string | null,
    active: boolean,
  ): Promise<void> {
    const token = ++restToken;
    restList = null;
    if (!active || resolve === null || key === null) return;
    const resolved = await resolve(key);
    if (token !== restToken) return;
    restList = resolved;
  }

  /* The float is as tall as the viewport allows — the design's 90-card deck,
     read with minimal scrolling — so only its side is decided here: beside the
     tile, and on the tile's other side when it would run off the right edge. */
  function floatPlacement(anchor: HTMLElement | null): string {
    if (anchor === null) return "";
    const rect = anchor.getBoundingClientRect();
    const flipped = rect.right + FLOAT_GAP + FLOAT_WIDTH > window.innerWidth;
    return flipped
      ? `right: ${Math.round(window.innerWidth - rect.left + FLOAT_GAP)}px`
      : `left: ${Math.round(rect.right + FLOAT_GAP)}px`;
  }

  /* The row names the card; the float is the card itself, held clear of the
     dock so it never covers the list it came from. */
  function showArt(code: number, anchor: HTMLElement): void {
    const url = cardImageFor?.(code) ?? null;
    if (url === null) {
      art = null;
      return;
    }
    const rect = anchor.getBoundingClientRect();
    const top = Math.max(
      FLOAT_GAP,
      Math.min(rect.top, window.innerHeight - ART_HEIGHT - FLOAT_GAP),
    );
    art = {
      url,
      place: `top: ${Math.round(top)}px; right: ${Math.round(window.innerWidth - rect.left + FLOAT_GAP)}px`,
    };
  }

  function openSelected(): void {
    if (selectedTile === null) return;
    onopen(selectedTile.key);
  }

  function duplicateSelected(): void {
    if (selectedTile === null) return;
    onduplicate(selectedTile.key);
  }

  /* The footer buttons and the kebab items are two paths to one operation, so
     both raise the same dialog rather than each confirming its own way. */
  function renameSelected(): void {
    if (selectedTile === null) return;
    renaming = selectedTile.key;
  }

  function deleteSelected(): void {
    if (selectedTile === null || !selectedTile.deletable) return;
    deleting = selectedTile.key;
  }

  /** Move the pick among legal decks in the order the grid shows them. */
  function step(delta: number): void {
    const legal = shown.filter((candidate) => candidate.legal);
    const index = legal.findIndex((candidate) => candidate.key === selectedKey);
    const target =
      legal[index < 0 ? (delta > 0 ? 0 : legal.length - 1) : index + delta];
    if (target === undefined) return;
    onselect(target.key);
  }

  /* A dialog or the kebab sheet owns the keyboard while it is up, and a field
     owns the letters typed into it — `/` and `f` are characters there, not
     shortcuts. */
  function shortcutsInert(event: KeyboardEvent): boolean {
    if (menu !== null || renaming !== null || deleting !== null || picking)
      return true;
    const target = event.target;
    return (
      target instanceof HTMLInputElement || target instanceof HTMLSelectElement
    );
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (shortcutsInert(event)) return;
    if (event.key === "/") {
      event.preventDefault();
      filterField.focus();
      return;
    }
    /* The grid scrolls, so an unhandled arrow would move the viewport under a
       pick that moved too. */
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      step(event.key === "ArrowDown" ? 1 : -1);
      return;
    }
    if (event.key === "Enter") {
      if (mode === "library") openSelected();
      else if (canStart) onstart();
      return;
    }
    if (event.key !== "f" || selectedTile === null) return;
    onfavourite(selectedTile.key, !selectedTile.favourite);
  }
</script>

<svelte:window onkeydown={handleKeydown} />
<svelte:document onpointerdown={pickerPointerDown} />

<section
  class="screen"
  class:paneled={seatPanel || docked}
  class:library={mode === "library"}
  data-cy="deck-select-screen"
>
  {#if mode === "duel-start" && opponent !== null}
    <!-- First in the markup rather than last: a screen reader meets who you
         face before the decks it is choosing against, while the grid places
         the panel on the right. -->
    <aside class="seat-panel" data-cy="duel-start-seat-panel">
      <!-- svelte-ignore a11y_no_static_element_interactions (the handler only
           exists on the button branch; a locked opponent renders an inert div) -->
      <svelte:element
        this={opponent.locked ? "div" : "button"}
        class="portrait"
        class:pressable={!opponent.locked}
        type={opponent.locked ? undefined : "button"}
        aria-label={opponent.locked
          ? undefined
          : `Change opponent: ${opponent.name}`}
        onclick={opponent.locked ? undefined : () => (picking = true)}
        bind:this={portrait}
        data-cy="duel-start-opponent-portrait"
      >
        <!-- Authored geometry rather than a packaged asset, matching the
             tile's own placeholder: no portrait art ships yet. -->
        <svg
          class="portrait-art"
          viewBox="0 0 120 90"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
          data-cy="duel-start-opponent-portrait-art"
        >
          <rect
            class="art-field"
            width="120"
            height="90"
            data-cy="duel-start-opponent-art-field"
          />
          <circle
            class="art-figure"
            cx="60"
            cy="38"
            r="17"
            data-cy="duel-start-opponent-art-head"
          />
          <path
            class="art-figure"
            d="M24 92 Q60 56 96 92 Z"
            data-cy="duel-start-opponent-art-shoulders"
          />
        </svg>
        {#if !opponent.locked}
          <span
            class="chip"
            aria-hidden="true"
            data-cy="duel-start-opponent-change-chip">⇄ Change</span
          >
        {/if}
      </svelte:element>

      <div class="identity" data-cy="duel-start-opponent-identity">
        <h2 data-cy="duel-start-opponent-name">{opponent.name}</h2>
        <p data-cy="duel-start-opponent-line">{opponent.line}</p>
      </div>

      {#if opponentDeck !== null}
        <!-- svelte-ignore a11y_no_static_element_interactions (the handler only
             exists on the button branch; the story's deck card is an inert div) -->
        <svelte:element
          this={opponent.locked ? "div" : "button"}
          class="seat-card"
          class:pressable={!opponent.locked}
          type={opponent.locked ? undefined : "button"}
          aria-pressed={opponent.locked ? undefined : seat === "opponent"}
          onclick={opponent.locked ? undefined : toggleOpponentSeat}
          data-cy="duel-start-opponent-deck"
        >
          <!-- The same deck can be a grid tile and this card at once, so the
               card's copy carries its own `data-cy` identity. -->
          <DeckTile
            tile={opponentDeck}
            cyKey={`opponent-${opponentDeck.key}`}
            halo={seat === "opponent" && !opponent.locked
              ? "focus"
              : "opponent"}
            showFavourite={false}
            showMenu={false}
            disabled
          />
        </svelte:element>
        {#if opponent.locked}
          <p class="locked" data-cy="duel-start-opponent-deck-locked">
            🔒 Set by the story
          </p>
        {/if}
      {/if}

      {#if playerDeck !== null}
        <button
          type="button"
          class="seat-card pressable"
          aria-pressed={seat === "player"}
          onclick={() => onseat("player")}
          data-cy="duel-start-your-deck"
        >
          <DeckTile
            tile={playerDeck}
            cyKey={`yours-${playerDeck.key}`}
            halo={seat === "player" ? "focus" : "you"}
            showFavourite={false}
            showMenu={false}
            disabled
          />
        </button>
      {/if}
    </aside>
  {/if}

  <header data-cy="deck-select-header">
    <!-- The phone's Back, in the document whenever there is one at all: the
         footer's button is the wide control and CSS shows whichever one the
         width uses, so the two are one affordance and `showBack` takes both. -->
    {#if showBack}
      <button
        type="button"
        class="back-icon"
        aria-label="Back"
        onclick={onback}
        data-cy="deck-select-back-icon"
      >
        <svg
          viewBox="0 0 20 20"
          aria-hidden="true"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          data-cy="deck-select-back-icon-glyph"
        >
          <path d="M12 4 L6 10 L12 16" data-cy="deck-select-back-icon-arrow" />
        </svg>
      </button>
    {/if}
    <div class="heading" data-cy="deck-select-heading">
      <p class="eyebrow" data-cy="deck-select-eyebrow">{eyebrow}</p>
      <h1 data-cy="deck-select-title">{title}</h1>
      <p class="count" data-cy="deck-select-count">{countLabel}</p>
    </div>
  </header>

  <div class="tools" data-cy="deck-select-tools">
    <label data-cy="deck-select-filter-field">
      <span data-cy="deck-select-filter-label">Filter</span>
      <input
        type="search"
        bind:value={filter}
        bind:this={filterField}
        data-cy="deck-select-filter"
      />
    </label>
    <label data-cy="deck-select-sort-field">
      <span data-cy="deck-select-sort-label">Sort</span>
      <select bind:value={sort} data-cy="deck-select-sort">
        <option value="modified" data-cy="deck-select-sort-option-modified"
          >Last modified</option
        >
        <option value="name" data-cy="deck-select-sort-option-name">Name</option
        >
      </select>
    </label>
  </div>

  <div
    class="grid"
    bind:this={grid}
    onpointerentercapture={enterTile}
    onpointerleavecapture={leaveTile}
    data-cy="deck-select-grid"
  >
    {#each shown as candidate (candidate.key)}
      <DeckTile
        tile={candidate}
        halo={haloFor(candidate)}
        selected={selectedFor(candidate)}
        yours={seat === "opponent" && candidate.key === playerDeck?.key}
        onpress={() => onselect(candidate.key)}
        ondblpress={() => onopen(candidate.key)}
        showMenu={manageable}
        onfavourite={(favourite) => onfavourite(candidate.key, favourite)}
        onmenu={(anchor) => (menu = { key: candidate.key, anchor })}
      />
    {/each}
  </div>

  <footer data-cy="deck-select-footer">
    {#if showBack}
      <button
        type="button"
        class="return wide-only"
        data-cy="deck-select-back"
        onclick={onback}>{backText}</button
      >
    {/if}
    {#if manageable}
      <div class="manage" data-cy="deck-select-manage">
        <button
          type="button"
          class="secondary act-delete"
          disabled={selectedTile === null || !selectedTile.deletable}
          data-cy="deck-select-delete"
          onclick={deleteSelected}>Delete</button
        >
        <button
          type="button"
          class="secondary act-rename"
          disabled={selectedTile === null}
          data-cy="deck-select-rename"
          onclick={renameSelected}>Rename</button
        >
        <button
          type="button"
          class="secondary act-duplicate"
          disabled={selectedTile === null}
          data-cy="deck-select-duplicate"
          onclick={duplicateSelected}>Duplicate</button
        >
        {#if oncreate !== null}
          <button
            type="button"
            class="act-create"
            data-cy="deck-select-create"
            onclick={oncreate}>+ Create</button
          >
        {/if}
      </div>
    {/if}
    {#if mode === "duel-start"}
      <button
        type="button"
        class="secondary wide-only"
        class:pushed={!manageable}
        disabled={selectedTile === null}
        data-cy="deck-select-open"
        onclick={openSelected}>Open</button
      >
      <button
        type="button"
        disabled={!canStart}
        data-cy="deck-select-start"
        onclick={onstart}>{startLabel}</button
      >
    {/if}
    {#if blockNotice !== null}
      <p class="notice" role="status" data-cy="deck-select-block-notice">
        {blockNotice}
      </p>
    {/if}
  </footer>

  {#if docked}
    <!-- The library's second column, the space duel start seats its opponent
         in. Last in the markup rather than first: it answers a question the
         pointer asked, so a screen reader meets the decks themselves first. -->
    <aside class="dock" data-cy="deck-select-dock">
      {#if dockList === null}
        <p class="dock-empty" data-cy="deck-select-docked-empty">
          Hover a deck to see its list.
        </p>
      {:else}
        <DecklistPanel
          decklist={dockList}
          cy="deck-select-docked-list"
          onrowhover={showArt}
          onrowleave={() => (art = null)}
        />
      {/if}
    </aside>
  {/if}
</section>

{#if mode === "duel-start" && hoverList !== null}
  <!-- Fixed to the viewport rather than placed in the grid: the grid scrolls,
       and the float is a read of the deck the pointer is on. -->
  <div class="float" style={floatStyle} data-cy="deck-select-hover-float">
    <DecklistPanel decklist={hoverList} cy="deck-select-hover-list" />
  </div>
{/if}

{#if art !== null}
  <img
    class="art-float"
    src={art.url}
    alt=""
    style={art.place}
    data-cy="deck-select-card-art-float"
  />
{/if}

{#if menu !== null && menuTile !== null}
  {@const key = menuTile.key}
  <DeckTileMenu
    tile={menuTile}
    anchor={menu.anchor}
    onclose={() => (menu = null)}
    onopen={() => onopen(key)}
    onrename={() => (renaming = key)}
    onduplicate={() => onduplicate(key)}
    ondelete={() => (deleting = key)}
  />
{/if}

{#if renameTile !== null}
  {@const key = renameTile.key}
  <RenameDeckDialog
    deckName={renameTile.name}
    oncancel={() => (renaming = null)}
    onsubmit={(name) => {
      onrename(key, name);
      renaming = null;
    }}
  />
{/if}

{#if picking && opponent !== null}
  <div
    class="picker"
    role="dialog"
    tabindex="-1"
    aria-modal="true"
    aria-labelledby="duel-start-opponent-picker-heading"
    data-cy="duel-start-opponent-picker"
    bind:this={picker}
    onkeydown={(event) => handleModalKeydown(event, closePicker)}
  >
    <h2
      id="duel-start-opponent-picker-heading"
      data-cy="duel-start-opponent-picker-heading"
    >
      Choose your opponent
    </h2>
    <div class="options" data-cy="duel-start-opponent-options">
      {#each opponents as option (option.id)}
        <!-- The deck tile's grammar without its stats row: an opponent has a
             name and a line, and nothing to count. -->
        <button
          type="button"
          class="option"
          aria-pressed={option.id === opponent.id}
          onclick={() => pickOpponent(option.id)}
          data-cy={`duel-start-opponent-option-${option.id}`}
        >
          <span
            class="option-name"
            data-cy={`duel-start-opponent-option-name-${option.id}`}
            >{option.name}</span
          >
          <span
            class="option-line"
            data-cy={`duel-start-opponent-option-line-${option.id}`}
            >{option.line}</span
          >
        </button>
      {/each}
    </div>
  </div>
{/if}

{#if deleteTile !== null}
  {@const key = deleteTile.key}
  <DeleteDeckConfirm
    deckName={deleteTile.name}
    oncancel={() => (deleting = null)}
    onconfirm={() => {
      ondelete(key);
      deleting = null;
    }}
  />
{/if}

<style>
  /* The left column of the desktop stage: the header, tools and footer keep
     their height and the grid takes what is left, so only the decks scroll. */
  .screen {
    display: grid;
    height: 100%;
    min-height: 0;
    grid-template-rows: auto auto minmax(0, 1fr) auto;
    gap: var(--space-3);
  }

  /* Hidden until the phone layout claims it, where the footer's Back is gone
     and the header is the only place a way out can live. */
  .back-icon {
    display: none;
    width: 2.25rem;
    height: 2.25rem;
    flex: 0 0 auto;
    place-items: center;
    padding: 0;
    border: 1px solid var(--border);
    border-radius: 50%;
    color: var(--text);
    background: var(--surface-raised);
    cursor: pointer;
  }

  .back-icon svg {
    width: 1rem;
    height: 1rem;
  }

  .eyebrow {
    margin: 0;
    color: var(--muted);
    font-size: var(--text-xs);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  h1 {
    margin: 0;
    font-size: var(--text-lg);
  }

  .count {
    margin: var(--space-1) 0 0;
    color: var(--muted);
    font-size: var(--text-sm);
  }

  .tools {
    display: flex;
    align-items: end;
    gap: var(--space-3);
  }

  .tools label {
    display: grid;
    gap: var(--space-1);
  }

  .tools label span {
    color: var(--muted);
    font-size: var(--text-xs);
  }

  input,
  select {
    min-height: 2.5rem;
    padding: var(--space-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    color: var(--text);
    background: var(--surface-chain);
  }

  .grid {
    display: grid;
    overflow-y: auto;
    min-height: 0;
    align-content: start;
    gap: var(--space-3);
    grid-auto-rows: max-content;
    grid-template-columns: repeat(auto-fit, minmax(min(14rem, 100%), 1fr));
  }

  /* Stuck to the bottom of whatever scrolls this screen, so the way out and
     the actions on a deck stay reachable while the grid is read. */
  footer {
    position: sticky;
    bottom: 0;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
    padding-top: var(--space-2);
    border-top: 1px solid var(--line-soft);
    background: var(--bg);
  }

  /* Leaving is the one thing the footer says on its left; everything that acts
     on a deck is gathered against the right edge. */
  .manage {
    display: flex;
    margin-left: auto;
    gap: var(--space-2);
  }

  /* The way out, weighted like one: taller than the deck actions beside it and
     the only red on the resting footer. */
  .return {
    min-height: 3.1rem;
    padding: 0 var(--space-5);
    border: 1px solid var(--danger-border);
    color: var(--danger);
    background: var(--danger-surface);
    font-family: var(--font-display);
    font-weight: 400;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .return:hover {
    border-color: var(--danger-strong);
    color: var(--ink);
    background: var(--danger-strong);
  }

  /* One hue per operation, tinted while it rests and solid under the pointer,
     so the destructive one never reads the same as the rest. Open keeps the
     neutral secondary: it opens a deck rather than changing one. */
  .act-delete {
    border-color: var(--danger-border);
    color: var(--danger);
    background: color-mix(in srgb, var(--danger) 12%, var(--surface-raised));
  }

  .act-delete:hover:not(:disabled) {
    border-color: var(--danger-strong);
    color: var(--ink);
    background: var(--danger-strong);
  }

  .act-rename {
    border-color: color-mix(in srgb, var(--selected) 55%, transparent);
    color: var(--selected);
    background: color-mix(in srgb, var(--selected) 12%, var(--surface-raised));
  }

  .act-rename:hover:not(:disabled) {
    border-color: var(--selected);
    color: var(--ink-on-accent);
    background: var(--selected);
  }

  .act-duplicate {
    border-color: color-mix(in srgb, var(--seat-you) 55%, transparent);
    color: var(--seat-you);
    background: color-mix(in srgb, var(--seat-you) 12%, var(--surface-raised));
  }

  .act-duplicate:hover:not(:disabled) {
    border-color: var(--seat-you);
    color: var(--ink);
    background: color-mix(in srgb, var(--seat-you) 55%, var(--surface-raised));
  }

  /* The only solid fill in the cluster: the one action that adds a deck rather
     than acting on the one already picked. */
  .act-create {
    border-color: var(--legal);
    color: var(--ink-on-legal);
    background: var(--legal);
    font-weight: 650;
  }

  /* The fill is restated rather than left to the rest state above: the global
     `button:hover` paints gold, and only a rule of this weight keeps green. */
  .act-create:hover:not(:disabled) {
    background: var(--legal);
    filter: brightness(1.08);
  }

  /* Nothing holds the left edge when the management cluster is gone, so the
     screen's own actions claim the right edge themselves. */
  .pushed {
    margin-left: auto;
  }

  footer button {
    min-height: 2.75rem;
  }

  .notice {
    flex-basis: 100%;
    margin: 0;
    color: var(--muted);
    font-size: var(--text-sm);
  }

  /* The second column: duel start seats the opponent there and the library
     docks its preview there. It holds the whole of column 2, so the four rows
     above auto-place down column 1 without being placed by hand. */
  .screen.paneled {
    grid-template-columns: minmax(0, 73fr) minmax(17rem, 27fr);
  }

  .seat-panel,
  .dock {
    display: grid;
    overflow-y: auto;
    min-height: 0;
    align-content: start;
    grid-row: 1 / -1;
    grid-column: 2;
    grid-auto-rows: max-content;
    gap: var(--space-2);
    padding-left: var(--space-3);
    border-left: 1px solid var(--border);
  }

  /* The design's 62rem breakpoint, measured on the viewport rather than on a
     container: this screen fills the stage, and the collapse stacks the panel
     above the grid it belongs to. */
  @media (max-width: 62rem) {
    .screen.paneled {
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: auto auto auto minmax(0, 1fr) auto;
    }

    .seat-panel,
    .dock {
      grid-row: 1;
      grid-column: 1;
      padding-bottom: var(--space-2);
      padding-left: 0;
      border-bottom: 1px solid var(--border);
      border-left: 0;
    }
  }

  /* The phone layout, at the design's 430px frame. Header, opponent, tools,
     one column of decks, sticky footer — the same markup, re-ordered. */
  @media (max-width: 40rem) {
    header {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    .heading {
      min-width: 0;
    }

    .back-icon {
      display: grid;
    }

    /* Row 1 is the header here rather than the panel: the phone says which
       screen you are on before who it is seating. The other four rows
       auto-place around this one in document order. */
    .screen.paneled .seat-panel {
      grid-row: 2;
    }

    .grid {
      grid-template-columns: minmax(0, 1fr);
    }

    footer {
      position: sticky;
      bottom: 0;
      padding-top: var(--space-2);
      border-top: 1px solid var(--border);
      background: var(--bg);
    }

    /* Deck management lives on each card's own kebab on a phone, so the footer
       keeps Start alone — and the library, which has no Start, keeps nothing
       but the header's back icon. */
    .manage,
    .wide-only {
      display: none;
    }

    .screen.library footer {
      display: none;
    }

    footer button {
      width: 100%;
    }
  }

  .portrait {
    position: relative;
    display: block;
    width: 100%;
    overflow: hidden;
    padding: 0;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    color: inherit;
    background: var(--surface-panel);
    font: inherit;
  }

  .portrait-art {
    display: block;
    width: 100%;
    height: 9rem;
  }

  .art-field {
    fill: var(--surface-panel);
  }

  .art-figure {
    fill: color-mix(in srgb, var(--accent) 22%, transparent);
  }

  /* The portrait is the control that swaps who you face, so the chip names
     that affordance the moment the pointer or the caret reaches it. */
  .chip {
    position: absolute;
    top: var(--space-2);
    right: var(--space-2);
    padding: 0.15rem 0.55rem;
    border: 1px solid var(--border);
    border-radius: 999px;
    color: var(--muted);
    background: color-mix(in srgb, var(--shadow) 72%, transparent);
    font-size: var(--text-xs);
    opacity: 0;
  }

  .portrait:hover .chip,
  .portrait:focus-visible .chip {
    border-color: var(--accent);
    color: var(--accent);
    opacity: 1;
  }

  /* A phone has no hover to reveal it, so the chip rides the portrait
     permanently there. Last, so it beats the resting `opacity: 0` above. */
  @media (pointer: coarse), (max-width: 40rem) {
    .chip {
      opacity: 1;
    }
  }

  .identity {
    display: grid;
    gap: var(--space-1);
  }

  .identity h2 {
    margin: 0;
    font-size: var(--text-md);
  }

  .identity p {
    margin: 0;
    color: var(--muted);
    font-size: var(--text-sm);
  }

  /* The card itself is the control, so the wrapper adds a press surface and
     no chrome of its own — the tile inside is the whole visual. */
  .seat-card {
    display: block;
    width: min(100%, 14rem);
    justify-self: center;
    padding: 0;
    border: 0;
    color: inherit;
    background: none;
    font: inherit;
    text-align: left;
  }

  /* The tile fills the card, and its own press button covers all of it. That
     button is disabled here, and a disabled control does not fire a click or
     let one through — so without this the wrapper never hears the press and
     the seat card is dead in a browser however it looks. Global because the
     tile's markup belongs to `DeckTile`. */
  .seat-card :global(.deck-tile) {
    pointer-events: none;
  }

  .pressable {
    cursor: pointer;
  }

  .locked {
    margin: 0;
    color: var(--muted);
    font-size: var(--text-xs);
  }

  .picker {
    position: fixed;
    z-index: 30;
    display: grid;
    inset: 50% auto auto 50%;
    width: min(26rem, 92vw);
    gap: var(--space-2);
    padding: var(--space-3);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--surface-raised);
    transform: translate(-50%, -50%);
  }

  /* `display: grid` above beats the user-agent `[hidden]` rule, so a host that
     hides the picker with the attribute would still see it on screen. The
     attribute is marked global because nothing here renders it statically and
     the compiler would otherwise prune the guard as an unused selector. */
  .picker:global([hidden]) {
    display: none;
  }

  .picker h2 {
    margin: 0;
    font-size: var(--text-md);
  }

  .options {
    display: grid;
    gap: var(--space-2);
  }

  .option {
    display: grid;
    gap: var(--space-1);
    padding: var(--space-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    color: var(--text);
    background: var(--surface-panel);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .option[aria-pressed="true"] {
    border-color: var(--seat-opponent);
  }

  .option-name {
    font-size: var(--text-md);
    font-weight: 650;
  }

  .option-line {
    color: var(--muted);
    font-size: var(--text-xs);
  }

  /* `display: grid` on `.seat-panel, .dock` beats the user-agent `[hidden]`
     rule, so a host that hides the dock with the attribute would still see it
     on screen. Global for the same reason as the picker's guard: nothing here
     renders the attribute statically. */
  .dock:global([hidden]) {
    display: none;
  }

  .dock-empty {
    margin: 0;
    color: var(--muted);
    font-size: var(--text-sm);
  }

  /* Duel start's hover preview. As tall as the viewport allows rather than a
     short tooltip — a 90-card deck is meant to be read without scrolling
     inside it — and transparent to the pointer, so floating over the tile it
     came from never counts as leaving that tile. */
  .float {
    position: fixed;
    z-index: 25;
    top: 1rem;
    display: grid;
    overflow-y: auto;
    width: 20rem;
    max-height: calc(100vh - 2rem);
    padding: var(--space-3);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--surface-raised);
    pointer-events: none;
  }

  .float:global([hidden]) {
    display: none;
  }

  /* The card the docked row names, at the size the art is worth looking at. */
  .art-float {
    position: fixed;
    z-index: 25;
    display: block;
    width: 15rem;
    max-height: calc(100vh - 2rem);
    border-radius: var(--radius-md);
    box-shadow: 0 0.5rem 1.5rem var(--shadow);
    pointer-events: none;
  }

  .art-float:global([hidden]) {
    display: none;
  }
</style>

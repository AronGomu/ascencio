<script lang="ts">
  import DeckTile from "./DeckTile.svelte";
  import DeckTileMenu from "./DeckTileMenu.svelte";
  import DeleteDeckConfirm from "./DeleteDeckConfirm.svelte";
  import RenameDeckDialog from "./RenameDeckDialog.svelte";
  import type {
    DeckSelectMode,
    DeckSort,
    DeckTileModel,
  } from "./deck-select-contracts.ts";
  import { orderDeckTiles } from "./order-deck-tiles.ts";

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
  export let onselect: (key: string) => void = () => undefined;
  export let onstart: () => void = () => undefined;
  export let onback: () => void = () => undefined;
  export let onopen: (key: string) => void = () => undefined;
  export let onrename: (key: string, name: string) => void = () => undefined;
  export let onduplicate: (key: string) => void = () => undefined;
  export let ondelete: (key: string) => void = () => undefined;
  export let onfavourite: (key: string, favourite: boolean) => void = () =>
    undefined;

  let filter = "";
  let filterField: HTMLInputElement;
  /** Which tile's kebab is open, and the kebab itself for the sheet to sit
      under. Null closes the sheet. */
  let menu: { key: string; anchor: HTMLElement } | null = null;
  let renaming: string | null = null;
  let deleting: string | null = null;

  $: shown = orderDeckTiles(
    tiles.filter((candidate) =>
      candidate.name
        .toLocaleLowerCase()
        .includes(filter.trim().toLocaleLowerCase()),
    ),
    sort,
  );
  /* Built here rather than interpolated in the markup: the count is one token
     and formatter whitespace around `{…}` would land inside it. */
  $: countLabel = `${shown.length}/${tiles.length}`;

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

  $: selectedTile = tileFor(tiles, selectedKey);
  $: menuTile = tileFor(tiles, menu === null ? null : menu.key);
  $: renameTile = tileFor(tiles, renaming);
  $: deleteTile = tileFor(tiles, deleting);

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
    if (menu !== null || renaming !== null || deleting !== null) return true;
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

<section class="screen" data-cy="deck-select-screen">
  <header data-cy="deck-select-header">
    <p class="eyebrow" data-cy="deck-select-eyebrow">{eyebrow}</p>
    <h1 data-cy="deck-select-title">{title}</h1>
    <p class="count" data-cy="deck-select-count">{countLabel}</p>
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

  <div class="grid" data-cy="deck-select-grid">
    {#each shown as candidate (candidate.key)}
      <DeckTile
        tile={candidate}
        halo={candidate.key === selectedKey
          ? mode === "duel-start"
            ? "you"
            : "focus"
          : null}
        selected={candidate.key === selectedKey}
        onpress={() => onselect(candidate.key)}
        ondblpress={() => onopen(candidate.key)}
        onfavourite={(favourite) => onfavourite(candidate.key, favourite)}
        onmenu={(anchor) => (menu = { key: candidate.key, anchor })}
      />
    {/each}
  </div>

  <footer data-cy="deck-select-footer">
    <button
      type="button"
      class="secondary"
      data-cy="deck-select-back"
      onclick={onback}>Back</button
    >
    <div class="manage" data-cy="deck-select-manage">
      <button
        type="button"
        class="secondary"
        disabled={selectedTile === null || !selectedTile.deletable}
        data-cy="deck-select-delete"
        onclick={deleteSelected}>Delete</button
      >
      <button
        type="button"
        class="secondary"
        disabled={selectedTile === null}
        data-cy="deck-select-rename"
        onclick={renameSelected}>Rename</button
      >
      <button
        type="button"
        class="secondary"
        disabled={selectedTile === null}
        data-cy="deck-select-duplicate"
        onclick={duplicateSelected}>Duplicate</button
      >
    </div>
    {#if mode === "duel-start"}
      <button
        type="button"
        class="secondary"
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
</section>

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
    grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
  }

  footer {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
  }

  /* The management cluster sits next to Back; Open and Start hold the right
     edge, where the screen's own action belongs. */
  .manage {
    display: flex;
    margin-right: auto;
    gap: var(--space-2);
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
</style>

<script lang="ts">
  import { MAXIMUM_DECK_NAME_LENGTH } from "../../decks/deck-model.ts";
  import type { DeckRecord, DeckZone } from "../../decks/deck-contracts.ts";
  import type { DeckBuilderCardView } from "../../decks/catalog/ocg-card-mapper.ts";
  import type { PinnedDeckRuleset } from "../../decks/catalog/pinned-ruleset.ts";
  import { tick } from "svelte";
  import { SvelteMap } from "svelte/reactivity";
  import type { DeckBuilderState } from "../deck-editor-store.ts";
  import CardCatalog from "./CardCatalog.svelte";
  import { CardPreviewPanel } from "../../shell/index.ts";
  import DeckWorkspace from "./DeckWorkspace.svelte";
  import EditorTabs from "./EditorTabs.svelte";
  import TapTargetMenu from "./TapTargetMenu.svelte";
  import {
    defaultPane,
    paneAfterAdd,
    paneAfterSelect,
    type EditorLayoutMode,
    type EditorPane,
  } from "../layout/editor-layout.ts";
  import {
    catalogTapZone,
    deckTapTargets,
    type TapTarget,
  } from "../layout/tap-targets.ts";
  import type { PickedCard } from "../drag-state.ts";

  export let state: DeckBuilderState;
  export let cards: readonly DeckBuilderCardView[];
  export let catalog: ReadonlyMap<number, DeckBuilderCardView>;
  export let ruleset: PinnedDeckRuleset;
  /* `panels` is the three-column desktop editor; `tabs` shows one pane at a
     time below the stage breakpoint. The shell decides which, so no component
     below here reads the stage a second time. */
  export let layoutMode: EditorLayoutMode = "panels";
  export let onlibrary: () => void;
  export let onrename: (name: string) => void;
  export let onmutate: (
    command: import("../../decks/deck-model.ts").DeckCommand,
  ) => void | Promise<void>;
  export let onundo: () => void;
  export let onredo: () => void;
  export let onretrysave: () => void;
  export let onreload: () => void;
  export let onpreservecopy: () => void;

  let selected: DeckBuilderCardView | null = null;
  let selectedCode: number | null = null;
  let hovered: DeckBuilderCardView | null = null;
  let hoveredCode: number | null = null;
  let picked: PickedCard | null = null;
  let announcement = "";
  let deckName = state.current?.deck.name ?? "";
  let pane: EditorPane = defaultPane();
  let tapped: { code: number; zone: DeckZone } | null = null;
  let tapOpener: HTMLElement | null = null;

  $: tabs = layoutMode === "tabs";
  $: deck = state.current?.deck ?? null;
  $: tapTargets = tapped === null ? [] : targetsFor(tapped.code, tapped.zone);
  $: if (
    deck !== null &&
    deck.name !== deckName &&
    document.activeElement?.id !== "deck-name"
  )
    deckName = deck.name;
  $: copies = deck === null ? new Map<number, number>() : countCopies(deck);
  $: previewSource = hovered ?? selected;
  $: previewSourceCode = hovered !== null ? hoveredCode : selectedCode;
  $: previewView =
    previewSource !== null
      ? {
          code: previewSource.code,
          name: previewSource.name,
          description: previewSource.description,
        }
      : previewSourceCode !== null
        ? {
            code: previewSourceCode,
            name: `Missing card ${previewSourceCode}`,
            description: "Card data is unavailable for this code.",
          }
        : null;
  $: previewImageUrl = previewSource?.imageUrl ?? null;

  function countCopies(value: DeckRecord): ReadonlyMap<number, number> {
    const result = new SvelteMap<number, number>();
    for (const code of [...value.main, ...value.extra, ...value.side])
      result.set(code, (result.get(code) ?? 0) + 1);
    return result;
  }

  /* Every tap runs the same command the drag and keyboard paths run, so undo,
     redo and autosave cannot tell the three apart. */
  function tapCatalogCard(card: DeckBuilderCardView): void {
    selected = card;
    selectedCode = card.code;
    onmutate({ type: "add", cardCode: card.code });
    announcement = `${card.name} added to ${catalogTapZone(card) === "main" ? "Main Deck" : "Extra Deck"}.`;
    pane = paneAfterAdd(pane);
  }

  function tapDeckCard(code: number, zone: DeckZone): void {
    selectCard(catalog.get(code) ?? null, code);
    tapOpener = document.activeElement as HTMLElement | null;
    tapped = { code, zone };
  }

  function targetsFor(code: number, zone: DeckZone): readonly TapTarget[] {
    const card = catalog.get(code);
    const counts =
      deck === null
        ? { main: 0, extra: 0, side: 0 }
        : {
            main: deck.main.length,
            extra: deck.extra.length,
            side: deck.side.length,
          };
    /* A card the pinned catalog no longer knows cannot be placed anywhere, so
       removal is the only honest offer. */
    if (card === undefined)
      return [
        {
          zone: "remove",
          label: "Remove from deck",
          enabled: true,
          reason: null,
        },
      ];
    return deckTapTargets(card, zone, counts, ruleset);
  }

  async function chooseTapTarget(target: DeckZone | "remove"): Promise<void> {
    const active = tapped;
    if (active === null) return;
    const name = catalog.get(active.code)?.name ?? `Card ${active.code}`;
    if (target === "remove") {
      onmutate({ type: "remove", cardCode: active.code, zone: active.zone });
      announcement = `${name} removed.`;
    } else {
      onmutate({
        type: "move",
        cardCode: active.code,
        from: active.zone,
        to: target,
      });
      announcement = `${name} moved to ${target}.`;
    }
    await closeTapMenu();
  }

  async function closeTapMenu(): Promise<void> {
    tapped = null;
    await tick();
    tapOpener?.focus();
    tapOpener = null;
  }

  function selectCard(card: DeckBuilderCardView | null, code: number): void {
    selectedCode = code;
    selected = card ?? catalog.get(code) ?? null;
  }

  function startCatalogDrag(
    card: DeckBuilderCardView,
    event?: DragEvent,
  ): void {
    selected = card;
    selectedCode = card.code;
    picked = { code: card.code, source: "catalog", index: null };
    event?.dataTransfer?.setData("text/plain", String(card.code));
    if (event?.dataTransfer) event.dataTransfer.effectAllowed = "copy";
    announcement = `${card.name} picked up. Drop in ${card.canonicalZone === "main" ? "Main Deck" : "Extra Deck"}.`;
  }

  function startZoneDrag(
    code: number,
    zone: DeckZone,
    index: number,
    event?: DragEvent,
  ): void {
    selected = catalog.get(code) ?? null;
    selectedCode = code;
    picked = { code, source: zone, index };
    event?.dataTransfer?.setData("text/plain", String(code));
    if (event?.dataTransfer) event.dataTransfer.effectAllowed = "move";
    announcement = `${selected?.name ?? `Card ${code}`} picked up from ${zone}.`;
  }

  function dropInZone(zone: DeckZone): void {
    if (picked === null) return;
    const card = catalog.get(picked.code);
    if (picked.source === "catalog") {
      if (card === undefined || zone !== card.canonicalZone) {
        announcement = `Card cannot be added to ${zone}.`;
        return;
      }
      onmutate({ type: "add", cardCode: picked.code });
    } else if (card === undefined) {
      announcement = `Missing card ${picked.code} can only be removed.`;
      return;
    } else if (picked.source !== zone) {
      onmutate({
        type: "move",
        cardCode: picked.code,
        from: picked.source,
        to: zone,
      });
    }
    announcement = `${card?.name ?? `Card ${picked.code}`} dropped in ${zone}.`;
    picked = null;
  }

  function reorderInZone(zone: DeckZone, toIndex: number): void {
    if (picked === null || picked.source !== zone || picked.index === null)
      return;
    onmutate({ type: "reorder", zone, from: picked.index, to: toIndex });
    picked = null;
  }

  function cancelPicked(): void {
    if (picked === null) return;
    picked = null;
    announcement = "Card movement canceled.";
  }

  function removePicked(): void {
    if (picked === null || picked.source === "catalog") {
      picked = null;
      return;
    }
    const code = picked.code;
    const source = picked.source;
    onmutate({ type: "remove", cardCode: code, zone: source });
    announcement = `${catalog.get(code)?.name ?? `Card ${code}`} removed.`;
    picked = null;
  }

  function handleKeydown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    const editingText =
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      (target?.isContentEditable ?? false);
    if (!editingText && (event.ctrlKey || event.metaKey)) {
      const key = event.key.toLowerCase();
      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        if ((state.current?.history.undo.length ?? 0) > 0) onundo();
        return;
      }
      if (key === "y" || (key === "z" && event.shiftKey)) {
        event.preventDefault();
        if ((state.current?.history.redo.length ?? 0) > 0) onredo();
        return;
      }
    }
    if (event.key !== "Escape") return;
    if (tapped !== null) {
      void closeTapMenu();
      announcement = "Card move cancelled.";
    } else if (picked !== null) {
      picked = null;
      announcement = "Card move cancelled.";
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if deck}
  <header class="editor-header" data-cy="deck-editor-header">
    <button
      type="button"
      class="secondary"
      data-cy="deck-editor-library-link"
      onclick={onlibrary}>Deck Library</button
    >
    <label class="name-field" data-cy="deck-editor-name-field">
      <span data-cy="deck-editor-name-label">Deck name</span>
      <input
        id="deck-name"
        data-cy="deck-name-input"
        bind:value={deckName}
        maxlength={MAXIMUM_DECK_NAME_LENGTH}
        onblur={() => {
          if (deckName.trim() && deckName.trim() !== deck?.name)
            onrename(deckName);
        }}
      />
    </label>
    <button
      type="button"
      class="secondary"
      disabled={state.current?.history.undo.length === 0}
      data-cy="deck-editor-undo"
      onclick={onundo}
      aria-keyshortcuts="Control+Z">Undo</button
    >
    <button
      type="button"
      class="secondary"
      disabled={state.current?.history.redo.length === 0}
      data-cy="deck-editor-redo"
      onclick={onredo}
      aria-keyshortcuts="Control+Y Control+Shift+Z">Redo</button
    >
  </header>

  {#if state.saveState === "failed"}
    <section
      class="message error"
      role="alert"
      data-cy="deck-editor-save-failed"
    >
      <p data-cy="deck-editor-save-failed-message">{state.message}</p>
      <button
        type="button"
        data-cy="deck-editor-retry-save"
        onclick={onretrysave}>Retry autosave</button
      >
      <button
        type="button"
        class="secondary"
        data-cy="deck-editor-reload-saved"
        onclick={onreload}>Reload saved deck</button
      >
    </section>
  {:else if state.saveState === "conflict"}
    <section class="message error" role="alert" data-cy="deck-editor-conflict">
      <p data-cy="deck-editor-conflict-message">{state.message}</p>
      <button
        type="button"
        data-cy="deck-editor-reload-revision"
        onclick={onreload}>Reload newer revision</button
      >
      <button
        type="button"
        class="secondary"
        data-cy="deck-editor-preserve-copy"
        onclick={onpreservecopy}>Preserve local edits as copy</button
      >
    </section>
  {:else if state.message}
    <p class="message" role="status" data-cy="deck-editor-message">
      {state.message}
    </p>
  {/if}

  <p
    class="visually-hidden"
    role="status"
    aria-live="polite"
    aria-atomic="true"
    data-cy="deck-editor-announcement"
  >
    {announcement}
  </p>

  <main
    class="editor-layout"
    class:tabs
    aria-busy={state.saveState === "saving"}
    data-cy="deck-editor-layout"
  >
    {#if tabs}
      <EditorTabs {pane} onselectpane={(next) => (pane = next)} />
    {/if}

    {#if !tabs || pane === "details"}
      <div
        class="pane"
        id="deck-pane-details"
        role={tabs ? "tabpanel" : undefined}
        data-cy="deck-pane-details"
      >
        <CardPreviewPanel
          preview={previewView}
          imageLibrary={null}
          staticImageUrl={previewImageUrl}
          placeholderUrl=""
        />
      </div>
    {/if}

    {#if !tabs || pane === "deck"}
      <div
        class="pane"
        id="deck-pane-deck"
        role={tabs ? "tabpanel" : undefined}
        data-cy="deck-pane-deck"
      >
        <DeckWorkspace
          {deck}
          {catalog}
          {ruleset}
          {selectedCode}
          {picked}
          filled={tabs}
          onselect={selectCard}
          ontap={tabs ? tapDeckCard : null}
          ondragcard={(code, zone, index, event) =>
            startZoneDrag(code, zone, index, event)}
          ondragcancel={cancelPicked}
          onpickup={(code, zone, index) => startZoneDrag(code, zone, index)}
          onreorderdrop={reorderInZone}
          onmutate={(command) => {
            onmutate(command);
          }}
          ondropzone={dropInZone}
          onremove={removePicked}
          onhovercard={(code) => {
            hovered = catalog.get(code) ?? null;
            hoveredCode = code;
          }}
          onhoverend={() => {
            hovered = null;
            hoveredCode = null;
          }}
        />
      </div>
    {/if}

    {#if !tabs || pane === "catalog"}
      <div
        class="pane"
        id="deck-pane-catalog"
        role={tabs ? "tabpanel" : undefined}
        data-cy="deck-pane-catalog"
      >
        <CardCatalog
          {cards}
          {ruleset}
          {selectedCode}
          {copies}
          filled={tabs}
          onselect={(card) => {
            selected = card;
            selectedCode = card.code;
          }}
          ontap={tabs ? tapCatalogCard : null}
          ondragcard={(card, event) => startCatalogDrag(card, event)}
          ondragcancel={cancelPicked}
          onpickup={(card) => startCatalogDrag(card)}
          onblocked={(card, reason) => {
            selected = card;
            selectedCode = card.code;
            announcement = `${card.name}: ${reason}`;
            pane = paneAfterSelect(pane, layoutMode);
          }}
          onhovercard={(card) => {
            hovered = card;
            hoveredCode = card.code;
          }}
          onhoverend={() => {
            hovered = null;
            hoveredCode = null;
          }}
        />
      </div>
    {/if}
  </main>

  {#if tapped !== null}
    <div class="backdrop" aria-hidden="true" data-cy="deck-tap-backdrop"></div>
    <TapTargetMenu
      cardName={catalog.get(tapped.code)?.name ?? `Card ${tapped.code}`}
      targets={tapTargets}
      onchoose={(target) => void chooseTapTarget(target)}
      oncancel={() => void closeTapMenu()}
    />
  {/if}
{/if}

<style>
  .editor-header {
    display: grid;
    grid-template-columns: auto auto 1fr auto auto;
    align-items: end;
    gap: 0.55rem;
    width: calc(100% - 0.5rem);
    margin-inline: auto;
    padding-block: 0.75rem;
  }

  .editor-header button {
    min-height: 2.45rem;
    padding: 0.45rem 0.65rem;
  }

  .name-field {
    display: grid;
    gap: 0.2rem;
  }

  .name-field span {
    color: var(--muted);
    font-size: 0.68rem;
  }

  .name-field input {
    width: 11rem;
    min-height: 2.45rem;
    padding: 0.45rem 0.6rem;
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: 0.5rem;
    background: var(--surface-chain);
    font-weight: 750;
  }

  .editor-layout {
    display: grid;
    grid-template-columns: minmax(18rem, 0.9fr) minmax(38rem, 1.9fr) minmax(
        17rem,
        0.82fr
      );
    gap: 0.75rem;
    width: calc(100% - 0.5rem);
    margin-inline: auto;
    padding-bottom: 0.75rem;
  }

  /* Above the breakpoint the pane wrapper is not a box at all: the three
     sections stay the grid's own children, so the desktop layout is the same
     layout it was before the panes existed. */
  .pane {
    display: contents;
  }

  .pane :global(.card-preview-panel) {
    height: calc(100vh - 5.5rem);
    overflow-y: auto;
  }

  .editor-layout.tabs {
    grid-template-columns: minmax(0, 1fr);
    align-content: start;
    gap: 0.55rem;
  }

  .editor-layout.tabs .pane {
    display: block;
    min-width: 0;
  }

  .message {
    width: calc(100% - 0.5rem);
    margin: 0 auto 0.6rem;
    padding: 0.65rem;
    border: 1px solid var(--border);
    border-radius: 0.5rem;
    background: var(--surface);
  }

  .message.error {
    border-color: var(--danger-border);
    background: var(--danger-surface);
  }

  .message p {
    margin: 0 0 0.5rem;
  }

  .backdrop {
    position: fixed;
    z-index: 20;
    inset: 0;
    background: color-mix(in srgb, var(--shadow) 68%, transparent);
  }

  /* Below the stage breakpoint the header wraps rather than scrolling sideways.
     The width matches `STAGE_BREAKPOINT_PX` in `src/shell/stage-layout.ts`. */
  @media (max-width: 1023.98px) {
    .editor-header {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      width: calc(100% - 1rem);
      padding-block: 0.5rem;
    }

    .name-field {
      flex: 1 1 9rem;
    }

    .editor-layout,
    .message {
      width: calc(100% - 1rem);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      transition-duration: 0.01ms !important;
      animation-duration: 0.01ms !important;
    }
  }
</style>

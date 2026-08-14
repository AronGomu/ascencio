<script lang="ts">
  import { afterUpdate, getContext, onMount, tick } from "svelte";
  import { get, readable, type Readable } from "svelte/store";
  import {
    computeStageBox,
    STAGE_CONTEXT_KEY,
    type StageBox,
  } from "../shell/index.ts";
  import { selectEditorLayoutMode } from "./layout/editor-layout.ts";
  import type {
    DeckCardLists,
    DeckId,
    DeckRecord,
  } from "../decks/deck-contracts.ts";
  import { DeckMigrationError } from "../decks/index.ts";
  import { IndexedDbDeckRepository } from "../decks/indexeddb-deck-repository.ts";
  import {
    catalogByCode,
    PROTOTYPE_RULESET,
  } from "../decks/catalog/pinned-ruleset.ts";
  import {
    DeckBuilderController,
    type DeckBuilderState,
  } from "./deck-editor-store.ts";
  import type { DeckEditorRoute } from "./deck-editor-route.ts";
  import { PROTOTYPE_CATALOG } from "./fixtures/catalog.ts";
  import DeckEditor from "./components/DeckEditor.svelte";
  import DeckLibrary from "./components/DeckLibrary.svelte";
  import YdkExport from "./components/YdkExport.svelte";
  import YdkImport from "./components/YdkImport.svelte";

  /** Which deck the app route asks for; `null` is the library at `#/decks`. */
  export let deckId: DeckId | null = null;
  /* The route is a controlled prop: the domain never writes the URL itself, it
     reports where it wants to go and waits for the shell to echo the new
     `deckId` back. A host that swallows the callback keeps the library. */
  export let onnavigate: (route: DeckEditorRoute) => void = () => undefined;

  const catalog = catalogByCode(PROTOTYPE_CATALOG);
  /* The shell is the only surface that measures the viewport: the editor reads
     the published stage once here and passes the resulting layout mode down,
     so no component below reads the stage a second time. The fallback keeps a
     harness that mounts the domain without the shell on the desktop layout. */
  const stage: Readable<StageBox> =
    getContext<Readable<StageBox> | undefined>(STAGE_CONTEXT_KEY) ??
    readable(computeStageBox(globalThis.innerWidth, globalThis.innerHeight));
  $: layoutMode = selectEditorLayoutMode($stage.mode);
  let state: DeckBuilderState = {
    mode: "loading",
    decks: [],
    current: null,
    saveState: "idle",
    message: null,
  };
  let controller: DeckBuilderController | null = null;
  let showLibraryImport = false;
  let libraryExport: DeckRecord | null = null;
  let modalOpener: HTMLElement | null = null;
  /* Storage boots into whichever deck was last opened, so the first paint
     stays on the loading skeleton until the requested route has been applied
     and a deep link can never flash the wrong deck. */
  let routeApplied = false;
  let appliedDeckId: DeckId | null = null;
  let notFound: DeckId | null = null;
  let routing = false;
  /* A failed migration is not a failed load: the decks still exist, in the
     database the migration refused to delete. Nothing may be edited until the
     copy completes, or a second editor session would write into the database
     the next attempt is about to overwrite. */
  let migrationError: DeckMigrationError | null = null;

  /* Applying the route reads IndexedDB, so it is watched here rather than
     from a reactive statement: `routing` keeps one application in flight and
     the tail re-checks a `deckId` that moved while storage was answering. */
  afterUpdate(() => void watchRoute());

  async function watchRoute(): Promise<void> {
    if (controller === null || routing) return;
    if (routeApplied && deckId === appliedDeckId) return;
    routing = true;
    try {
      await applyRoute(deckId);
    } finally {
      routing = false;
    }
    await watchRoute();
  }

  onMount(() => {
    let disposed = false;
    let unsubscribe: () => void = () => undefined;
    let close: () => void = () => undefined;
    void IndexedDbDeckRepository.open()
      .then(async (repository) => {
        if (disposed) {
          repository.close();
          return;
        }
        close = () => repository.close();
        controller = new DeckBuilderController(
          repository,
          catalog,
          PROTOTYPE_RULESET,
        );
        unsubscribe = controller.subscribe((value) => (state = value));
        await controller.initialize();
      })
      .catch((error: unknown) => {
        if (error instanceof DeckMigrationError) {
          migrationError = error;
          return;
        }
        state = {
          ...state,
          mode: "error",
          message: `Deck Editor could not start: ${error instanceof Error ? error.message : "Unknown error"}`,
        };
      });
    return () => {
      disposed = true;
      unsubscribe();
      close();
    };
  });

  async function applyRoute(id: DeckId | null): Promise<void> {
    const active = controller;
    if (active === null) return;
    appliedDeckId = id;
    notFound = null;
    if (id === null) await active.showLibrary();
    else if (get(active).current?.deck.id !== id) {
      await active.openDeck(id);
      /* A later route won the race, so this one no longer owns the view. */
      if (appliedDeckId !== id) return;
      if (get(active).current?.deck.id !== id) notFound = id;
    }
    routeApplied = true;
  }

  /** Every controller action that can change which deck is open runs through
      here, so the route always follows the controller rather than drifting
      from it. `showLibrary` refuses to abandon unsaved edits, and a refusal
      leaves the deck open — `syncRoute` then correctly keeps the URL on it. */
  async function runAndSync(
    action: Promise<unknown> | undefined,
  ): Promise<void> {
    await action;
    syncRoute();
  }

  /** Creating, importing and duplicating open their deck inside the
      controller, so the route has to catch up with what is already shown. */
  function syncRoute(): void {
    const settled = controller === null ? null : get(controller);
    const open =
      settled?.mode === "editor" ? (settled.current?.deck.id ?? null) : null;
    if (open === appliedDeckId) return;
    appliedDeckId = open;
    notFound = null;
    onnavigate({ deckId: open });
  }

  function openLibraryModal(
    kind: "import" | "export",
    deck?: DeckRecord,
  ): void {
    modalOpener = document.activeElement as HTMLElement | null;
    if (kind === "import") showLibraryImport = true;
    else libraryExport = deck ?? null;
  }

  async function closeLibraryModal(): Promise<void> {
    showLibraryImport = false;
    libraryExport = null;
    await tick();
    modalOpener?.focus();
    modalOpener = null;
  }

  async function importFromLibrary(
    cards: DeckCardLists,
    name: string,
  ): Promise<boolean> {
    if (controller === null) return false;
    const imported = await controller.importDeck(name, cards);
    if (imported) {
      await closeLibraryModal();
      syncRoute();
    }
    return imported;
  }
</script>

<svelte:head>
  <title>Deck Editor · YGO Story Duel Simulator</title>
</svelte:head>

{#if migrationError !== null}
  <main class="loading error" role="alert" data-cy="deck-migration-error">
    <p data-cy="deck-migration-error-eyebrow">Deck Editor stopped</p>
    <h1 data-cy="deck-migration-error-heading">Your decks were not moved</h1>
    <p data-cy="deck-migration-error-message">
      {migrationError.message}
    </p>
    <p data-cy="deck-migration-error-reassurance">
      Nothing was deleted. Close any other tab running this app and try again.
    </p>
    <button
      type="button"
      data-cy="deck-migration-retry"
      onclick={() => location.reload()}>Retry</button
    >
  </main>
{:else if state.mode === "error"}
  <main class="loading error" role="alert" data-cy="deck-editor-error">
    <p data-cy="deck-editor-error-eyebrow">Deck Editor stopped</p>
    <h1 data-cy="deck-editor-error-message">{state.message}</h1>
    <button
      type="button"
      data-cy="deck-editor-error-retry"
      onclick={() => location.reload()}>Retry</button
    >
  </main>
{:else if notFound !== null}
  <main class="loading" data-cy="deck-not-found">
    <p data-cy="deck-not-found-eyebrow">Deck Editor</p>
    <h1 data-cy="deck-not-found-heading">Deck not found</h1>
    <p data-cy="deck-not-found-message">
      No local deck is stored under “{notFound}”.
    </p>
    <a href="#/decks" data-cy="deck-not-found-back">Back to Deck Library</a>
  </main>
{:else if !routeApplied || state.mode === "loading"}
  <main class="loading" aria-busy="true" data-cy="deck-editor-loading">
    <p data-cy="deck-editor-loading-eyebrow">Deck Editor</p>
    <h1 data-cy="deck-editor-loading-heading">Loading local decks…</h1>
    <div class="skeleton" data-cy="deck-editor-loading-skeleton"></div>
  </main>
{:else if deckId === null}
  <DeckLibrary
    decks={state.decks}
    message={state.message}
    oncreate={(name) => runAndSync(controller?.createDeck(name))}
    onopen={(id) => onnavigate({ deckId: id })}
    onrename={async (deck, name) => {
      await controller?.openDeck(deck.id);
      await runAndSync(controller?.rename(name));
    }}
    onduplicate={(id) => runAndSync(controller?.duplicate(id))}
    ondelete={(deck) => controller?.deleteDeck(deck.id, deck.revision)}
    onexport={(deck) => openLibraryModal("export", deck)}
    onimport={() => openLibraryModal("import")}
  />
{:else if state.current !== null && state.current.deck.id === deckId}
  <DeckEditor
    {state}
    cards={PROTOTYPE_CATALOG}
    {catalog}
    ruleset={PROTOTYPE_RULESET}
    {layoutMode}
    onlibrary={() => void runAndSync(controller?.showLibrary())}
    onrename={(name) => void controller?.rename(name)}
    onmutate={(command) => controller?.mutate(command)}
    onundo={() => void controller?.undo()}
    onredo={() => void controller?.redo()}
    onretrysave={() => void controller?.retrySave()}
    onreload={() => void controller?.reloadCurrent()}
    onpreservecopy={() => void runAndSync(controller?.preserveCurrentAsCopy())}
  />
{:else}
  <main class="loading" aria-busy="true" data-cy="deck-editor-opening">
    <p data-cy="deck-editor-opening-eyebrow">Deck Editor</p>
    <h1 data-cy="deck-editor-opening-heading">Opening deck…</h1>
    <div class="skeleton" data-cy="deck-editor-opening-skeleton"></div>
  </main>
{/if}

{#if showLibraryImport}
  <div
    class="backdrop"
    aria-hidden="true"
    data-cy="deck-library-import-backdrop"
  ></div>
  <YdkImport
    requireName={true}
    catalogCodes={new Set(catalog.keys())}
    existingDeckNames={state.decks.map(({ name }) => name)}
    oncancel={() => void closeLibraryModal()}
    onimport={importFromLibrary}
  />
{/if}

{#if libraryExport}
  <div
    class="backdrop"
    aria-hidden="true"
    data-cy="deck-library-export-backdrop"
  ></div>
  <YdkExport deck={libraryExport} oncancel={() => void closeLibraryModal()} />
{/if}

<style>
  :global(body) {
    overflow-x: hidden;
  }

  .loading {
    width: min(70rem, calc(100% - 2rem));
    margin: 4rem auto;
  }

  .loading p {
    margin-bottom: 0.25rem;
    color: var(--muted);
  }

  .skeleton {
    height: 28rem;
    margin-top: 1.5rem;
    border: 1px solid var(--border);
    border-radius: 0.8rem;
    background: linear-gradient(
      90deg,
      var(--surface),
      var(--surface-strong),
      var(--surface)
    );
    background-size: 200% 100%;
    animation: loading 1.4s linear infinite;
  }

  .error {
    padding: 1rem;
    border: 1px solid #a43b50;
    border-radius: 0.8rem;
    background: #321825;
  }

  .backdrop {
    position: fixed;
    z-index: 20;
    inset: 0;
    background: rgb(0 0 0 / 0.68);
  }

  @keyframes loading {
    to {
      background-position: -200% 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .skeleton {
      animation: none;
    }
  }
</style>

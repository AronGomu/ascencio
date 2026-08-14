<script lang="ts">
  import { onMount } from "svelte";
  import { handleModalKeydown } from "../focus-trap.ts";
  import type { DeckCardLists } from "../../decks/deck-contracts.ts";
  import { MAXIMUM_DECK_NAME_LENGTH } from "../../decks/deck-model.ts";
  import {
    importYdk,
    MAXIMUM_YDK_SOURCE_LENGTH,
    type YdkImportResult,
  } from "../../decks/ydk-adapter.ts";

  export let onimport: (
    cards: DeckCardLists,
    name: string,
  ) => boolean | void | Promise<boolean | void>;
  export let oncancel: () => void;
  export let requireName = false;
  export let catalogCodes: ReadonlySet<number> = new Set();
  export let existingDeckNames: readonly string[] = [];

  let source = "";
  let deckName = "Imported Deck";
  let result: YdkImportResult | null = null;
  let selectedFilename: string | null = null;
  let isImporting = false;
  let importError: string | null = null;
  let heading: HTMLHeadingElement;

  $: unknownCodes =
    result?.type === "ready"
      ? [
          ...new Set([
            ...result.cards.main,
            ...result.cards.extra,
            ...result.cards.side,
          ]),
        ]
          .filter((code) => !catalogCodes.has(code))
          .sort((left, right) => left - right)
      : [];
  $: duplicateName = existingDeckNames.some(
    (name) => name.toLocaleLowerCase() === deckName.trim().toLocaleLowerCase(),
  );

  onMount(() => heading.focus());

  function preview(): void {
    result = importYdk(source);
  }

  async function loadFile(event: Event): Promise<void> {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    if (file === undefined) return;
    selectedFilename = file.name;
    if (file.size > MAXIMUM_YDK_SOURCE_LENGTH) {
      result = {
        type: "invalid",
        message: `YDK file exceeds ${MAXIMUM_YDK_SOURCE_LENGTH.toLocaleString()} bytes`,
        line: null,
      };
      return;
    }
    try {
      source = await file.text();
      preview();
    } catch (error) {
      result = {
        type: "invalid",
        message: `File read failed: ${error instanceof Error ? error.message : "Browser could not read file"}`,
        line: null,
      };
    }
  }

  function sourceChanged(): void {
    result = null;
    importError = null;
    selectedFilename = null;
  }

  async function commitImport(): Promise<void> {
    if (
      result?.type !== "ready" ||
      (requireName &&
        (deckName.trim().length === 0 ||
          deckName.trim().length > MAXIMUM_DECK_NAME_LENGTH))
    )
      return;
    isImporting = true;
    importError = null;
    try {
      const imported = await onimport(result.cards, deckName.trim());
      if (imported === false)
        importError = "Import could not be saved. Try again.";
    } catch (error) {
      importError = `Import failed: ${error instanceof Error ? error.message : "Unknown error"}`;
    } finally {
      isImporting = false;
    }
  }
</script>

<div
  class="dialog"
  role="dialog"
  tabindex="-1"
  aria-modal="true"
  aria-labelledby="ydk-import-heading"
  aria-busy={isImporting}
  data-cy="deck-ydk-import"
  onkeydown={(event) =>
    handleModalKeydown(event, () => {
      if (!isImporting) oncancel();
    })}
>
  <header data-cy="deck-ydk-import-header">
    <div data-cy="deck-ydk-import-titles">
      <p data-cy="deck-ydk-import-eyebrow">YDK import</p>
      <h2
        id="ydk-import-heading"
        tabindex="-1"
        data-cy="deck-ydk-import-heading"
        bind:this={heading}
      >
        Import deck list
      </h2>
    </div>
    <button
      type="button"
      class="secondary"
      disabled={isImporting}
      data-cy="deck-ydk-import-cancel"
      onclick={oncancel}>Cancel</button
    >
  </header>
  {#if requireName}
    <label data-cy="deck-ydk-import-name-field">
      <span data-cy="deck-ydk-import-name-label">Deck name</span>
      <input
        bind:value={deckName}
        maxlength={MAXIMUM_DECK_NAME_LENGTH}
        disabled={isImporting}
        data-cy="deck-ydk-import-name-input"
      />
    </label>
  {/if}
  <label data-cy="deck-ydk-import-file-field">
    <span data-cy="deck-ydk-import-file-label">Choose .ydk file</span>
    <input
      type="file"
      data-cy="deck-ydk-import-file-input"
      accept=".ydk,text/plain"
      disabled={isImporting}
      aria-invalid={result?.type === "invalid"}
      aria-describedby={result?.type === "invalid"
        ? "ydk-import-error"
        : undefined}
      onchange={(event) => void loadFile(event)}
    />
  </label>
  <label data-cy="deck-ydk-import-source-field">
    <span data-cy="deck-ydk-import-source-label">Or paste YDK text</span>
    <textarea
      data-cy="deck-ydk-import-source-input"
      bind:value={source}
      oninput={sourceChanged}
      rows="12"
      disabled={isImporting}
      aria-invalid={result?.type === "invalid"}
      aria-describedby={result?.type === "invalid"
        ? "ydk-import-error"
        : undefined}
      placeholder="#main&#10;89631139&#10;#extra&#10;!side"></textarea>
  </label>
  <button
    type="button"
    disabled={isImporting || source.trim().length === 0}
    data-cy="deck-ydk-import-preview"
    onclick={preview}>Preview import</button
  >

  {#if result?.type === "invalid"}
    <div
      id="ydk-import-error"
      class="error"
      role="alert"
      data-cy="deck-ydk-import-error"
    >
      <h3 data-cy="deck-ydk-import-error-heading">
        Import could not be parsed
      </h3>
      <p data-cy="deck-ydk-import-error-message">{result.message}</p>
      {#if result.line !== null}<p data-cy="deck-ydk-import-error-line">
          Check line {result.line}.
        </p>{/if}
    </div>
  {:else if result?.type === "ready"}
    <div class="preview" data-cy="deck-ydk-import-preview-panel">
      <h3 data-cy="deck-ydk-import-preview-heading">Import preview</h3>
      {#if selectedFilename !== null}
        <p data-cy="deck-ydk-import-preview-file">
          <strong data-cy="deck-ydk-import-preview-file-label">File:</strong>
          {selectedFilename}
        </p>
      {/if}
      <p data-cy="deck-ydk-import-preview-counts">
        Main {result.cards.main.length} · Extra {result.cards.extra.length} · Side
        {result.cards.side.length}
      </p>
      {#if duplicateName}
        <p class="error" role="status" data-cy="deck-ydk-import-duplicate-name">
          Another local deck already uses this name. Import creates a separate
          deck ID.
        </p>
      {/if}
      {#if unknownCodes.length > 0}
        <div
          class="error"
          role="status"
          data-cy="deck-ydk-import-unknown-codes"
        >
          <strong data-cy="deck-ydk-import-unknown-codes-label"
            >Unknown card codes</strong
          >
          <p data-cy="deck-ydk-import-unknown-codes-list">
            {unknownCodes.join(", ")}
          </p>
        </div>
      {/if}
      <p data-cy="deck-ydk-import-preview-note">
        Unknown or misplaced cards remain visible as validation errors. Nothing
        is repaired silently.
      </p>
      <button
        type="button"
        data-cy="deck-ydk-import-commit"
        disabled={isImporting ||
          (requireName &&
            (deckName.trim().length === 0 ||
              deckName.trim().length > MAXIMUM_DECK_NAME_LENGTH))}
        onclick={() => void commitImport()}
        >{isImporting ? "Importing…" : "Replace deck cards"}</button
      >
    </div>
  {/if}
  {#if importError !== null}<p
      class="error"
      role="alert"
      data-cy="deck-ydk-import-commit-error"
    >
      {importError}
    </p>{/if}
</div>

<style>
  .dialog {
    position: fixed;
    z-index: 30;
    inset: 50% auto auto 50%;
    width: min(42rem, calc(100vw - 3rem));
    max-height: calc(100vh - 3rem);
    padding: 1rem;
    overflow-y: auto;
    transform: translate(-50%, -50%);
    border: 1px solid var(--border);
    border-radius: 0.85rem;
    background: #111b2f;
    box-shadow: 0 1.5rem 5rem rgb(0 0 0 / 0.55);
  }

  header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
  }

  h2,
  h3,
  p {
    margin-top: 0;
  }

  header p,
  label span {
    color: var(--muted);
    font-size: 0.76rem;
    font-weight: 750;
  }

  label {
    display: grid;
    gap: 0.3rem;
    margin-block: 0.75rem;
  }

  textarea,
  input {
    padding: 0.6rem;
    color: #e8edf8;
    border: 1px solid var(--border);
    border-radius: 0.5rem;
    background: #08101f;
  }

  textarea {
    resize: vertical;
  }

  .error,
  .preview {
    margin-top: 0.8rem;
    padding: 0.8rem;
    border: 1px solid var(--border);
    border-radius: 0.55rem;
    background: #18243b;
  }

  .error {
    border-color: #a43b50;
    background: #321825;
  }
</style>

<script lang="ts">
  import { getContext, onMount } from "svelte";
  import { handleModalKeydown } from "../focus-trap.ts";
  import type { DeckRecord } from "../../decks/deck-contracts.ts";
  import { exportYdk, ydkFilename } from "../../decks/ydk-adapter.ts";
  import { TOAST_CONTEXT_KEY, type ToastPublisher } from "../../shell/index.ts";

  export let deck: DeckRecord;
  export let oncancel: () => void;

  let message = "";
  let heading: HTMLHeadingElement;
  const toasts = getContext<ToastPublisher | undefined>(TOAST_CONTEXT_KEY);
  $: source = exportYdk(deck);
  $: filename = ydkFilename(deck.name);

  onMount(() => heading.focus());

  async function copyText(): Promise<void> {
    try {
      await navigator.clipboard.writeText(source);
      message = "";
      if (toasts === undefined) message = "YDK text copied.";
      else toasts.show({ message: "YDK text copied.", tone: "success" });
    } catch (error) {
      message = `Copy failed: ${error instanceof Error ? error.message : "Clipboard unavailable"}`;
    }
  }

  function download(): void {
    try {
      const url = URL.createObjectURL(
        new Blob([source], { type: "text/plain" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
      const confirmation = `Downloaded ${filename}.`;
      message = "";
      if (toasts === undefined) message = confirmation;
      else toasts.show({ message: confirmation, tone: "success" });
    } catch (error) {
      message = `Download failed: ${error instanceof Error ? error.message : "Browser download unavailable"}`;
    }
  }
</script>

<div
  class="dialog"
  role="dialog"
  tabindex="-1"
  aria-modal="true"
  aria-labelledby="ydk-export-heading"
  data-cy="deck-ydk-export"
  onkeydown={(event) => handleModalKeydown(event, oncancel)}
>
  <header data-cy="deck-ydk-export-header">
    <div data-cy="deck-ydk-export-titles">
      <p data-cy="deck-ydk-export-eyebrow">YDK export</p>
      <h2
        id="ydk-export-heading"
        tabindex="-1"
        data-cy="deck-ydk-export-heading"
        bind:this={heading}
      >
        Export {deck.name}
      </h2>
    </div>
    <button
      type="button"
      class="secondary"
      data-cy="deck-ydk-export-close"
      onclick={oncancel}>Close</button
    >
  </header>
  <p data-cy="deck-ydk-export-counts">
    Main {deck.main.length} · Extra {deck.extra.length} · Side {deck.side
      .length}
  </p>
  {#if deck.validation.status === "errors"}
    <p class="warning" role="alert" data-cy="deck-ydk-export-warning">
      Deck is invalid. Export is allowed, but VN deck resolution will reject it.
    </p>
  {/if}
  <label data-cy="deck-ydk-export-filename-field">
    <span data-cy="deck-ydk-export-filename-label">Filename</span>
    <input value={filename} readonly data-cy="deck-ydk-export-filename-input" />
  </label>
  <textarea
    rows="12"
    readonly
    value={source}
    aria-label="YDK text"
    data-cy="deck-ydk-export-text"></textarea>
  <div class="actions" data-cy="deck-ydk-export-actions">
    <button
      type="button"
      data-cy="deck-ydk-export-copy"
      onclick={() => void copyText()}>Copy YDK text</button
    >
    <button
      type="button"
      class="secondary"
      data-cy="deck-ydk-export-download"
      onclick={download}>Download .ydk</button
    >
  </div>
  {#if message}<p role="status" data-cy="deck-ydk-export-status">
      {message}
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
    background: var(--surface);
    box-shadow: 0 1.5rem 5rem color-mix(in srgb, var(--shadow) 55%, transparent);
  }

  header,
  .actions {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.75rem;
  }

  h2,
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
  }

  input,
  textarea {
    width: 100%;
    padding: 0.6rem;
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: 0.5rem;
    background: var(--bg);
  }

  textarea {
    margin-block: 0.75rem;
    resize: vertical;
  }

  .warning {
    padding: 0.7rem;
    border: 1px solid var(--warning-border);
    border-radius: 0.5rem;
    background: var(--warning-surface);
  }
</style>

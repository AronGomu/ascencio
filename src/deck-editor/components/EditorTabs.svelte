<script lang="ts">
  import type { EditorPane } from "../layout/editor-layout.ts";

  export let pane: EditorPane;
  export let onselectpane: (next: EditorPane) => void = () => undefined;

  const PANES: readonly { pane: EditorPane; label: string }[] = [
    { pane: "catalog", label: "Catalog" },
    { pane: "deck", label: "Deck" },
    { pane: "details", label: "Details" },
  ];

  /* Arrow keys move the selection, which is what a tab list does: the panes
     are cheap enough that following focus needs no separate activation. */
  function step(event: KeyboardEvent, index: number): void {
    const delta =
      event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (delta === 0) return;
    event.preventDefault();
    const next = PANES[(index + delta + PANES.length) % PANES.length]!;
    onselectpane(next.pane);
    document
      .querySelector<HTMLElement>(`[data-cy="deck-tab-${next.pane}"]`)
      ?.focus();
  }
</script>

<div
  class="tabs"
  role="tablist"
  aria-label="Deck editor panes"
  data-cy="deck-editor-tabs"
>
  {#each PANES as entry, index (entry.pane)}
    <button
      type="button"
      role="tab"
      class:active={pane === entry.pane}
      aria-selected={pane === entry.pane}
      aria-controls={`deck-pane-${entry.pane}`}
      tabindex={pane === entry.pane ? 0 : -1}
      data-cy={`deck-tab-${entry.pane}`}
      onclick={() => onselectpane(entry.pane)}
      onkeydown={(event) => step(event, index)}>{entry.label}</button
    >
  {/each}
</div>

<style>
  .tabs {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.35rem;
    padding: 0.35rem;
    border: 1px solid var(--border);
    border-radius: 0.6rem;
    background: var(--surface);
  }

  button {
    min-height: 2.75rem;
    padding: 0.5rem 0.4rem;
    color: var(--text);
    border: 1px solid transparent;
    background: transparent;
  }

  button.active {
    color: var(--ink-on-accent);
    background: var(--accent);
  }
</style>

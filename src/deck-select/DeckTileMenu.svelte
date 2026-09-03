<script lang="ts">
  import { onMount } from "svelte";
  import type { DeckTileModel } from "./deck-select-contracts.ts";

  export let tile: DeckTileModel;
  export let anchor: HTMLElement;
  /** Menu closes itself on any choice, outside press, or Escape; host clears state. */
  export let onclose: () => void = () => undefined;
  export let onopen: () => void = () => undefined;
  export let openDisabled = false;
  export let openDisabledReason: string | null = null;
  export let onrename: () => void = () => undefined;
  export let onduplicate: () => void = () => undefined;
  export let ondelete: () => void = () => undefined;

  let sheet: HTMLElement;
  let top = 0;
  let left = 0;
  $: openReasonId = `deck-tile-menu-open-reason-${tile.key}`;

  onMount(() => {
    place();
    sheet.querySelector<HTMLElement>("button:not([disabled])")?.focus();
    document.addEventListener("pointerdown", documentPointerDown, true);
    document.addEventListener("keydown", documentKeydown);
    return () => {
      document.removeEventListener("pointerdown", documentPointerDown, true);
      document.removeEventListener("keydown", documentKeydown);
      /* The kebab is where the pointer and the caret both were, so the sheet
         hands focus back to it however it closed — chosen item, outside press
         or Escape alike. */
      if (anchor.isConnected) anchor.focus();
    };
  });

  /* Below the kebab, growing right from its left edge, flipped above when the
     sheet would run past the viewport bottom. The rect is in viewport
     coordinates, so the sheet is fixed rather than a child of the tile — a
     tile clips its own overflow and would cut the sheet in half. */
  function place(): void {
    const opener = anchor.getBoundingClientRect();
    const height = sheet.getBoundingClientRect().height;
    const fitsBelow = opener.bottom + height <= window.innerHeight;
    top = fitsBelow ? opener.bottom : opener.top - height;
    left = opener.left;
  }

  function choose(action: () => void): void {
    action();
    onclose();
  }

  function documentPointerDown(event: Event): void {
    const origin = event.target;
    if (origin instanceof Node && sheet.contains(origin)) return;
    onclose();
  }

  function documentKeydown(event: KeyboardEvent): void {
    if (event.key !== "Escape") return;
    event.preventDefault();
    onclose();
  }
</script>

<div
  class="sheet"
  role="menu"
  aria-label={`Actions for ${tile.name}`}
  style:top={`${top}px`}
  style:left={`${left}px`}
  data-cy={`deck-tile-menu-sheet-${tile.key}`}
  bind:this={sheet}
>
  <button
    type="button"
    role="menuitem"
    disabled={openDisabled}
    aria-describedby={openDisabledReason === null ? undefined : openReasonId}
    data-cy={`deck-tile-menu-open-${tile.key}`}
    onclick={() => choose(onopen)}>Open in deck builder</button
  >
  {#if openDisabledReason !== null}
    <span
      id={openReasonId}
      class="visually-hidden"
      data-cy={`deck-tile-menu-open-reason-${tile.key}`}
      >{openDisabledReason}</span
    >
  {/if}
  <button
    type="button"
    role="menuitem"
    data-cy={`deck-tile-menu-rename-${tile.key}`}
    onclick={() => choose(onrename)}>Rename</button
  >
  <button
    type="button"
    role="menuitem"
    data-cy={`deck-tile-menu-duplicate-${tile.key}`}
    onclick={() => choose(onduplicate)}>Duplicate</button
  >
  <!-- The guard is the model's, not the menu's: a bundled or AI-owned deck is
       never deletable, so the item stays visible and inert rather than
       disappearing and moving the three above it. -->
  <button
    type="button"
    role="menuitem"
    class="danger"
    disabled={!tile.deletable}
    data-cy={`deck-tile-menu-delete-${tile.key}`}
    onclick={() => choose(ondelete)}>Delete</button
  >
</div>

<style>
  .sheet {
    position: fixed;
    z-index: 30;
    display: grid;
    min-width: 12rem;
    gap: var(--space-1);
    padding: var(--space-1);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--surface-raised);
    box-shadow: 0 0.6rem 1.6rem
      color-mix(in srgb, var(--shadow) 55%, transparent);
  }

  /* `display: grid` above beats the user-agent `[hidden]` rule, so a host that
     hides the sheet with the attribute would still see it on screen. The
     attribute is marked global because nothing here renders it statically and
     the compiler would otherwise prune the guard as an unused selector. */
  .sheet:global([hidden]) {
    display: none;
  }

  .sheet button {
    min-height: 2.75rem;
    padding: 0 var(--space-2);
    border: 0;
    border-radius: var(--radius-sm);
    color: var(--text);
    background: none;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .sheet button:hover:not(:disabled) {
    background: var(--surface-panel);
  }

  .sheet button:disabled {
    color: var(--muted);
    cursor: default;
  }

  .danger:not(:disabled) {
    color: var(--danger);
  }
</style>

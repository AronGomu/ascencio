<script lang="ts">
  import { onMount } from "svelte";

  export let cardName: string;
  export let x: number;
  export let y: number;
  export let onsetillustration: () => void = () => undefined;
  export let onremove: () => void = () => undefined;
  export let oncancel: () => void = () => undefined;

  let menu: HTMLElement;
  let left = x;
  let top = y;

  onMount(() => {
    const bounds = menu.getBoundingClientRect();
    left = Math.max(8, Math.min(x, globalThis.innerWidth - bounds.width - 8));
    top = Math.max(8, Math.min(y, globalThis.innerHeight - bounds.height - 8));
    menu.querySelector<HTMLButtonElement>("button")?.focus();
  });

  function keydown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      event.preventDefault();
      oncancel();
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const items = [...menu.querySelectorAll<HTMLButtonElement>("button")];
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    const delta = event.key === "ArrowDown" ? 1 : -1;
    items[(current + delta + items.length) % items.length]?.focus();
  }

  function outside(event: PointerEvent): void {
    if (!menu.contains(event.target as Node)) oncancel();
  }
</script>

<svelte:window onpointerdown={outside} />

<div
  class="menu"
  role="menu"
  tabindex="-1"
  aria-label={`Actions for ${cardName}`}
  style={`left:${left}px;top:${top}px`}
  data-cy="deck-card-context-menu"
  bind:this={menu}
  onkeydown={keydown}
  oncontextmenu={(event) => event.preventDefault()}
>
  <button
    type="button"
    role="menuitem"
    data-cy="deck-card-context-set-illustration"
    onclick={onsetillustration}>Set as illustration</button
  >
  <button
    type="button"
    role="menuitem"
    class="danger"
    data-cy="deck-card-context-remove"
    onclick={onremove}>Remove from deck</button
  >
</div>

<style>
  .menu {
    position: fixed;
    z-index: 24;
    display: grid;
    min-width: 12rem;
    padding: 0.35rem;
    border: 1px solid var(--line-soft);
    border-radius: 0;
    background: var(--glass-strong);
    box-shadow: 0 0.55rem 1.4rem
      color-mix(in srgb, var(--shadow) 45%, transparent);
  }

  button {
    justify-content: flex-start;
    min-height: 2.25rem;
    padding: 0.45rem 0.65rem;
    border: 0;
    background: transparent;
    text-align: left;
  }

  button:hover,
  button:focus-visible {
    background: var(--surface-highlight);
  }
</style>

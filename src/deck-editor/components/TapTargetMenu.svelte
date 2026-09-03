<script lang="ts">
  import { onMount } from "svelte";
  import type { DeckZone } from "../../decks/deck-contracts.ts";
  import { handleModalKeydown } from "../focus-trap.ts";
  import type { TapTarget } from "../layout/tap-targets.ts";

  export let cardName: string;
  export let targets: readonly TapTarget[];
  export let onchoose: (zone: DeckZone | "remove") => void = () => undefined;
  export let oncancel: () => void = () => undefined;

  let menu: HTMLElement;

  onMount(() => {
    menu.querySelector<HTMLElement>("button:not([disabled])")?.focus();
  });
</script>

<div
  class="menu"
  role="dialog"
  tabindex="-1"
  aria-modal="true"
  aria-labelledby="deck-tap-menu-heading"
  data-cy="deck-tap-menu"
  bind:this={menu}
  onkeydown={(event) => handleModalKeydown(event, oncancel)}
>
  <h2 id="deck-tap-menu-heading" data-cy="deck-tap-menu-heading">
    Move {cardName}
  </h2>
  <ul data-cy="deck-tap-menu-list">
    {#each targets as target (target.zone)}
      <li data-cy={`deck-tap-item-${target.zone}`}>
        <button
          type="button"
          class:danger={target.zone === "remove"}
          disabled={!target.enabled}
          data-cy={`deck-tap-target-${target.zone}`}
          onclick={() => onchoose(target.zone)}>{target.label}</button
        >
        {#if target.reason !== null}
          <span class="reason" data-cy={`deck-tap-reason-${target.zone}`}
            >{target.reason}</span
          >
        {/if}
      </li>
    {/each}
  </ul>
  <button
    type="button"
    class="secondary"
    data-cy="deck-tap-menu-cancel"
    onclick={oncancel}>Cancel</button
  >
</div>

<style>
  .menu {
    position: fixed;
    z-index: 21;
    right: 0;
    bottom: 0;
    left: 0;
    max-height: 80svh;
    overflow-y: auto;
    padding: 0.9rem;
    border: 1px solid var(--line-soft);
    border-radius: 0;
    background: var(--glass-strong);
  }

  h2 {
    margin: 0 0 0.7rem;
    font-size: 1rem;
  }

  ul {
    display: grid;
    gap: 0.45rem;
    margin: 0 0 0.7rem;
    padding: 0;
    list-style: none;
  }

  li button {
    width: 100%;
    min-height: 2.75rem;
  }

  .reason {
    display: block;
    padding-top: 0.2rem;
    color: var(--muted);
    font-size: 0.72rem;
  }

  .menu > .secondary {
    width: 100%;
  }
</style>

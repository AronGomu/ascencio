<script lang="ts">
  import { onMount } from "svelte";
  import type { InteractionChoice } from "../../prompts/interaction-spec.ts";

  interface FieldMenuAnchor {
    readonly left: number;
    readonly top: number;
    readonly bottom: number;
  }

  export let label: string;
  export let choices: readonly InteractionChoice[];
  export let anchor: FieldMenuAnchor;
  export let disabled = false;
  export let onchoose: (choice: InteractionChoice) => void;
  export let oninspect: () => void;
  export let onclose: () => void;

  let menuElement: HTMLDivElement;
  $: positionStyle = [
    `--field-action-menu-left: ${anchor.left}px`,
    `--field-action-menu-top: ${anchor.bottom}px`,
  ].join(";");

  onMount(() => menuItems()[0]?.focus());

  function menuItems(): HTMLButtonElement[] {
    return [
      ...menuElement.querySelectorAll<HTMLButtonElement>(
        "[role=menuitem]:not(:disabled)",
      ),
    ];
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      event.preventDefault();
      onclose();
      return;
    }
    const items = menuItems();
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    let destination: number | null = null;
    if (event.key === "ArrowDown") destination = (current + 1) % items.length;
    else if (event.key === "ArrowUp")
      destination = (current - 1 + items.length) % items.length;
    else if (event.key === "Home") destination = 0;
    else if (event.key === "End") destination = items.length - 1;
    if (destination === null) return;
    event.preventDefault();
    items[destination]?.focus();
  }
</script>

<div
  class="field-action-menu"
  role="menu"
  tabindex="-1"
  aria-label={`${label} actions`}
  style={positionStyle}
  bind:this={menuElement}
  onkeydown={handleKeydown}
  data-cy="field-action-menu"
>
  {#each choices as choice (choice.id)}
    <button
      type="button"
      role="menuitem"
      {disabled}
      onclick={() => onchoose(choice)}
      data-cy={`field-action-menu-choice-${choice.id}`}>{choice.label}</button
    >
  {/each}
  <button
    type="button"
    role="menuitem"
    onclick={oninspect}
    data-cy="field-action-menu-inspect-button">Inspect {label}</button
  >
  <button
    type="button"
    role="menuitem"
    class="secondary"
    onclick={onclose}
    data-cy="field-action-menu-close-button">Close actions</button
  >
</div>

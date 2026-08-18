<script lang="ts">
  import { cardActionLabel } from "../../presentation/card-action-label.ts";
  import type { InteractionChoice } from "../../prompts/interaction-spec.ts";

  export let cardId: string;
  export let cardLabel: string;
  export let choices: readonly InteractionChoice[];
  export let disabled = false;
  export let onchoose: (choice: InteractionChoice) => void;
  export let ondismiss: () => void;
  export let variant: "field" | "list" = "field";
  export let ondetails: (() => void) | null = null;
  /* A second copy of a card's chips exists while the hand zoom overlay is open:
     the card keeps its own for focus and pin, the overlay draws the hovered
     set. Both would otherwise carry the same `data-cy`, and those values are
     required to be unique within a document. */
  export let dataCyScope = "";

  $: dataCyPrefix = dataCyScope === "" ? "" : `${dataCyScope}-`;

  let chipsElement: HTMLDivElement | undefined;

  /* Reachable only through an instance binding (`bind:this`): this codebase
     runs Svelte 5 in legacy mode, where a component-level `export function` is
     an instance method rather than a prop. `CardControl` holds the binding. */
  export function focusFirstChip(): void {
    chipsElement
      ?.querySelector<HTMLButtonElement>("button")
      ?.focus({ preventScroll: true });
  }

  function chipButtons(): HTMLButtonElement[] {
    return chipsElement === undefined
      ? []
      : [...chipsElement.querySelectorAll<HTMLButtonElement>("button")];
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      event.preventDefault();
      ondismiss();
      return;
    }
    const buttons = chipButtons();
    if (buttons.length === 0) return;
    const current = buttons.indexOf(
      document.activeElement as HTMLButtonElement,
    );
    let destination: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown")
      destination = (current + 1) % buttons.length;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp")
      destination = (current - 1 + buttons.length) % buttons.length;
    else if (event.key === "Home") destination = 0;
    else if (event.key === "End") destination = buttons.length - 1;
    if (destination === null) return;
    event.preventDefault();
    buttons[destination]?.focus({ preventScroll: true });
  }
</script>

<div
  class="card-action-chips"
  role="group"
  aria-label={`${cardLabel} actions`}
  bind:this={chipsElement}
  data-cy={`${dataCyPrefix}card-action-chips-${cardId}`}
>
  {#each choices as choice (choice.id)}
    <button
      type="button"
      class="card-action-chip"
      title={choice.label}
      aria-label={choice.label}
      tabindex={variant === "field" ? -1 : 0}
      {disabled}
      onclick={() => onchoose(choice)}
      onkeydown={handleKeydown}
      data-cy={`${dataCyPrefix}card-action-chip-${choice.id}`}
      >{variant === "list" && choice.action === "activate"
        ? "Activate effect"
        : cardActionLabel(choice.action)}</button
    >
  {/each}
  {#if variant === "list" && ondetails !== null}
    <button
      type="button"
      class="card-action-chip card-action-chip--details"
      onclick={ondetails}
      onkeydown={handleKeydown}
      data-cy={`${dataCyPrefix}card-action-details-${cardId}`}>Details</button
    >
  {/if}
</div>

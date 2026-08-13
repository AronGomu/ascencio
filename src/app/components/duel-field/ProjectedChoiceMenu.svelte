<script lang="ts">
  import type { ChoiceId } from "../../../duel/contracts/ids.ts";
  import type { InteractionChoice } from "../../prompts/interaction-spec.ts";

  export let entryId: string;
  export let cardLabel: string;
  export let zoneLabel: string;
  export let choices: readonly InteractionChoice[];
  export let selectedChoiceIds: readonly ChoiceId[];
  export let disabledChoiceIds: ReadonlySet<ChoiceId>;
  export let onchoose: (choice: InteractionChoice) => void;
  export let ondismiss: () => void;

  let menuElement: HTMLDivElement | undefined;

  function buttons(): HTMLButtonElement[] {
    return menuElement === undefined ? [] : [...menuElement.querySelectorAll<HTMLButtonElement>("button")];
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      event.preventDefault();
      ondismiss();
      return;
    }
    const items = buttons();
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    let destination: number | null = null;
    if (event.key === "ArrowDown") destination = (current + 1) % items.length;
    else if (event.key === "ArrowUp") destination = (current - 1 + items.length) % items.length;
    else if (event.key === "Home") destination = 0;
    else if (event.key === "End") destination = items.length - 1;
    if (destination === null || items.length === 0) return;
    event.preventDefault();
    items[destination]?.focus({ preventScroll: true });
  }
</script>

<div
  class="projected-choice-menu"
  role="group"
  aria-label={`${cardLabel} in ${zoneLabel} choices`}
  bind:this={menuElement}
  data-cy={`projected-choice-menu-${entryId}`}
>
  {#each choices as choice (choice.id)}
    <button
      type="button"
      aria-pressed={selectedChoiceIds.includes(choice.id)}
      disabled={disabledChoiceIds.has(choice.id)}
      onclick={() => onchoose(choice)}
      onkeydown={handleKeydown}
      data-cy={`projected-choice-${entryId}-${choice.id}`}
    >{choice.label}</button>
  {/each}
</div>

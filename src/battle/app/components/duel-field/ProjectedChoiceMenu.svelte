<script lang="ts">
  import type { ChoiceId } from "../../../duel/contracts/ids.ts";
  import type { InteractionChoice } from "../../prompts/interaction-spec.ts";

  export let entryId: string;
  export let cardLabel: string;
  export let zoneLabel: string;
  export let choices: readonly InteractionChoice[];
  export let selectedChoiceIds: readonly ChoiceId[];
  export let unavailableChoiceIds: ReadonlySet<ChoiceId>;
  export let disabled = false;
  export let onchoose: (choice: InteractionChoice) => void;
  export let ondismiss: () => void;

  let menuElement: HTMLDivElement | undefined;

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      event.preventDefault();
      ondismiss();
      return;
    }
    const items = [
      ...(menuElement?.querySelectorAll<HTMLButtonElement>("button:enabled") ??
        []),
    ];
    if (items.length === 0) return;
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    const destination =
      event.key === "ArrowDown"
        ? (current + 1) % items.length
        : event.key === "ArrowUp"
          ? (current - 1 + items.length) % items.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? items.length - 1
              : -1;
    if (destination < 0) return;
    event.preventDefault();
    items[destination]!.focus({ preventScroll: true });
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
    {@const choiceDisabled = disabled || unavailableChoiceIds.has(choice.id)}
    <button
      type="button"
      aria-pressed={selectedChoiceIds.includes(choice.id)}
      disabled={choiceDisabled}
      aria-disabled={choiceDisabled}
      onclick={() => onchoose(choice)}
      onkeydown={handleKeydown}
      data-cy={`projected-choice-${entryId}-${choice.id}`}
      >{choice.label}</button
    >
  {/each}
</div>

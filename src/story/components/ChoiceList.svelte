<script lang="ts">
  /** Every multiple choice the story asks, from the narrative's branch points
      to the shopkeeper's menu: one centred column of large buttons, so a
      decision looks and answers the same wherever the player meets one.

      The selector is handed in rather than fixed, like `StoryCardTile` and
      `RaritySortButton` — each screen already names its own choice block, and a
      `data-cy` owned by this file would rename `story-shop-greeting-menu` out
      from under the suites that walk the shop. */
  import { onMount } from "svelte";

  export let choices: readonly {
    readonly id: string;
    readonly label: string;
    readonly dataCy: string;
    /** Cancels, leaves, or otherwise backs out of where the player is. Drawn in
        the danger colour so the way out never reads as the way forward. */
    readonly danger?: boolean;
    /** Only a choice that stays on screen after it is taken reports a pressed
        state; a one-shot menu action is not a toggle and carries none. */
    readonly pressed?: boolean;
  }[] = [];
  export let dataCy: string;
  export let label: string;
  export let onchoose: (id: string) => void = () => undefined;

  let list: HTMLDivElement;

  /* Both readers mount this only while a decision is open, so mount is the
     moment the choice appears: the player can answer from the keyboard without
     first hunting for the list. The same first-button focus the story's
     overlays take. */
  onMount(() => list.querySelector<HTMLElement>("button")?.focus());
</script>

<div
  class="story-choice-list"
  role="group"
  aria-label={label}
  data-cy={dataCy}
  bind:this={list}
>
  {#each choices as choice (choice.id)}
    <button
      type="button"
      class:story-danger={choice.danger}
      data-cy={choice.dataCy}
      aria-pressed={choice.pressed}
      onclick={() => onchoose(choice.id)}>{choice.label}</button
    >
  {/each}
</div>

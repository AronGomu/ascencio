<script lang="ts">
  import type { BoardStackView } from "../../../field/board-view-model.ts";
  import type { ZoneListEntry } from "../../../field/zone-list.ts";
  import type { CardImageLibrary } from "../../images/card-image-cache.ts";
  import type { InteractionChoice } from "../../prompts/interaction-spec.ts";
  import ZoneListEntryTile from "./ZoneListEntryTile.svelte";

  export let stack: BoardStackView;
  export let entries: readonly ZoneListEntry[] = [];
  export let choices: readonly InteractionChoice[] = [];
  export let imageLibrary: Pick<CardImageLibrary, "lease"> | null = null;
  export let cardBackUrl = "";
  export let placeholderUrl = "";
  export let disabled = false;
  export let onchoose: (choice: InteractionChoice) => void = () => undefined;
  export let onpreview: (entry: ZoneListEntry) => void = () => undefined;
  export let onclose: () => void = () => undefined;

  function promptSequenceInListSpace(
    choice: InteractionChoice,
    entry: ZoneListEntry,
  ): number | undefined {
    const engineSequence = choice.cardAddress?.sequence;
    if (engineSequence === undefined || entry.location !== "deck")
      return engineSequence;
    // Engine deck sequences are bottom-first; projected deck entries use a
    // top-relative offset. `entries.length` comes from this same snapshot.
    return entries.length - 1 - engineSequence;
  }

  function entryChoices(entry: ZoneListEntry): readonly InteractionChoice[] {
    return choices.filter(
      (choice) =>
        choice.cardAddress !== undefined &&
        choice.cardAddress.controller === entry.controller &&
        choice.cardAddress.location === entry.location &&
        promptSequenceInListSpace(choice, entry) === entry.sequence,
    );
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      event.preventDefault();
      onclose();
    }
  }
</script>

<svelte:document onkeydown={handleKeydown} />

<div
  class="zone-list-dialog"
  role="dialog"
  aria-modal="false"
  aria-label={`${stack.label} contents${stack.zone === "deck" ? ", position 1 is the top of the deck" : ""}`}
  tabindex="-1"
  data-cy="zone-list-dialog"
>
  <div class="zone-list-dialog__header" data-cy="zone-list-dialog-header">
    <span data-cy="zone-list-dialog-title">{stack.label}</span>
    <strong data-cy="zone-list-dialog-count">{entries.length}</strong>
    <button
      type="button"
      onclick={onclose}
      data-cy="zone-list-dialog-close-button">Close</button
    >
  </div>
  <div class="zone-list-dialog__entries" data-cy="zone-list-dialog-entries">
    {#each entries as entry (entry.id)}
      <ZoneListEntryTile
        {entry}
        choices={entryChoices(entry)}
        {imageLibrary}
        {cardBackUrl}
        {placeholderUrl}
        {disabled}
        {onchoose}
        onpreview={() => onpreview(entry)}
      />
    {/each}
  </div>
</div>

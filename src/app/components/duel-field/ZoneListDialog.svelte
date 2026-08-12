<script lang="ts">
  import type { BoardStackView } from "../../../field/board-view-model.ts";
  import type { ZoneListEntry } from "../../../field/zone-list.ts";
  import type { CardImageLibrary } from "../../images/card-image-cache.ts";
  import type { InteractionChoice } from "../../prompts/interaction-spec.ts";
  import type { FieldWindowId } from "../../presentation/floating-window-position.ts";
  import type { PersistedWindowPosition } from "../../stores/persisted-ui-state.ts";
  import FloatingFieldWindow from "./FloatingFieldWindow.svelte";
  import ZoneListEntryTile from "./ZoneListEntryTile.svelte";

  export let stack: BoardStackView;
  export let entries: readonly ZoneListEntry[] = [];
  export let choices: readonly InteractionChoice[] = [];
  export let imageLibrary: Pick<CardImageLibrary, "lease"> | null = null;
  export let cardBackUrl = "";
  export let placeholderUrl = "";
  export let disabled = false;
  /* Window shell props (ADR-017). The list owns the primitive so that exactly
     one component installs the outside/Escape listeners for this surface. */
  export let boundaryElement: HTMLElement | null = null;
  export let windowPosition: PersistedWindowPosition | null = null;
  export let active = false;
  export let onactivate: (id: FieldWindowId) => void = () => undefined;
  export let onwindowpositionchange: (
    position: PersistedWindowPosition,
  ) => void = () => undefined;
  export let onchoose: (choice: InteractionChoice) => void = () => undefined;
  export let onpreview: (entry: ZoneListEntry) => void = () => undefined;
  export let onclose: (event?: Event) => void = () => undefined;

  let entriesElement: HTMLElement | null = null;

  $: label = `${stack.label} contents${stack.zone === "deck" ? ", position 1 is the top of the deck" : ""}`;

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

  /* The list is a single horizontal run, so a plain vertical wheel is the
     natural way to travel it. The page/field scroll is only suppressed while
     this list can still consume the movement, so a wheel at either end still
     reaches whatever would normally scroll. */
  function wheelToHorizontal(event: WheelEvent): void {
    const element = entriesElement;
    if (element === null || event.deltaY === 0) return;
    const travel = element.scrollWidth - element.clientWidth;
    if (travel <= 0) return;
    const next = Math.min(
      Math.max(element.scrollLeft + event.deltaY, 0),
      travel,
    );
    if (next === element.scrollLeft) return;
    element.scrollLeft = next;
    event.preventDefault();
  }
</script>

<FloatingFieldWindow
  windowId="zoneList"
  ariaLabel={label}
  {boundaryElement}
  position={windowPosition}
  dismissOnOutsideClick={true}
  dismissOnEscape={true}
  {active}
  {disabled}
  {onactivate}
  onpositionchange={onwindowpositionchange}
  ondismiss={onclose}
>
  <div
    class="zone-list-dialog__header"
    slot="handle"
    data-cy="zone-list-dialog-header"
  >
    <span data-cy="zone-list-dialog-title">{stack.label}</span>
    <strong data-cy="zone-list-dialog-count">{entries.length}</strong>
    <button
      type="button"
      class="danger zone-list-dialog__close"
      aria-label={`Close ${stack.label}`}
      onclick={() => onclose()}
      data-cy="zone-list-dialog-close-button">×</button
    >
  </div>
  <div class="zone-list-dialog" data-cy="zone-list-dialog">
    <div
      class="zone-list-dialog__entries"
      bind:this={entriesElement}
      onwheel={wheelToHorizontal}
      data-cy="zone-list-dialog-entries"
    >
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
</FloatingFieldWindow>

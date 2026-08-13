<script lang="ts">
  import type { ChoiceId } from "../../../duel/contracts/ids.ts";
  import type { BoardStackView } from "../../../field/board-view-model.ts";
  import type { OffFieldTargetEntry } from "../../../field/off-field-target-list.ts";
  import type { ZoneListEntry } from "../../../field/zone-list.ts";
  import type { CardImageLibrary } from "../../images/card-image-cache.ts";
  import type { InteractionChoice } from "../../prompts/interaction-spec.ts";
  import type { FieldWindowId } from "../../presentation/floating-window-position.ts";
  import type { PersistedWindowPosition } from "../../stores/persisted-ui-state.ts";
  import {
    cardListAlphabeticalAllowed,
    cardListBrowseTitle,
    cardListDisplayEntries,
  } from "../../presentation/card-list-dialog-model.ts";
  import FloatingFieldWindow from "./FloatingFieldWindow.svelte";
  import ZoneListEntryTile from "./ZoneListEntryTile.svelte";

  /* Browse lists one pile as it is; target lists only the legal off-field
     choices of the live prompt, wherever they live (T16). */
  export let mode: "browse" | "target" = "browse";
  export let stack: BoardStackView | null = null;
  export let entries: readonly ZoneListEntry[] = [];
  export let choices: readonly InteractionChoice[] = [];
  export let title = "";
  export let targetEntries: readonly OffFieldTargetEntry[] = [];
  export let selectedChoiceIds: readonly ChoiceId[] = [];
  export let minimum = 0;
  export let maximum = 0;
  export let confirmValid = false;
  export let validationMessage = "";
  export let cancelable = false;
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
  export let ontargetchoice: (choice: InteractionChoice) => void = () =>
    undefined;
  export let onconfirm: () => void = () => undefined;
  export let oncancel: () => void = () => undefined;
  export let onpreview: (entry: ZoneListEntry) => void = () => undefined;
  export let onclose: (event?: Event) => void = () => undefined;

  let entriesElement: HTMLElement | null = null;
  let alphabetical = false;

  $: targetMode = mode === "target";
  $: alphabeticalAllowed = cardListAlphabeticalAllowed(entries);
  $: if (!alphabeticalAllowed) alphabetical = false;
  $: displayEntries = cardListDisplayEntries(entries, alphabetical);
  $: headerTitle = targetMode
    ? title || "Select targets"
    : stack === null
      ? ""
      : cardListBrowseTitle(stack.zone);
  $: count = targetMode ? targetEntries.length : entries.length;
  $: label = targetMode ? headerTitle : `${headerTitle} card browser`;
  $: selectedCount = selectedChoiceIds.length;
  /* An exact one-of-one target answers on click, so it owns no Confirm. */
  $: exactSingle = minimum === 1 && maximum === 1;
  $: selectionCountLabel =
    minimum === maximum
      ? `${selectedCount} / ${maximum} selected`
      : `${selectedCount} selected · ${minimum}–${maximum} allowed`;

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

  function targetSelected(entry: OffFieldTargetEntry): boolean {
    return entry.choices.some(({ id }) => selectedChoiceIds.includes(id));
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
  dismissOnOutsideClick={!targetMode}
  dismissOnEscape={!targetMode}
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
    <span data-cy="zone-list-dialog-title">{headerTitle}</span>
    <strong data-cy="zone-list-dialog-count">{count}</strong>
    {#if !targetMode}
      <button
        type="button"
        class="danger zone-list-dialog__close"
        aria-label={`Close ${headerTitle}`}
        onclick={() => onclose()}
        data-cy="zone-list-dialog-close-button">×</button
      >
    {/if}
  </div>
  <div class="zone-list-dialog" data-cy="zone-list-dialog">
    <div
      class="zone-list-dialog__entries"
      bind:this={entriesElement}
      onwheel={wheelToHorizontal}
      data-cy="zone-list-dialog-entries"
    >
      {#if targetMode}
        {#each targetEntries as entry (entry.id)}
          <ZoneListEntryTile
            {entry}
            mode="target"
            choices={entry.choices}
            zoneBadge={entry.zoneBadge}
            zoneLabel={entry.zoneLabel}
            selected={targetSelected(entry)}
            {selectedChoiceIds}
            {imageLibrary}
            {cardBackUrl}
            {placeholderUrl}
            {disabled}
            {ontargetchoice}
            onpreview={() => onpreview(entry)}
          />
        {/each}
      {:else if displayEntries.length === 0}
        <p class="zone-list-dialog__empty" data-cy="zone-list-dialog-empty">No cards available</p>
      {:else}
        {#each displayEntries as entry (entry.id)}
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
      {/if}
    </div>
    {#if targetMode}
      <div class="zone-list-dialog__footer" data-cy="zone-list-dialog-target-footer">
        <output data-cy="zone-list-dialog-selection-count"
          >{selectionCountLabel}</output
        >
        {#if !exactSingle}
          <button
            type="button"
            disabled={disabled || !confirmValid}
            aria-describedby={!confirmValid && validationMessage
              ? "zone-list-dialog-validation"
              : undefined}
            onclick={() => onconfirm()}
            data-cy="zone-list-dialog-confirm-button">Confirm selection</button
          >
        {/if}
        {#if cancelable}
          <button
            type="button"
            class="secondary"
            {disabled}
            onclick={() => oncancel()}
            data-cy="zone-list-dialog-target-cancel-button">Cancel</button
          >
        {/if}
        {#if !confirmValid && validationMessage}
          <p
            id="zone-list-dialog-validation"
            class="validation"
            data-cy="zone-list-dialog-validation"
          >
            {validationMessage}
          </p>
        {/if}
      </div>
    {:else}
      <div class="zone-list-dialog__footer" data-cy="zone-list-dialog-footer">
        <label class="zone-list-dialog__sort" data-cy="zone-list-dialog-sort-label">
          <input
            type="checkbox"
            bind:checked={alphabetical}
            disabled={!alphabeticalAllowed}
            data-cy="zone-list-dialog-alphabetical-checkbox"
          />
          Alphabetical
        </label>
        <button
          type="button"
          class="danger zone-list-dialog__cancel"
          onclick={() => onclose()}
          data-cy="zone-list-dialog-cancel-button">Cancel</button
        >
      </div>
    {/if}
  </div>
</FloatingFieldWindow>

<script lang="ts">
  import { tick } from "svelte";
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
    cardListSelectionState,
    cardListSourceNotice,
  } from "../../presentation/card-list-dialog-model.ts";
  import FloatingFieldWindow from "./FloatingFieldWindow.svelte";
  import ZoneListEntryTile from "./ZoneListEntryTile.svelte";

  const noop = (): void => undefined;

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
  export let onactivate: (id: FieldWindowId) => void = noop;
  export let onwindowpositionchange: (
    position: PersistedWindowPosition,
  ) => void = noop;
  export let onchoose: (choice: InteractionChoice) => void = noop;
  export let ontargetchoice: (choice: InteractionChoice) => void = noop;
  export let onconfirm: () => void = noop;
  export let oncancel: () => void = noop;
  export let onpreview: (entry: ZoneListEntry) => void = noop;
  export let onclose: (event?: Event) => void = noop;

  export let collapsed = false;
  export let oncollapsedchange: (value: boolean) => void = () => undefined;

  let entriesElement: HTMLElement | null = null;
  let alphabetical = false;
  let collapseButton: HTMLButtonElement | null = null;
  let expandButton: HTMLButtonElement | null = null;

  $: targetMode = mode === "target";
  $: sourceEntries = targetMode ? targetEntries : entries;
  $: alphabeticalAllowed = cardListAlphabeticalAllowed(sourceEntries);
  $: if (!alphabeticalAllowed) alphabetical = false;
  $: displayEntries = cardListDisplayEntries(entries, alphabetical);
  $: displayTargetEntries = cardListDisplayEntries(
    targetEntries,
    alphabeticalAllowed && alphabetical,
  );
  $: filterNotice = cardListSourceNotice(targetEntries);
  $: headerTitle = targetMode
    ? title || "Select targets"
    : stack === null
      ? ""
      : cardListBrowseTitle(stack.zone);
  $: count = targetMode ? targetEntries.length : entries.length;
  $: label = targetMode ? headerTitle : `${headerTitle} card browser`;
  $: selectionState = cardListSelectionState({
    selectedChoiceIds,
    entries: [...targetEntries, { choices }],
    minimum,
    maximum,
    promptValid: confirmValid,
  });

  async function setCollapsed(value: boolean): Promise<void> {
    oncollapsedchange(value);
    await tick();
    (value ? expandButton : collapseButton)?.focus();
  }

  function entryChoices(entry: ZoneListEntry): readonly InteractionChoice[] {
    return choices.filter((choice) => {
      const address = choice.cardAddress;
      return (
        address !== undefined &&
        address.controller === entry.controller &&
        address.location === entry.location &&
        (entry.location === "deck"
          ? entries.length - 1 - address.sequence
          : address.sequence) === entry.sequence
      );
    });
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
  {collapsed}
  {mode}
>
  <div
    class="zone-list-dialog__header"
    slot="handle"
    data-cy="zone-list-dialog-header"
  >
    {#if targetMode && collapsed}
      <button
        type="button"
        class="zone-list-dialog__collapse"
        aria-label="Expand target list"
        bind:this={expandButton}
        onclick={() => setCollapsed(false)}
        data-cy="zone-list-dialog-expand-button">+</button
      >
    {:else}
      {#if targetMode}
        <button
          type="button"
          class="zone-list-dialog__collapse"
          aria-label="Collapse target list"
          bind:this={collapseButton}
          onclick={() => setCollapsed(true)}
          data-cy="zone-list-dialog-collapse-button">−</button
        >
      {/if}
      <span data-cy="zone-list-dialog-title">{headerTitle}</span>
      <strong data-cy="zone-list-dialog-count">{count}</strong>
      {#if targetMode}
        <span
          class="zone-list-dialog__notice"
          data-cy="zone-list-dialog-filter-notice">{filterNotice}</span
        >
      {/if}
      {#if !targetMode}
        <button
          type="button"
          class="danger zone-list-dialog__close"
          aria-label={`Close ${headerTitle}`}
          onclick={() => onclose()}
          data-cy="zone-list-dialog-close-button">×</button
        >
      {/if}
    {/if}
  </div>
  {#if !collapsed}
    <div
      class="zone-list-dialog"
      data-mode={mode}
      data-collapsed="false"
      data-cy="zone-list-dialog"
    >
      <div
        class="zone-list-dialog__entries"
        bind:this={entriesElement}
        onwheel={wheelToHorizontal}
        data-cy="zone-list-dialog-entries"
      >
        {#if targetMode}
          {#each displayTargetEntries as entry, index (entry.id)}
            <ZoneListEntryTile
              {entry}
              first={index === 0}
              last={index === displayTargetEntries.length - 1}
              mode="target"
              choices={entry.choices}
              zoneBadge={entry.zoneBadge}
              zoneLabel={entry.zoneLabel}
              selected={entry.choices.some(({ id }) =>
                selectedChoiceIds.includes(id),
              )}
              {selectedChoiceIds}
              unavailableChoiceIds={selectionState.unavailableChoiceIds}
              {imageLibrary}
              {cardBackUrl}
              {placeholderUrl}
              {disabled}
              {ontargetchoice}
              onpreview={() => onpreview(entry)}
            />
          {/each}
        {:else if displayEntries.length === 0}
          <p class="zone-list-dialog__empty" data-cy="zone-list-dialog-empty">
            No cards available
          </p>
        {:else}
          {#each displayEntries as entry, index (entry.id)}
            <ZoneListEntryTile
              {entry}
              first={index === 0}
              last={index === displayEntries.length - 1}
              choices={entryChoices(entry)}
              {imageLibrary}
              {cardBackUrl}
              {placeholderUrl}
              {disabled}
              {onchoose}
              ondetails={() => onpreview(entry)}
              onpreview={() => onpreview(entry)}
            />
          {/each}
        {/if}
      </div>
      <div
        class="zone-list-dialog__footer"
        data-cy={targetMode
          ? "zone-list-dialog-target-footer"
          : "zone-list-dialog-footer"}
      >
        {#if targetMode}
          <output data-cy="zone-list-dialog-selection-count"
            >{selectionState.countLabel}</output
          >
        {/if}
        <label
          class="zone-list-dialog__sort"
          data-cy={targetMode
            ? "zone-list-dialog-target-sort-label"
            : "zone-list-dialog-sort-label"}
        >
          <input
            type="checkbox"
            bind:checked={alphabetical}
            disabled={!alphabeticalAllowed}
            data-cy="zone-list-dialog-alphabetical-checkbox"
          />
          Alphabetical
        </label>
        {#if targetMode}
          <button
            type="button"
            disabled={disabled || !selectionState.validateEnabled}
            onclick={() => onconfirm()}
            data-cy="zone-list-dialog-confirm-button">Validate selection</button
          >
          {#if cancelable}
            <button
              type="button"
              class="danger"
              {disabled}
              onclick={() => oncancel()}
              data-cy="zone-list-dialog-target-cancel-button">Cancel</button
            >
          {/if}
        {:else}
          <button
            type="button"
            class="danger zone-list-dialog__cancel"
            onclick={() => onclose()}
            data-cy="zone-list-dialog-cancel-button">Cancel</button
          >
        {/if}
      </div>
    </div>
  {/if}
</FloatingFieldWindow>

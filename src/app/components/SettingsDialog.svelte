<script lang="ts">
  import { onMount } from "svelte";
  import type { UiSettingsState } from "../stores/ui-settings-store.ts";

  export let settings: UiSettingsState;
  export let coreVersion: readonly [number, number] | null = null;
  export let activeSnapshotId: string | null = null;
  export let fallbackSnapshotId: string | null = null;
  export let onshowduelhud: (value: boolean) => void;
  export let onshowworkspace: (value: boolean) => void;
  export let onautoplacecards: (value: boolean) => void;
  export let onautoresolvetrivialprompts: (value: boolean) => void;
  export let onshowzoneoutlines: (value: boolean) => void;
  export let onshowzonecounts: (value: boolean) => void;
  export let onreset: () => void;
  export let onclose: () => void;

  let panel: HTMLDivElement | undefined;

  $: engineText =
    coreVersion === null
      ? "Engine not ready"
      : `ocgcore ${coreVersion[0]}.${coreVersion[1]}`;
  $: snapshotText =
    activeSnapshotId === null
      ? "No active snapshot"
      : `Active assets ${activeSnapshotId.slice(0, 12)}${
          fallbackSnapshotId !== null
            ? ` · fallback ${fallbackSnapshotId.slice(0, 12)}`
            : ""
        }`;

  onMount(() => {
    panel?.querySelector("button")?.focus();
  });

  function handleBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) onclose();
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      event.preventDefault();
      onclose();
    }
  }

  function handleShowDuelHud(event: Event): void {
    onshowduelhud((event.currentTarget as HTMLInputElement).checked);
  }

  function handleShowWorkspace(event: Event): void {
    onshowworkspace((event.currentTarget as HTMLInputElement).checked);
  }

  function handleAutoPlaceCards(event: Event): void {
    onautoplacecards((event.currentTarget as HTMLInputElement).checked);
  }

  function handleAutoResolveTrivialPrompts(event: Event): void {
    onautoresolvetrivialprompts(
      (event.currentTarget as HTMLInputElement).checked,
    );
  }

  function handleShowZoneOutlines(event: Event): void {
    onshowzoneoutlines((event.currentTarget as HTMLInputElement).checked);
  }

  function handleShowZoneCounts(event: Event): void {
    onshowzonecounts((event.currentTarget as HTMLInputElement).checked);
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events (Escape is handled globally via svelte:window) -->
<!-- svelte-ignore a11y_no_static_element_interactions (backdrop only dismisses; the dialog panel holds all interactive content) -->
<div
  class="dialog-backdrop"
  data-cy="settings-dialog-backdrop"
  onclick={handleBackdropClick}
>
  <div
    class="dialog-panel"
    role="dialog"
    aria-modal="true"
    aria-labelledby="settings-dialog-heading"
    data-cy="settings-dialog"
    bind:this={panel}
  >
    <h2 id="settings-dialog-heading" data-cy="settings-dialog-heading">
      Settings
    </h2>
    <label data-cy="settings-show-duel-hud-label">
      <input
        type="checkbox"
        checked={settings.showDuelHud}
        onchange={handleShowDuelHud}
        data-cy="settings-show-duel-hud-checkbox"
      />
      Show duel HUD
    </label>
    <label data-cy="settings-show-workspace-label">
      <input
        type="checkbox"
        checked={settings.showWorkspace}
        onchange={handleShowWorkspace}
        data-cy="settings-show-workspace-checkbox"
      />
      Show workspace panels
    </label>
    <label data-cy="settings-auto-place-cards-label">
      <input
        type="checkbox"
        checked={settings.autoPlaceCards}
        onchange={handleAutoPlaceCards}
        data-cy="settings-auto-place-cards-checkbox"
      />
      Place cards automatically
    </label>
    <label data-cy="settings-auto-resolve-label">
      <input
        type="checkbox"
        checked={settings.autoResolveTrivialPrompts}
        onchange={handleAutoResolveTrivialPrompts}
        data-cy="settings-auto-resolve-checkbox"
      />
      Skip prompts with a single answer
    </label>
    <label data-cy="settings-show-zone-outlines-label">
      <input
        type="checkbox"
        checked={settings.showZoneOutlines}
        onchange={handleShowZoneOutlines}
        data-cy="settings-show-zone-outlines-checkbox"
      />
      <span data-cy="settings-show-zone-outlines-copy">Show zone outlines</span>
      <span data-cy="settings-show-zone-outlines-description"
        >Draw the dashed square footprint of every zone.</span
      >
    </label>
    <label data-cy="settings-show-zone-counts-label">
      <input
        type="checkbox"
        checked={settings.showZoneCounts}
        onchange={handleShowZoneCounts}
        data-cy="settings-show-zone-counts-checkbox"
      />
      <span data-cy="settings-show-zone-counts-copy">Show card counts</span>
      <span data-cy="settings-show-zone-counts-description"
        >Show the number of cards in Deck, Extra Deck, GY, Banished and both
        hands.</span
      >
    </label>
    <button
      type="button"
      class="secondary"
      data-cy="settings-reset-button"
      onclick={onreset}>Reset settings</button
    >
    <p data-cy="settings-engine-version">{engineText}</p>
    <p data-cy="settings-active-snapshot">{snapshotText}</p>
    <button
      type="button"
      class="secondary"
      data-cy="settings-dialog-close-button"
      onclick={onclose}>Close</button
    >
  </div>
</div>

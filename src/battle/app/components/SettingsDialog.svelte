<script lang="ts">
  import { onMount } from "svelte";
  import type { UiSettingsState } from "../stores/ui-settings-store.ts";
  import { portalDuelDialog } from "./portal-duel-dialog.ts";

  const SHOW_ZONE_COUNTS_DESCRIPTION =
    "Show the number of cards in Deck, Extra Deck, GY, Banished and both hands.";
  const SHOW_CARD_SHADOWS_DESCRIPTION =
    "Draw a soft shadow under every card on the field.";
  const SHOW_ZONE_LABELS_DESCRIPTION =
    "Name empty zones on the board. Life points are unaffected.";

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
  export let onshowcardshadows: (value: boolean) => void;
  export let onshowzonelabels: (value: boolean) => void;
  export let onreset: () => void;
  export let ondownloaddiagnostics: (() => void) | null = null;
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
    const trigger = document.activeElement;
    const isolated: HTMLElement[] = [];
    let lastFocus: HTMLElement | null = null;
    /* Settings can mount workspace controls or a new portaled prompt. Follow
       live ancestry and watch its siblings, not just the initial DOM. */
    function isolateBackground(): void {
      let branch = panel?.parentElement;
      while (branch && branch !== document.body) {
        for (const sibling of branch.parentElement?.children ?? []) {
          if (
            sibling instanceof HTMLElement &&
            sibling !== branch &&
            !sibling.hasAttribute("inert")
          ) {
            sibling.setAttribute("inert", "");
            isolated.push(sibling);
          }
        }
        branch = branch.parentElement;
      }
    }
    function restoreFocus(): void {
      const target =
        lastFocus?.isConnected &&
        panel?.contains(lastFocus) &&
        !lastFocus.matches(":disabled")
          ? lastFocus
          : panel?.querySelector<HTMLElement>(
              ":is(button, input):not(:disabled)",
            );
      target?.focus();
    }
    function containFocus(event: FocusEvent): void {
      if (
        event.target instanceof HTMLElement &&
        panel?.contains(event.target)
      ) {
        lastFocus = event.target;
      } else {
        // A newly mounted prompt may focus before the observer runs.
        isolateBackground();
        restoreFocus();
      }
    }
    isolateBackground();
    const observer = new MutationObserver(() => {
      isolateBackground();
      if (
        !panel?.contains(document.activeElement) ||
        document.activeElement?.matches(":disabled")
      ) {
        restoreFocus();
      }
    });
    if (panel) {
      observer.observe(panel, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["disabled"],
      });
    }
    let ancestor = panel?.parentElement?.parentElement;
    while (ancestor) {
      observer.observe(ancestor, { childList: true });
      if (ancestor === document.body) break;
      ancestor = ancestor.parentElement;
    }
    document.addEventListener("focusin", containFocus, true);
    panel?.querySelector("button")?.focus();
    document.addEventListener("keydown", handleKeydown, true);
    return () => {
      observer.disconnect();
      document.removeEventListener("focusin", containFocus, true);
      document.removeEventListener("keydown", handleKeydown, true);
      for (const element of isolated) element.removeAttribute("inert");
      if (trigger instanceof HTMLElement && trigger.isConnected)
        trigger.focus();
    };
  });

  function handleBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) onclose();
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onclose();
    } else if (event.key === "Tab") {
      const controls = panel?.querySelectorAll<HTMLElement>(
        ":is(button, input):not(:disabled)",
      );
      const first = controls?.[0];
      const last = controls?.[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
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

  function handleShowCardShadows(event: Event): void {
    onshowcardshadows((event.currentTarget as HTMLInputElement).checked);
  }

  function handleShowZoneLabels(event: Event): void {
    onshowzonelabels((event.currentTarget as HTMLInputElement).checked);
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events (Escape is handled by the modal's document listener) -->
<!-- svelte-ignore a11y_no_static_element_interactions (backdrop only dismisses; the dialog panel holds all interactive content) -->
<div
  class="dialog-backdrop settings-backdrop"
  data-cy="settings-dialog-backdrop"
  use:portalDuelDialog
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
    <h2
      id="settings-dialog-heading"
      class="ui-dialog-title"
      data-cy="settings-dialog-heading"
    >
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
        >{SHOW_ZONE_COUNTS_DESCRIPTION}</span
      >
    </label>
    <label data-cy="settings-show-card-shadows-label">
      <input
        type="checkbox"
        checked={settings.showCardShadows}
        onchange={handleShowCardShadows}
        data-cy="settings-show-card-shadows-checkbox"
      />
      <span data-cy="settings-show-card-shadows-copy">Show card shadows</span>
      <span data-cy="settings-show-card-shadows-description"
        >{SHOW_CARD_SHADOWS_DESCRIPTION}</span
      >
    </label>
    <label data-cy="settings-show-zone-labels-label">
      <input
        type="checkbox"
        checked={settings.showZoneLabels}
        onchange={handleShowZoneLabels}
        data-cy="settings-show-zone-labels-checkbox"
      />
      <span data-cy="settings-show-zone-labels-copy">Show zone labels</span>
      <span data-cy="settings-show-zone-labels-description"
        >{SHOW_ZONE_LABELS_DESCRIPTION}</span
      >
    </label>
    <button
      type="button"
      class="secondary"
      data-cy="settings-reset-button"
      onclick={onreset}>Reset settings</button
    >
    <button
      type="button"
      class="secondary"
      disabled={ondownloaddiagnostics === null}
      title={ondownloaddiagnostics === null ? "No duel trace yet" : undefined}
      onclick={() => ondownloaddiagnostics?.()}
      data-cy="settings-download-diagnostics-button">Download duel log</button
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

<style>
  /* A prompt portaled while Settings is open remains behind this modal. */
  .settings-backdrop {
    z-index: calc(var(--duel-field-layer-menu) + 1);
  }
</style>

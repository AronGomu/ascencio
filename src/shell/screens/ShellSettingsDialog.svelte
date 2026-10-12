<script lang="ts">
  import { onMount } from "svelte";
  import { isNativeApp } from "../native/content.ts";

  export let onclose: () => void;
  export let onopencontent: () => void;
  export let onresetbrowsersaves: (() => Promise<void>) | null = null;

  let heading: HTMLHeadingElement | undefined;
  let resetBusy = false;
  let resetError: string | null = null;
  const contentManagementAvailable = isNativeApp();

  async function resetBrowserSaves(): Promise<void> {
    if (onresetbrowsersaves === null || resetBusy) return;
    resetBusy = true;
    resetError = null;
    try {
      await onresetbrowsersaves();
    } catch (error: unknown) {
      resetError = error instanceof Error ? error.message : String(error);
    } finally {
      resetBusy = false;
    }
  }

  onMount(() => {
    heading?.focus();
  });
</script>

<div class="dialog-backdrop" data-cy="shell-settings-backdrop">
  <div
    class="dialog-panel"
    role="dialog"
    aria-modal="true"
    aria-labelledby="shell-settings-heading"
    data-cy="shell-settings-dialog"
  >
    <h2
      id="shell-settings-heading"
      tabindex="-1"
      bind:this={heading}
      data-cy="shell-settings-heading"
    >
      Settings
    </h2>
    <p class="hint" role="status" data-cy="shell-settings-offline-status">
      Installed content is available offline on this device.
    </p>
    <div class="settings-actions" data-cy="shell-settings-actions">
      <button
        type="button"
        data-cy="shell-settings-content"
        disabled={!contentManagementAvailable}
        title={!contentManagementAvailable
          ? "Content installation and mods are available in Tauri."
          : undefined}
        onclick={onopencontent}>Content</button
      >
      {#if onresetbrowsersaves !== null}<button
          type="button"
          data-cy="shell-settings-reset-browser-saves"
          disabled={resetBusy}
          onclick={() => void resetBrowserSaves()}
          >{resetBusy
            ? "Resetting browser saves…"
            : "Reset browser saves"}</button
        >{/if}
      {#if resetError !== null}<p
          class="reset-error"
          role="alert"
          data-cy="shell-settings-reset-error"
        >
          {resetError}
        </p>{/if}
      <button type="button" data-cy="shell-settings-close" onclick={onclose}
        >Close</button
      >
    </div>
  </div>
</div>

<style>
  h2 {
    margin: 0;
    font-size: var(--text-lg);
  }

  .hint {
    margin: 0;
    color: var(--muted);
    font-size: var(--text-sm);
  }

  .settings-actions {
    display: grid;
    gap: var(--space-2);
  }

  .reset-error {
    margin: 0;
    color: var(--danger);
  }
</style>

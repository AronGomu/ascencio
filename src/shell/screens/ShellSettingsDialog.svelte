<script lang="ts">
  import { onMount } from "svelte";

  export let fullscreenPreferred: boolean;
  export let onToggleFullscreen: (next: boolean) => void;
  export let onclose: () => void;

  let heading: HTMLHeadingElement | undefined;

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
    <button
      type="button"
      class="switch"
      role="switch"
      aria-checked={fullscreenPreferred}
      data-cy="shell-settings-fullscreen"
      onclick={() => onToggleFullscreen(!fullscreenPreferred)}
    >
      Fullscreen
      <span class="switch-state" data-cy="shell-settings-fullscreen-state"
        >{fullscreenPreferred ? "On" : "Off"}</span
      >
    </button>
    <p class="hint" data-cy="shell-settings-fullscreen-hint">
      Fullscreen needs a click, so it is applied on your next interaction.
    </p>
    <button type="button" data-cy="shell-settings-close" onclick={onclose}
      >Close</button
    >
  </div>
</div>

<style>
  h2 {
    margin: 0;
    font-size: var(--text-lg);
  }

  .switch {
    display: flex;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .switch-state {
    color: var(--accent);
  }

  .hint {
    margin: 0;
    color: var(--muted);
    font-size: var(--text-sm);
  }
</style>

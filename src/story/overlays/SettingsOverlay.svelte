<script lang="ts">
  import OverlayShell from "./OverlayShell.svelte";
  export let onclose: () => void = () => undefined;
  export let restoreFocusTo: HTMLElement | null = null;
  let textSpeed = 40;
  let autoSpeed = 3;
  let transitions = "standard";
  const fullscreenSupported =
    typeof document !== "undefined" && document.fullscreenEnabled;
  function reset(): void {
    textSpeed = 40;
    autoSpeed = 3;
    transitions = "standard";
  }
</script>

<OverlayShell
  title="Settings"
  labelId="settings-title"
  {onclose}
  {restoreFocusTo}
>
  <div class="settings" data-cy="story-settings">
    <label data-cy="story-settings-text-speed-field"
      >Text speed <input
        aria-label="Text speed"
        type="number"
        min="0"
        max="100"
        data-cy="story-settings-text-speed"
        bind:value={textSpeed}
      /></label
    >
    <label data-cy="story-settings-auto-speed-field"
      >Auto speed <input
        aria-label="Auto speed"
        type="range"
        min="1"
        max="8"
        data-cy="story-settings-auto-speed"
        bind:value={autoSpeed}
      /></label
    >
    <label data-cy="story-settings-transitions-field"
      >Transitions <select
        aria-label="Transitions"
        data-cy="story-settings-transitions"
        bind:value={transitions}
        ><option value="standard" data-cy="story-settings-transitions-standard"
          >Standard</option
        ><option value="reduced" data-cy="story-settings-transitions-reduced"
          >Reduced</option
        ><option value="off" data-cy="story-settings-transitions-off"
          >Off</option
        ></select
      ></label
    >
    <label data-cy="story-settings-music-volume-field"
      >Music volume <input
        aria-label="Music volume"
        type="range"
        disabled
        data-cy="story-settings-music-volume"
      /></label
    >
    <label data-cy="story-settings-sound-volume-field"
      >Sound volume <input
        aria-label="Sound volume"
        type="range"
        disabled
        data-cy="story-settings-sound-volume"
      /></label
    >
    <p data-cy="story-settings-audio-note">
      Audio not included in this prototype.
    </p>
    <p data-cy="story-settings-fullscreen-support">
      Fullscreen {fullscreenSupported ? "supported" : "unavailable"}
    </p>
    <button
      type="button"
      class="secondary"
      data-cy="story-settings-reset"
      onclick={reset}>Reset settings</button
    >
  </div>
</OverlayShell>

<style>
  .settings {
    display: grid;
    gap: 1rem;
  }
  .settings label {
    display: grid;
    gap: 0.4rem;
  }
  input,
  select {
    min-height: 44px;
    width: 100%;
    padding: 0.5rem;
    border: 1px solid var(--story-border);
    border-radius: 0.35rem;
    background: #071522;
    color: var(--story-text);
  }
</style>

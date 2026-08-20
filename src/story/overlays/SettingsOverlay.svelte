<script lang="ts">
  import OverlayShell from "./OverlayShell.svelte";
  import {
    AUTO_SPEED_MAX_SECONDS,
    AUTO_SPEED_MIN_SECONDS,
  } from "../playback/story-playback.ts";
  import {
    createStoryPlaybackSettingsStore,
    type StoryPlaybackSettingsStore,
  } from "../playback/story-playback-settings-store.ts";
  /* Auto speed and skip-unread are the two settings with a consumer, so they
     go through the store the narrative screen reads. The rest below are still
     prototype-local: there is no typewriter or transition to drive yet. */
  export let settings: StoryPlaybackSettingsStore =
    createStoryPlaybackSettingsStore();
  export let onclose: () => void = () => undefined;
  export let restoreFocusTo: HTMLElement | null = null;
  let textSpeed = 40;
  let transitions = "standard";
  function reset(): void {
    textSpeed = 40;
    transitions = "standard";
    settings.reset();
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
      >Auto speed ({$settings.autoSpeedSeconds}s per line)
      <input
        aria-label="Auto speed"
        type="range"
        min={AUTO_SPEED_MIN_SECONDS}
        max={AUTO_SPEED_MAX_SECONDS}
        data-cy="story-settings-auto-speed"
        value={$settings.autoSpeedSeconds}
        oninput={(event) =>
          settings.setAutoSpeedSeconds(Number(event.currentTarget.value))}
      /></label
    >
    <label class="toggle" data-cy="story-settings-skip-unread-field"
      ><input
        aria-label="Skip unread text"
        type="checkbox"
        data-cy="story-settings-skip-unread"
        checked={$settings.skipUnread}
        onchange={(event) =>
          settings.setSkipUnread(event.currentTarget.checked)}
      /> Skip unread text</label
    >
    <p class="hint" data-cy="story-settings-skip-unread-note">
      Off, Skip stops at the first line you have not read yet.
    </p>
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
    <p data-cy="story-settings-fullscreen-hint">Press F11 for fullscreen.</p>
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
  .settings label.toggle {
    grid-template-columns: auto 1fr;
    align-items: center;
    gap: 0.6rem;
  }
  .settings label.toggle input {
    width: 1.25rem;
    min-height: 1.25rem;
  }
  .settings .hint {
    margin: -0.6rem 0 0;
    color: var(--story-muted);
    font-size: 0.85rem;
  }
  input,
  select {
    min-height: 44px;
    width: 100%;
    padding: 0.5rem;
    border: 1px solid var(--story-border);
    border-radius: 0.35rem;
    background: var(--bg);
    color: var(--story-text);
  }
</style>

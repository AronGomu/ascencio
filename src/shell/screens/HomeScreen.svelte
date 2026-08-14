<script lang="ts">
  import { onMount } from "svelte";
  import { isFullscreen, requestAppFullscreen } from "../fullscreen.ts";
  import type { AppRoute } from "../routes.ts";
  import type { ShellStore } from "../shell-store.ts";
  import type { ShellSettingsStore } from "../settings/shell-settings-store.ts";
  import ShellSettingsDialog from "./ShellSettingsDialog.svelte";

  export let store: ShellStore;
  export let settings: ShellSettingsStore;
  export let requestFullscreen: (element: Element) => Promise<boolean> =
    requestAppFullscreen;

  const ENTRIES: readonly { route: AppRoute; cy: string; label: string }[] = [
    { route: { kind: "story" }, cy: "home-entry-story", label: "Story" },
    { route: { kind: "decks" }, cy: "home-entry-decks", label: "Decks" },
    { route: { kind: "duel" }, cy: "home-entry-duel", label: "Duel" },
  ];

  let root: HTMLElement | undefined;
  let settingsOpen = false;
  /* Read after mount only: the document is the one thing this screen cannot
     ask for while server-rendered. */
  let documentFullscreen = false;

  onMount(() => {
    const sync = () => {
      documentFullscreen = isFullscreen(document);
    };
    sync();
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  });

  $: tipVisible =
    $settings.fullscreenPreferred &&
    !$settings.fullscreenTipDismissed &&
    !documentFullscreen;

  async function applyFullscreen(): Promise<void> {
    if (root !== undefined) await requestFullscreen(root);
    settings.dismissFullscreenTip();
  }
</script>

<main class="home" data-cy="home-screen" bind:this={root}>
  <h1 data-cy="home-title">YGO Story Duel Simulator</h1>

  {#if tipVisible}
    <div class="tip" role="note" data-cy="home-fullscreen-tip">
      <p data-cy="home-fullscreen-tip-text">
        Fullscreen is enabled in your settings. Your browser needs one click to
        apply it.
      </p>
      <div class="tip-actions" data-cy="home-fullscreen-tip-actions">
        <button
          type="button"
          data-cy="home-fullscreen-apply"
          onclick={applyFullscreen}>Go fullscreen</button
        >
        <button
          type="button"
          class="secondary"
          data-cy="home-fullscreen-dismiss"
          onclick={() => settings.dismissFullscreenTip()}>Not now</button
        >
      </div>
    </div>
  {/if}

  <nav class="entries" data-cy="home-entries">
    {#each ENTRIES as entry (entry.cy)}
      <button
        type="button"
        class="entry"
        data-cy={entry.cy}
        onclick={() => store.navigate(entry.route)}>{entry.label}</button
      >
    {/each}
    <button
      type="button"
      class="entry secondary"
      data-cy="home-entry-settings"
      onclick={() => (settingsOpen = true)}>Settings</button
    >
  </nav>
</main>

{#if settingsOpen}
  <ShellSettingsDialog
    fullscreenPreferred={$settings.fullscreenPreferred}
    onToggleFullscreen={(next) => settings.setFullscreenPreferred(next)}
    onclose={() => (settingsOpen = false)}
  />
{/if}

<style>
  .home {
    display: grid;
    align-content: center;
    justify-items: center;
    gap: var(--space-5);
    height: 100%;
    padding: var(--space-6);
    text-align: center;
  }

  .entries {
    display: grid;
    gap: var(--space-3);
    width: min(20rem, 100%);
  }

  .entry {
    padding-block: var(--space-3);
    font-size: var(--text-md);
  }

  .tip {
    display: grid;
    gap: var(--space-3);
    max-width: 32rem;
    padding: var(--space-4);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--surface-raised);
    color: var(--muted);
    font-size: var(--text-sm);
  }

  .tip-actions {
    display: flex;
    justify-content: center;
    gap: var(--space-2);
  }

  .tip p {
    margin: 0;
  }
</style>

<script lang="ts">
  import type { AppRoute } from "../routes.ts";
  import type { ShellStore } from "../shell-store.ts";
  import ShellSettingsDialog from "./ShellSettingsDialog.svelte";

  export let store: ShellStore;

  const ENTRIES: readonly { route: AppRoute; cy: string; label: string }[] = [
    { route: { kind: "story" }, cy: "home-entry-story", label: "Story" },
    { route: { kind: "decks" }, cy: "home-entry-decks", label: "Decks" },
    { route: { kind: "duel" }, cy: "home-entry-duel", label: "Duel" },
  ];

  let settingsOpen = false;
</script>

<main class="home" data-cy="home-screen">
  <h1 data-cy="home-title">YGO Story Duel Simulator</h1>

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

  <p class="hint" data-cy="home-fullscreen-hint">Press F11 for fullscreen.</p>
</main>

{#if settingsOpen}
  <ShellSettingsDialog onclose={() => (settingsOpen = false)} />
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

  .hint {
    margin: 0;
    color: var(--muted);
    font-size: var(--text-sm);
  }
</style>

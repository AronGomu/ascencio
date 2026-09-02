<script lang="ts">
  import { onMount } from "svelte";
  import type { ShellStore } from "../shell-store.ts";
  import ShellSettingsDialog from "./ShellSettingsDialog.svelte";
  import { storySaveExists } from "./story-save-presence.ts";

  export let store: ShellStore;
  /* Free play opens on a deck list, and reading that list means the whole
     packaged card database. Reported the moment a player reaches for the
     entry — pointer over it, or focus on it — so the read happens while they
     are still travelling to the click, and never for a player who came for the
     story and passes it by. */
  export let onfreeplaywarm: () => void = () => undefined;

  /* Starts hidden and appears once the probe answers: a Continue that turns
     out to have nothing behind it is worse than one that arrives a frame
     late. The story domain is not loaded to decide this — see
     `story-save-presence.ts`. */
  let hasSave = false;
  let settingsOpen = false;

  onMount(() => {
    void storySaveExists(globalThis.indexedDB).then((found) => {
      hasSave = found;
    });
  });
</script>

<main class="main-menu" data-cy="main-menu-screen">
  <p class="main-menu__eyebrow" data-cy="main-menu-eyebrow">
    Private prototype · v0.1
  </p>
  <h1 class="main-menu__title" data-cy="main-menu-title">
    ASCEN<b data-cy="main-menu-title-accent">CIO</b>
  </h1>
  <p class="main-menu__tagline" data-cy="main-menu-tagline">
    One signal. One duel. More than one way forward.
  </p>

  <nav
    class="main-menu__entries"
    aria-label="Main menu"
    data-cy="main-menu-entries"
  >
    <button
      type="button"
      data-cy="main-menu-new-game"
      onclick={() => store.enterStory("new")}>New Game</button
    >
    {#if hasSave}
      <button
        type="button"
        data-cy="main-menu-continue"
        onclick={() => store.enterStory("continue")}>Continue</button
      >
    {/if}
    <button
      type="button"
      class="secondary"
      data-cy="main-menu-load"
      onclick={() => store.enterStory("load")}>Load</button
    >
    <button
      type="button"
      class="secondary"
      data-cy="main-menu-settings"
      onclick={() => (settingsOpen = true)}>Settings</button
    >
    <!-- Last on purpose: the game's front door is the story, and free play is
         the developer's and the practising player's way past it (ADR-051). -->
    <button
      type="button"
      class="secondary"
      data-cy="main-menu-free-play"
      onpointerenter={onfreeplaywarm}
      onfocus={onfreeplaywarm}
      onclick={() => store.navigate({ kind: "free-play" })}>Free Play</button
    >
  </nav>

  <p class="main-menu__hint" data-cy="main-menu-fullscreen-hint">
    Press F11 for fullscreen.
  </p>
</main>

{#if settingsOpen}
  <ShellSettingsDialog onclose={() => (settingsOpen = false)} />
{/if}

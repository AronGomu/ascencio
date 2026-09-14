<script lang="ts">
  import { onMount } from "svelte";
  import { coreGateMessage, type CoreGate } from "../core/core-gate.ts";
  import { INSTALL_CONTENT_ROUTE } from "../routes.ts";
  import type { ShellStore } from "../shell-store.ts";
  import ShellSettingsDialog from "./ShellSettingsDialog.svelte";
  import type { GenerationSaveRepository } from "../../story/saves/index.ts";
  export let saves: GenerationSaveRepository | null = null;
  let saveError: string | null = null;

  export let store: ShellStore;
  export let coreGate: CoreGate;
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
    if (coreGate.kind !== "ready") return;
    if (saves === null) return;
    void Promise.all([saves.read("manual:1"), saves.read("autosave")])
      .then((results) => {
        hasSave = results.some((result) => result.kind === "ready");
        const problem = results.find(
          (result) =>
            result.kind === "corrupt" || result.kind === "incompatible",
        );
        if (problem?.kind === "corrupt") saveError = problem.reason;
        if (problem?.kind === "incompatible")
          saveError = `Story save schema ${problem.found} is incompatible`;
      })
      .catch((error: unknown) => {
        saveError =
          error instanceof Error ? error.message : "STORY_STORAGE_UNAVAILABLE";
      });
  });

  const gameplayReady = (): boolean => coreGate.kind === "ready";
  const gameplayReason = (): string =>
    gameplayReady()
      ? "No compatible save is available."
      : coreGateMessage(coreGate);
</script>

<main class="main-menu" data-cy="main-menu-screen">
  {#if saveError !== null}<p role="alert" data-cy="main-menu-save-error">
      {saveError}
    </p>{/if}
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
      disabled={!gameplayReady()}
      title={!gameplayReady() ? gameplayReason() : undefined}
      onclick={() => store.enterStory("new")}>New Game</button
    >
    <button
      type="button"
      data-cy="main-menu-continue"
      disabled={!gameplayReady() || !hasSave}
      title={!gameplayReady() || !hasSave ? gameplayReason() : undefined}
      onclick={() => store.enterStory("continue")}>Continue</button
    >
    <button
      type="button"
      class="secondary"
      data-cy="main-menu-load"
      disabled={!gameplayReady()}
      title={!gameplayReady() ? gameplayReason() : undefined}
      onclick={() => store.enterStory("load")}>Load</button
    >
    <button
      type="button"
      class="secondary"
      data-cy="main-menu-install-content"
      onclick={() => store.navigate(INSTALL_CONTENT_ROUTE)}
      >Install Content</button
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
      disabled={!gameplayReady()}
      title={!gameplayReady() ? gameplayReason() : undefined}
      onpointerenter={() => {
        if (gameplayReady()) onfreeplaywarm();
      }}
      onfocus={() => {
        if (gameplayReady()) onfreeplaywarm();
      }}
      onclick={() => store.navigate({ kind: "free-play" })}>Free Play</button
    >
  </nav>

  <p class="main-menu__hint" role="status" data-cy="core-gate-status">
    {coreGateMessage(coreGate)}
  </p>
  <p class="main-menu__hint" data-cy="main-menu-fullscreen-hint">
    Press F11 for fullscreen.
  </p>
</main>

{#if settingsOpen}
  <ShellSettingsDialog {coreGate} onclose={() => (settingsOpen = false)} />
{/if}

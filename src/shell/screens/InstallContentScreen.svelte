<script lang="ts">
  import { onMount } from "svelte";
  import type {
    ShellBootstrap,
    ShellInstaller,
    ShellGameplay,
    ShellSession,
    ShellChapterSizes,
    ShellInstallProgress,
  } from "../core/installed-inputs.ts";
  import { openShellInstaller } from "../application/legacy-installer.ts";
  import { contentErrorCopy } from "../content/content-error-copy.ts";
  import { coreGateMessage, type CoreGate } from "../core/core-gate.ts";

  export let gate: CoreGate;
  export let bootstrap: ShellBootstrap | null;
  export let onback: () => void;
  export let oninstalled: (
    gameplay: ShellGameplay,
    reader: ShellSession,
    generation: number,
  ) => void = () => undefined;
  export let createInstaller = openShellInstaller;

  let installer: ShellInstaller | null = null;
  let busy = false;
  let error = "";
  let progress: ShellInstallProgress | null = null;
  let installed: readonly string[] = [];
  let gameplayReady: readonly string[] =
    gate.kind === "ready" ? gate.gameplay.chapterIds : [];
  let descriptions: Record<string, ShellChapterSizes> = {};
  let mounted = false;
  let started = false;
  let readerTransferred = false;
  $: if (mounted && bootstrap !== null && !started) void initialize();
  let unsubscribe: () => void = () => undefined;
  const abort = new AbortController();
  const phaseLabel = (phase: ShellInstallProgress["phase"]): string =>
    ({
      queued: "checking",
      extracting: "staging",
      complete: "installed",
      downloading: "downloading",
      verifying: "verifying",
      activating: "activating",
      paused: "paused",
      failed: "failed",
      cancelled: "cancelled",
    })[phase];

  async function initialize(): Promise<void> {
    if (!bootstrap) return;
    started = true;
    busy = true;
    error = "";
    const result = await createInstaller(bootstrap);
    if (!mounted) {
      if (result.kind === "ok") result.value.close();
      return;
    }
    if (result.kind === "failed") {
      error = contentErrorCopy(result.code);
      busy = false;
      return;
    }
    installer = result.value;
    const refresh = async () => {
      const current = await result.value.current();
      if (!mounted) return;
      if (current.kind === "failed") {
        error = contentErrorCopy(current.code);
        installed = [];
      } else installed = current.value;
    };
    unsubscribe = result.value.subscribeCurrent((state) => {
      if (!mounted) return;
      if (state.kind === "failed") {
        error = contentErrorCopy(state.code);
        installed = [];
      } else installed = state.value;
    });
    await refresh();
    const descriptionsResult = await result.value.descriptions();
    if (descriptionsResult.kind === "failed")
      error = contentErrorCopy(descriptionsResult.code);
    else descriptions = { ...descriptionsResult.value };
    busy = false;
  }
  async function install(chapterId: string): Promise<void> {
    if (busy) return;
    if (!installer) {
      await initialize();
      return;
    }
    busy = true;
    error = "";
    const result = await installer.install(
      chapterId,
      (p) => {
        progress = p;
      },
      abort.signal,
    );
    if (result.kind === "failed") error = contentErrorCopy(result.code);
    else if (result.kind === "ok") {
      gameplayReady = result.value.gameplay.chapterIds;
      oninstalled(
        result.value.gameplay,
        result.value.reader,
        result.value.generation,
      );
      readerTransferred = true;
    }
    busy = false;
  }

  onMount(() => {
    mounted = true;
    const teardown = () => abort.abort();
    window.addEventListener("pagehide", teardown);
    return () => {
      mounted = false;
      teardown();
      window.removeEventListener("pagehide", teardown);
      unsubscribe();
      if (!readerTransferred) installer?.close();
    };
  });
</script>

<main class="install-content" data-cy="install-content-screen">
  <p class="install-content__eyebrow" data-cy="install-content-eyebrow">
    CORE content
  </p>
  <h1 data-cy="install-content-heading">Install content</h1>
  <p role="status" data-cy="install-content-status">
    {coreGateMessage(gate)}
  </p>

  {#if bootstrap !== null}
    <ul data-cy="install-content-chapters">
      {#each bootstrap.chapters as chapter (chapter.id)}
        <li data-cy={`install-content-chapter-${chapter.id}`}>
          <strong data-cy={`install-content-chapter-title-${chapter.id}`}
            >{chapter.title}</strong
          >
          <span data-cy={`install-content-chapter-description-${chapter.id}`}
            >{chapter.description}</span
          >
          <span data-cy={`install-content-sizes-${chapter.id}`}>
            {#if descriptions[chapter.id]}
              Download: {descriptions[chapter.id]!.download.toLocaleString()} bytes
              · Installed: {descriptions[
                chapter.id
              ]!.installed.toLocaleString()} bytes · Dependencies: {descriptions[
                chapter.id
              ]!.deps || "none"}
            {:else}Unavailable in this release{/if}
          </span>
          <span role="status" data-cy={`install-content-ready-${chapter.id}`}
            >{gameplayReady.includes(chapter.id)
              ? "Verified installed — gameplay ready."
              : installed.includes(chapter.id)
                ? "Installed — preparing gameplay…"
                : descriptions[chapter.id]
                  ? "Available"
                  : "Unavailable"}</span
          >
          <button
            type="button"
            data-cy={`install-content-install-${chapter.id}`}
            disabled={busy ||
              installed.includes(chapter.id) ||
              !descriptions[chapter.id]}
            onclick={() => install(chapter.id)}
            >{error ? "Retry installation" : "Install"}</button
          >
        </li>
      {/each}
    </ul>
  {/if}

  <p class="install-content__hint" data-cy="install-content-availability">
    {bootstrap === null || !bootstrap.available
      ? "No content package is available in this build."
      : "Install verified content to unlock Story and Free Play."}
  </p>
  {#if progress}
    <p role="status" aria-live="polite" data-cy="install-content-progress">
      {phaseLabel(progress.phase)} · {progress.verifiedDownloadBytes.toLocaleString()}
      / {progress.totalDownloadBytes.toLocaleString()} bytes
    </p>
  {/if}
  {#if error}
    <p role="alert" data-cy="install-content-error">{error}</p>
    {#if !installer}<button
        type="button"
        data-cy="install-content-retry"
        disabled={busy}
        onclick={initialize}>Retry</button
      >{/if}
  {/if}
  <div
    class="install-content__actions"
    data-cy="install-content-actions"
    aria-busy={busy}
  >
    <button type="button" data-cy="install-content-install" disabled
      >Update / remove unavailable</button
    >
    <button
      type="button"
      class="secondary"
      data-cy="install-content-back"
      onclick={onback}>Back to menu</button
    >
  </div>
</main>

<style>
  .install-content {
    display: grid;
    align-content: center;
    gap: var(--space-3);
    width: min(38rem, 100%);
    min-height: 100%;
    margin-inline: auto;
    padding: clamp(var(--space-4), 8vw, var(--space-6));
  }

  .install-content__eyebrow,
  .install-content__hint {
    margin: 0;
    color: var(--muted);
  }

  h1,
  p,
  ul {
    margin-block: 0;
  }

  ul {
    display: grid;
    gap: var(--space-2);
    padding: 0;
    list-style: none;
  }

  li {
    display: grid;
    gap: var(--space-1);
    padding: var(--space-3);
    border: 1px solid var(--line-soft);
    background: var(--glass);
  }

  .install-content__actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
</style>

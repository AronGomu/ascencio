<script lang="ts">
  import { onMount } from "svelte";
  import type {
    ContentActionsController,
    ContentActionsView,
    CoreCandidate,
  } from "../application/content-actions.ts";
  import { coreGateMessage, type CoreGate } from "../core/core-gate.ts";

  export let gate: CoreGate;
  export let actions: ContentActionsController | null = null;
  export let onback: () => void;

  let view: ContentActionsView | null = actions?.view ?? null;
  let confirmDeleteAll = false;
  let active: AbortController | null = null;

  function run(work: (signal: AbortSignal) => Promise<void>): void {
    active?.abort();
    active = new AbortController();
    void work(active.signal).catch(() => undefined);
  }
  function approve(candidate: CoreCandidate): void {
    void actions?.approveCore(candidate).catch(() => undefined);
  }
  function deleteUnused(): void {
    void actions?.deleteUnusedAssets().catch(() => undefined);
  }
  function deleteAll(): void {
    confirmDeleteAll = false;
    void actions?.deleteAllAssets().catch(() => undefined);
  }

  onMount(() => {
    const unsubscribe = actions?.subscribe((next) => (view = next));
    return () => {
      active?.abort();
      unsubscribe?.();
    };
  });
</script>

<main class="install-content" data-cy="install-content-screen">
  <h1 data-cy="install-content-heading">Content & updates</h1>
  <p role="status" data-cy="install-content-readiness">
    {coreGateMessage(gate)}
  </p>

  {#if view === null}
    <p role="alert" data-cy="install-content-unavailable">
      Content controls are unavailable. Reopen from Main Menu.
    </p>
  {:else}
    {#if view.missingMedia > 0}
      <section class="media-warning" data-cy="optional-media-warning">
        <h2 data-cy="optional-media-warning-heading">Optional media missing</h2>
        <p data-cy="optional-media-warning-copy">
          Optional media is missing. You can keep playing.
        </p>
        <p data-cy="optional-media-placeholder-count">
          {view.missingMedia.toLocaleString()} placeholder{view.missingMedia ===
          1
            ? ""
            : "s"} active.
        </p>
      </section>
    {/if}

    <p role="status" aria-live="polite" data-cy="content-actions-status">
      {view.message}
    </p>
    {#if view.totalBytes > 0}
      <p data-cy="content-actions-progress">
        {view.completedBytes.toLocaleString()} / {view.totalBytes.toLocaleString()}
        bytes
      </p>
    {/if}

    <section class="action-group" data-cy="content-update-actions">
      <h2 data-cy="content-update-heading">Content</h2>
      <button
        type="button"
        data-cy="content-check-updates"
        disabled={view.phase === "checking" || view.phase === "downloading"}
        onclick={() => run((signal) => actions!.check(signal))}
        >Check updates</button
      >
      <button
        type="button"
        data-cy="content-install-required"
        disabled={!view.canInstall || view.phase === "downloading"}
        onclick={() => run((signal) => actions!.installRequired(signal))}
        >Install required data</button
      >
      <button
        type="button"
        data-cy="content-activate"
        disabled={!view.canActivate || view.phase === "downloading"}
        onclick={() => run((signal) => actions!.activate(signal))}
        >Activate content</button
      >
      <button
        type="button"
        data-cy="content-download-media"
        disabled={!view.canDownloadMedia || view.phase === "downloading"}
        onclick={() => run((signal) => actions!.downloadMedia(signal))}
        >Download media</button
      >
      {#if view.phase === "downloading"}
        <button
          type="button"
          class="secondary"
          data-cy="content-pause-download"
          onclick={() => actions!.cancel()}>Pause download</button
        >
      {/if}
      {#each view.resumableJobs as job (job.request.jobId)}
        <button
          type="button"
          class="secondary"
          data-cy={`content-resume-${job.request.jobId}`}
          onclick={() =>
            run((signal) => actions!.resume(job.request.jobId, signal))}
          >Resume {job.request.kind} download</button
        >
      {/each}
    </section>

    <section class="action-group" data-cy="core-update-actions">
      <h2 data-cy="core-update-heading">CORE</h2>
      <button
        type="button"
        data-cy="core-approve-update"
        disabled={!view.canApproveCore || view.coreCandidate === null}
        onclick={() => approve(view!.coreCandidate!)}
        >Approve CORE update</button
      >
      <p data-cy="core-update-instructions">
        Approved updates install in background. Close all app tabs, then reopen.
      </p>
    </section>

    <section class="action-group" data-cy="content-cleanup-actions">
      <h2 data-cy="content-cleanup-heading">Storage</h2>
      <button
        type="button"
        class="secondary"
        data-cy="content-delete-unused"
        disabled={!view.canDeleteAssets || view.phase === "downloading"}
        onclick={deleteUnused}>Delete unused assets</button
      >
      <button
        type="button"
        class="secondary"
        data-cy="content-delete-all"
        disabled={!view.canDeleteAssets || view.phase === "downloading"}
        onclick={() => (confirmDeleteAll = true)}>Delete all assets</button
      >
      {#if confirmDeleteAll}
        <div
          role="alertdialog"
          aria-labelledby="delete-assets-heading"
          data-cy="delete-assets-confirmation"
        >
          <h3
            id="delete-assets-heading"
            data-cy="delete-assets-confirmation-heading"
          >
            Delete downloaded assets?
          </h3>
          <p data-cy="delete-assets-confirmation-copy">
            Downloads and offline gameplay data will be removed. Saves and
            settings will be retained.
          </p>
          <button
            type="button"
            data-cy="delete-assets-confirm"
            onclick={deleteAll}>Delete downloaded assets</button
          >
          <button
            type="button"
            class="secondary"
            data-cy="delete-assets-cancel"
            onclick={() => (confirmDeleteAll = false)}>Cancel</button
          >
        </div>
      {/if}
    </section>
  {/if}

  <button
    type="button"
    class="secondary"
    data-cy="install-content-back"
    onclick={onback}>Back to menu</button
  >
</main>

<style>
  .install-content {
    display: grid;
    align-content: center;
    gap: var(--space-3);
    width: min(46rem, 100%);
    min-height: 100%;
    margin-inline: auto;
    padding: clamp(var(--space-4), 6vw, var(--space-6));
    overflow: auto;
  }

  h1,
  h2,
  h3,
  p {
    margin-block: 0;
  }

  .action-group,
  .media-warning,
  [role="alertdialog"] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3);
    border: 1px solid var(--line-soft);
    background: var(--glass);
  }

  .action-group h2,
  .media-warning h2,
  [role="alertdialog"] h3,
  .action-group p,
  .media-warning p,
  [role="alertdialog"] p {
    flex-basis: 100%;
  }

  .media-warning {
    border-color: var(--warning);
  }
</style>

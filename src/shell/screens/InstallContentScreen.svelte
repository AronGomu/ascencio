<script lang="ts">
  import { onMount } from "svelte";
  import { downloadUserData } from "../application/user-data-download.ts";
  import {
    failureCopy,
    type ManualContentController,
  } from "../application/manual-content-controller.ts";
  import { coreGateMessage, type CoreGate } from "../core/core-gate.ts";
  import type { StorageFailure } from "../../storage/index.ts";
  import {
    isNativeDesktop,
    openNativeContentFolder,
    seedNativeContent,
  } from "../native/content.ts";

  export let gate: CoreGate;
  export let manual: ManualContentController | null = null;
  export let storageFailure: StorageFailure | null = null;
  export let onback: () => void;

  let view = manual?.view ?? null;
  let boundManual: ManualContentController | null = null;
  let unsubscribeManual: (() => void) | null = null;
  const nativeDesktop = isNativeDesktop();
  let nativeContentPath = "";
  let nativeFolderError = "";
  $: removeCandidate = view?.removal ?? null;
  $: actionsBlocked =
    view?.busy === true ||
    view?.refreshPending === true ||
    view?.state.kind === "restore-outcome-unknown" ||
    removeCandidate !== null;
  $: bindManual(manual);

  function bindManual(next: ManualContentController | null): void {
    if (next === boundManual) return;
    unsubscribeManual?.();
    boundManual = next;
    view = next?.view ?? null;
    unsubscribeManual = next?.subscribe((value) => (view = value)) ?? null;
    if (next !== null) void next.refresh();
  }

  async function importFiles(event: Event): Promise<void> {
    const input = event.currentTarget as HTMLInputElement;
    const files = input.files === null ? [] : [...input.files];
    try {
      await manual?.importPackages(files);
    } finally {
      input.value = "";
    }
  }

  async function inspectBackup(event: Event): Promise<void> {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    try {
      if (file !== undefined) await manual?.inspectUserDataBackup(file);
    } finally {
      input.value = "";
    }
  }

  async function exportBackup(): Promise<void> {
    const blob = await manual?.exportUserData();
    if (blob === null || blob === undefined) return;
    await downloadUserData(blob, (message) => manual?.reportDownload(message));
  }

  function bytes(value: number): string {
    return `${value.toLocaleString()} bytes`;
  }

  async function openContentFolder(): Promise<void> {
    try {
      await openNativeContentFolder();
      nativeFolderError = "";
    } catch (error) {
      nativeFolderError =
        error instanceof Error ? error.message : String(error);
    }
  }

  onMount(() => {
    if (nativeDesktop)
      void seedNativeContent().then((status) => {
        nativeContentPath = status?.contentFolder ?? "";
      });
    return () => {
      unsubscribeManual?.();
    };
  });
</script>

<main class="install-content" data-cy="install-content-screen">
  <h1 data-cy="install-content-heading">Installed content</h1>
  <p role="status" data-cy="install-content-readiness">
    {coreGateMessage(gate)}
  </p>
  {#if nativeDesktop}
    <p data-cy="native-content-location">
      Installed content: {nativeContentPath}
    </p>
    <button
      type="button"
      class="secondary"
      data-cy="native-open-content-folder"
      onclick={openContentFolder}>Open content folder</button
    >
    {#if nativeFolderError}
      <p role="alert" data-cy="native-content-folder-error">
        {nativeFolderError}
      </p>
    {/if}
  {/if}

  {#if storageFailure?.code === "APP_ALREADY_OPEN" || view?.state.kind === "already-open"}
    <p role="alert" data-cy="content-already-open">
      Application is already open. Close the other instance, then retry here.
    </p>
  {:else if view === null}
    <p role="alert" data-cy="install-content-unavailable">
      {storageFailure === null
        ? "Local content controls are unavailable. Reopen from Main Menu."
        : failureCopy(storageFailure)}
    </p>
  {:else}
    <p role="status" aria-live="polite" data-cy="manual-content-status">
      {view.message}
    </p>

    {#if view.state.kind === "restore-outcome-unknown"}
      <p role="alert" data-cy="user-data-restore-outcome-unknown">
        {view.message}
      </p>
    {/if}

    {#if view.state.kind === "failed"}
      <p role="alert" data-cy="manual-content-error">{view.message}</p>
      <button
        type="button"
        class="secondary"
        data-cy="manual-content-retry"
        disabled={view.busy}
        onclick={() => manual!.retry()}
        >{view.refreshPending ? "Retry refresh" : "Retry"}</button
      >
    {/if}

    <section class="action-group" data-cy="manual-package-actions">
      <h2 data-cy="manual-package-heading">Local packages</h2>
      <p data-cy="manual-package-trust-warning">
        Only import packages from sources you trust. Corruption checks do not
        authenticate the publisher.
      </p>
      <label data-cy="content-import-label">
        Import content packages
        <input
          type="file"
          multiple
          accept=".zip,application/zip,.sqlite,application/vnd.sqlite3"
          data-cy="content-import-files"
          aria-describedby="content-import-help"
          disabled={actionsBlocked}
          onchange={importFiles}
        />
      </label>
      <p id="content-import-help" data-cy="content-import-help">
        Choose one package ZIP, or up to four SQLite package files.
      </p>
      {#if view.state.kind === "importing"}
        <p role="status" data-cy="content-import-progress">
          {#if view.state.progress === null}
            Preparing package import…
          {:else}
            {view.state.progress.phase}: {view.state.progress.fileName} — {bytes(
              view.state.progress.copiedBytes,
            )} / {bytes(view.state.progress.totalBytes)}
          {/if}
        </p>
        <button
          type="button"
          class="secondary"
          data-cy="content-import-cancel"
          onclick={() => manual!.cancelImport()}>Cancel import</button
        >
      {/if}
      <button
        type="button"
        data-cy="content-verify"
        disabled={actionsBlocked || view.state.kind !== "ready"}
        onclick={() => manual!.verifyInstalled()}
        >Verify installed content</button
      >
      <button
        type="button"
        class="secondary"
        data-cy="content-cleanup-unused"
        disabled={actionsBlocked || view.state.kind !== "ready"}
        onclick={() => manual!.cleanupUnused()}>Cleanup unused files</button
      >
    </section>

    {#if view.state.kind === "ready"}
      <section class="action-group" data-cy="installed-package-list">
        <h2 data-cy="installed-package-heading">Installed packages</h2>
        {#if view.state.stack.packages.length === 0}
          <p data-cy="installed-package-empty">No packages installed.</p>
        {:else}
          {#each view.state.stack.packages as active (active.packageId)}
            <article data-cy={`content-package-${active.packageId}`}>
              <h3 data-cy={`content-package-title-${active.packageId}`}>
                {active.packageId}
              </h3>
              <p data-cy={`content-package-details-${active.packageId}`}>
                Version {active.version} · {bytes(active.bytes)}
              </p>
              <button
                type="button"
                class="secondary"
                data-cy={`content-remove-${active.packageId}`}
                disabled={actionsBlocked}
                onclick={() => manual!.requestRemoval(active.packageId)}
                >Remove</button
              >
            </article>
          {/each}
        {/if}
        {#if view.state.readiness.missing.length > 0}
          <p data-cy="content-missing-dependencies">
            Install in order: {view.state.readiness.missing.join(", ")}.
          </p>
        {/if}
        {#if view.state.mediaWarnings.length > 0}
          <p role="status" data-cy="optional-media-warning">
            Optional media is unavailable. You can keep playing. {view.state.mediaWarnings.length.toLocaleString()}
            warning{view.state.mediaWarnings.length === 1 ? "" : "s"} recorded.
          </p>
        {/if}
      </section>
    {/if}

    {#if removeCandidate !== null}
      <div
        role="alertdialog"
        aria-labelledby="remove-package-heading"
        data-cy="content-remove-confirmation"
      >
        <h3 id="remove-package-heading" data-cy="content-remove-heading">
          Remove {removeCandidate.packageId} version {removeCandidate.version}?
        </h3>
        <p data-cy="content-remove-copy">
          Installed dependants must be removed first. User decks and saves are
          unchanged.
        </p>
        <button
          type="button"
          data-cy="content-remove-confirm"
          disabled={view.busy}
          onclick={() => manual!.removePackage(true)}>Remove package</button
        >
        <button
          type="button"
          class="secondary"
          data-cy="content-remove-cancel"
          disabled={view.busy}
          onclick={() => manual!.cancelRemoval()}>Cancel</button
        >
      </div>
    {/if}

    <section class="action-group" data-cy="user-data-backup-actions">
      <h2 data-cy="user-data-backup-heading">User data backup</h2>
      <p data-cy="user-data-backup-copy">
        Export or replace decks, preferences, and story saves. Installed content
        is separate.
      </p>
      <button
        type="button"
        data-cy="user-data-export"
        disabled={actionsBlocked}
        onclick={exportBackup}>Export user-data.json</button
      >
      <label data-cy="user-data-import-label">
        Inspect backup
        <input
          type="file"
          accept=".json,application/json"
          data-cy="user-data-import-file"
          disabled={actionsBlocked}
          onchange={inspectBackup}
        />
      </label>
      {#if view.state.kind === "restore-confirmation"}
        <div
          role="alertdialog"
          aria-labelledby="restore-user-data-heading"
          data-cy="user-data-restore-dialog"
        >
          <h3
            id="restore-user-data-heading"
            data-cy="user-data-restore-heading"
          >
            Restore user data
          </h3>
          <p data-cy="user-data-restore-copy">
            Restore this backup? This replaces all current decks, preferences,
            and story saves. Installed content is unchanged.
          </p>
          <ul data-cy="user-data-restore-counts">
            {#each Object.entries(view.state.preview.counts) as [namespace, count] (namespace)}
              <li data-cy={`user-data-restore-count-${namespace}`}>
                {namespace}: {count.toLocaleString()}
              </li>
            {/each}
          </ul>
          <button
            type="button"
            class="secondary"
            data-cy="user-data-export-before-restore"
            disabled={actionsBlocked}
            onclick={exportBackup}>Export current data first</button
          >
          <button
            type="button"
            data-cy="user-data-restore-confirm"
            disabled={actionsBlocked}
            onclick={() => manual!.confirmRestore()}
            >Replace current user data</button
          >
          <button
            type="button"
            class="secondary"
            data-cy="user-data-restore-cancel"
            disabled={actionsBlocked}
            onclick={() => manual!.cancelRestore()}>Cancel</button
          >
        </div>
      {/if}
    </section>
  {/if}

  <button
    type="button"
    class="secondary"
    data-cy="install-content-back"
    disabled={view?.navigationBlocked === true}
    onclick={() => {
      if (view?.navigationBlocked !== true) onback();
    }}>Back to Main Menu</button
  >
</main>

<style>
  .install-content {
    display: grid;
    align-content: start;
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
  p,
  ul {
    margin-block: 0;
  }

  .action-group,
  [role="alertdialog"] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
    padding: var(--space-3);
    border: 1px solid var(--line-soft);
    background: var(--glass);
  }

  .action-group h2,
  .action-group > p,
  [role="alertdialog"] h3,
  [role="alertdialog"] p,
  [role="alertdialog"] ul {
    flex-basis: 100%;
    min-width: 0;
  }

  article {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-2);
    min-width: 0;
    overflow-wrap: anywhere;
  }

  article {
    flex-basis: 100%;
    padding-block: var(--space-2);
    border-block-end: 1px solid var(--line-soft);
  }

  article h3,
  article p {
    min-width: 0;
  }

  input[type="file"] {
    display: block;
    max-width: 100%;
    margin-block-start: var(--space-1);
  }

  [role="alert"] {
    overflow-wrap: anywhere;
  }
</style>

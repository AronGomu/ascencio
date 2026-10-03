<script lang="ts">
  import type AppShell from "../AppShell.svelte";
  import { onMount } from "svelte";
  import { listen } from "@tauri-apps/api/event";
  import { getCurrentWindow } from "@tauri-apps/api/window";
  import { isNativeApp } from "../native/content.ts";
  import {
    invokeNative,
    prepareNativeStorage,
    closePreparedNativeStorage,
    flushPreparedNativeStorage,
    type StartupLogStatus,
  } from "../../storage/index.ts";
  import {
    loadCoreStartup,
    closeCoreStartup,
  } from "../application/core-startup.ts";
  import {
    emptyStartupLog,
    readStartupLog,
    recordStartupDiagnostic,
    startupDiagnostics,
    startupDiagnostic,
    openStartupLog,
  } from "./startup-diagnostics.ts";

  import StartupProgressBar from "./StartupProgressBar.svelte";
  import { startupErrorTitle } from "./startup-error-title.ts";
  import { startupPercentage } from "./startup-percentage.ts";

  let AppShellComponent: typeof AppShell | null = null;
  let ready = false;
  let running = false;
  let phase = "Preparing application…";
  let percentage = 0;
  let log: StartupLogStatus = emptyStartupLog;
  let actionMessage = "";
  let heading: HTMLHeadingElement;
  let alive = true;
  let controller = new AbortController();
  let exitError = "";
  let exiting = false;
  let maintenance = false;
  let maintenanceBusy = true;
  async function restart() {
    await flushPreparedNativeStorage();
    ready = false;
    await closeCoreStartup();
    await closePreparedNativeStorage();
    maintenance = false;
    await retry();
  }
  async function quit() {
    if (exiting) return;
    exiting = true;
    controller.abort();
    try {
      await flushPreparedNativeStorage();
      ready = false;
      await closeCoreStartup();
      await closePreparedNativeStorage();
      await invokeNative("native_startup_quit");
    } catch (error) {
      exitError = error instanceof Error ? error.message : String(error);
    } finally {
      exiting = false;
    }
  }
  async function repairContent() {
    running = true;
    phase = "Restoring bundled content…";
    percentage = 0;
    try {
      await closeCoreStartup();
      await closePreparedNativeStorage();
      await invokeNative("native_startup_repair");
    } finally {
      running = false;
    }
    await retry();
  }

  async function attempt() {
    if (running) return;
    running = true;
    actionMessage = "";
    phase = "Preparing application…";
    percentage = 0;
    try {
      if (!isNativeApp())
        throw new Error("Open this application through Tauri.");
      try {
        log = { ...(await readStartupLog()), diagnostics: [] };
      } catch (error) {
        log = { ...emptyStartupLog, loggingError: String(error) };
      }
      phase = "Verifying installed content…";
      percentage = startupPercentage({
        phase: "startup",
        completed: 1,
        total: 1,
      });
      await prepareNativeStorage(controller.signal, (progress) => {
        if (!alive) return;
        percentage = Math.max(percentage, startupPercentage(progress));
        phase = `${progress.phase.replaceAll("-", " ")}${progress.total > 0 ? ` (${progress.completed}/${progress.total})` : progress.completed > 0 ? ` (${progress.completed} files)` : ""}…`;
      });
      controller.signal.throwIfAborted();
      phase = "Preparing gameplay and screens…";
      percentage = Math.max(
        percentage,
        startupPercentage({
          phase: "gameplay-preparation",
          completed: 0,
          total: 1,
        }),
      );
      const shell = await import("../AppShell.svelte");
      AppShellComponent = shell.default;
      const startup = await loadCoreStartup(
        controller.signal,
        (completed, total) => {
          if (alive)
            percentage = Math.max(
              percentage,
              startupPercentage({
                phase: "gameplay-preparation",
                completed: completed + 1,
                total: total + 1,
              }),
            );
        },
      );
      if (startup.gate.kind !== "ready")
        throw new Error(`STARTUP_NOT_PREPARED: ${startup.gate.kind}`);
      if (alive) {
        percentage = 100;
        ready = true;
      }
    } catch (error) {
      if (!alive) return;
      for (const diagnostic of startupDiagnostics(error)) {
        try {
          const diagnostics = [...log.diagnostics, diagnostic].slice(0, 256);
          log = { ...(await recordStartupDiagnostic(diagnostic)), diagnostics };
        } catch (loggingError) {
          log = {
            ...log,
            path: null,
            loggingError: String(loggingError),
            diagnostics: [...log.diagnostics, diagnostic].slice(0, 256),
          };
        }
      }
      phase = controller.signal.aborted
        ? "Startup cancelled"
        : "Application could not start";
      queueMicrotask(() => heading?.focus());
    } finally {
      running = false;
    }
  }
  async function retry() {
    controller.abort();
    await closeCoreStartup();
    await closePreparedNativeStorage();
    controller = new AbortController();
    log = emptyStartupLog;
    await attempt();
  }
  async function action(run: () => Promise<unknown>) {
    actionMessage = "";
    try {
      await run();
    } catch (error) {
      actionMessage = error instanceof Error ? error.message : String(error);
      queueMicrotask(() => heading?.focus());
    }
  }
  async function copyError() {
    const details = {
      ...log,
      ...(actionMessage || exitError ? { actionError: primaryError } : {}),
    };
    await action(() =>
      navigator.clipboard.writeText(JSON.stringify(details, null, 2)),
    );
  }
  $: primaryError =
    actionMessage || exitError
      ? startupDiagnostic(actionMessage || exitError)
      : log.diagnostics.find((diagnostic) => diagnostic.severity === "error");
  $: failed = !running && primaryError !== undefined;
  $: canRestore = log.diagnostics.some(
    (diagnostic) =>
      diagnostic.code.startsWith("BASE_") ||
      diagnostic.code.startsWith("ENGINE_"),
  );
  onMount(() => {
    let stopClose: (() => void) | undefined;
    let stopExit: (() => void) | undefined;
    const enterMaintenance = () => {
      maintenance = true;
    };
    const updateMaintenance = (event: Event) => {
      maintenanceBusy = (event as CustomEvent<{ busy: boolean }>).detail.busy;
    };
    globalThis.addEventListener(
      "application-maintenance-requested",
      enterMaintenance,
    );
    globalThis.addEventListener(
      "application-maintenance-state",
      updateMaintenance,
    );
    if (isNativeApp())
      void listen("application-close-requested", () => {
        void quit();
      })
        .then((stop) => {
          if (alive) stopExit = stop;
          else stop();
        })
        .catch((error) => {
          exitError = String(error);
        });
    if (isNativeApp())
      void getCurrentWindow()
        .onCloseRequested((event) => {
          event.preventDefault();
          void quit();
        })
        .then((stop) => {
          if (alive) stopClose = stop;
          else stop();
        })
        .catch((error) => {
          exitError = String(error);
        });
    void attempt();
    return () => {
      alive = false;
      controller.abort();
      stopClose?.();
      stopExit?.();
      globalThis.removeEventListener(
        "application-maintenance-requested",
        enterMaintenance,
      );
      globalThis.removeEventListener(
        "application-maintenance-state",
        updateMaintenance,
      );
    };
  });
</script>

{#if ready && exitError}<p
    data-cy="startup-exit-error"
    class="exit-error"
    role="alert"
  >
    The application could not close safely: {exitError}
  </p>{/if}

{#if ready}
  {#if maintenance}<aside
      data-cy="startup-maintenance"
      class="exit-error"
      role="status"
    >
      Content maintenance is active. Restart preparation before returning to
      gameplay.
      <button
        data-cy="startup-maintenance-restart"
        disabled={maintenanceBusy}
        on:click={() => action(restart)}>Restart preparation</button
      >
      {#if actionMessage}<p data-cy="startup-maintenance-error" role="alert">
          {actionMessage}
        </p>{/if}
    </aside>{/if}
  {#if AppShellComponent}<svelte:component this={AppShellComponent} />{/if}
{:else}
  <main data-cy="startup-surface" class="startup" aria-busy={running}>
    <section data-cy="startup-panel" class="panel">
      <h1 data-cy="startup-heading" bind:this={heading} tabindex="-1">
        {failed ? "Application could not start" : phase}
      </h1>
      {#if failed && primaryError}
        <h2 data-cy="startup-error-title" class="error-title">
          {startupErrorTitle(primaryError)}
        </h2>
        <p data-cy="startup-error-message" class="error-message" role="alert">
          {primaryError.message}{log.loggingError
            ? `\nThe log could not be written: ${log.loggingError}. Copy Error includes the available details.`
            : ""}
        </p>
        <div data-cy="startup-actions" class="actions">
          <button
            data-cy="startup-repair-content"
            disabled={!canRestore || exiting}
            title={canRestore
              ? "Restore bundled critical content and retry startup"
              : "This error cannot be repaired by restoring bundled content"}
            on:click={() => action(repairContent)}>Restore</button
          >
          <button
            data-cy="startup-open-log"
            disabled={!log.path || exiting}
            on:click={() => action(() => openStartupLog())}>Open Log</button
          >
          <button
            data-cy="startup-copy-details"
            disabled={exiting}
            on:click={copyError}>Copy Error</button
          >
          <button
            data-cy="startup-quit"
            disabled={exiting}
            on:click={() => action(quit)}>Close</button
          >
        </div>
      {:else}
        <p data-cy="startup-status" role="status" aria-live="polite">
          Preparing your content and saves. Gameplay opens when preparation is
          complete.
        </p>
        <StartupProgressBar {percentage} />
      {/if}
    </section>
  </main>
{/if}

<style>
  .exit-error {
    position: fixed;
    z-index: 10000;
    inset: 0 0 auto;
    margin: 0;
    padding: 1rem;
    background: var(--panel);
    color: var(--text);
    border: 2px solid var(--accent);
  }
  .startup {
    height: 100svh;
    overflow: auto;
    display: flex;
    flex-direction: column;
    padding: clamp(1rem, 4vw, 3rem);
  }
  .panel {
    width: min(100%, 70ch);
    margin: auto;
    flex-shrink: 0;
    background: var(--panel);
    border: 1px solid var(--border);
    padding: clamp(1rem, 3vw, 2rem);
  }
  h1 {
    font-family: var(--font-display);
    font-size: clamp(1.6rem, 4vw, 2.5rem);
    color: var(--text);
    margin-block: 0 1rem;
  }
  p {
    overflow-wrap: anywhere;
    white-space: pre-wrap;
    line-height: 1.5;
  }
  .error-title {
    font-size: 1.15rem;
    margin: 1.5rem 0 0.5rem;
    color: var(--text);
  }
  .error-message {
    margin: 0.5rem 0 0;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin-block-start: 1.5rem;
  }
  button {
    min-height: 44px;
    padding: 0.6rem 1rem;
    color: var(--text);
    background: var(--panel);
    border: 1px solid var(--border);
    cursor: pointer;
    font: inherit;
  }
  button:hover {
    border-color: var(--accent);
  }
  button:disabled {
    opacity: 0.5;
    cursor: default;
  }
  button:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 3px;
  }
</style>

<script lang="ts">
  import { onMount } from "svelte";
  import type { DuelError } from "../../duel/contracts/duel-error.ts";
  import { portalDuelDialog } from "./portal-duel-dialog.ts";
  import type { RestoreFailureReason } from "../../duel/contracts/duel-worker-event.ts";

  export let error: DuelError;
  /* Whether the Worker can still rebuild this duel. Hidden rather than
     disabled when false: a duel too long for its own trace, or one the player
     never answered, has nothing to offer and must not look like it does. */
  export let canRestore = false;
  /* A failure that predates the first duel has no trace, so it has no report. */
  export let diagnosticsAvailable = false;
  export let diagnosticPending = false;
  export let diagnosticMessage: string | null = null;
  export let restorePending = false;
  /* `"refused"` is the one outcome the Worker never reports: the client turned
     the command away before it was posted, so no `restore_failed` follows. */
  export let restoreFailure: RestoreFailureReason | "refused" | null = null;
  export let ondownload: () => void;
  export let onrestore: () => void;
  export let onretry: () => void;

  let heading: HTMLHeadingElement | undefined;

  onMount(() => {
    heading?.focus();
  });

  /* The typed reason the Worker refused or abandoned the rebuild, said in the
     player's own terms. A rebuild that fails silently is the thing this dialog
     exists to prevent, so every reason gets its own sentence. */
  function restoreFailureCopy(
    reason: RestoreFailureReason | "refused",
  ): string {
    switch (reason) {
      case "refused":
        return "The duel could not be handed back to the engine. Try again in a moment.";
      case "no_restore_point":
        return "This duel no longer holds a decision of yours to rebuild from.";
      case "duel_active":
        return "The duel is still running, so there is nothing to rebuild.";
      case "replay_diverged":
        return "The rebuilt duel asked a different question than your recorded answer belongs to.";
      case "replay_failed":
        return "The duel could not be rebuilt from its recorded decisions.";
    }
  }
</script>

<div
  class="dialog-backdrop"
  data-cy="duel-error-dialog-backdrop"
  use:portalDuelDialog
>
  <div
    class="dialog-panel duel-error-dialog-panel"
    role="dialog"
    aria-modal="true"
    aria-labelledby="duel-error-dialog-heading"
    data-cy="duel-error-dialog"
  >
    <section class="error-panel" data-cy="duel-error-panel">
      <div data-cy="duel-error-body">
        <p class="eyebrow" data-cy="duel-error-eyebrow">Duel stopped</p>
        <h2
          id="duel-error-dialog-heading"
          class="ui-dialog-title duel-error-dialog-title"
          tabindex="-1"
          bind:this={heading}
          data-cy="duel-error-heading"
        >
          {error.message}
        </h2>
        <p data-cy="duel-error-code">Error code: {error.code}</p>
      </div>
      <div class="button-row" data-cy="duel-error-actions">
        {#if diagnosticsAvailable}
          <span class="sensitive-note" data-cy="duel-error-sensitive-note"
            >Contains the production seed.</span
          >
          <button
            type="button"
            class="secondary"
            disabled={diagnosticPending}
            data-cy="duel-error-download-button"
            onclick={ondownload}
            >{diagnosticPending
              ? "Preparing diagnostics…"
              : "Download diagnostics"}</button
          >
        {/if}
        {#if canRestore}
          <button
            type="button"
            disabled={restorePending}
            data-cy="duel-error-restore-button"
            onclick={onrestore}
            >{restorePending
              ? "Rebuilding the duel…"
              : "Restore your last decision"}</button
          >
        {/if}
        <button
          type="button"
          class="secondary"
          data-cy="duel-error-retry-button"
          onclick={onretry}>Try again</button
        >
      </div>
      {#if restoreFailure !== null}
        <p
          class="restore-failure"
          role="alert"
          data-cy="duel-error-restore-failure"
        >
          {restoreFailureCopy(restoreFailure)}
        </p>
      {/if}
      {#if diagnosticMessage}
        <p class="diagnostic-message" data-cy="duel-error-message">
          {diagnosticMessage}
        </p>
      {/if}
    </section>
  </div>
</div>

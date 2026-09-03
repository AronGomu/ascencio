<script lang="ts">
  import { onMount } from "svelte";
  import type { DuelResult } from "../../duel/contracts/duel-result.ts";

  export let result: DuelResult;
  export let completed = false;
  export let diagnosticPending = false;
  export let onrestart: () => void;
  export let onchangedecks: () => void;
  export let ondownloaddiagnostics: () => void;

  let heading: HTMLHeadingElement | undefined;

  onMount(() => {
    heading?.focus();
  });
</script>

<div class="dialog-backdrop" data-cy="duel-result-dialog-backdrop">
  <div
    class="dialog-panel"
    role="dialog"
    aria-modal="true"
    aria-labelledby="duel-result-heading"
    data-cy="duel-result-dialog"
  >
    <section
      class="result-panel"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-busy={!completed}
      data-cy="app-result-panel"
    >
      <div data-cy="app-result-body">
        <p class="eyebrow" data-cy="app-result-eyebrow">Duel complete</p>
        <h2
          id="duel-result-heading"
          class="ui-dialog-title duel-result-dialog-title"
          tabindex="-1"
          bind:this={heading}
          data-cy="app-result-heading"
        >
          {#if result.type === "completed"}
            {result.winner === 0 ? "You won" : "Opponent won"}
          {:else if result.type === "surrendered"}
            Duel surrendered
          {:else if result.type === "unsupported"}
            Unsupported duel message
          {:else}
            Engine error
          {/if}
        </h2>
        {#if result.type === "completed"}
          <p data-cy="app-result-finish-reason">
            Finish reason {result.reason}
          </p>
        {:else if result.type === "unsupported"}
          <p data-cy="app-result-unsupported-detail">
            {result.detail}
          </p>
        {:else if result.type === "engineError"}
          <p data-cy="app-result-engine-error-detail">
            {result.detail}
          </p>
        {/if}
      </div>
      <div class="button-row" data-cy="app-result-actions">
        <button
          type="button"
          disabled={!completed}
          data-cy="app-restart-duel-button"
          onclick={onrestart}
          >{completed ? "Start another duel" : "Starting another duel…"}</button
        >
        <button
          type="button"
          class="secondary"
          disabled={!completed}
          data-cy="duel-result-change-decks-button"
          onclick={onchangedecks}>Change decks</button
        >
        <span class="sensitive-note" data-cy="app-result-sensitive-note"
          >Contains the production seed.</span
        >
        <button
          type="button"
          class="secondary"
          disabled={diagnosticPending}
          data-cy="app-result-download-diagnostics-button"
          onclick={ondownloaddiagnostics}
          >{diagnosticPending
            ? "Preparing diagnostics…"
            : "Download diagnostics"}</button
        >
      </div>
    </section>
  </div>
</div>

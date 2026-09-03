<script lang="ts">
  import type { DeckValidationSummary } from "../../decks/deck-contracts.ts";

  export let validation: DeckValidationSummary;
  export let onfocusissue: (
    cardCode: number | null,
    zone: string | null,
  ) => void = () => undefined;
</script>

{#if validation.issues.length > 0}
  <section
    class="validation"
    aria-labelledby="validation-heading"
    data-cy="deck-validation"
  >
    <header data-cy="deck-validation-header">
      <h3
        id="validation-heading"
        class="panel-title"
        data-cy="deck-validation-heading"
      >
        Deck checks
      </h3>
      <span data-cy="deck-validation-count"
        >{validation.issues.length} issue(s)</span
      >
    </header>
    <ul data-cy="deck-validation-list">
      {#each validation.issues as issue (issue.id)}
        <li
          class:error={issue.severity === "error"}
          data-cy={`deck-validation-issue-${issue.id}`}
        >
          <button
            type="button"
            class="issue"
            data-cy={`deck-validation-issue-button-${issue.id}`}
            onclick={() =>
              onfocusissue(issue.cardCode ?? null, issue.zone ?? null)}
          >
            <span
              aria-hidden="true"
              data-cy={`deck-validation-issue-icon-${issue.id}`}
              >{issue.severity === "error" ? "×" : "!"}</span
            >
            {issue.message}
          </button>
        </li>
      {/each}
    </ul>
  </section>
{/if}

<style>
  .validation {
    margin-top: 0.75rem;
    padding: 0.75rem;
    border: 1px solid var(--warning-border);
    border-radius: 0.55rem;
    background: var(--warning-surface);
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .panel-title {
    margin: 0;
    color: var(--accent);
    font-family: var(--font-display);
    font-size: 0.92rem;
    font-weight: 400;
    letter-spacing: var(--ls-display);
    text-transform: uppercase;
  }

  header span {
    color: var(--muted);
    font-size: 0.75rem;
  }

  ul {
    display: grid;
    gap: 0.35rem;
    margin: 0.55rem 0 0;
    padding: 0;
    list-style: none;
  }

  .issue {
    width: 100%;
    min-height: 2rem;
    justify-content: flex-start;
    padding: 0.35rem 0.5rem;
    color: var(--text);
    border-color: transparent;
    background: transparent;
    text-align: left;
    font-size: 0.78rem;
    font-weight: 600;
  }

  li.error .issue {
    color: var(--danger);
  }
</style>

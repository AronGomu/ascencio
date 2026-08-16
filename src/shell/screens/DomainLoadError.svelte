<script lang="ts">
  /* What a player sees when a domain's own chunk never arrives. Without it the
     `{#await}` blocks in the shell render nothing at all on rejection, so a
     failed import — a stale dev server, a half-cached build, an offline
     reload — looks exactly like a route that leads to an empty page. */
  export let label: string;
  export let cy: string;
  export let error: unknown;

  $: message =
    error instanceof Error ? error.message : "The page could not be loaded.";
</script>

<main class="domain-error" role="alert" data-cy={`shell-domain-error-${cy}`}>
  <p class="eyebrow" data-cy={`shell-domain-error-eyebrow-${cy}`}>
    {label} stopped
  </p>
  <h1 data-cy={`shell-domain-error-heading-${cy}`}>{label} could not load</h1>
  <p data-cy={`shell-domain-error-message-${cy}`}>{message}</p>
  <div class="actions" data-cy={`shell-domain-error-actions-${cy}`}>
    <button
      type="button"
      data-cy={`shell-domain-error-retry-${cy}`}
      onclick={() => location.reload()}>Retry</button
    >
    <a class="secondary" href="#/" data-cy={`shell-domain-error-home-${cy}`}
      >Back to menu</a
    >
  </div>
</main>

<style>
  .domain-error {
    display: grid;
    align-content: center;
    justify-items: center;
    gap: var(--space-3);
    width: 100%;
    height: 100%;
    padding: var(--space-6);
    text-align: center;
    /* The duel region is a two-row grid, so a region-filling child has to say
       it spans both rows to centre in the stage rather than in the first. The
       block-layout regions ignore this. */
    grid-row: 1 / -1;
  }

  .actions {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  /* `button.secondary` in `src/styles/app.css` is the app's quiet action, and
     it is scoped to buttons; this link is the same action in anchor form. */
  .actions a {
    min-height: 2.75rem;
    display: inline-flex;
    align-items: center;
    padding: 0.7rem 1rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    color: var(--text);
    font-weight: 750;
    text-decoration: none;
  }

  .domain-error p {
    margin: 0;
    color: var(--muted);
  }
</style>

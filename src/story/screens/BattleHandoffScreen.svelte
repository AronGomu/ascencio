<script lang="ts">
  /* The frame between the story and a real duel. It never runs one: the shell
     owns mounting the duel, so all this screen can report is that the handoff
     is under way — or that the checkpoint could not be written, in which case
     no duel started and the player is offered the attempt again. */
  export let label = "the duel";
  export let error: string | null = null;
  export let onretry: () => void = () => undefined;
  export let onreturn: () => void = () => undefined;
</script>

<section
  class="handoff"
  aria-labelledby="handoff-heading"
  data-cy="story-handoff-screen"
>
  <div class="transition-mark" aria-hidden="true" data-cy="story-handoff-mark">
    DUEL
  </div>
  <div data-cy="story-handoff-intro">
    <p class="eyebrow" data-cy="story-handoff-eyebrow">Entering the duel</p>
    <h1 id="handoff-heading" data-cy="story-handoff-heading">{label}</h1>
    <p data-cy="story-handoff-body">
      Your progress is saved before the duel begins, so the encounter can be
      restarted exactly here if anything interrupts it.
    </p>
  </div>
  {#if error === null}
    <p class="status" role="status" data-cy="story-handoff-status">
      Saving your progress and preparing the duel…
    </p>
  {:else}
    <section
      class="failure"
      role="alert"
      aria-labelledby="handoff-error-heading"
      data-cy="story-handoff-error"
    >
      <h2 id="handoff-error-heading" data-cy="story-handoff-error-heading">
        The duel did not start
      </h2>
      <p data-cy="story-handoff-error-message">{error}</p>
      <div class="controls" data-cy="story-handoff-error-actions">
        <button type="button" data-cy="story-handoff-retry" onclick={onretry}
          >Try again</button
        ><button
          type="button"
          class="secondary"
          data-cy="story-handoff-return"
          onclick={onreturn}>Return to map</button
        >
      </div>
    </section>
  {/if}
</section>

<style>
  .handoff {
    min-height: 100svh;
    display: grid;
    align-content: center;
    gap: 1.5rem;
    padding: clamp(1rem, 6vw, 5rem);
    background: linear-gradient(135deg, var(--bg) 40%, var(--field-glow));
  }
  .transition-mark {
    font: 900 clamp(4rem, 20vw, 13rem)/0.75 sans-serif;
    color: color-mix(in srgb, var(--accent) 9%, transparent);
    position: absolute;
    right: 2vw;
    top: 10vh;
  }
  .handoff > div:not(.transition-mark),
  .status,
  .failure {
    position: relative;
    max-width: 55rem;
  }
  .status {
    padding: 1rem;
    border-left: 4px solid var(--story-accent);
    background: var(--surface-raised);
  }
  .failure {
    padding: 1.2rem;
    border: 2px solid var(--danger);
    border-radius: 0.6rem;
    background: var(--danger-surface);
  }
  .controls {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem;
  }
  @media (prefers-reduced-motion: no-preference) {
    .handoff {
      animation: battle-enter 280ms ease-out;
    }
  }
  @keyframes battle-enter {
    from {
      opacity: 0;
      filter: brightness(2);
    }
    to {
      opacity: 1;
      filter: none;
    }
  }
</style>

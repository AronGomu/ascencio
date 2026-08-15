<script lang="ts">
  import type { BattleResult } from "../model/story-state.ts";
  export let outcome: BattleResult = "win";
  export let oncontinue: () => void = () => undefined;
  export let onretry: () => void = () => undefined;
  export let onreturn: () => void = () => undefined;
</script>

<section
  class:recovery={outcome === "abort" || outcome === "failure"}
  class="outcome-screen"
  aria-labelledby="outcome-heading"
  data-cy="story-outcome-screen"
>
  <p class="eyebrow" data-cy="story-outcome-eyebrow">
    Authored outcome · {outcome}
  </p>
  {#if outcome === "win"}<h1
      id="outcome-heading"
      data-cy="story-outcome-win-heading"
    >
      Signal broken
    </h1>
    <p data-cy="story-outcome-win-body">
      The final attack cuts through the false arena. Rin catches the decoded
      pulse before it fades.
    </p>
    <p data-cy="story-outcome-win-quote">
      “You won us an answer,” she says. “Now we find who asked the question.”
    </p>
    <button
      type="button"
      data-cy="story-outcome-win-continue"
      onclick={oncontinue}>Continue story</button
    >
  {:else if outcome === "loss"}<h1
      id="outcome-heading"
      data-cy="story-outcome-loss-heading"
    >
      Signal endures
    </h1>
    <p data-cy="story-outcome-loss-body">
      Your last card falls, but the arena does not close. The opponent lowers
      its duel disk.
    </p>
    <p data-cy="story-outcome-loss-quote">
      Rin smiles. “It wanted a complete duel, not a victory. We still have its
      answer.”
    </p>
    <button
      type="button"
      data-cy="story-outcome-loss-continue"
      onclick={oncontinue}>Continue story</button
    >
  {:else if outcome === "abort"}<h1
      id="outcome-heading"
      data-cy="story-outcome-abort-heading"
    >
      Duel paused
    </h1>
    <p data-cy="story-outcome-abort-body">
      No story progress changed. Resume when ready or return safely.
    </p>
    <div data-cy="story-outcome-abort-actions">
      <button
        type="button"
        data-cy="story-outcome-abort-retry"
        onclick={onretry}>Retry duel</button
      ><button
        type="button"
        class="secondary"
        data-cy="story-outcome-abort-return"
        onclick={onreturn}>Return to map</button
      >
    </div>
  {:else}<h1 id="outcome-heading" data-cy="story-outcome-error-heading">
      Connection interrupted
    </h1>
    <p data-cy="story-outcome-error-body">
      Technical failure stopped the mock duel. This is not an authored loss.
    </p>
    <div data-cy="story-outcome-error-actions">
      <button
        type="button"
        data-cy="story-outcome-error-retry"
        onclick={onretry}>Retry duel</button
      ><button
        type="button"
        class="secondary"
        data-cy="story-outcome-error-return"
        onclick={onreturn}>Return to map</button
      >
    </div>{/if}
</section>

<style>
  .outcome-screen {
    min-height: 100svh;
    display: grid;
    align-content: center;
    justify-items: start;
    gap: 0.75rem;
    padding: clamp(1rem, 8vw, 7rem);
    background:
      radial-gradient(circle at 70% 50%, var(--accent-deep), transparent 25%),
      var(--bg);
  }
  .outcome-screen.recovery {
    background:
      radial-gradient(circle at 70% 50%, var(--stack-surface), transparent 25%),
      var(--bg);
  }
  .outcome-screen p {
    max-width: 55ch;
    font-size: clamp(1rem, 2.5vw, 1.3rem);
    line-height: 1.6;
  }
  .outcome-screen div {
    display: flex;
    gap: 0.6rem;
    flex-wrap: wrap;
  }
</style>

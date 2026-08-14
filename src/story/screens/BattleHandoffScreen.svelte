<script lang="ts">
  import type { BattleResult } from "../model/story-state.ts";
  export let onresult: (result: BattleResult) => void = () => undefined;
  export let onretry: () => void = () => undefined;
  export let onreturn: () => void = () => undefined;
  let result: BattleResult | null = null;
  const messages: Record<BattleResult, string> = {
    win: "Player win normalized. Returning to the authored win scene.",
    loss: "Player loss normalized. Returning to the distinct authored loss scene.",
    abort: "Battle aborted safely. No progression granted.",
    failure:
      "Technical failure recorded; this is not a story defeat. No progression granted.",
  };
  function select(value: BattleResult): void {
    result = value;
    onresult(value);
  }
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
    <p class="eyebrow" data-cy="story-handoff-eyebrow">
      Mock boundary · no duel runtime loaded
    </p>
    <h1 id="handoff-heading" data-cy="story-handoff-heading">
      Existing duel experience placeholder
    </h1>
    <p data-cy="story-handoff-body">
      This frame validates story-to-duel language only. Reviewer picks a
      normalized outcome below.
    </p>
  </div>
  <section
    class="reviewer-controls"
    aria-label="Reviewer-only battle controls"
    data-cy="story-handoff-reviewer-controls"
  >
    <h2 data-cy="story-handoff-reviewer-heading">Reviewer battle outcome</h2>
    <p data-cy="story-handoff-reviewer-note">
      <strong data-cy="story-handoff-reviewer-note-label"
        >Non-player tooling:</strong
      > these controls never appear as production duel actions.
    </p>
    <div class="controls" data-cy="story-handoff-outcome-actions">
      <button
        type="button"
        data-cy="story-handoff-simulate-win"
        onclick={() => select("win")}>Simulate Player Win</button
      ><button
        type="button"
        data-cy="story-handoff-simulate-loss"
        onclick={() => select("loss")}>Simulate Player Loss</button
      ><button
        type="button"
        class="secondary"
        data-cy="story-handoff-simulate-abort"
        onclick={() => select("abort")}>Simulate Abort</button
      ><button
        type="button"
        class="secondary"
        data-cy="story-handoff-simulate-failure"
        onclick={() => select("failure")}>Simulate Technical Failure</button
      >
    </div>
  </section>
  {#if result}<div
      class:failure={result === "failure"}
      class="result"
      role="status"
      data-cy="story-handoff-result"
    >
      <p data-cy="story-handoff-result-message">{messages[result]}</p>
      {#if result === "abort" || result === "failure"}<div
          class="controls"
          data-cy="story-handoff-result-actions"
        >
          <button type="button" data-cy="story-handoff-retry" onclick={onretry}
            >Retry mock duel</button
          ><button
            type="button"
            class="secondary"
            data-cy="story-handoff-return"
            onclick={onreturn}>Return to map</button
          >
        </div>{/if}
    </div>{/if}
</section>

<style>
  .handoff {
    min-height: 100svh;
    display: grid;
    align-content: center;
    gap: 1.5rem;
    padding: clamp(1rem, 6vw, 5rem);
    background: linear-gradient(135deg, #07111f 40%, #1d3953);
  }
  .transition-mark {
    font: 900 clamp(4rem, 20vw, 13rem)/0.75 sans-serif;
    color: #47d7cc18;
    position: absolute;
    right: 2vw;
    top: 10vh;
  }
  .handoff > div:not(.transition-mark),
  .reviewer-controls,
  .result {
    position: relative;
    max-width: 55rem;
  }
  .reviewer-controls {
    padding: 1.2rem;
    border: 2px dashed #e6ba69;
    border-radius: 0.6rem;
    background: #201b19;
  }
  .controls {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem;
  }
  .result {
    padding: 1rem;
    border-left: 4px solid var(--story-accent);
    background: #10243a;
  }
  .result.failure {
    border-color: #ff9ba5;
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

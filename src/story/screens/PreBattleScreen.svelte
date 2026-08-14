<script lang="ts">
  export let allowReturn = true;
  export let onstart: () => void = () => undefined;
  export let onreturn: () => void = () => undefined;
  let started = false;
  function start(): void {
    if (started) return;
    started = true;
    onstart();
  }
</script>

<section
  class="briefing"
  aria-labelledby="briefing-heading"
  data-cy="story-briefing-screen"
>
  <div
    class="opponent-art"
    role="img"
    aria-label="Provisional silhouette of Rin's Echo"
    data-cy="story-briefing-opponent-art"
  >
    RE
  </div>
  <div class="briefing-copy" data-cy="story-briefing-copy">
    <p class="eyebrow" data-cy="story-briefing-eyebrow">Pre-battle briefing</p>
    <h1 id="briefing-heading" data-cy="story-briefing-heading">Rin's Echo</h1>
    <p data-cy="story-briefing-body">
      The arena transmitter shaped Rin's warning into an opponent. Win or lose,
      finish the duel to decode its challenge.
    </p>
    <dl data-cy="story-briefing-facts">
      <div data-cy="story-briefing-player-deck-row">
        <dt data-cy="story-briefing-player-deck-term">Your deck</dt>
        <dd data-cy="story-briefing-player-deck-value">Signal Deck</dd>
      </div>
      <div data-cy="story-briefing-opponent-deck-row">
        <dt data-cy="story-briefing-opponent-deck-term">Opponent deck</dt>
        <dd data-cy="story-briefing-opponent-deck-value">Relay Deck</dd>
      </div>
      <div data-cy="story-briefing-format-row">
        <dt data-cy="story-briefing-format-term">Format</dt>
        <dd data-cy="story-briefing-format-value">
          Single duel · prototype rules
        </dd>
      </div>
      <div data-cy="story-briefing-objective-row">
        <dt data-cy="story-briefing-objective-term">Objective</dt>
        <dd data-cy="story-briefing-objective-value">
          Decode the challenge signal
        </dd>
      </div>
    </dl>
    <p class="checkpoint" role="status" data-cy="story-briefing-checkpoint">
      Mock checkpoint saved before battle.
    </p>
    <div class="actions" data-cy="story-briefing-actions">
      <button
        type="button"
        disabled={started}
        data-cy="story-briefing-start"
        onclick={start}>{started ? "Entering duel…" : "Start Duel"}</button
      >{#if allowReturn}<button
          type="button"
          class="secondary"
          data-cy="story-briefing-return"
          onclick={onreturn}>Return to Map</button
        >{/if}
    </div>
  </div>
</section>

<style>
  .briefing {
    min-height: 100svh;
    display: grid;
    grid-template-columns: minmax(12rem, 1fr) minmax(0, 1.3fr);
    align-items: center;
    gap: clamp(1rem, 5vw, 5rem);
    padding: clamp(1rem, 6vw, 5rem);
    background:
      radial-gradient(circle at 20% 50%, #284b63, transparent 25%), #07111f;
  }
  .opponent-art {
    aspect-ratio: 3/4;
    display: grid;
    place-items: center;
    border: 1px solid var(--story-border);
    border-radius: 45% 45% 12% 12%;
    background: linear-gradient(#31566d, #0d1825);
    font: 800 clamp(4rem, 15vw, 10rem) Georgia;
    color: #b9d8e8;
  }
  .briefing-copy {
    max-width: 42rem;
  }
  dl {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.75rem;
  }
  dl div {
    padding: 0.8rem;
    background: #10243a;
  }
  dt {
    color: var(--story-muted);
    font-size: 0.8rem;
  }
  dd {
    margin: 0.2rem 0 0;
    font-weight: 800;
  }
  .checkpoint {
    padding: 0.7rem;
    border-left: 3px solid var(--story-accent);
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem;
  }
  @media (max-width: 42rem) {
    .briefing {
      grid-template-columns: 1fr;
    }
    .opponent-art {
      max-height: 30svh;
      aspect-ratio: 16/7;
    }
    dl {
      grid-template-columns: 1fr;
    }
  }
</style>

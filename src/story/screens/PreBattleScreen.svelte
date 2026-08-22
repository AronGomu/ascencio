<script lang="ts">
  import {
    preBattleBlock,
    preBattleSelection,
    type PreBattleDeckOption,
  } from "../decks/pre-battle-decks.ts";

  export let allowReturn = true;
  /* Null while the card database is still being read. An empty catalog calls
     every card missing, so a verdict reached before it lands would refuse every
     deck in the save — the screen waits instead of refusing. */
  export let decks: readonly PreBattleDeckOption[] | null = null;
  export let defaultDeckId: string | null = null;
  export let decksError: string | null = null;
  export let onstart: () => void = () => undefined;
  export let onreturn: () => void = () => undefined;
  export let onselectdeck: (deckId: string) => void = () => undefined;
  export let onretrydecks: () => void = () => undefined;
  /* Reported rather than linked. An anchor to `#/story/decks` changes the
     route from inside the story, which unmounts the domain with everything it
     has not written yet — and this screen is the furthest a player gets from
     their last save. The parent writes the run first and navigates second, and
     answers when it is done either way. */
  export let onopendecks: () => void | Promise<void> = () => undefined;

  let started = false;
  /* The same latch `started` gives the start below, for the same reason: the
     parent writes the save before the route changes, so a second click during
     that write would write twice and leave a duplicate history entry behind. */
  let leaving = false;
  /* Null until the player picks for themselves, which is what lets the line
     below stay derived: an opening selection recomputed on every flush cannot
     overwrite a choice that was never stored there. */
  let chosenId: string | null = null;
  /* What this screen has already written into the save. Tracked here rather
     than read back off `defaultDeckId`, so recording stays once-per-deck
     whether or not the parent has flushed the new prop yet. */
  let recordedId: string | null = null;

  $: selectedId =
    chosenId ??
    (decks === null ? null : preBattleSelection(decks, defaultDeckId));
  $: savedId = recordedId ?? defaultDeckId;
  $: block = decks === null ? null : preBattleBlock(decks, selectedId);
  $: selectedName =
    decks?.find(({ id }) => id === selectedId)?.name ?? "No deck selected";
  $: blocked = decksError !== null || decks === null || block !== null;

  function record(deckId: string): void {
    if (deckId === savedId) return;
    recordedId = deckId;
    onselectdeck(deckId);
  }

  function choose(deckId: string): void {
    chosenId = deckId;
    record(deckId);
  }

  async function leave(): Promise<void> {
    if (leaving) return;
    leaving = true;
    await onopendecks();
    /* A write that was refused leaves the player on this screen, and the one
       way off it has to still be one. A write that landed took the route with
       it, so this runs against a screen that is already gone. */
    leaving = false;
  }

  function start(): void {
    if (started || blocked || selectedId === null) return;
    started = true;
    /* A fallback selection was chosen by nobody, so nothing recorded it. The
       encounter is what makes it the save's deck. */
    record(selectedId);
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
        <dd data-cy="story-briefing-player-deck-value">{selectedName}</dd>
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
    <div class="deck-picker" data-cy="story-briefing-deck-picker">
      <h2 id="deck-picker-heading" data-cy="story-briefing-deck-picker-heading">
        Choose your deck
      </h2>
      {#if decksError !== null}
        <p class="deck-error" role="alert" data-cy="story-briefing-deck-error">
          {decksError}
        </p>
        <button
          type="button"
          class="secondary"
          data-cy="story-briefing-deck-error-retry"
          onclick={() => onretrydecks()}>Try again</button
        >
      {:else if decks === null}
        <p role="status" data-cy="story-briefing-deck-checking">
          Checking your decks against the card database…
        </p>
      {:else if decks.length > 0}
        <ul
          aria-labelledby="deck-picker-heading"
          data-cy="story-briefing-deck-list"
        >
          {#each decks as deck (deck.id)}
            <li data-cy={`story-briefing-deck-row-${deck.id}`}>
              <button
                type="button"
                class="deck-choice"
                class:illegal={!deck.legal}
                data-cy={`story-briefing-deck-${deck.id}`}
                disabled={!deck.legal}
                aria-pressed={deck.id === selectedId}
                aria-describedby={deck.issue === null
                  ? null
                  : `deck-issue-${deck.id}`}
                onclick={() => choose(deck.id)}
                ><span data-cy={`story-briefing-deck-name-${deck.id}`}
                  >{deck.name}</span
                ></button
              >{#if deck.issue !== null}<p
                  id={`deck-issue-${deck.id}`}
                  class="deck-issue"
                  data-cy={`story-briefing-deck-issue-${deck.id}`}
                >
                  {deck.issue}
                </p>{/if}
            </li>
          {/each}
        </ul>
      {/if}
      {#if block !== null}
        <div class="deck-block" role="status" data-cy="story-briefing-block">
          <p data-cy="story-briefing-block-reason">{block.reason}</p>
          <button
            type="button"
            class="secondary"
            data-cy="story-briefing-block-action"
            disabled={leaving}
            onclick={() => void leave()}
            >{leaving
              ? "Saving your progress…"
              : block.action === "build"
                ? "Build a deck"
                : "Open the deck editor"}</button
          >
        </div>
      {/if}
    </div>
    <p class="checkpoint" role="status" data-cy="story-briefing-checkpoint">
      Your progress is saved before the duel starts.
    </p>
    <div class="actions" data-cy="story-briefing-actions">
      <button
        type="button"
        disabled={started || blocked}
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
      radial-gradient(circle at 20% 50%, var(--field-glow), transparent 25%),
      var(--bg);
  }
  .opponent-art {
    aspect-ratio: 3/4;
    display: grid;
    place-items: center;
    border: 1px solid var(--story-border);
    border-radius: 45% 45% 12% 12%;
    background: linear-gradient(var(--border-strong), var(--surface-chain));
    font: 800 clamp(4rem, 15vw, 10rem) Georgia;
    color: var(--text);
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
    background: var(--surface-raised);
  }
  dt {
    color: var(--story-muted);
    font-size: 0.8rem;
  }
  dd {
    margin: 0.2rem 0 0;
    font-weight: 800;
  }
  .deck-picker {
    margin-top: 1rem;
  }
  .deck-picker h2 {
    margin: 0 0 0.5rem;
    font-size: 1rem;
  }
  .deck-picker ul {
    display: grid;
    gap: 0.4rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .deck-choice {
    width: 100%;
    background: transparent;
    color: var(--story-text);
    text-align: left;
  }
  .deck-choice[aria-pressed="true"] {
    background: var(--story-accent);
    color: var(--ink-on-accent);
  }
  /* The same danger border the deck library paints an `errors` row with, so a
     deck refused here and a deck badged there read as one verdict. */
  .deck-choice.illegal {
    border-color: var(--danger);
    color: var(--danger);
    cursor: not-allowed;
  }
  .deck-issue,
  .deck-error {
    margin: 0.2rem 0 0;
    color: var(--danger);
    font-size: 0.85rem;
  }
  .deck-block {
    margin-top: 0.6rem;
    padding: 0.6rem;
    border-left: 3px solid var(--danger);
  }
  .deck-block p {
    margin: 0 0 0.3rem;
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

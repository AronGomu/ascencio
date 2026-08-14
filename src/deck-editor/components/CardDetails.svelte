<script lang="ts">
  import type { DeckBuilderCardView } from "../../decks/catalog/ocg-card-mapper.ts";
  import type { PinnedDeckRuleset } from "../../decks/catalog/pinned-ruleset.ts";
  import { quantityLimit } from "../../decks/catalog/pinned-ruleset.ts";

  export let card: DeckBuilderCardView | null = null;
  export let missingCode: number | null = null;
  export let copies: Readonly<{ main: number; extra: number; side: number }> = {
    main: 0,
    extra: 0,
    side: 0,
  };
  export let ruleset: PinnedDeckRuleset;
  /* Its own pane below the breakpoint: the stage scrolls it, not an inner box. */
  export let filled = false;

  $: limit = card === null ? 3 : quantityLimit(ruleset, card.code);
  $: limitLabel =
    limit === 0
      ? "Forbidden"
      : limit === 1
        ? "Limited"
        : limit === 2
          ? "Semi-Limited"
          : "Unlimited";
</script>

<aside
  class="details"
  class:filled
  aria-labelledby="card-details-heading"
  data-cy="deck-card-details"
>
  <p class="section-label" data-cy="deck-card-details-eyebrow">
    Pinned card details
  </p>
  {#if card === null && missingCode !== null}
    <h2 id="card-details-heading" data-cy="deck-card-details-missing-heading">
      Unknown card #{missingCode}
    </h2>
    <div
      class="missing-details"
      role="alert"
      data-cy="deck-card-details-missing"
    >
      <p class="section-label" data-cy="deck-card-details-missing-label">
        Missing catalog entry
      </p>
      <p class="muted" data-cy="deck-card-details-missing-message">
        Card data, text, and art are unavailable. Remove placeholder from its
        deck zone or restore catalog data.
      </p>
      <dl data-cy="deck-card-details-missing-facts">
        <div data-cy="deck-card-details-missing-code-row">
          <dt data-cy="deck-card-details-missing-code-term">Code</dt>
          <dd data-cy="deck-card-details-missing-code-value">{missingCode}</dd>
        </div>
        <div data-cy="deck-card-details-missing-copies-row">
          <dt data-cy="deck-card-details-missing-copies-term">Copies</dt>
          <dd data-cy="deck-card-details-missing-copies-value">
            {copies.main} Main · {copies.extra} Extra · {copies.side} Side
          </dd>
        </div>
      </dl>
    </div>
  {:else if card === null}
    <h2 id="card-details-heading" data-cy="deck-card-details-empty-heading">
      Select a card
    </h2>
    <p class="muted" data-cy="deck-card-details-empty-message">
      Choose a catalog or deck tile to inspect full card text.
    </p>
  {:else}
    <div class="art" data-cy="deck-card-details-art">
      {#if card.imageUrl}
        <img
          src={card.imageUrl}
          alt={card.name}
          data-cy="deck-card-details-image"
        />
      {:else}
        <span aria-hidden="true" data-cy="deck-card-details-art-glyph"
          >{card.family.slice(0, 1).toUpperCase()}</span
        >
        <small data-cy="deck-card-details-art-fallback"
          >Artwork unavailable</small
        >
      {/if}
      <span
        class={`limit limit-${limit}`}
        data-cy="deck-card-details-limit-badge">{limit}</span
      >
    </div>
    <h2 id="card-details-heading" data-cy="deck-card-details-heading">
      {card.name}
    </h2>
    <p class="type-line" data-cy="deck-card-details-type-line">
      {[card.family, ...card.subtypes].join(" · ")}
    </p>
    <dl data-cy="deck-card-details-facts">
      <div data-cy="deck-card-details-code-row">
        <dt data-cy="deck-card-details-code-term">Code</dt>
        <dd data-cy="deck-card-details-code-value">{card.code}</dd>
      </div>
      {#if card.attribute}<div data-cy="deck-card-details-attribute-row">
          <dt data-cy="deck-card-details-attribute-term">Attribute</dt>
          <dd data-cy="deck-card-details-attribute-value">{card.attribute}</dd>
        </div>{/if}
      {#if card.race}<div data-cy="deck-card-details-race-row">
          <dt data-cy="deck-card-details-race-term">Monster type</dt>
          <dd data-cy="deck-card-details-race-value">{card.race}</dd>
        </div>{/if}
      {#if card.ratingLabel}<div data-cy="deck-card-details-rating-row">
          <dt data-cy="deck-card-details-rating-term">{card.ratingLabel}</dt>
          <dd data-cy="deck-card-details-rating-value">{card.levelRankLink}</dd>
        </div>{/if}
      {#if card.attack !== null}<div data-cy="deck-card-details-attack-row">
          <dt data-cy="deck-card-details-attack-term">ATK</dt>
          <dd data-cy="deck-card-details-attack-value">{card.attack}</dd>
        </div>{/if}
      {#if card.defense !== null}<div data-cy="deck-card-details-defense-row">
          <dt data-cy="deck-card-details-defense-term">DEF</dt>
          <dd data-cy="deck-card-details-defense-value">{card.defense}</dd>
        </div>{/if}
      {#if card.pendulumScales}<div data-cy="deck-card-details-scales-row">
          <dt data-cy="deck-card-details-scales-term">Scales</dt>
          <dd data-cy="deck-card-details-scales-value">
            {card.pendulumScales.join(" / ")}
          </dd>
        </div>{/if}
      {#if card.linkMarkers.length > 0}<div
          data-cy="deck-card-details-markers-row"
        >
          <dt data-cy="deck-card-details-markers-term">Markers</dt>
          <dd data-cy="deck-card-details-markers-value">
            {card.linkMarkers.join(", ")}
          </dd>
        </div>{/if}
      <div data-cy="deck-card-details-target-row">
        <dt data-cy="deck-card-details-target-term">Target</dt>
        <dd data-cy="deck-card-details-target-value">
          {card.canonicalZone === "main" ? "Main Deck" : "Extra Deck"}
        </dd>
      </div>
      <div data-cy="deck-card-details-limit-row">
        <dt data-cy="deck-card-details-limit-term">Limit</dt>
        <dd data-cy="deck-card-details-limit-value">{limitLabel} ({limit})</dd>
      </div>
      <div data-cy="deck-card-details-copies-row">
        <dt data-cy="deck-card-details-copies-term">Copies</dt>
        <dd data-cy="deck-card-details-copies-value">
          {copies.main} Main · {copies.extra} Extra · {copies.side} Side
        </dd>
      </div>
    </dl>
    <section
      class="effect-text"
      aria-label="Card text"
      data-cy="deck-card-details-text"
    >
      <h3 data-cy="deck-card-details-text-heading">Card text</h3>
      <p data-cy="deck-card-details-text-body">
        {card.description || "No card text is available."}
      </p>
    </section>
  {/if}
</aside>

<style>
  .details {
    min-width: 0;
    height: calc(100vh - 9.5rem);
    overflow-y: auto;
    padding: 1rem;
    border: 1px solid var(--border);
    border-radius: 0.8rem;
    background: var(--surface);
  }

  .details.filled {
    height: auto;
    overflow-y: visible;
  }

  h2,
  h3,
  p {
    margin-top: 0;
  }

  .section-label,
  .muted,
  .type-line,
  dt {
    color: var(--muted);
  }

  .section-label {
    margin-bottom: 0.3rem;
    font-size: 0.76rem;
    font-weight: 750;
  }

  .art {
    position: relative;
    display: grid;
    width: min(12rem, 100%);
    aspect-ratio: 59 / 86;
    margin: 0 auto 1rem;
    place-items: center;
    overflow: hidden;
    border: 1px solid var(--border);
    border-radius: 0.55rem;
    background: #0d1729;
    font-size: 3rem;
  }

  .art img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .art small {
    font-size: 0.72rem;
  }

  .limit {
    position: absolute;
    top: 0.35rem;
    left: 0.35rem;
    display: grid;
    width: 1.55rem;
    height: 1.55rem;
    place-items: center;
    border: 2px solid currentColor;
    border-radius: 999px;
    color: #08101f;
    background: #73daca;
    font-size: 0.78rem;
    font-weight: 900;
  }

  .limit-0 {
    color: #fff;
    background: #b52140;
  }
  .limit-1 {
    background: #ff8c9b;
  }
  .limit-2 {
    background: #ffd580;
  }

  dl {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.6rem;
  }

  dl div {
    min-width: 0;
  }

  dt {
    font-size: 0.7rem;
  }

  dd {
    margin: 0.15rem 0 0;
    overflow-wrap: anywhere;
    font-weight: 700;
  }

  .effect-text {
    padding-top: 0.85rem;
    border-top: 1px solid var(--border);
  }

  .effect-text p {
    white-space: pre-line;
    line-height: 1.55;
  }
</style>

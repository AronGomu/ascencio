<script lang="ts">
  import { isCardIdentityVisible } from "../../../duel/card-visibility.ts";
  import type {
    PublicCard,
    PublicDuelState,
  } from "../../../duel/contracts/public-duel-state.ts";
  import type { CardImageLibrary } from "../../images/card-image-cache.ts";
  import CardTray from "./CardTray.svelte";
  import ChainStatus from "./ChainStatus.svelte";

  interface CardText {
    readonly name: string;
    readonly description?: string;
  }

  export let snapshot: PublicDuelState;
  export let cardTexts: ReadonlyMap<number, CardText> = new Map();
  export let imageLibrary: Pick<CardImageLibrary, "lease"> | null = null;
  export let placeholderUrl = "";
  export let resolveCardImage: (card: PublicCard) => string | undefined = () =>
    undefined;
  export let oninspect: (
    card: PublicCard,
    trigger: HTMLButtonElement,
  ) => void = () => undefined;

  $: inspectableCards = snapshot.players.flatMap((player) =>
    [
      ...(player.player === 0 ? player.hand : []),
      ...player.monsters,
      ...player.spellsAndTraps,
    ].filter((card) => canReveal(card)),
  );

  function canReveal(card: PublicCard): boolean {
    return (
      card.code !== undefined &&
      isCardIdentityVisible(0, card.controller, card.location, card.position)
    );
  }

  function cardName(card: PublicCard): string {
    if (card.code === undefined) return "Visible card";
    return cardTexts.get(card.code)?.name ?? `Card ${card.code}`;
  }

  function words(value: string): string {
    return value
      .replaceAll(/([a-z])([A-Z])/g, "$1 $2")
      .replaceAll(/([a-z])(\d)/g, "$1 $2")
      .toLocaleLowerCase();
  }

  function counterLabel(name: string, count: number): string {
    return `${count} ${name}${count === 1 || name.endsWith("s") ? "" : "s"}`;
  }

  function materialName(card: PublicCard, index: number): string {
    const material = card.overlayMaterials[index];
    if (material === undefined || !material.identityVisible)
      return "Hidden material";
    return cardTexts.get(material.code)?.name ?? `Card ${material.code}`;
  }
</script>

<section class="duel-hud" aria-label="Duel HUD" data-cy="duel-hud">
  <header class="duel-hud__turn" data-cy="duel-hud-turn">
    <div data-cy="duel-hud-turn-title">
      <p class="eyebrow" data-cy="duel-hud-turn-eyebrow">
        Turn {snapshot.turn}
      </p>
      <h2 data-cy="duel-hud-turn-heading">
        {snapshot.turnPlayer === 0 ? "Your turn" : "Opponent's turn"}
      </h2>
    </div>
    <p class="phase-pill" data-cy="duel-hud-phase-pill">
      {words(snapshot.phase)}
    </p>
  </header>

  <div class="duel-hud__players" data-cy="duel-hud-players">
    {#each snapshot.players as player (player.player)}
      <article
        aria-label={player.player === 0 ? "Your state" : "Opponent state"}
        data-cy={`duel-hud-player-${player.player}`}
      >
        <div class="player-heading" data-cy="duel-hud-player-heading">
          <h3 data-cy="duel-hud-player-name">
            {player.player === 0 ? "You" : "Opponent"}
          </h3>
          <strong data-cy="duel-hud-player-life-points"
            >{player.lifePoints.toLocaleString()} LP</strong
          >
        </div>
        <dl class="duel-hud__counts" data-cy="duel-hud-player-counts">
          <div data-cy="duel-hud-player-deck-count-row">
            <dt data-cy="duel-hud-player-deck-count-label">Deck</dt>
            <dd data-cy="duel-hud-player-deck-count-value">
              {player.deckCount}
            </dd>
          </div>
          <div data-cy="duel-hud-player-extra-count-row">
            <dt data-cy="duel-hud-player-extra-count-label">Extra</dt>
            <dd data-cy="duel-hud-player-extra-count-value">
              {player.extraDeckCount}
            </dd>
          </div>
          <div data-cy="duel-hud-player-hand-count-row">
            <dt data-cy="duel-hud-player-hand-count-label">Hand</dt>
            <dd data-cy="duel-hud-player-hand-count-value">
              {player.handCount}
            </dd>
          </div>
        </dl>
        <div class="duel-hud__trays" data-cy="duel-hud-player-trays">
          <CardTray
            label={player.player === 0 ? "Your Deck" : "Opponent Deck"}
            player={player.player}
            zone="deck"
            count={player.deckCount}
            cards={[]}
            {cardTexts}
            {imageLibrary}
            {placeholderUrl}
            {resolveCardImage}
            {oninspect}
          />
          <CardTray
            label={player.player === 0
              ? "Your Extra Deck"
              : "Opponent Extra Deck"}
            player={player.player}
            zone="extra"
            count={player.extraDeckCount}
            cards={player.extraDeck}
            {cardTexts}
            {imageLibrary}
            {placeholderUrl}
            {resolveCardImage}
            {oninspect}
          />
          <CardTray
            label={player.player === 0 ? "Your GY" : "Opponent GY"}
            player={player.player}
            zone="graveyard"
            count={player.graveyard.length}
            cards={player.graveyard}
            {cardTexts}
            {imageLibrary}
            {placeholderUrl}
            {resolveCardImage}
            {oninspect}
          />
          <CardTray
            label={player.player === 0 ? "Your Banished" : "Opponent Banished"}
            player={player.player}
            zone="banished"
            count={player.banished.length}
            cards={player.banished}
            {cardTexts}
            {imageLibrary}
            {placeholderUrl}
            {resolveCardImage}
            {oninspect}
          />
        </div>
      </article>
    {/each}
  </div>

  <section
    class="rich-card-state"
    aria-label="Public and owned card state"
    data-cy="duel-hud-rich-card-state"
  >
    <h3 data-cy="duel-hud-rich-card-state-heading">
      Public and owned card state
    </h3>
    {#if inspectableCards.length === 0}
      <p class="empty-copy" data-cy="duel-hud-rich-card-state-empty">
        No inspectable card details.
      </p>
    {:else}
      <ul data-cy="duel-hud-rich-card-state-list">
        {#each inspectableCards as card (card.instanceId)}
          <li data-cy={`duel-hud-card-${card.instanceId}`}>
            <button
              type="button"
              class="card-detail-trigger"
              aria-label={`Inspect ${cardName(card)}`}
              onclick={(event) =>
                oninspect(card, event.currentTarget as HTMLButtonElement)}
              data-cy={`duel-hud-card-inspect-button-${card.instanceId}`}
              >{cardName(card)}</button
            >
            <span data-cy="duel-hud-card-position">{words(card.position)}</span>
            {#if card.counters.length > 0}
              <ul
                class="state-badges"
                aria-label={`Counters on ${cardName(card)}`}
                data-cy="duel-hud-card-counters-list"
              >
                {#each card.counters as counter (`${counter.type}:${counter.name}`)}
                  <li
                    data-cy={`duel-hud-card-counter-${counter.type}-${counter.name}`}
                  >
                    <span
                      aria-hidden="true"
                      data-cy="duel-hud-card-counter-icon">◆</span
                    >
                    {counterLabel(counter.name, counter.count)}
                  </li>
                {/each}
              </ul>
            {/if}
            {#if card.overlayMaterials.length > 0}
              <div
                class="material-summary"
                data-cy="duel-hud-card-material-summary"
              >
                <strong data-cy="duel-hud-card-material-count"
                  >{card.overlayMaterials.length}
                  {card.overlayMaterials.length === 1
                    ? "material"
                    : "materials"}</strong
                >
                <ol
                  aria-label={`Materials on ${cardName(card)}`}
                  data-cy="duel-hud-card-materials-list"
                >
                  {#each card.overlayMaterials as material, index (material.instanceId)}
                    <li
                      data-cy={`duel-hud-card-material-${material.instanceId}`}
                    >
                      {materialName(card, index)}
                    </li>
                  {/each}
                </ol>
              </div>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  </section>

  <ChainStatus links={snapshot.chain} />
</section>

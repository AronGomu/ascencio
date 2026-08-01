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

<section class="duel-hud" aria-label="Duel HUD">
  <header class="duel-hud__turn">
    <div>
      <p class="eyebrow">Turn {snapshot.turn}</p>
      <h2>{snapshot.turnPlayer === 0 ? "Your turn" : "Opponent's turn"}</h2>
    </div>
    <p class="phase-pill">{words(snapshot.phase)}</p>
  </header>

  <div class="duel-hud__players">
    {#each snapshot.players as player (player.player)}
      <article
        aria-label={player.player === 0 ? "Your state" : "Opponent state"}
      >
        <div class="player-heading">
          <h3>{player.player === 0 ? "You" : "Opponent"}</h3>
          <strong>{player.lifePoints.toLocaleString()} LP</strong>
        </div>
        <dl class="duel-hud__counts">
          <div>
            <dt>Deck</dt>
            <dd>{player.deckCount}</dd>
          </div>
          <div>
            <dt>Extra</dt>
            <dd>{player.extraDeckCount}</dd>
          </div>
          <div>
            <dt>Hand</dt>
            <dd>{player.handCount}</dd>
          </div>
        </dl>
        <div class="duel-hud__trays">
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

  <section class="rich-card-state" aria-label="Public and owned card state">
    <h3>Public and owned card state</h3>
    {#if inspectableCards.length === 0}
      <p class="empty-copy">No inspectable card details.</p>
    {:else}
      <ul>
        {#each inspectableCards as card (card.instanceId)}
          <li>
            <button
              type="button"
              class="card-detail-trigger"
              aria-controls="card-inspector"
              aria-label={`Inspect ${cardName(card)}`}
              onclick={(event) =>
                oninspect(card, event.currentTarget as HTMLButtonElement)}
              >{cardName(card)}</button
            >
            <span>{words(card.position)}</span>
            {#if card.counters.length > 0}
              <ul
                class="state-badges"
                aria-label={`Counters on ${cardName(card)}`}
              >
                {#each card.counters as counter (`${counter.type}:${counter.name}`)}
                  <li>
                    <span aria-hidden="true">◆</span>
                    {counterLabel(counter.name, counter.count)}
                  </li>
                {/each}
              </ul>
            {/if}
            {#if card.overlayMaterials.length > 0}
              <div class="material-summary">
                <strong
                  >{card.overlayMaterials.length}
                  {card.overlayMaterials.length === 1
                    ? "material"
                    : "materials"}</strong
                >
                <ol aria-label={`Materials on ${cardName(card)}`}>
                  {#each card.overlayMaterials as material, index (material.instanceId)}
                    <li>{materialName(card, index)}</li>
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

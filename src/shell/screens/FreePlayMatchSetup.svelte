<script lang="ts">
  import { onMount } from "svelte";
  import type { BattleRequest, SelectableDeck } from "../../battle/index.ts";
  import type {
    BattleDeckModule,
    BattleDomainLoader,
  } from "../domain-loaders.ts";
  import {
    freePlayBattleModule,
    listedFreePlayDecks,
    refreshFreePlayDecks,
  } from "./free-play-deck-listing.ts";
  import type { ShellSettingsStore } from "../settings/shell-settings-store.ts";
  import DomainLoadError from "./DomainLoadError.svelte";
  import FreePlayDeckSeat from "./FreePlayDeckSeat.svelte";

  export let settings: ShellSettingsStore;
  /* The battle entry, loaded rather than imported: it also exports the duel,
     and a static import here would make the largest chunk in the build eager.
     Typed to the deck half of that entry, so this screen cannot mount a duel —
     that stays the shell's own duel region, which the stage geometry measures
     against (`src/battle/app/presentation/stage-frame.ts`). */
  export let loadBattle: BattleDomainLoader | (() => Promise<BattleDeckModule>);
  export let onstart: (request: BattleRequest) => void = () => undefined;
  export let onback: () => void = () => undefined;
  /* Leaving the seat for the library it is filled from. Reported rather than
     routed, because the deck editor is a route the shell owns the URL of. */
  export let ondecks: () => void = () => undefined;

  let battle: BattleDeckModule | null = null;
  let decks: readonly SelectableDeck[] = [];
  let playerKey = "";
  let opponentKey = "";
  let startError: string | null = null;
  /* The battle chunk itself never arrived. It is the duel domain failing one
     screen earlier than it used to, so it is reported as the duel failing:
     a stale dev server or a half-cached build looks the same from here. */
  let loadError: unknown = null;

  $: ready = battle !== null;
  /* Both seats, or no match: a request is two decks, and a seat that resolves
     to nothing is a duel the Worker would refuse after the click. */
  $: canStart = ready && playerKey !== "" && opponentKey !== "";

  onMount(() => {
    let cancelled = false;
    void (async () => {
      try {
        const loaded = await freePlayBattleModule(loadBattle);
        if (cancelled) return;
        battle = loaded;
        /* Whatever is already known, so the seats fill on the first paint: the
           listing this page last read, or the bundled decks alone, which are
           compiled into this build and need no read at all. */
        adoptDecks(
          loaded,
          listedFreePlayDecks() ??
            loaded.presetSelectableDecks(loaded.DECK_CATALOG),
        );
        const listed = await refreshFreePlayDecks(loadBattle);
        if (cancelled) return;
        adoptDecks(loaded, listed);
      } catch (error) {
        if (!cancelled) loadError = error;
      }
    })();
    return () => {
      cancelled = true;
    };
  });

  /* A listing, and the seats that survive it. Each seat keeps what it already
     shows — the bundled list is replaced by the full one a moment later, and a
     choice made in between is the player's — then falls back to the pairing
     they last played, then to the bundled default. A deck deleted, or edited
     since — the key carries the revision — simply does not resolve, so no seat
     ever names a deck the picker does not show. */
  function adoptDecks(
    loaded: BattleDeckModule,
    listed: readonly SelectableDeck[],
  ): void {
    decks = listed;
    const remembered = $settings.freePlayPairing;
    playerKey = seatKey(
      loaded,
      listed,
      [playerKey, remembered?.player],
      `preset:${loaded.DEFAULT_PLAYER_DECK_ID}`,
    );
    opponentKey = seatKey(
      loaded,
      listed,
      [opponentKey, remembered?.opponent],
      `preset:${loaded.DEFAULT_OPPONENT_DECK_ID}`,
    );
  }

  function seatKey(
    loaded: BattleDeckModule,
    listed: readonly SelectableDeck[],
    candidates: readonly (string | undefined)[],
    fallback: string,
  ): string {
    for (const candidate of candidates)
      if (
        candidate !== undefined &&
        candidate !== "" &&
        loaded.findSelectableDeck(listed, candidate) !== null
      )
        return candidate;
    /* The bundled default is normally there — it is compiled into this build —
       but a listing that answered with nothing at all must not preselect a row
       the picker does not show, or Start would run a deck nobody can see. */
    return loaded.findSelectableDeck(listed, fallback) === null ? "" : fallback;
  }

  function select(seat: "player" | "opponent", key: string): void {
    startError = null;
    if (seat === "player") playerKey = key;
    else opponentKey = key;
  }

  function start(): void {
    startError = null;
    if (battle === null) return;
    const player = battle.findSelectableDeck(decks, playerKey);
    const opponent = battle.findSelectableDeck(decks, opponentKey);
    /* Reachable when the library changed in another tab since the listing. */
    if (player === null || opponent === null) {
      startError = "A deck you chose is no longer available. Choose another.";
      return;
    }
    let request: BattleRequest;
    /* The duel's own parser, run before the duel mounts: a deck edited to 39
       cards after it was remembered names the rule it broke here, rather than
       taking the player into a duel that dies on creation. */
    try {
      request = battle.parseBattleRequest({
        player: player.selection,
        opponent: opponent.selection,
      });
    } catch (error) {
      startError =
        error instanceof Error
          ? `That pairing cannot be played: ${error.message}`
          : "That pairing cannot be played.";
      return;
    }
    settings.rememberFreePlayPairing({
      player: playerKey,
      opponent: opponentKey,
    });
    onstart(request);
  }
</script>

{#if loadError !== null}
  <DomainLoadError label="Duel Simulator" cy="duel" error={loadError} />
{:else}
  <main class="match-setup" data-cy="free-play-match-setup">
    <h1 class="match-setup__title" data-cy="free-play-match-title">
      Choose the decks
    </h1>

    {#if !ready}
      <p class="notice" role="status" data-cy="free-play-match-status">
        Reading your deck library…
      </p>
    {/if}

    {#if startError !== null}
      <p class="notice error" role="alert" data-cy="free-play-match-error">
        {startError}
      </p>
    {/if}

    <div class="match-setup__seats" data-cy="free-play-match-seats">
      <!-- The way to the library this seat is filled from sits under the seat
           itself: a deck the player wants is either in this list or one click
           from being built, and that click belongs beside the list rather than
           on a menu one screen back. -->
      <FreePlayDeckSeat
        seat="player"
        label="Your deck"
        {decks}
        value={playerKey}
        disabled={!ready}
        onselect={(key) => select("player", key)}
        onmanage={ondecks}
      />
      <FreePlayDeckSeat
        seat="opponent"
        label="Opponent deck"
        {decks}
        value={opponentKey}
        disabled={!ready}
        onselect={(key) => select("opponent", key)}
      />
    </div>

    <div class="match-setup__actions" data-cy="free-play-match-actions">
      <button
        type="button"
        disabled={!canStart}
        data-cy="free-play-match-start"
        onclick={start}>Start the duel</button
      >
      <button
        type="button"
        class="secondary"
        data-cy="free-play-match-back"
        onclick={onback}>Main menu</button
      >
    </div>
  </main>
{/if}

<style>
  .match-setup {
    display: grid;
    align-content: start;
    gap: var(--space-3);
    width: 100%;
    height: 100%;
    padding: clamp(var(--space-3), 5vw, var(--space-6));
    overflow: auto;
  }

  .match-setup__title {
    margin: 0;
  }

  /* Two seats side by side where the stage is wide enough for both to stay
     readable, stacked below that; the region itself is what scrolls. */
  .match-setup__seats {
    display: grid;
    gap: var(--space-3);
    width: min(48rem, 100%);
  }

  @media (min-width: 40rem) {
    .match-setup__seats {
      grid-template-columns: 1fr 1fr;
    }
  }

  .match-setup__actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin-block-start: var(--space-2);
  }

  .notice {
    width: min(48rem, 100%);
    margin: 0;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--surface-raised);
    color: var(--muted);
  }

  .notice.error {
    border-color: var(--danger-border);
    background: var(--danger-surface);
    color: var(--danger);
  }
</style>

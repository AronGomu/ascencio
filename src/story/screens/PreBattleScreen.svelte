<script lang="ts">
  import type { DeckBuilderCardView } from "../../decks/catalog/ocg-card-mapper.ts";
  import { cardFrameOf } from "../../decks/card-frame.ts";
  import { croppedCardImageUrl } from "../../decks/deck-cover.ts";
  import {
    DeckSelectScreen,
    type DeckTileModel,
    type DecklistRow,
    type DecklistView,
    type OpponentView,
  } from "../../deck-select/index.ts";
  import {
    preBattleBlock,
    preBattleSelection,
    type PreBattleDeckOption,
  } from "../decks/pre-battle-decks.ts";
  import { preBattleDeckTile } from "../decks/pre-battle-tiles.ts";
  import type { StoryDeck } from "../model/story-state.ts";

  export let allowReturn = true;
  /* Null while the card database is still being read. An empty catalog calls
     every card missing, so a verdict reached before it lands would refuse every
     deck in the save — the screen waits instead of refusing. */
  export let decks: readonly PreBattleDeckOption[] | null = null;
  /** The save's decks as records, for counts/cover/decklists; pairs with
      `decks` (verdicts) by id. */
  export let deckRecords: readonly StoryDeck[] = [];
  export let favouriteDeckIds: readonly string[] = [];
  export let defaultDeckId: string | null = null;
  export let decksError: string | null = null;
  export let catalog: ReadonlyMap<number, DeckBuilderCardView> = new Map();
  /** Encounter identity for the locked seat card. */
  export let opponentName = "Rin's Echo";
  export let opponentDeckName = "Relay Deck";
  export let onstart: () => void = () => undefined;
  export let onreturn: () => void = () => undefined;
  export let onselectdeck: (deckId: string) => void = () => undefined;
  export let onfavourite: (deckId: string, favourite: boolean) => void = () =>
    undefined;
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
  $: blocked = decksError !== null || decks === null || block !== null;
  $: recordById = new Map<string, StoryDeck>(
    deckRecords.map((record) => [record.id, record]),
  );
  $: tiles =
    decks?.map((option) =>
      preBattleDeckTile(option, recordById.get(option.id), {
        catalog,
        favouriteDeckIds,
        defaultDeckId,
      }),
    ) ?? [];
  /* The three refusals this screen can be under, in the order they can hide
     each other: a database that never loaded says so instead of a verdict it
     could not reach, and a verdict still being computed is not yet a refusal. */
  $: blockNotice =
    decksError ??
    (decks === null
      ? "Checking your decks against the card database…"
      : (block?.reason ?? null));
  /* `started` rides here as well as in `start()`: the latch is why the button
     stops being pressable, and the guard is why a press that beat the flush
     still only counts once. */
  $: canStart = !blocked && !started && selectedId !== null;

  $: opponent = Object.freeze({
    id: "encounter",
    name: opponentName,
    line: "Set by the story",
    locked: true,
  }) satisfies OpponentView;

  /* The opponent's own cards are the duel's: the shell seats a bundled preset
     the story never names, and its lists live inside the duel domain, which
     this screen may not read and could not load without making the duel eager.
     So the card carries the encounter's name and no count it would be making
     up. */
  $: opponentDeck = {
    key: "encounter-deck",
    name: opponentDeckName,
    counts: { main: 0, extra: 0, side: 0 },
    meta: "🔒 Set by the story",
    coverImageUrl: null,
    legal: true,
    blockReason: null,
    bundled: true,
    lockedBy: null,
    favourite: false,
    isDefault: false,
    deletable: false,
    updatedAt: null,
  } satisfies DeckTileModel;

  function rows(codes: readonly number[]): readonly DecklistRow[] {
    return codes.map((code) => {
      const card = catalog.get(code);
      return {
        code,
        name: card?.name ?? `#${code}`,
        frame: cardFrameOf(card?.rawType ?? 0),
        artUrl: croppedCardImageUrl(card?.imageUrl ?? null),
      };
    });
  }

  /* Resolved rather than fetched: the save carries its own decks, so the
     preview is a read of a prop. Async because the screen's resolver is. */
  function decklistFor(key: string): Promise<DecklistView | null> {
    const record = recordById.get(key);
    return Promise.resolve(
      record === undefined
        ? null
        : {
            main: rows(record.main),
            extra: rows(record.extra),
            side: rows(record.side),
          },
    );
  }

  function cardImageFor(code: number): string | null {
    return catalog.get(code)?.imageUrl ?? null;
  }

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

<section class="briefing" data-cy="story-briefing-screen">
  <!-- The same screen free play picks a deck on. The story's differences are
       all props: the opponent is locked, the decks are the save's, and nothing
       here manages them — the deck editor this screen leaves for does. -->
  <DeckSelectScreen
    mode="duel-start"
    eyebrow="Pre-battle briefing"
    title={opponentName}
    {tiles}
    selectedKey={selectedId}
    startLabel={started ? "Entering duel…" : "Start Duel"}
    {canStart}
    {blockNotice}
    manageable={false}
    showBack={allowReturn}
    backLabel="Map"
    {opponent}
    opponents={[]}
    {opponentDeck}
    {decklistFor}
    {cardImageFor}
    onselect={choose}
    onfavourite={(key, favourite) => onfavourite(key, favourite)}
    onstart={start}
    onback={onreturn}
    onopen={() => void leave()}
  />

  <div class="under" data-cy="story-briefing-notes">
    {#if decksError !== null}
      <!-- The screen's own notice carries the message; the read it failed at
           is offered again here, because the shared footer has no retry. -->
      <button
        type="button"
        class="secondary"
        data-cy="story-briefing-deck-error-retry"
        onclick={() => onretrydecks()}>Try again</button
      >
    {/if}
    {#if block !== null}
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
    {/if}
    <p class="checkpoint" role="status" data-cy="story-briefing-checkpoint">
      Your progress is saved before the duel starts.
    </p>
  </div>
</section>

<style>
  /* The same full-height box every story screen takes, split into the shared
     screen and the story's own footnotes: the screen holds a definite row, so
     its deck grid scrolls inside itself rather than growing the page. */
  .briefing {
    min-height: 100svh;
    display: grid;
    grid-template-rows: minmax(0, 1fr) auto;
    gap: 0.75rem;
    padding: clamp(0.75rem, 3vw, 2.5rem);
    background:
      radial-gradient(circle at 20% 50%, var(--field-glow), transparent 25%),
      var(--bg);
  }
  .under {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.6rem;
  }
  .checkpoint {
    margin: 0;
    padding: 0.7rem;
    border-left: 3px solid var(--story-accent);
  }
</style>

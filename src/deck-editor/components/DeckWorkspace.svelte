<script lang="ts">
  import { tick } from "svelte";
  import { SvelteMap } from "svelte/reactivity";
  import type { DeckRecord, DeckZone } from "../../decks/deck-contracts.ts";
  import type { PickedCard } from "../drag-state.ts";
  import {
    FIFTEEN_CARD_GRID,
    mainDeckGridPlan,
  } from "../../decks/deck-model.ts";
  import type { DeckBuilderCardView } from "../../decks/catalog/ocg-card-mapper.ts";
  import type { PinnedDeckRuleset } from "../../decks/catalog/pinned-ruleset.ts";
  import DeckZoneGrid from "./DeckZoneGrid.svelte";
  import ValidationIssues from "./ValidationIssues.svelte";

  export let deck: DeckRecord;
  export let catalog: ReadonlyMap<number, DeckBuilderCardView>;
  export let ruleset: PinnedDeckRuleset;
  export let selectedCode: number | null = null;
  export let picked: PickedCard | null = null;
  export let onselect: (
    card: DeckBuilderCardView | null,
    code: number,
  ) => void = () => undefined;
  export let ondragcard: (
    code: number,
    zone: DeckZone,
    event: DragEvent,
  ) => void = () => undefined;
  export let ondragcancel: () => void = () => undefined;
  export let onpickup: (code: number, zone: DeckZone) => void = () => undefined;
  export let ondropzone: (zone: DeckZone) => void = () => undefined;
  export let onremove: () => void = () => undefined;
  export let ontap: ((code: number, zone: DeckZone) => void) | null = null;
  export let onhovercard: (code: number) => void = () => undefined;
  export let onhoverend: () => void = () => undefined;
  /* Its own pane below the breakpoint: the stage scrolls it, not an inner box. */
  export let filled = false;

  let workspaceElement: HTMLElement;
  let collapsedZones = { main: false, extra: false, side: true };
  $: totalCopies = countCopies(deck);
  $: mainDropAllowed = canDrop("main", picked, catalog);
  $: extraDropAllowed = canDrop("extra", picked, catalog);
  $: sideDropAllowed = canDrop("side", picked, catalog);

  function canDrop(
    zone: DeckZone,
    active: PickedCard | null,
    cards: ReadonlyMap<number, DeckBuilderCardView>,
  ): boolean {
    if (active === null) return false;
    const card = cards.get(active.code);
    if (card === undefined) return false;
    if (active.source === "catalog" || active.source === "side")
      return zone === card.canonicalZone;
    return zone === "side";
  }

  async function dropAndRestoreFocus(zone: DeckZone): Promise<void> {
    ondropzone(zone);
    await tick();
    document.getElementById(`${zone}-heading`)?.focus();
  }

  async function focusIssue(
    cardCode: number | null,
    zone: string | null,
  ): Promise<void> {
    if (cardCode !== null) onselect(catalog.get(cardCode) ?? null, cardCode);
    await tick();
    const zoneSelector = zone === null ? "" : `[data-deck-zone="${zone}"]`;
    const card =
      cardCode === null
        ? null
        : workspaceElement.querySelector<HTMLElement>(
            `[data-card-code="${cardCode}"]${zoneSelector}`,
          );
    if (card !== null) card.focus();
    else if (zone !== null) document.getElementById(`${zone}-heading`)?.focus();
  }

  function countCopies(value: DeckRecord): ReadonlyMap<number, number> {
    const counts = new SvelteMap<number, number>();
    for (const code of [...value.main, ...value.extra, ...value.side])
      counts.set(code, (counts.get(code) ?? 0) + 1);
    return counts;
  }
</script>

<section
  class="workspace"
  class:filled
  aria-label="Deck workspace"
  data-cy="deck-workspace"
  bind:this={workspaceElement}
>
  <header class="workspace-header" data-cy="deck-workspace-header">
    {#if picked && picked.source !== "catalog"}
      <button
        type="button"
        class="danger remove"
        data-cy="deck-workspace-remove-picked"
        ondragover={(event) => event.preventDefault()}
        ondrop={(event) => {
          event.preventDefault();
          onremove();
        }}
        onclick={onremove}
      >
        Remove picked card
      </button>
    {/if}
  </header>

  <DeckZoneGrid
    zone="main"
    label="Main Deck"
    codes={deck.main}
    plan={mainDeckGridPlan(deck.main.length)}
    {catalog}
    {ruleset}
    {totalCopies}
    {selectedCode}
    picked={mainDropAllowed}
    {onselect}
    {ondragcard}
    {ondragcancel}
    {onpickup}
    {ontap}
    ondropzone={(zone) => void dropAndRestoreFocus(zone)}
    {onhovercard}
    {onhoverend}
    collapsed={collapsedZones.main}
    ontogglecollapse={() =>
      (collapsedZones = { ...collapsedZones, main: !collapsedZones.main })}
  />
  <DeckZoneGrid
    zone="extra"
    label="Extra Deck"
    codes={deck.extra}
    plan={FIFTEEN_CARD_GRID}
    {catalog}
    {ruleset}
    {totalCopies}
    {selectedCode}
    picked={extraDropAllowed}
    {onselect}
    {ondragcard}
    {ondragcancel}
    {onpickup}
    {ontap}
    ondropzone={(zone) => void dropAndRestoreFocus(zone)}
    {onhovercard}
    {onhoverend}
    collapsed={collapsedZones.extra}
    ontogglecollapse={() =>
      (collapsedZones = { ...collapsedZones, extra: !collapsedZones.extra })}
  />
  <DeckZoneGrid
    zone="side"
    label="Side Deck"
    codes={deck.side}
    plan={FIFTEEN_CARD_GRID}
    {catalog}
    {ruleset}
    {totalCopies}
    {selectedCode}
    picked={sideDropAllowed}
    {onselect}
    {ondragcard}
    {ondragcancel}
    {onpickup}
    {ontap}
    ondropzone={(zone) => void dropAndRestoreFocus(zone)}
    {onhovercard}
    {onhoverend}
    collapsed={collapsedZones.side}
    ontogglecollapse={() =>
      (collapsedZones = { ...collapsedZones, side: !collapsedZones.side })}
  />

  <ValidationIssues
    validation={deck.validation}
    onfocusissue={(code, zone) => void focusIssue(code, zone)}
  />
</section>

<style>
  .workspace {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    min-width: 0;
    height: calc(100vh - 5.5rem);
    overflow-y: auto;
    padding: 1rem;
    border: 1px solid var(--border);
    border-radius: 0.8rem;
    background: var(--surface);
  }

  .workspace.filled {
    height: auto;
    overflow-y: visible;
  }

  .workspace-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .remove {
    min-height: 2.25rem;
    padding: 0.45rem 0.65rem;
  }
</style>

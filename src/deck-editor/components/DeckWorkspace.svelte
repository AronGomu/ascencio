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
  import {
    unlimitedCardOwnership,
    type CardOwnership,
  } from "../../decks/card-ownership.ts";
  import DeckZoneGrid from "./DeckZoneGrid.svelte";
  import ValidationIssues from "./ValidationIssues.svelte";

  export let deck: DeckRecord;
  export let catalog: ReadonlyMap<number, DeckBuilderCardView>;
  export let ruleset: PinnedDeckRuleset;
  export let ownership: CardOwnership = unlimitedCardOwnership();
  export let selectedCode: number | null = null;
  export let picked: PickedCard | null = null;
  export let onselect: (
    card: DeckBuilderCardView | null,
    code: number,
  ) => void = () => undefined;
  export let ondragcard: (
    code: number,
    zone: DeckZone,
    index: number,
    event: DragEvent,
  ) => void = () => undefined;
  export let ondragcancel: () => void = () => undefined;
  export let onreorderdrop: (zone: DeckZone, toIndex: number) => void = () =>
    undefined;
  export let ondropzone: (zone: DeckZone) => void = () => undefined;
  export let ontap:
    ((code: number, zone: DeckZone, index: number) => void) | null = null;
  export let onhovercard: (code: number) => void = () => undefined;
  export let onhoverend: () => void = () => undefined;
  export let oncontextremove: (
    code: number,
    zone: DeckZone,
    index: number,
    request: {
      readonly anchor: HTMLElement;
      readonly x: number;
      readonly y: number;
    },
  ) => void = () => undefined;
  /* Its own pane below the breakpoint: the stage scrolls it, not an inner box. */
  export let filled = false;

  let workspaceElement: HTMLElement;
  let collapsedZones = { main: false, extra: false, side: false };
  $: totalCopies = countCopies(deck);
  $: mainDropAllowed = canDrop("main", picked, catalog);
  $: extraDropAllowed = canDrop("extra", picked, catalog);
  $: sideDropAllowed = canDrop("side", picked, catalog);
  $: mainReorderActive = picked?.source === "main";
  $: extraReorderActive = picked?.source === "extra";
  $: sideReorderActive = picked?.source === "side";

  function canDrop(
    zone: DeckZone,
    active: PickedCard | null,
    cards: ReadonlyMap<number, DeckBuilderCardView>,
  ): boolean {
    if (active === null) return false;
    if (active.source === zone) return true;
    const card = cards.get(active.code);
    if (card === undefined) return false;
    /* The catalog can seed the sideboard directly; a side card only ever
       returns to the zone it belongs in. */
    if (active.source === "catalog")
      return zone === card.canonicalZone || zone === "side";
    if (active.source === "side") return zone === card.canonicalZone;
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
  class="workspace ui-glass-panel ui-chamfer"
  class:filled
  aria-label="Deck workspace"
  data-cy="deck-workspace"
  bind:this={workspaceElement}
>
  <DeckZoneGrid
    zone="main"
    label="Main Deck"
    codes={deck.main}
    plan={mainDeckGridPlan(deck.main.length)}
    {catalog}
    {ruleset}
    {totalCopies}
    {ownership}
    {selectedCode}
    dropAllowed={mainDropAllowed}
    dragActive={picked !== null}
    {onselect}
    {ondragcard}
    {ondragcancel}
    {ontap}
    {onreorderdrop}
    reorderActive={mainReorderActive}
    ondropzone={(zone) => void dropAndRestoreFocus(zone)}
    {onhovercard}
    {onhoverend}
    {oncontextremove}
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
    {ownership}
    {selectedCode}
    dropAllowed={extraDropAllowed}
    dragActive={picked !== null}
    {onselect}
    {ondragcard}
    {ondragcancel}
    {ontap}
    {onreorderdrop}
    reorderActive={extraReorderActive}
    ondropzone={(zone) => void dropAndRestoreFocus(zone)}
    {onhovercard}
    {onhoverend}
    {oncontextremove}
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
    {ownership}
    {selectedCode}
    dropAllowed={sideDropAllowed}
    dragActive={picked !== null}
    {onselect}
    {ondragcard}
    {ondragcancel}
    {ontap}
    {onreorderdrop}
    reorderActive={sideReorderActive}
    ondropzone={(zone) => void dropAndRestoreFocus(zone)}
    {onhovercard}
    {onhoverend}
    {oncontextremove}
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
    height: 100%;
    min-height: 0;
    overflow-y: auto;
    padding: 1rem;
  }

  .workspace.filled {
    height: auto;
    overflow-y: visible;
  }
</style>

<script lang="ts">
  import type {
    DeckValidationIssue,
    DeckZone,
  } from "../../decks/deck-contracts.ts";
  import type { DeckGridPlan } from "../../decks/deck-model.ts";
  import type { DeckBuilderCardView } from "../../decks/catalog/ocg-card-mapper.ts";
  import type { PinnedDeckRuleset } from "../../decks/catalog/pinned-ruleset.ts";
  import { quantityLimit } from "../../decks/catalog/pinned-ruleset.ts";
  import {
    unlimitedCardOwnership,
    type CardOwnership,
  } from "../../decks/card-ownership.ts";
  import CardTile from "./CardTile.svelte";

  export let zone: DeckZone;
  export let label: string;
  export let codes: readonly number[];
  export let plan: DeckGridPlan;
  export let catalog: ReadonlyMap<number, DeckBuilderCardView>;
  export let ruleset: PinnedDeckRuleset;
  export let totalCopies: ReadonlyMap<number, number>;
  export let ownership: CardOwnership = unlimitedCardOwnership();
  export let selectedCode: number | null = null;
  export let dropAllowed = false;
  export let dragActive = false;
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
  export let reorderActive = false;
  export let ondropzone: (zone: DeckZone) => void = () => undefined;
  /* The index is what tells one copy of a repeated card from another, so the
     edit lands on the tile that was clicked rather than on the first match. */
  export let ontap:
    ((code: number, zone: DeckZone, index: number) => void) | null = null;
  export let ondoubleclick:
    ((code: number, zone: DeckZone, index: number) => void) | null = null;
  export let onhovercard: (code: number) => void = () => undefined;
  export let onhoverend: () => void = () => undefined;
  export let collapsed = false;
  export let ontogglecollapse: () => void = () => undefined;
  export let issues: readonly DeckValidationIssue[] = [];
  /* The index for the same reason `ontap` carries one: without it the removal
     lands on the first copy of a repeated card rather than the one clicked. */
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

  let tooltipOpen = false;
  let pointerPressed = false;

  $: emptyCount = Math.max(0, plan.slots - codes.length);
  $: invalid = issues.some(({ severity }) => severity === "error");
  $: if (issues.length === 0) closeTooltip();

  function closeTooltip(): void {
    tooltipOpen = false;
    pointerPressed = false;
  }

  function handleIssuePointerEnter(event: PointerEvent): void {
    if (event.pointerType !== "touch") tooltipOpen = true;
  }

  function handleIssuePointerLeave(event: PointerEvent): void {
    if (event.pointerType !== "touch") closeTooltip();
  }

  function handleIssueFocus(): void {
    if (!pointerPressed) tooltipOpen = true;
  }

  function handleIssueKeydown(event: KeyboardEvent): void {
    if (event.key !== "Escape") return;
    closeTooltip();
    event.stopPropagation();
  }
</script>

<section
  class="zone"
  class:invalid
  aria-labelledby={`${zone}-heading`}
  data-cy={`deck-zone-${zone}`}
>
  <header data-cy={`deck-zone-header-${zone}`}>
    <button
      type="button"
      class="zone-toggle"
      data-cy={`deck-zone-toggle-${zone}`}
      aria-expanded={!collapsed}
      aria-controls={`deck-zone-body-${zone}`}
      onclick={ontogglecollapse}
    >
      <span aria-hidden="true" data-cy={`deck-zone-chevron-${zone}`}
        >{collapsed ? "▸" : "▾"}</span
      >
      <h3
        class="panel-title"
        id={`${zone}-heading`}
        tabindex="-1"
        data-cy={`deck-zone-heading-${zone}`}
      >
        {label}
      </h3>
      <span
        class="count"
        class:error={codes.length > plan.slots}
        data-cy={`deck-zone-count-${zone}`}
      >
        {zone === "main"
          ? codes.length <= 40
            ? `${codes.length}/40`
            : `${codes.length}/40-60`
          : `${codes.length}/${plan.slots}`}
      </span>
    </button>
    {#if issues.length > 0}
      <button
        type="button"
        class="issue-indicator"
        class:error={invalid}
        aria-label={`${label} has ${issues.length} validation ${issues.length === 1 ? "error" : "errors"}`}
        aria-expanded={tooltipOpen}
        aria-describedby={tooltipOpen
          ? `deck-zone-error-tooltip-${zone}`
          : undefined}
        data-cy={`deck-zone-error-${zone}`}
        onpointerenter={handleIssuePointerEnter}
        onpointerleave={handleIssuePointerLeave}
        onpointerdown={() => (pointerPressed = true)}
        onfocus={handleIssueFocus}
        onblur={closeTooltip}
        onclick={() => {
          tooltipOpen = !tooltipOpen;
          pointerPressed = false;
        }}
        onkeydown={handleIssueKeydown}
      >
        <span aria-hidden="true" data-cy={`deck-zone-error-icon-${zone}`}
          >(!)</span
        >
      </button>
      {#if tooltipOpen}
        <div
          id={`deck-zone-error-tooltip-${zone}`}
          class="issue-tooltip"
          class:error={invalid}
          role="tooltip"
          data-cy={`deck-zone-error-tooltip-${zone}`}
        >
          <ul data-cy={`deck-zone-error-list-${zone}`}>
            {#each issues as issue (issue.id)}
              <li data-cy={`deck-zone-error-issue-${zone}-${issue.id}`}>
                {issue.message}
              </li>
            {/each}
          </ul>
        </div>
      {/if}
    {/if}
  </header>
  {#if !collapsed}
    <div
      id={`deck-zone-body-${zone}`}
      class:allowed={dragActive && dropAllowed}
      class:blocked={dragActive && !dropAllowed}
      class="drop-zone"
      role="group"
      aria-label={`${label} drop area`}
      data-cy={`deck-zone-drop-area-${zone}`}
      ondragover={(event) => event.preventDefault()}
      ondrop={(event) => {
        event.preventDefault();
        ondropzone(zone);
      }}
      onmouseleave={() => onhoverend()}
    >
      <div
        class:compact={plan.compact}
        class="grid"
        style={`--columns:${plan.columns}`}
        data-columns={plan.columns}
        data-rows={plan.rows}
        data-slots={plan.slots}
        aria-label={`${label}: ${codes.length} cards in ${plan.slots} slots`}
        data-cy={`deck-zone-grid-${zone}`}
      >
        {#each codes as code, index (`${code}-${index}`)}
          <div
            class="slot"
            role="presentation"
            data-cy={`deck-slot-${zone}-${index}`}
            ondragover={(e) => {
              if (reorderActive) e.preventDefault();
            }}
            ondrop={(e) => {
              if (reorderActive) {
                e.preventDefault();
                e.stopPropagation();
                onreorderdrop(zone, index);
              }
            }}
          >
            <CardTile
              card={catalog.get(code) ?? null}
              {code}
              {zone}
              limit={quantityLimit(ruleset, code)}
              currentCopies={totalCopies.get(code) ?? 0}
              selected={selectedCode === code}
              disabled={ownership.ownedCount(code) <
                (totalCopies.get(code) ?? 0)}
              compact={plan.compact}
              dataCyPrefix={zone}
              dataCyId={index}
              onselect={() => onselect(catalog.get(code) ?? null, code)}
              ontap={ontap === null ? null : () => ontap(code, zone, index)}
              ondoubleclick={ondoubleclick === null
                ? null
                : () => ondoubleclick(code, zone, index)}
              ondragcard={(event) => ondragcard(code, zone, index, event)}
              {ondragcancel}
              onhover={() => onhovercard(code)}
              oncontext={(request) =>
                oncontextremove(code, zone, index, request)}
            />
          </div>
        {/each}
        {#each Array.from({ length: emptyCount }) as slot, index (index)}
          <span
            class="empty-slot"
            data-empty-slot={slot === undefined ? index : slot}
            aria-hidden="true"
            data-cy={`deck-zone-empty-slot-${zone}-${index}`}
            ondragover={(e) => {
              if (reorderActive) e.preventDefault();
            }}
            ondrop={(e) => {
              if (reorderActive) {
                e.preventDefault();
                e.stopPropagation();
                onreorderdrop(zone, codes.length);
              }
            }}
          ></span>
        {/each}
      </div>
    </div>
  {/if}
  {#if codes.length > plan.slots}
    <p class="overflow" role="alert" data-cy={`deck-zone-overflow-${zone}`}>
      {codes.length - plan.slots} overflow card(s) remain invalid.
    </p>
  {/if}
</section>

<style>
  .zone {
    position: relative;
    min-width: 0;
    padding: 0.25rem;
    border: 2px solid transparent;
    border-radius: 0.65rem;
  }

  .zone.invalid {
    border-color: var(--danger);
  }

  header {
    position: relative;
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin-bottom: 0.45rem;
  }

  .zone-toggle {
    all: unset;
    display: flex;
    flex: 1;
    min-width: 0;
    align-items: center;
    gap: 0.4rem;
    padding: 0.15rem 0.25rem;
    border-radius: 0.4rem;
    cursor: pointer;
  }

  .zone-toggle:hover {
    background: var(--surface-raised);
  }

  /* `all: unset` drops the user-agent focus ring, and being an author
     declaration it also beats the global one in `app.css`. */
  .zone-toggle:focus-visible {
    outline: 3px solid var(--focus-ring);
    outline-offset: 3px;
  }

  .issue-indicator {
    flex: none;
    min-width: 2.75rem;
    min-height: 2.75rem;
    padding: 0.2rem 0.45rem;
    color: var(--warning);
    border: 1px solid var(--warning-border);
    border-radius: 0.45rem;
    background: var(--warning-surface);
    font-weight: 800;
    cursor: help;
  }

  .issue-indicator:hover,
  .issue-indicator:focus-visible {
    color: var(--surface-sunken);
    background: var(--warning);
  }

  .issue-indicator.error {
    color: var(--danger);
    border-color: var(--danger);
    background: var(--danger-surface);
  }

  .issue-indicator.error:hover,
  .issue-indicator.error:focus-visible {
    color: var(--surface-sunken);
    background: var(--danger);
  }

  .issue-tooltip {
    position: absolute;
    z-index: 10;
    top: calc(100% + 0.2rem);
    right: 0;
    width: min(24rem, calc(100% - 0.5rem));
    padding: 0.65rem 0.8rem;
    color: var(--text);
    border: 1px solid var(--warning-border);
    border-radius: 0.5rem;
    background: var(--surface-raised);
    box-shadow: 0 1.5rem 5rem color-mix(in srgb, var(--shadow) 55%, transparent);
    font-size: 0.78rem;
    line-height: 1.4;
  }

  .issue-tooltip.error {
    border-color: var(--danger);
  }

  .issue-tooltip ul {
    display: grid;
    gap: 0.3rem;
    margin: 0;
    padding-left: 1.15rem;
  }

  .panel-title {
    margin: 0;
    color: var(--accent);
    font-family: var(--font-display);
    font-size: 0.94rem;
    font-weight: 400;
    letter-spacing: var(--ls-display);
    text-transform: uppercase;
  }

  .count {
    margin-left: auto;
    color: var(--muted);
    font-size: 0.78rem;
    font-weight: 750;
  }

  .count.error,
  .overflow {
    color: var(--danger);
  }

  .drop-zone {
    width: 100%;
    min-height: 0;
    padding: 0.4rem;
    border: 1px solid var(--border);
    border-radius: 0.55rem;
    background: var(--surface-sunken);
  }

  .drop-zone.allowed {
    border-color: var(--accent);
    background: var(--surface-chain);
  }

  .drop-zone.blocked {
    border-color: var(--danger);
    background: var(--danger-surface);
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(var(--columns), minmax(0, 1fr));
    gap: 0.3rem;
  }

  .grid.compact {
    gap: 0.22rem;
  }

  .slot {
    min-width: 0;
    min-height: 0;
  }

  .empty-slot {
    aspect-ratio: 59 / 86;
    border: 1px dashed color-mix(in srgb, var(--border) 55%, transparent);
    border-radius: 0.32rem;
    background: color-mix(in srgb, var(--ink) 2%, transparent);
  }

  .overflow {
    margin: 0.35rem 0 0;
    font-size: 0.76rem;
  }
</style>

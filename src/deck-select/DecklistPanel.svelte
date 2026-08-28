<script lang="ts">
  import type { DecklistRow, DecklistView } from "./deck-select-contracts.ts";

  export let decklist: DecklistView;
  /** The `data-cy` root every value here is built from. The float beside a
      duel-start tile and the library's docked column are the same panel, so
      the caller names its copy rather than the panel claiming one identity. */
  export let cy: string;
  /** A row is under the pointer; the anchor is the row itself, for the card
      art to float beside. */
  export let onrowhover: (code: number, anchor: HTMLElement) => void = () =>
    undefined;
  export let onrowleave: () => void = () => undefined;

  interface Entry {
    readonly code: number;
    readonly name: string;
    /** "×2" from the second copy on; null for a single one. */
    readonly copies: string | null;
  }

  interface Part {
    readonly id: string;
    readonly heading: string;
    readonly entries: readonly Entry[];
  }

  /* A deck holds up to three copies of a card and the panel names each card
     once: the copies ride the row rather than repeating it. That is also what
     keeps the row's `data-cy` — built from the code — unique in the document,
     which repeated rows could not be. */
  function entriesOf(rows: readonly DecklistRow[]): readonly Entry[] {
    const counted: { code: number; name: string; copies: number }[] = [];
    for (const row of rows) {
      const seen = counted.find((entry) => entry.code === row.code);
      if (seen === undefined)
        counted.push({ code: row.code, name: row.name, copies: 1 });
      else seen.copies += 1;
    }
    return counted.map((entry) => ({
      code: entry.code,
      name: entry.name,
      copies: entry.copies > 1 ? `×${entry.copies}` : null,
    }));
  }

  /* The heading and the copies are built here rather than interpolated in the
     markup: each is one token, and formatter whitespace around `{…}` would
     land inside it. */
  function partOf(
    id: string,
    label: string,
    rows: readonly DecklistRow[],
  ): Part {
    return {
      id,
      heading: `${label} (${rows.length})`,
      entries: entriesOf(rows),
    };
  }

  $: parts = [
    partOf("main", "Main", decklist.main),
    partOf("extra", "Extra", decklist.extra),
    partOf("side", "Side", decklist.side),
  ];
</script>

<div class="decklist" data-cy={cy}>
  {#each parts as part (part.id)}
    <section data-cy={`${cy}-${part.id}`}>
      <h3 data-cy={`${cy}-${part.id}-heading`}>{part.heading}</h3>
      <ul data-cy={`${cy}-${part.id}-rows`}>
        {#each part.entries as entry (entry.code)}
          <li
            class="row"
            onpointerenter={(event) =>
              onrowhover(entry.code, event.currentTarget)}
            onpointerleave={() => onrowleave()}
            data-cy={`${cy}-row-${entry.code}`}
          >
            <span class="name" data-cy={`${cy}-row-name-${entry.code}`}
              >{entry.name}</span
            >
            {#if entry.copies !== null}
              <span class="copies" data-cy={`${cy}-row-copies-${entry.code}`}
                >{entry.copies}</span
              >
            {/if}
          </li>
        {/each}
      </ul>
    </section>
  {/each}
</div>

<style>
  .decklist {
    display: grid;
    align-content: start;
    gap: var(--space-2);
  }

  /* `display: grid` above beats the user-agent `[hidden]` rule, so a host that
     hides the panel with the attribute would still see it on screen. The
     attribute is marked global because nothing here renders it statically and
     the compiler would otherwise prune the guard as an unused selector. */
  .decklist:global([hidden]) {
    display: none;
  }

  h3 {
    margin: 0;
    color: var(--muted);
    font-size: var(--text-xs);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  ul {
    display: grid;
    margin: var(--space-1) 0 0;
    padding: 0;
    list-style: none;
  }

  /* A full deck is up to 90 cards, so a row is one line of text and nothing
     more: the name takes the width it needs and the copies hold the far edge. */
  .row {
    display: flex;
    justify-content: space-between;
    gap: var(--space-2);
    font-size: var(--text-sm);
  }

  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .copies {
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }
</style>

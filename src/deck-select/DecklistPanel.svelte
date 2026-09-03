<script lang="ts">
  import { CARD_FRAME_COLORS, type CardFrame } from "../decks/card-frame.ts";
  import type { DecklistRow, DecklistView } from "./deck-select-contracts.ts";

  export let decklist: DecklistView;
  /** The `data-cy` root every value here is built from. The float beside a
      duel-start tile and the library's docked column are the same panel, so
      the caller names its copy rather than the panel claiming one identity. */
  export let cy: string;
  /** A row is hovered or focused; the anchor is the row itself, for the card
      scan to float beside. Null keeps rows out of the tab order when a host
      does not offer the visual preview. */
  export let onrowhover: ((code: number, anchor: HTMLElement) => void) | null =
    null;
  export let onrowleave: (() => void) | null = null;

  interface Entry {
    readonly code: number;
    readonly name: string;
    readonly frame: CardFrame;
    readonly artUrl: string | null;
    readonly copies: number;
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
    const counted: {
      code: number;
      name: string;
      frame: CardFrame;
      artUrl: string | null;
      copies: number;
    }[] = [];
    for (const row of rows) {
      const seen = counted.find((entry) => entry.code === row.code);
      if (seen === undefined)
        counted.push({
          code: row.code,
          name: row.name,
          frame: row.frame,
          artUrl: row.artUrl,
          copies: 1,
        });
      else seen.copies += 1;
    }
    return counted;
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
          <!-- svelte-ignore a11y_no_noninteractive_tabindex (focus is the keyboard
               equivalent of hover for this visual-only preview; row stays a list item) -->
          <li
            class="row"
            tabindex={onrowhover === null ? undefined : 0}
            style={`--fc:${CARD_FRAME_COLORS[entry.frame]};${entry.artUrl === null ? "" : `--img:url('${entry.artUrl}')`}`}
            onpointerenter={(event) =>
              onrowhover?.(entry.code, event.currentTarget)}
            onpointerleave={() => onrowleave?.()}
            onfocus={(event) => onrowhover?.(entry.code, event.currentTarget)}
            onblur={() => onrowleave?.()}
            data-cy={`${cy}-row-${entry.code}`}
          >
            <span
              class="cp"
              class:single={entry.copies === 1}
              data-cy={`${cy}-row-copies-${entry.code}`}>{entry.copies}</span
            >
            {#if entry.artUrl !== null}
              <span class="art" data-cy={`${cy}-row-art-${entry.code}`}></span>
              <span class="fade" data-cy={`${cy}-row-fade-${entry.code}`}
              ></span>
            {/if}
            <span
              class="name"
              title={entry.name}
              data-cy={`${cy}-row-name-${entry.code}`}>{entry.name}</span
            >
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
    gap: 3px;
    margin: var(--space-1) 0 0;
    padding: 0;
    list-style: none;
  }

  .row {
    position: relative;
    display: flex;
    align-items: center;
    height: 30px;
    overflow: hidden;
    border-left: 5px solid var(--fc);
    border-radius: 5px;
    background: #22252c;
  }

  .row:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: -2px;
  }

  .cp {
    position: relative;
    z-index: 2;
    align-self: stretch;
    min-width: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #000a;
    color: #e8e9ec;
    font-size: 12px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .cp.single {
    background: #0006;
  }

  .art {
    position: absolute;
    z-index: 0;
    inset: 0;
    background-image: var(--img);
    background-position: center 20%;
    background-size: cover;
    opacity: 0.6;
  }

  .fade {
    position: absolute;
    z-index: 1;
    inset: 0;
    background: linear-gradient(
      90deg,
      #22252c 0%,
      #22252ccc 38%,
      #22252c00 100%
    );
  }

  .name {
    position: relative;
    z-index: 2;
    flex: 1;
    padding: 0 8px 0 6px;
    overflow: hidden;
    font-size: 13px;
    text-overflow: ellipsis;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
    white-space: nowrap;
  }
</style>

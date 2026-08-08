<script lang="ts">
  import type { DuelLogEntry } from "../../stores/duel-store.ts";

  export let entries: readonly DuelLogEntry[] = [];

  $: latestText =
    entries.at(-1)?.kind === "activity" ? entries.at(-1)!.text : "";
</script>

<section
  class="event-log"
  aria-labelledby="event-log-heading"
  data-cy="duel-log"
>
  <div class="section-heading" data-cy="duel-log-heading-row">
    <div data-cy="duel-log-title">
      <p class="eyebrow" data-cy="duel-log-eyebrow">Latest activity</p>
      <h2 id="event-log-heading" data-cy="duel-log-heading">Duel log</h2>
    </div>
    <span data-cy="duel-log-count">{entries.length}/2,000</span>
  </div>
  <p
    class="visually-hidden"
    aria-live="polite"
    data-cy="duel-log-latest-announcement"
  >
    {latestText}
  </p>
  {#if entries.length === 0}
    <p class="empty-copy" data-cy="duel-log-empty">
      Duel events will appear here.
    </p>
  {:else}
    <!-- svelte-ignore a11y_no_noninteractive_tabindex (focus enables keyboard scrolling) -->
    <div
      class="log-scroll"
      role="region"
      tabindex="0"
      aria-labelledby="event-log-heading"
      data-cy="duel-log-scroll"
    >
      <ol data-cy="duel-log-entries-list">
        {#each entries as entry (entry.logSequence)}
          <li
            class:is-truncation={entry.kind === "truncated"}
            data-cy={`duel-log-entry-${entry.logSequence}`}
          >
            {entry.text}
          </li>
        {/each}
      </ol>
    </div>
  {/if}
</section>

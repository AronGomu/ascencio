<script lang="ts">
  import type { DuelLogEntry } from "../../stores/duel-store.ts";

  export let entries: readonly DuelLogEntry[] = [];

  $: latestText =
    entries.at(-1)?.kind === "activity" ? entries.at(-1)!.text : "";
</script>

<section class="event-log" aria-labelledby="event-log-heading">
  <div class="section-heading">
    <div>
      <p class="eyebrow">Latest activity</p>
      <h2 id="event-log-heading">Duel log</h2>
    </div>
    <span>{entries.length}/2,000</span>
  </div>
  <p class="visually-hidden" aria-live="polite">{latestText}</p>
  {#if entries.length === 0}
    <p class="empty-copy">Duel events will appear here.</p>
  {:else}
    <!-- svelte-ignore a11y_no_noninteractive_tabindex (focus enables keyboard scrolling) -->
    <div
      class="log-scroll"
      role="region"
      tabindex="0"
      aria-labelledby="event-log-heading"
    >
      <ol>
        {#each entries as entry (entry.logSequence)}
          <li class:is-truncation={entry.kind === "truncated"}>{entry.text}</li>
        {/each}
      </ol>
    </div>
  {/if}
</section>

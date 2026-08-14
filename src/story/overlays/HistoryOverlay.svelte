<script lang="ts">
  import OverlayShell from "./OverlayShell.svelte";
  export let entries: readonly {
    readonly speaker: string | null;
    readonly text: string;
  }[] = [];
  export let onclose: () => void = () => undefined;
  export let restoreFocusTo: HTMLElement | null = null;
</script>

<OverlayShell
  title="Dialogue history"
  labelId="history-title"
  {onclose}
  {restoreFocusTo}
>
  <p data-cy="story-history-caption">Current scene · oldest to newest</p>
  {#if entries.length === 0}<p class="empty" data-cy="story-history-empty">
      No dialogue in this scene yet.
    </p>{:else}<ol data-cy="story-history-list">
      {#each entries as entry, index (`${entry.speaker}-${entry.text}-${index}`)}<li
          data-cy={`story-history-entry-${index}`}
        >
          <strong data-cy={`story-history-speaker-${index}`}
            >{entry.speaker ?? "Narration"}</strong
          ><span data-cy={`story-history-text-${index}`}>{entry.text}</span>
        </li>{/each}
    </ol>{/if}
</OverlayShell>

<style>
  ol {
    display: grid;
    gap: 0.75rem;
    padding-left: 1.5rem;
  }
  li {
    padding: 0.75rem;
    border-left: 2px solid var(--story-accent);
  }
  li strong,
  li span {
    display: block;
  }
  .empty {
    color: var(--story-muted);
  }
</style>

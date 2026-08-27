<script lang="ts">
  import type { PromptMessageSegment } from "../../presentation/prompt-context-message.ts";

  /* What the duel is asking about, in styled runs: the seat that acted is
     weighted, the cards it named are italic, and the zones stay quiet. The
     line is non-authoritative — legality lives entirely in the choices below
     it — so it renders as a paragraph, not a control. */
  export let segments: readonly PromptMessageSegment[] = [];
  export let dataCyPrefix: string;
</script>

{#if segments.length > 0}
  <p class="prompt-context" data-cy={`${dataCyPrefix}-prompt-context-message`}>
    {#each segments as segment, index (index)}
      {#if segment.kind === "actor"}
        <strong data-cy={`${dataCyPrefix}-prompt-context-actor-${index}`}
          >{segment.value}</strong
        >{:else if segment.kind === "card"}<em
          data-cy={`${dataCyPrefix}-prompt-context-card-${index}`}
          >{segment.value}</em
        >{:else if segment.kind === "zone"}<span
          class="prompt-context__zone"
          data-cy={`${dataCyPrefix}-prompt-context-zone-${index}`}
          >{segment.value}</span
        >{:else}{segment.value}{/if}
    {/each}
  </p>
{/if}

<style>
  .prompt-context {
    margin: 0 0 0.35rem;
    font-size: var(--text-sm);
    line-height: 1.4;
    color: var(--muted);
  }

  .prompt-context strong {
    font-weight: 650;
    color: var(--text);
  }

  .prompt-context em {
    font-style: italic;
    color: var(--accent);
  }

  .prompt-context__zone {
    color: var(--muted);
  }
</style>

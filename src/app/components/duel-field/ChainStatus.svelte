<script lang="ts">
  import type { PublicChainLink } from "../../../duel/contracts/public-duel-state.ts";

  export let links: readonly PublicChainLink[] = [];
</script>

<section class="chain-status" aria-label="Active chain">
  <div class="section-heading">
    <h3>Active chain</h3>
    <span>{links.length}</span>
  </div>
  {#if links.length === 0}
    <p class="empty-copy">No chain is resolving.</p>
  {:else}
    <ol>
      {#each links as link (link.index)}
        <li>
          <p class="chain-status__provenance">
            Link {link.index} · {link.controller === 0 ? "You" : "Opponent"}
          </p>
          <strong>{link.label}</strong>
          <span class="chain-status__state">{link.phase} · {link.outcome}</span>
          {#if link.description}<p>{link.description}</p>{/if}
        </li>
      {/each}
    </ol>
  {/if}
</section>

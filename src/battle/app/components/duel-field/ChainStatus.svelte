<script lang="ts">
  import type { PublicChainLink } from "../../../duel/contracts/public-duel-state.ts";

  export let links: readonly PublicChainLink[] = [];
</script>

<section class="chain-status" aria-label="Active chain" data-cy="chain-status">
  <div class="section-heading" data-cy="chain-status-heading-row">
    <h3 data-cy="chain-status-heading">Active chain</h3>
    <span data-cy="chain-status-count">{links.length}</span>
  </div>
  {#if links.length === 0}
    <p class="empty-copy" data-cy="chain-status-empty">
      No chain is resolving.
    </p>
  {:else}
    <ol data-cy="chain-status-links-list">
      {#each links as link (link.index)}
        <li data-cy={`chain-status-link-${link.index}`}>
          <p
            class="chain-status__provenance"
            data-cy="chain-status-link-provenance"
          >
            Link {link.index} · {link.controller === 0 ? "You" : "Opponent"}
          </p>
          <strong data-cy="chain-status-link-label">{link.label}</strong>
          <span class="chain-status__state" data-cy="chain-status-link-state"
            >{link.phase} · {link.outcome}</span
          >
          {#if link.description}<p data-cy="chain-status-link-description">
              {link.description}
            </p>{/if}
        </li>
      {/each}
    </ol>
  {/if}
</section>

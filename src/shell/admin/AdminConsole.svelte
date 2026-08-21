<script lang="ts">
  import { PROTOTYPE_RULESET } from "../../decks/catalog/pinned-ruleset.ts";
  import { emptyDeckHistory } from "../../decks/deck-history.ts";
  import type { DeckRepository } from "../../decks/index.ts";
  import { IndexedDbDeckRepository } from "../../decks/indexeddb-deck-repository.ts";
  import { formatAppRoute, type AppRoute } from "../routes.ts";
  import type { ShellStore } from "../shell-store.ts";
  import {
    ADMIN_ROUTES,
    ADMIN_STORAGE_TARGETS,
    ADMIN_TEST_DECK_ID,
    ADMIN_TEST_DECK_NAME,
    buildAdminTestDeck,
    resetStorageTarget,
    type AdminStorageTarget,
  } from "./admin-actions.ts";

  /** The console holds a connection only for the length of one seed, so a
      reset that follows is not blocked by an open database. */
  type ClosableRepository = DeckRepository & { close: () => void };

  export let store: ShellStore;
  export let openRepository: () => Promise<ClosableRepository> = async () =>
    await IndexedDbDeckRepository.open();
  export let resetTarget: (
    target: AdminStorageTarget,
  ) => Promise<void> = async (target) =>
    await resetStorageTarget(
      target,
      globalThis.indexedDB,
      globalThis.localStorage,
    );
  export let now: () => Date = () => new Date();

  /* Deleting a store is irreversible, so a reset needs a second, separate
     click on a button that only exists once the first one has armed it. Only
     one target is ever armed, so a stray click cannot wipe two stores. */
  let armedTargetId: string | null = null;
  let busy = false;
  let status = "Ready.";

  function reason(error: unknown): string {
    return error instanceof Error ? error.message : "Unknown error";
  }

  async function seedTestDeck(): Promise<void> {
    busy = true;
    status = "Seeding the test deck…";
    let repository: ClosableRepository | null = null;
    try {
      repository = await openRepository();
      const timestamp = now().toISOString();
      await repository.create(
        {
          schemaVersion: 1,
          id: ADMIN_TEST_DECK_ID,
          revision: 0,
          name: ADMIN_TEST_DECK_NAME,
          ...buildAdminTestDeck(),
          createdAt: timestamp,
          updatedAt: timestamp,
          validation: {
            status: "valid",
            issues: [],
            rulesetRevision: PROTOTYPE_RULESET.revision,
          },
          importedNeedsReview: false,
        },
        emptyDeckHistory(),
      );
    } catch (error) {
      status = `Could not seed the test deck: ${reason(error)}`;
      return;
    } finally {
      repository?.close();
      busy = false;
    }
    status = "Seeded the test deck.";
    store.navigate({ kind: "free-play-deck", deckId: ADMIN_TEST_DECK_ID });
  }

  async function runReset(target: AdminStorageTarget): Promise<void> {
    armedTargetId = null;
    busy = true;
    try {
      await resetTarget(target);
      status = `Cleared ${target.label}.`;
    } catch (error) {
      status = `Could not clear ${target.label}: ${reason(error)}`;
    } finally {
      busy = false;
    }
  }

  function go(route: AppRoute): void {
    store.navigate(route);
  }
</script>

<main class="admin" data-cy="admin-console">
  <header class="head" data-cy="admin-head">
    <h1 data-cy="admin-title">Developer console</h1>
    <p class="warning" data-cy="admin-warning">
      Not linked from the game. Actions here change local data only.
    </p>
  </header>

  <section class="panel" data-cy="admin-routes">
    <h2 data-cy="admin-routes-title">Routes</h2>
    <div class="grid" data-cy="admin-routes-list">
      {#each ADMIN_ROUTES as route (route.kind)}
        <button
          type="button"
          data-cy={`admin-route-${route.kind}`}
          onclick={() => go(route)}>{formatAppRoute(route)}</button
        >
      {/each}
    </div>
  </section>

  <section class="panel" data-cy="admin-jumps">
    <h2 data-cy="admin-jumps-title">State jumps</h2>
    <div class="grid" data-cy="admin-jumps-list">
      <button
        type="button"
        disabled={busy}
        data-cy="admin-jump-seed-deck"
        onclick={seedTestDeck}>Seed test deck &amp; open it</button
      >
      <button
        type="button"
        data-cy="admin-jump-preset-duel"
        onclick={() => go({ kind: "free-play" })}>Launch preset duel</button
      >
      <button
        type="button"
        data-cy="admin-jump-story"
        onclick={() => go({ kind: "story" })}>Open story</button
      >
    </div>
  </section>

  <section class="panel" data-cy="admin-resets">
    <h2 data-cy="admin-resets-title">Resets</h2>
    <ul class="resets" data-cy="admin-resets-list">
      {#each ADMIN_STORAGE_TARGETS as target (target.id)}
        <li class="reset" data-cy={`admin-reset-row-${target.id}`}>
          <span data-cy={`admin-reset-label-${target.id}`}>
            {target.label}
            <code data-cy={`admin-reset-name-${target.id}`}>{target.name}</code>
          </span>
          {#if armedTargetId === target.id}
            <span class="confirm" data-cy={`admin-reset-armed-${target.id}`}>
              <button
                type="button"
                class="danger"
                disabled={busy}
                data-cy={`admin-reset-${target.id}-confirm`}
                onclick={() => runReset(target)}>Delete for good</button
              >
              <button
                type="button"
                class="secondary"
                data-cy={`admin-reset-${target.id}-cancel`}
                onclick={() => (armedTargetId = null)}>Cancel</button
              >
            </span>
          {:else}
            <button
              type="button"
              class="secondary"
              disabled={busy}
              data-cy={`admin-reset-${target.id}`}
              onclick={() => (armedTargetId = target.id)}>Reset…</button
            >
          {/if}
        </li>
      {/each}
    </ul>
  </section>

  <p class="status" role="status" data-cy="admin-status">{status}</p>
</main>

<style>
  .admin {
    display: grid;
    align-content: start;
    gap: var(--space-4);
    height: 100%;
    padding: var(--space-5);
    overflow-y: auto;
  }

  .head {
    display: grid;
    gap: var(--space-1);
  }

  h1 {
    margin: 0;
    font-size: var(--text-lg);
  }

  h2 {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .warning {
    margin: 0;
    color: var(--warning);
    font-size: var(--text-sm);
  }

  .panel {
    display: grid;
    gap: var(--space-3);
    padding: var(--space-4);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--surface-raised);
  }

  .grid {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .resets {
    display: grid;
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .reset {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    font-size: var(--text-sm);
  }

  .confirm {
    display: flex;
    gap: var(--space-2);
  }

  .danger {
    border-color: var(--danger);
    color: var(--danger);
  }

  .status {
    margin: 0;
    color: var(--muted);
    font-size: var(--text-sm);
  }
</style>

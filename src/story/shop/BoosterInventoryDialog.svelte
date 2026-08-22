<script lang="ts">
  import OverlayShell from "../overlays/OverlayShell.svelte";

  type BoosterPick = { readonly setId: string; readonly count: number };

  export let boosters: Readonly<Record<string, number>> = {};
  export let setNameOf: (setId: string) => string = (id) => id;
  export let onopen: (picks: readonly BoosterPick[]) => void = () => undefined;
  export let onopenall: (picks: readonly BoosterPick[]) => void = () =>
    undefined;
  export let onclose: () => void = () => undefined;
  export let restoreFocusTo: HTMLElement | null = null;

  let selection: Record<string, number> = Object.fromEntries(
    Object.keys(boosters).map((id) => [id, 0]),
  );

  $: entries = Object.entries(boosters);
  $: totalOwned = Object.values(boosters).reduce((a, b) => a + b, 0);
  $: selectedTotal = Object.values(selection).reduce((a, b) => a + b, 0);

  function decrement(setId: string): void {
    const v = selection[setId] ?? 0;
    if (v > 0) selection = { ...selection, [setId]: v - 1 };
  }
  function increment(setId: string): void {
    const v = selection[setId] ?? 0;
    const max = boosters[setId] ?? 0;
    if (v < max) selection = { ...selection, [setId]: v + 1 };
  }
  function handleOpenAll(): void {
    const picks = entries
      .filter(([, n]) => n > 0)
      .map(([setId, count]) => ({ setId, count }));
    onopenall(picks);
  }
</script>

<OverlayShell
  title="Boosters"
  labelId="booster-dialog-title"
  {onclose}
  {restoreFocusTo}
>
  <ul class="booster-list" data-cy="story-shop-booster-list">
    {#each entries as [setId, owned] (setId)}
      <li class="booster-row" data-cy={`story-shop-booster-${setId}`}>
        <span class="booster-name" data-cy={`story-shop-booster-owned-${setId}`}
          >{setNameOf(setId)} — {owned} owned</span
        >
        <div
          class="booster-controls"
          data-cy={`story-shop-booster-controls-${setId}`}
        >
          <button
            type="button"
            class="secondary compact"
            data-cy={`story-shop-booster-minus-${setId}`}
            disabled={!(selection[setId] ?? 0)}
            onclick={() => decrement(setId)}>−</button
          >
          <span data-cy={`story-shop-booster-selected-${setId}`}
            >{selection[setId] ?? 0}</span
          >
          <button
            type="button"
            class="secondary compact"
            data-cy={`story-shop-booster-plus-${setId}`}
            disabled={(selection[setId] ?? 0) >= owned}
            onclick={() => increment(setId)}>+</button
          >
        </div>
      </li>
    {/each}
  </ul>
  <footer class="booster-footer" data-cy="story-shop-booster-footer">
    <button
      type="button"
      class="secondary"
      data-cy="story-shop-open-selected"
      disabled={selectedTotal < 1}
      onclick={() => {
        const picks = Object.entries(selection)
          .filter(([, n]) => n > 0)
          .map(([setId, count]) => ({ setId, count }));
        onopen(picks);
      }}>Open selected</button
    >
    <button
      type="button"
      data-cy="story-shop-open-all"
      disabled={totalOwned === 0}
      onclick={handleOpenAll}>Open All</button
    >
    <button
      type="button"
      class="story-danger"
      data-cy="story-shop-booster-close"
      onclick={onclose}>Close</button
    >
  </footer>
</OverlayShell>

<style>
  .booster-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .booster-row {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.5rem 0;
    border-bottom: 1px solid var(--story-border);
  }
  .booster-name {
    flex: 1;
    font-size: 0.9rem;
  }
  .booster-controls {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 700;
    min-width: 5.5rem;
    justify-content: center;
  }
  .booster-footer {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin-top: 1.5rem;
    padding-top: 1rem;
    border-top: 1px solid var(--story-border);
  }
</style>

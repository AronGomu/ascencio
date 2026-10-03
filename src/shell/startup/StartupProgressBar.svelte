<script lang="ts">
  export let percentage = 0;

  $: displayedPercentage = Number.isFinite(percentage)
    ? Math.floor(Math.min(100, Math.max(0, percentage)))
    : 0;
</script>

<div data-cy="startup-progress" class="loading">
  <div
    data-cy="startup-progress-track"
    class="track"
    role="progressbar"
    aria-label="Overall startup progress"
    aria-valuemin="0"
    aria-valuemax="100"
    aria-valuenow={displayedPercentage}
  >
    <span
      data-cy="startup-progress-fill"
      class="fill"
      aria-hidden="true"
      style:transform={`scaleX(${displayedPercentage / 100})`}
    ></span>
  </div>
  <p data-cy="startup-progress-caption" class="caption">
    <span data-cy="startup-progress-label">Startup progress</span>
    <span data-cy="startup-progress-percentage">{displayedPercentage}%</span>
  </p>
</div>

<style>
  .loading {
    margin-block-start: 1.5rem;
  }
  .track {
    height: 0.5rem;
    background: var(--surface-raised);
    overflow: hidden;
  }
  .fill {
    display: block;
    width: 100%;
    height: 100%;
    background: var(--accent);
    transform-origin: left;
  }
  .caption {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    color: var(--muted);
    font-size: 0.85rem;
    margin: 0.6rem 0 0;
    font-variant-numeric: tabular-nums;
  }
</style>

<script lang="ts">
  export let label: string;
  export let progress: number | null = null;
</script>

<div
  class="loading-overlay"
  role="status"
  aria-live="polite"
  data-cy="loading-overlay"
>
  <p data-cy="loading-overlay-label">{label}</p>
  <progress
    aria-label={label}
    value={progress === null ? undefined : progress}
    max={progress === null ? undefined : "1"}
    data-cy="loading-overlay-progress"
  ></progress>
</div>

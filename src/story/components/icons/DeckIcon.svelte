<script lang="ts">
  export let cy: string;
</script>

<svg
  viewBox="0 0 24 24"
  width="20"
  height="20"
  aria-hidden="true"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
  data-cy={cy}
>
  <rect data-cy="deck-icon-back" x="4" y="3" width="12" height="16" rx="1.5" />
  <rect data-cy="deck-icon-front" x="8" y="7" width="12" height="16" rx="1.5" />
</svg>

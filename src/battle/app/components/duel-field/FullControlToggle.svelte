<script lang="ts">
  /* Reads the effective state — the checkbox, or Ctrl held down — so a held
     Ctrl is visible as the tick the player would otherwise have to trust. */
  export let effective: boolean;
  export let onchange: (value: boolean) => void;
</script>

<label class="full-control-toggle" data-cy="full-control-toggle">
  <input
    type="checkbox"
    checked={effective}
    onchange={(event) => onchange(event.currentTarget.checked)}
    data-cy="full-control-checkbox"
  />
  <span class="full-control-toggle__text" data-cy="full-control-label"
    >Full Control</span
  >
</label>

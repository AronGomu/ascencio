<script lang="ts">
  /* The box reflects the *stored* setting only. Painting the Ctrl hold into
     `checked` made the control lie: with Ctrl down and the setting off the box
     showed a tick, clicking it emitted `false` — which changed nothing the
     effective state could see — and Svelte never rewrote the attribute, so the
     player could not turn the persistent setting on while the key was held.
     The hold is a separate, announced state beside the box instead. */
  export let value: boolean;
  export let held = false;
  export let onchange: (value: boolean) => void;

  $: effective = value || held;
</script>

<label
  class="full-control-toggle"
  class:is-held={held}
  data-cy="full-control-toggle"
  data-effective={effective ? "true" : "false"}
>
  <input
    type="checkbox"
    checked={value}
    onchange={(event) => onchange(event.currentTarget.checked)}
    data-cy="full-control-checkbox"
  />
  <span class="full-control-toggle__text" data-cy="full-control-label"
    >Full Control</span
  >
  <!-- Live region rather than a conditional block: it has to exist before the
       key goes down for the hold to be announced while focus is on the board. -->
  <span
    class="full-control-toggle__hold"
    role="status"
    data-cy="full-control-hold-hint">{held ? "held by Ctrl" : ""}</span
  >
</label>

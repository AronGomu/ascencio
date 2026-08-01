<script lang="ts">
  import type { InteractionChoice } from "../../prompts/interaction-spec.ts";

  interface FieldMenuAnchor {
    readonly left: number;
    readonly top: number;
    readonly bottom: number;
  }

  export let label: string;
  export let choices: readonly InteractionChoice[];
  export let anchor: FieldMenuAnchor;
  export let disabled = false;
  export let onchoose: (choice: InteractionChoice) => void;
  export let oninspect: () => void;
  export let onclose: () => void;

  $: positionStyle = `left: ${anchor.left}px; top: ${anchor.bottom}px;`;
</script>

<div
  class="field-action-menu"
  role="menu"
  tabindex="-1"
  aria-label={`${label} actions`}
  style={positionStyle}
  onkeydown={(event) => {
    if (event.key === "Escape") onclose();
  }}
>
  {#each choices as choice (choice.id)}
    <button
      type="button"
      role="menuitem"
      {disabled}
      onclick={() => onchoose(choice)}>{choice.label}</button
    >
  {/each}
  <button type="button" role="menuitem" onclick={oninspect}
    >Inspect {label}</button
  >
  <button type="button" role="menuitem" class="secondary" onclick={onclose}
    >Close actions</button
  >
</div>

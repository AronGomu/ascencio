<script lang="ts">
  import type { DuelPhase } from "../../../duel/contracts/public-duel-state.ts";
  import type { FieldGeometry } from "../../../field/duel-field-geometry.ts";
  import type { InteractionSessionAction } from "../../prompts/interaction-session.ts";
  import type { ActiveInteractionSpec } from "../../prompts/interaction-spec.ts";
  import {
    PHASE_SLOTS_LEFT,
    PHASE_SLOTS_RIGHT,
    PHASE_SLOT_LABELS,
    phaseSlotChoices,
    phaseSlotForDuelPhase,
    type PhaseSlot,
  } from "../../prompts/phase-transitions.ts";
  import EndTurnButton from "./EndTurnButton.svelte";

  const PHASE_ZONE_CLEARANCE_PX = 2;

  export let geometry: FieldGeometry;
  export let phase: DuelPhase = "unknown";
  export let spec: ActiveInteractionSpec | null = null;
  export let disabled = false;
  /* Without shared Extra Monster Zones there is no central gap to straddle,
     so the same semantic groups flow continuously instead of splitting. */
  export let extraMonsterZones = true;
  export let oninteraction: (
    action: InteractionSessionAction,
  ) => unknown = () => false;

  $: currentSlot = phaseSlotForDuelPhase(phase);
  $: choices = phaseSlotChoices(spec);
  $: phaseStyle = [
    `--phase-y:${geometry.bandY}px`,
    `--phase-left-emz:${geometry.emzX[0] - geometry.box / 2 - PHASE_ZONE_CLEARANCE_PX}px`,
    `--phase-right-emz:${geometry.emzX[1] + geometry.box / 2 + PHASE_ZONE_CLEARANCE_PX}px`,
    `--phase-right-edge:${geometry.width - geometry.margin}px`,
    `--label-size:${Math.max(7, geometry.pitch * 0.085)}px`,
    `--phase-gap:${Math.max(2, geometry.pitch * 0.025)}px`,
  ].join(";");

  function ariaLabel(
    slot: PhaseSlot,
    current: boolean,
    available: boolean,
  ): string {
    let label = `${PHASE_SLOT_LABELS[slot]} phase`;
    if (current) label += ", current";
    if (available) label += ", available";
    return label;
  }

  function activate(slot: PhaseSlot): void {
    if (disabled || spec === null) return;
    const choice = choices.get(slot);
    if (choice === undefined) return;
    oninteraction({ type: "chooseChoice", choiceId: choice.id, key: spec.key });
  }
</script>

<div
  class="field-phase-strip"
  class:is-continuous={!extraMonsterZones}
  data-cy="field-phase-strip"
  role="group"
  aria-label="Duel phases"
  data-current-phase={currentSlot ?? undefined}
  data-extra-monster-zones={extraMonsterZones ? "true" : "false"}
  style={phaseStyle}
>
  <div
    class="field-phase-strip__group field-phase-strip__group--left"
    data-cy="field-phase-strip-left"
  >
    {#each PHASE_SLOTS_LEFT as slot (slot)}
      {@const available = !disabled && choices.has(slot)}
      {@const current = slot === currentSlot}
      <svelte:element
        this={available ? "button" : "span"}
        type={available ? "button" : undefined}
        class="field-phase-chip"
        class:is-current={current}
        class:is-available={available}
        role={available ? undefined : "presentation"}
        aria-label={ariaLabel(slot, current, available)}
        data-cy={`field-phase-chip-${slot}`}
        onclick={available ? () => activate(slot) : undefined}
      >
        {PHASE_SLOT_LABELS[slot]}
      </svelte:element>
    {/each}
  </div>
  <div
    class="field-phase-strip__group field-phase-strip__group--right"
    data-cy="field-phase-strip-right"
  >
    {#each PHASE_SLOTS_RIGHT as slot (slot)}
      {@const available = !disabled && choices.has(slot)}
      {@const current = slot === currentSlot}
      <svelte:element
        this={available ? "button" : "span"}
        type={available ? "button" : undefined}
        class="field-phase-chip"
        class:is-current={current}
        class:is-available={available}
        role={available ? undefined : "presentation"}
        aria-label={ariaLabel(slot, current, available)}
        data-cy={`field-phase-chip-${slot}`}
        onclick={available ? () => activate(slot) : undefined}
      >
        {PHASE_SLOT_LABELS[slot]}
      </svelte:element>
    {/each}
  </div>
  <div class="field-phase-strip__end" data-cy="field-phase-strip-end">
    <EndTurnButton {spec} {disabled} {oninteraction} />
  </div>
</div>

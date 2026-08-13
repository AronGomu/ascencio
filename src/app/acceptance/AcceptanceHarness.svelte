<script lang="ts">
  import DuelField from "../components/DuelField.svelte";
  import { acceptanceScenarioId } from "./acceptance-scenario.ts";
  import { fullHeightFieldScenario } from "./full-height-field-scenarios.ts";

  const scenarioId = acceptanceScenarioId(window.location.search);
  const scenario =
    scenarioId === null ? null : fullHeightFieldScenario(scenarioId);
  let fieldSlot: HTMLElement | null = null;
</script>

{#if scenario === null}
  <main data-cy="acceptance-scenario-error">
    Unsupported or missing acceptance scenario.
  </main>
{:else}
  <main
    class="duel-shell"
    data-cy="acceptance-scenario"
    data-acceptance-scenario={scenario.id}
    data-extra-monster-zones={scenario.extraMonsterZones}
    data-zone-count={scenario.board.zones.length}
  >
    <aside data-cy="acceptance-preview"></aside>
    <div class="duel-field-slot" data-cy="acceptance-field-slot" bind:this={fieldSlot}>
      <DuelField
        board={scenario.board}
        layoutBoundaryElement={fieldSlot}
        spec={scenario.phaseSpec}
        phase="main1"
      />
    </div>
    <aside data-cy="acceptance-rail"></aside>
  </main>
{/if}

<script lang="ts">
  import DuelField from "../components/DuelField.svelte";
  import { acceptanceScenarioId } from "./acceptance-scenario.ts";
  import { fullHeightFieldScenario } from "./full-height-field-scenarios.ts";

  const scenarioId = acceptanceScenarioId(window.location.search);
  const scenario =
    scenarioId === null ? null : fullHeightFieldScenario(scenarioId);
</script>

{#if scenario === null}
  <main data-cy="acceptance-scenario-error">
    Unsupported or missing acceptance scenario.
  </main>
{:else}
  <main
    data-cy="acceptance-scenario"
    data-acceptance-scenario={scenario.id}
    data-extra-monster-zones={scenario.extraMonsterZones}
    data-zone-count={scenario.board.zones.length}
  >
    <DuelField board={scenario.board} />
  </main>
{/if}

<style>
  main[data-cy="acceptance-scenario"] {
    min-height: 100svh;
  }
</style>

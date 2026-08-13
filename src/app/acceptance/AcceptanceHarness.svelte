<script lang="ts">
  import CardPreviewPanel from "../components/CardPreviewPanel.svelte";
  import DuelField from "../components/DuelField.svelte";
  import { cardCode } from "../../duel/contracts/ids.ts";
  import { acceptanceScenarioId } from "./acceptance-scenario.ts";
  import { fullHeightFieldScenario } from "./full-height-field-scenarios.ts";

  const scenarioId = acceptanceScenarioId(window.location.search);
  const previewScenario =
    scenarioId === "preview-short" || scenarioId === "preview-long";
  const scenario =
    scenarioId === null || previewScenario
      ? null
      : fullHeightFieldScenario(scenarioId);
  const previewDescription =
    scenarioId === "preview-long"
      ? Array.from(
          { length: 24 },
          (_, index) =>
            `Effect paragraph ${index + 1}. This card text remains inside the preview panel while native scrolling stays available.`,
        ).join("\n\n")
      : "Short effect text.";
  let fieldSlot: HTMLElement | null = null;
</script>

{#if previewScenario}
  <main class="duel-shell" data-cy="acceptance-preview-scenario">
    <CardPreviewPanel
      preview={{
        code: cardCode(97590747),
        name: "The Legendary Fisherman",
        description: previewDescription,
      }}
    />
    <div class="duel-field-slot" data-cy="acceptance-preview-field"></div>
    <aside data-cy="acceptance-preview-rail"></aside>
  </main>
{:else if scenario === null}
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

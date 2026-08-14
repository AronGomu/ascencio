<script lang="ts">
  import CardPreviewPanel from "../components/CardPreviewPanel.svelte";
  import DuelField from "../components/DuelField.svelte";
  import ZoneListDialog from "../components/duel-field/ZoneListDialog.svelte";
  import { cardCode } from "../../duel/contracts/ids.ts";
  import { acceptanceScenarioId } from "./acceptance-scenario.ts";
  import { fullHeightFieldScenario } from "./full-height-field-scenarios.ts";
  import { createPersistedUiStore } from "../stores/persisted-ui-store.ts";
  import { cardListAcceptanceScenario } from "./card-list-dialog-scenarios.ts";

  const persistedUi = createPersistedUiStore();
  const scenarioId = acceptanceScenarioId(window.location.search);
  const previewScenario =
    scenarioId === "preview-short" || scenarioId === "preview-long";
  const cardListScenario = scenarioId?.startsWith("card-list-") ?? false;
  const scenario =
    scenarioId === null || previewScenario || cardListScenario
      ? null
      : fullHeightFieldScenario(scenarioId);
  const cardList =
    cardListScenario && scenarioId !== null
      ? cardListAcceptanceScenario(scenarioId)
      : null;
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

{#if cardList !== null}
  <main
    class="acceptance-card-list-field"
    bind:this={fieldSlot}
    data-cy="acceptance-card-list-scenario"
  >
    <ZoneListDialog
      stack={cardList.stack}
      entries={cardList.entries}
      choices={cardList.choices}
      mode={cardList.mode ?? "browse"}
      targetEntries={cardList.targetEntries ?? []}
      minimum={cardList.minimum ?? 0}
      maximum={cardList.maximum ?? 0}
      cancelable={cardList.cancelable ?? false}
      boundaryElement={fieldSlot}
      cardBackUrl="/card-back.svg"
    />
  </main>
{:else if previewScenario}
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
    <div
      class="duel-field-slot"
      data-cy="acceptance-field-slot"
      bind:this={fieldSlot}
    >
      <DuelField
        board={scenario.board}
        layoutBoundaryElement={fieldSlot}
        spec={scenario.phaseSpec}
        phase="main1"
        showZoneOutlines={$persistedUi.settings.showZoneOutlines}
        showZoneCounts={$persistedUi.settings.showZoneCounts}
      />
    </div>
    <aside data-cy="acceptance-rail"></aside>
  </main>
{/if}

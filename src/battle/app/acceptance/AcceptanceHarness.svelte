<script lang="ts">
  import { CardPreviewPanel } from "../../../shell/index.ts";
  import DuelField from "../components/DuelField.svelte";
  import PhaseBar from "../components/PhaseBar.svelte";
  import ZoneListDialog from "../components/duel-field/ZoneListDialog.svelte";
  import { cardCode, type ChoiceId } from "../../duel/contracts/ids.ts";
  import type { InteractionChoice } from "../prompts/interaction-spec.ts";
  import type { ZoneListEntry } from "../../field/zone-list.ts";
  import { acceptanceScenarioId } from "./acceptance-scenario.ts";
  import { fullHeightFieldScenario } from "./full-height-field-scenarios.ts";
  import { createPersistedUiStore } from "../stores/persisted-ui-store.ts";
  import { cardListAcceptanceScenario } from "./card-list-dialog-scenarios.ts";

  const persistedUi = createPersistedUiStore();
  const acceptanceCardBackUrl = `${import.meta.env.BASE_URL}card-back.svg`;
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
  let selectedChoiceIds: readonly ChoiceId[] =
    cardList?.initialSelectedChoiceIds ?? [];
  let collapsed = false;
  let lastAction = "";
  let previewEntryId = "";
  let confirmCount = 0;
  let cancelCount = 0;
  let closeCount = 0;
  let positionChangeCount = 0;

  function chooseBrowse(choice: InteractionChoice): void {
    lastAction = choice.id;
  }

  function toggleTargetChoice(choice: InteractionChoice): void {
    selectedChoiceIds = selectedChoiceIds.includes(choice.id)
      ? selectedChoiceIds.filter((id) => id !== choice.id)
      : [...selectedChoiceIds, choice.id];
  }

  function previewEntry(entry: ZoneListEntry): void {
    previewEntryId = entry.id;
  }
</script>

{#if cardList !== null}
  <main
    class="acceptance-card-list-field"
    bind:this={fieldSlot}
    data-selected-choice-ids={selectedChoiceIds.join(",")}
    data-last-action={lastAction}
    data-preview-entry-id={previewEntryId}
    data-confirm-count={confirmCount}
    data-cancel-count={cancelCount}
    data-close-count={closeCount}
    data-position-change-count={positionChangeCount}
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
      confirmValid={cardList.confirmValid ?? false}
      cancelable={cardList.cancelable ?? false}
      {selectedChoiceIds}
      boundaryElement={fieldSlot}
      cardBackUrl={acceptanceCardBackUrl}
      onchoose={chooseBrowse}
      ontargetchoice={toggleTargetChoice}
      onconfirm={() => (confirmCount += 1)}
      oncancel={() => (cancelCount += 1)}
      {collapsed}
      oncollapsedchange={(value) => (collapsed = value)}
      onclose={() => (closeCount += 1)}
      onpreview={previewEntry}
      onwindowpositionchange={() => (positionChangeCount += 1)}
    />
  </main>
{:else if previewScenario}
  <main class="duel-shell" data-cy="acceptance-preview-scenario">
    <CardPreviewPanel
      preview={{
        code: cardCode(97590747),
        name: "The Legendary Fisherman",
        description: previewDescription,
        statsLine: null,
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
        showZoneOutlines={$persistedUi.settings.showZoneOutlines}
        showZoneCounts={$persistedUi.settings.showZoneCounts}
      />
    </div>
    <PhaseBar phase="main1" spec={scenario.phaseSpec} />
    <aside data-cy="acceptance-rail"></aside>
  </main>
{/if}

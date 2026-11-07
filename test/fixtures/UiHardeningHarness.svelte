<script lang="ts">
  import SettingsDialog from "../../src/battle/app/components/SettingsDialog.svelte";
  import PromptDialog from "../../src/battle/app/components/PromptDialog.svelte";
  import FieldBoard from "../../src/battle/app/components/duel-field/FieldBoard.svelte";
  import DuelFieldErrorBoundary from "../../src/battle/app/components/duel-field/DuelFieldErrorBoundary.svelte";
  import { promptSurface } from "../../src/battle/app/prompts/prompt-surface.ts";
  import { createInteractionSession } from "../../src/battle/app/prompts/interaction-session.ts";
  import type { PlayerPrompt } from "../../src/battle/duel/contracts/player-prompt.ts";
  import ShopCardListScreen from "../../src/story/shop/ShopCardListScreen.svelte";
  import { DEFAULT_UI_SETTINGS } from "../../src/battle/app/stores/ui-settings-store.ts";
  import { mapSnapshotToBoard } from "../../src/battle/field/board-view-model.ts";
  import { createFieldRenderLayout } from "../../src/battle/field/duel-field-geometry.ts";
  import { mapPromptToInteractionSpec } from "../../src/battle/app/prompts/interaction-spec.ts";
  import { choiceId, promptId } from "../../src/battle/duel/contracts/ids.ts";
  import {
    RICH_PUBLIC_DUEL_STATE,
    PUBLIC_STATE_CARD_TEXTS,
  } from "./board-public-states.ts";

  const mode = new URLSearchParams(location.search).get("mode");
  const portaled = new URLSearchParams(location.search).has("portal");
  const dynamic = new URLSearchParams(location.search).has("dynamic");
  const diagnostics = new URLSearchParams(location.search).has("diagnostics");
  let diagnosticPending = false;
  const mapped = mapSnapshotToBoard(
    RICH_PUBLIC_DUEL_STATE,
    PUBLIC_STATE_CARD_TEXTS,
  );
  if (!mapped.ok) throw new Error("Fixture mapping failed");
  const board = mapped.value;
  const host = board.cards.find((card) => card.instanceId === "rich-host")!;
  const fieldPrompt: PlayerPrompt = {
    id: promptId("shadow-actions"),
    kind: "idleCommand",
    player: 0,
    title: "Choose action",
    choices: [
      {
        id: choiceId("host-action"),
        label: "Activate",
        action: "activate",
        card: {
          instanceId: host.instanceId!,
          controller: 0,
          location: "monster",
          sequence: 0,
        },
      },
    ],
    minimum: 1,
    maximum: 1,
    ordered: false,
    cancelable: false,
  };
  const spec = mapPromptToInteractionSpec(
    fieldPrompt,
    RICH_PUBLIC_DUEL_STATE,
    board,
    { workerGeneration: 1, sessionGeneration: 1 },
  );
  let state = mode === "settings" ? "legal" : "ordinary";
  let settings = { ...DEFAULT_UI_SETTINGS };
  let open = false;
  let actions = 0;
  let purchases = 0;
  let workspaceVisited = false;
  let fieldFailed = false;
  let retryField: (() => void) | null = null;
  $: surface = promptSurface(
    fieldPrompt,
    spec,
    settings.showWorkspace,
    !fieldFailed,
  );
  const noop = () => undefined;
</script>

<div class:shell-region--duel={portaled}>
  <button data-cy="underlying-action" onclick={() => actions++}
    >Underlying action {actions}</button
  >
  <button data-cy="open-settings" onclick={() => (open = true)}>Settings</button
  >
  {#if mode === "shop"}
    <ShopCardListScreen
      dp={0}
      onbuysingle={() => purchases++}
      cards={[
        {
          key: "first",
          code: 1,
          name: "First card",
          description: "First effect",
          imageUrl: null,
          rarity: "common",
          priceDp: 40,
        },
        {
          key: "second",
          code: 2,
          name: "Second card",
          description: "Second effect",
          imageUrl: null,
          rarity: "rare",
          priceDp: 100,
        },
      ]}
    />
    <output data-cy="purchases">{purchases}</output>
  {:else if mode === "field-failure" && spec.kind !== "inactive"}
    <DuelFieldErrorBoundary
      {board}
      cardBackUrl=""
      placeholderUrl=""
      prompt={fieldPrompt}
      {spec}
      session={createInteractionSession(spec)}
      pending={false}
      injectFailure={true}
      onfailurechange={(failed, retry) => {
        fieldFailed = failed;
        retryField = retry ?? null;
      }}
      oninteraction={() => actions++}
    />
    {#if surface === "dialog"}
      <PromptDialog
        prompt={fieldPrompt}
        onsubmit={() => actions++}
        onretryfield={retryField}
      />
    {/if}
  {:else}
    <button data-cy="ordinary" onclick={() => (state = "ordinary")}
      >Ordinary</button
    >
    <button data-cy="legal" onclick={() => (state = "legal")}>Legal</button>
    <button data-cy="selected" onclick={() => (state = "selected")}
      >Selected</button
    >
    <div style="position:relative;width:1280px;height:720px">
      <FieldBoard
        {board}
        renderLayout={createFieldRenderLayout(true, 1280, 720)}
        planeHeight={720}
        planeTransform=""
        cardBackUrl=""
        placeholderUrl=""
        oncardactivate={() => actions++}
        showCardShadows={settings.showCardShadows}
        spec={state === "legal" && spec.kind !== "inactive" ? spec : null}
        selectedTargets={new Set(state === "selected" ? [host.targetId] : [])}
      />
    </div>
  {/if}
  {#if dynamic && workspaceVisited}
    {#if settings.showWorkspace}
      <button data-cy="workspace-action" onclick={() => actions++}
        >Workspace action</button
      >
    {:else}
      <PromptDialog
        prompt={{
          id: promptId("dynamic-prompt"),
          kind: "yesNo",
          player: 0,
          title: "Dynamic prompt",
          choices: [
            { id: choiceId("dynamic-yes"), label: "Yes", action: "yes" },
            { id: choiceId("dynamic-no"), label: "No", action: "no" },
          ],
          minimum: 1,
          maximum: 1,
          ordered: false,
          cancelable: false,
        }}
        onsubmit={() => actions++}
      />
    {/if}
  {/if}
  {#if open}
    <SettingsDialog
      {settings}
      onshowduelhud={noop}
      onshowworkspace={(value) => {
        settings = { ...settings, showWorkspace: value };
        workspaceVisited = true;
      }}
      onautoplacecards={noop}
      onautoresolvetrivialprompts={noop}
      onshowzoneoutlines={noop}
      onshowzonecounts={noop}
      onshowzonelabels={noop}
      onshowcardshadows={(value) =>
        (settings = { ...settings, showCardShadows: value })}
      onreset={noop}
      ondownloaddiagnostics={diagnostics && !diagnosticPending
        ? () => (diagnosticPending = true)
        : null}
      onclose={() => (open = false)}
    />
  {/if}
</div>

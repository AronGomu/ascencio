<script lang="ts">
  import { afterUpdate, onMount } from "svelte";
  import { PROLOGUE } from "./content/prologue.ts";
  import {
    createInitialStoryState,
    type ChoiceId,
    type LocationId,
    type StoryScreen,
    type StoryState,
  } from "./model/story-state.ts";
  import { reduceStory } from "./model/story-reducer.ts";
  import HistoryOverlay from "./overlays/HistoryOverlay.svelte";
  import LoadOverlay from "./overlays/LoadOverlay.svelte";
  import PauseOverlay from "./overlays/PauseOverlay.svelte";
  import SaveLoadOverlay from "./overlays/SaveLoadOverlay.svelte";
  import SettingsOverlay from "./overlays/SettingsOverlay.svelte";
  import BattleHandoffScreen from "./screens/BattleHandoffScreen.svelte";
  import IllustratedMapScreen from "./screens/IllustratedMapScreen.svelte";
  import LoadScreen from "./screens/LoadScreen.svelte";
  import NarrativeScreen from "./screens/NarrativeScreen.svelte";
  import OutcomeScreen from "./screens/OutcomeScreen.svelte";
  import PreBattleScreen from "./screens/PreBattleScreen.svelte";
  import RewardScreen from "./screens/RewardScreen.svelte";
  import TitleScreen from "./screens/TitleScreen.svelte";
  import {
    loadStorySlots,
    resetStoryStorage,
    saveStoryState,
  } from "./storage/story-storage.ts";
  /* Scoped to `.story-app`, so it travels with the component instead of
     leaking into the duel and deck editor the shell mounts beside it. */
  import "./styles.css";

  type Overlay = "history" | "settings" | "pause" | "save" | "load" | null;
  let state = createInitialStoryState();
  let manualState: StoryState | null = null;
  let autosaveState: StoryState | null = null;
  let latestSaveSlot: "manual" | "autosave" | null = null;
  let storageOperationError: string | null = null;
  let overlay: Overlay = null;
  let overlayTrigger: HTMLElement | null = null;
  let saveMode: "idle" | "saving" | "success" | "overwrite" | "failure" =
    "idle";
  let autosaveStatus: "idle" | "success" | "failure" = "idle";
  let dirty = false;
  let inputId = 0;
  let previousScreen: StoryScreen = state.screen;
  let root: HTMLElement;

  onMount(() => {
    const loaded = loadStorySlots();
    if (loaded.ok) {
      manualState = loaded.slots.manual;
      autosaveState = loaded.slots.autosave;
      latestSaveSlot = loaded.slots.latest;
      if (manualState !== null || autosaveState !== null)
        state = { ...state, progressExists: true };
    } else storageOperationError = loaded.message;
  });

  afterUpdate(() => {
    if (state.screen === previousScreen) return;
    previousScreen = state.screen;
    queueMicrotask(() => {
      /* Scoped to this domain's own root: the shell mounts other domains in
         the same document, so a document-wide `h1` lookup could steal focus
         into one of them. */
      const heading = root?.querySelector<HTMLElement>("h1");
      if (heading !== null && heading !== undefined) {
        heading.tabIndex = -1;
        heading.focus();
      }
    });
  });

  $: beat =
    PROLOGUE.beats[Math.min(state.narrativeIndex, PROLOGUE.beats.length - 1)]!;
  $: activeChoices =
    state.narrativeIndex === 13 && state.choice === null
      ? PROLOGUE.choices
      : [];
  $: historyEntries = PROLOGUE.beats
    .slice(0, state.narrativeIndex + 1)
    .map(({ speaker, text }) => ({ speaker, text }));

  function go(screen: StoryScreen): void {
    state = { ...state, screen };
    overlay = null;
  }
  function dispatch(command: Parameters<typeof reduceStory>[1]): void {
    const next = reduceStory(state, command);
    if (next !== state && !["continue", "load", "reset"].includes(command.type))
      dirty = true;
    state = next;
  }
  function newGame(): void {
    dispatch({ type: "new-game" });
  }
  function resumeSnapshot(snapshot: StoryState): void {
    state = { ...snapshot, screen: snapshot.savedScreen };
    inputId = snapshot.lastInputId ?? 0;
    dirty = false;
  }
  function continueGame(): void {
    const snapshot =
      latestSaveSlot === "manual"
        ? manualState
        : latestSaveSlot === "autosave"
          ? autosaveState
          : (autosaveState ?? manualState);
    if (snapshot !== null) resumeSnapshot(snapshot);
    else dispatch({ type: "continue" });
  }
  function loadSlot(slot: "manual" | "autosave"): void {
    const snapshot = slot === "manual" ? manualState : autosaveState;
    if (snapshot !== null) resumeSnapshot(snapshot);
    else {
      state = reduceStory(state, { type: "load", slot });
      dirty = false;
    }
  }
  function deleteManualSave(): boolean {
    const result = resetStoryStorage(undefined, "manual");
    if (!result.ok) {
      storageOperationError = `Delete failed: ${result.message}`;
      return false;
    }
    manualState = null;
    if (latestSaveSlot === "manual")
      latestSaveSlot = autosaveState === null ? null : "autosave";
    state = {
      ...state,
      progressExists: autosaveState !== null,
    };
    return true;
  }
  function advance(): void {
    if (state.narrativeIndex >= PROLOGUE.beats.length - 1) {
      dispatch({ type: "go-to-map" });
      return;
    }
    inputId += 1;
    dispatch({ type: "advance", inputId });
  }
  function choose(choice: ChoiceId): void {
    dispatch({ type: "choose", choice });
  }
  function openOverlay(
    value: Overlay,
    event?: Event,
    preserveTrigger = false,
  ): void {
    if (!preserveTrigger)
      overlayTrigger =
        event?.currentTarget instanceof HTMLElement
          ? event.currentTarget
          : document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
    saveMode =
      value === "save"
        ? state.progressExists
          ? "overwrite"
          : "idle"
        : saveMode;
    overlay = value;
  }
  function closeOverlay(): void {
    overlay = null;
  }
  function retryStorageAccess(): boolean {
    const loaded = loadStorySlots();
    if (!loaded.ok) {
      storageOperationError = loaded.message;
      return false;
    }
    manualState = loaded.slots.manual;
    autosaveState = loaded.slots.autosave;
    latestSaveSlot = loaded.slots.latest;
    storageOperationError = null;
    state = {
      ...state,
      progressExists:
        manualState !== null || autosaveState !== null || state.progressExists,
    };
    return true;
  }
  function manualSave(): void {
    if (storageOperationError !== null) {
      saveMode = "failure";
      return;
    }
    const snapshot = { ...state, savedScreen: state.screen };
    const result = saveStoryState(snapshot, undefined, "manual");
    saveMode = result.ok ? "success" : "failure";
    if (result.ok) {
      manualState = snapshot;
      latestSaveSlot = "manual";
      dirty = false;
    } else storageOperationError = result.message;
  }
  function retryManualSave(): void {
    if (storageOperationError !== null && !retryStorageAccess()) return;
    manualSave();
  }
  function autosaveReward(): void {
    if (storageOperationError !== null) {
      autosaveStatus = "failure";
      return;
    }
    const snapshot = { ...state, savedScreen: "reward" as const };
    const result = saveStoryState(snapshot, undefined, "autosave");
    autosaveStatus = result.ok ? "success" : "failure";
    if (result.ok) {
      autosaveState = snapshot;
      latestSaveSlot = "autosave";
      dirty = false;
    } else storageOperationError = result.message;
  }
  function retryAutosave(): void {
    if (storageOperationError !== null && !retryStorageAccess()) return;
    autosaveReward();
  }
  function continueOutcome(): void {
    dispatch({ type: "continue-outcome" });
    if (state.screen === "reward") autosaveReward();
  }
  function acknowledgeReward(): void {
    dispatch({ type: "acknowledge-reward" });
  }
  function reset(): void {
    const result = resetStoryStorage();
    if (!result.ok) {
      storageOperationError = `Reset failed: ${result.message}`;
      return;
    }
    state = createInitialStoryState();
    manualState = null;
    autosaveState = null;
    latestSaveSlot = null;
    storageOperationError = null;
    dirty = false;
    autosaveStatus = "idle";
    saveMode = "idle";
    overlay = null;
  }
  function recoverOutcome(action: "retry" | "return"): void {
    state = {
      ...state,
      screen: action === "retry" ? "battle-mock" : "map",
      outcome: null,
      outcomeScene: null,
    };
  }
</script>

<div class="story-app" bind:this={root}>
  {#if storageOperationError}
    <section
      class="storage-error"
      role="alert"
      aria-labelledby="storage-error-heading"
    >
      <div>
        <h2 id="storage-error-heading">Prototype storage needs attention</h2>
        <p>{storageOperationError}</p>
      </div>
      <button
        type="button"
        class="secondary"
        onclick={() => void retryStorageAccess()}>Retry storage</button
      >
      <button type="button" class="secondary" onclick={reset}
        >Reset prototype storage</button
      >
    </section>
  {/if}
  {#if state.screen === "title"}
    <TitleScreen
      hasProgress={state.progressExists}
      onnewgame={newGame}
      oncontinue={continueGame}
      onload={() => go("load")}
      onsettings={() => openOverlay("settings")}
    />
  {:else if state.screen === "load"}
    <LoadScreen
      onload={loadSlot}
      ondelete={deleteManualSave}
      onback={() => go("title")}
    />
  {:else if state.screen === "narrative"}
    <NarrativeScreen
      {beat}
      narrativeIndex={state.narrativeIndex}
      choices={activeChoices}
      selectedChoice={state.choice}
      choiceResponse={state.narrativeIndex === 13 ? state.choiceResponse : null}
      onadvance={advance}
      onchoose={choose}
      onutility={(utility) =>
        openOverlay(utility === "pause" ? "pause" : utility)}
    />
  {:else if state.screen === "map"}
    <IllustratedMapScreen
      locations={state.locations}
      objective={state.objective}
      choiceAcknowledgment={state.laterAcknowledgment}
      allowBack={!state.rewardAcknowledged}
      onselect={(locationId: LocationId) =>
        dispatch({ type: "select-location", locationId })}
      onback={() => go("narrative")}
    />
    {#if state.rewardAcknowledged}<section
        class="completion-panel"
        aria-label="Progression complete"
      >
        <p>
          <strong>Updated map:</strong> Old Arena completed. Archive available.
        </p>
        <button type="button" onclick={() => openOverlay("save")}
          >Save progress</button
        ><button type="button" class="secondary" onclick={() => go("end")}
          >End prototype</button
        >
      </section>{/if}
  {:else if state.screen === "pre-battle"}
    <PreBattleScreen
      allowReturn={true}
      onstart={() => dispatch({ type: "start-battle" })}
      onreturn={() => go("map")}
    />
  {:else if state.screen === "battle-mock"}
    <BattleHandoffScreen
      onresult={(result) => dispatch({ type: "battle-result", result })}
      onretry={() => recoverOutcome("retry")}
      onreturn={() => recoverOutcome("return")}
    />
  {:else if state.screen === "outcome"}
    <OutcomeScreen
      outcome={state.outcome ?? "win"}
      oncontinue={continueOutcome}
      onretry={() => recoverOutcome("retry")}
      onreturn={() => recoverOutcome("return")}
    />
  {:else if state.screen === "reward"}
    <RewardScreen
      {autosaveStatus}
      onretry={retryAutosave}
      oncontinue={acknowledgeReward}
    />
  {:else}
    <main class="end-screen">
      <p class="eyebrow">End of the prologue</p>
      <h1>Prototype complete</h1>
      <p>
        The authored prologue stops here. Later chapters continue from the
        updated map.
      </p>
      <div>
        <button type="button" onclick={reset}>Replay from the title</button
        ><button type="button" class="secondary" onclick={() => go("map")}
          >Return to the updated map</button
        >
      </div>
    </main>
  {/if}

  {#if state.screen !== "title" && state.screen !== "load" && state.screen !== "end"}
    <button
      type="button"
      class="global-pause secondary"
      onclick={(event) => openOverlay("pause", event)}>Open pause menu</button
    >
  {/if}

  {#if overlay === "history"}<HistoryOverlay
      entries={historyEntries}
      onclose={closeOverlay}
      restoreFocusTo={overlayTrigger}
    />
  {:else if overlay === "settings"}<SettingsOverlay
      onclose={closeOverlay}
      restoreFocusTo={overlayTrigger}
    />
  {:else if overlay === "pause"}<PauseOverlay
      unsaved={dirty}
      onclose={closeOverlay}
      restoreFocusTo={overlayTrigger}
      onaction={(action) => {
        if (action === "resume") closeOverlay();
        else if (action === "title") go("title");
        else if (action === "settings")
          openOverlay("settings", undefined, true);
        else openOverlay(action, undefined, true);
      }}
    />
  {:else if overlay === "save"}<SaveLoadOverlay
      mode={saveMode}
      onclose={closeOverlay}
      onsave={manualSave}
      onretry={retryManualSave}
      oncontinue={closeOverlay}
      restoreFocusTo={overlayTrigger}
    />
  {:else if overlay === "load"}<LoadOverlay
      onload={(slot) => {
        loadSlot(slot);
        closeOverlay();
      }}
      ondelete={deleteManualSave}
      onclose={closeOverlay}
      restoreFocusTo={overlayTrigger}
    />{/if}
</div>

<style>
  /* The shell gives the story a fixed-size region inside the 16:9 stage, so
     the domain root fills that box rather than the viewport. */
  .story-app {
    min-height: 100%;
  }
  .storage-error {
    position: fixed;
    z-index: 45;
    top: max(0.5rem, env(safe-area-inset-top));
    left: 50%;
    width: min(48rem, calc(100% - 1rem));
    transform: translateX(-50%);
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.6rem;
    padding: 0.75rem;
    border: 2px solid #ff9ba5;
    border-radius: 0.5rem;
    background: #35151df2;
  }
  .storage-error div {
    flex: 1 1 16rem;
  }
  .storage-error h2,
  .storage-error p {
    margin: 0.2rem;
  }
  .global-pause {
    position: fixed;
    z-index: 25;
    left: max(0.5rem, env(safe-area-inset-left));
    top: max(0.5rem, env(safe-area-inset-top));
    background: #07111ddd;
  }
  .completion-panel {
    position: fixed;
    z-index: 10;
    left: 50%;
    bottom: max(1rem, env(safe-area-inset-bottom));
    width: min(40rem, calc(100% - 2rem));
    transform: translateX(-50%);
    padding: 1rem;
    border: 1px solid var(--story-accent);
    border-radius: 0.6rem;
    background: #07111ff2;
    box-shadow: 0 1rem 3rem #000b;
  }
  .completion-panel button {
    margin-right: 0.5rem;
  }
  .end-screen {
    min-height: 100%;
    display: grid;
    place-content: center;
    justify-items: start;
    gap: 1rem;
    padding: clamp(1rem, 8vw, 7rem);
    background:
      radial-gradient(circle at 60% 30%, #28586a, transparent 30%), #07111f;
  }
  .end-screen p {
    max-width: 50ch;
    line-height: 1.6;
  }
  .end-screen div {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem;
  }
</style>

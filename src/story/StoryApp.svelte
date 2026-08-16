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
  import {
    ENCOUNTER_LABELS,
    restoreStoryState,
    storyBattleResult,
    type StoryDuelResolution,
    type StoryEncounterRequest,
    type StoryHandoffOutcome,
  } from "./handoff/story-handoff.ts";
  import HistoryOverlay from "./overlays/HistoryOverlay.svelte";
  import LoadOverlay from "./overlays/LoadOverlay.svelte";
  import PauseOverlay from "./overlays/PauseOverlay.svelte";
  import SaveLoadOverlay from "./overlays/SaveLoadOverlay.svelte";
  import SettingsOverlay from "./overlays/SettingsOverlay.svelte";
  import GearIcon from "./components/icons/GearIcon.svelte";
  import BattleHandoffScreen from "./screens/BattleHandoffScreen.svelte";
  import IllustratedMapScreen from "./screens/IllustratedMapScreen.svelte";
  import LoadScreen from "./screens/LoadScreen.svelte";
  import NarrativeScreen from "./screens/NarrativeScreen.svelte";
  import OutcomeScreen from "./screens/OutcomeScreen.svelte";
  import PreBattleScreen from "./screens/PreBattleScreen.svelte";
  import RewardScreen from "./screens/RewardScreen.svelte";
  import TitleScreen from "./screens/TitleScreen.svelte";
  import {
    STORY_SLOT_KEYS,
    type StorySaveReadResult,
    type StorySaveWriteResult,
    type StorySlotKey,
  } from "./saves/story-save-contracts.ts";
  import { createStorySaveRepository } from "./saves/story-save-repository.ts";
  /* Scoped to `.story-app`, so it travels with the component instead of
     leaking into the duel and deck editor the shell mounts beside it. */
  import "./styles.css";

  type Overlay = "history" | "settings" | "pause" | "save" | "load" | null;

  /* The duel handoff, in three props. The story asks for an encounter and is
     told whether it started; it is unmounted while the duel runs, so what
     comes back arrives as the checkpointed state plus one resolution. */
  export let onencounter: (
    request: StoryEncounterRequest,
  ) => Promise<StoryHandoffOutcome> = () =>
    Promise.resolve("checkpoint-failed" as const);
  export let resumeState: StoryState | null = null;
  export let resolution: StoryDuelResolution | null = null;
  /* Told once the handback has been adopted, so a later remount of this
     domain does not replay an outcome the player already read. */
  export let onhandled: () => void = () => undefined;

  const CHECKPOINT_FAILED =
    "Your progress could not be saved, so the duel was not started. Free some storage and try again.";
  const HANDOFF_INTERRUPTED =
    "The duel was interrupted before it started. Try again or return to the map.";

  /* The overlays expose one manual slot and the autosave stream; the store
     carries three manual slots and the pre-duel checkpoint for the duel
     handoff, which writes them without going through this screen. */
  const MANUAL_SLOT: StorySlotKey = "manual:1";
  const AUTOSAVE_SLOT: StorySlotKey = "autosave";
  const saves = createStorySaveRepository(globalThis.indexedDB);

  let state =
    resumeState === null
      ? createInitialStoryState()
      : restoreStoryState(resumeState);
  /* A restored checkpoint with no result to apply is a handoff that never
     produced one — a duel that was never mounted, or a session route that
     resolved to nothing. It lands here with a retry rather than on a screen
     waiting for a duel nobody is running. */
  let handoffError: string | null =
    resumeState !== null &&
    resumeState.screen === "battle-mock" &&
    resolution === null
      ? HANDOFF_INTERRUPTED
      : null;
  let appliedResolution: StoryDuelResolution | null = null;
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
    if (resumeState !== null || resolution !== null) onhandled();
    /* Safe to call on every mount: reading never writes, and a slot this build
       cannot parse resolves to "no save" rather than a thrown mount. */
    void hydrate();
  });

  /** Re-reads both player-visible slots and rebuilds what the title screen
      offers. Returns whether storage answered cleanly. */
  async function hydrate(): Promise<boolean> {
    const [manual, autosave] = await Promise.all([
      saves.read(MANUAL_SLOT),
      saves.read(AUTOSAVE_SLOT),
    ]);
    manualState = manual.kind === "ready" ? manual.envelope.state : null;
    autosaveState = autosave.kind === "ready" ? autosave.envelope.state : null;
    latestSaveSlot = newerSlot(manual, autosave);
    storageOperationError = readProblem(manual) ?? readProblem(autosave);
    state = {
      ...state,
      progressExists:
        manualState !== null || autosaveState !== null || state.progressExists,
    };
    return storageOperationError === null;
  }

  /** Which slot Continue should resume, decided by when each was written so
      the store never has to keep a "latest" pointer of its own. */
  function newerSlot(
    manual: StorySaveReadResult,
    autosave: StorySaveReadResult,
  ): "manual" | "autosave" | null {
    if (manual.kind !== "ready")
      return autosave.kind === "ready" ? "autosave" : null;
    if (autosave.kind !== "ready") return "manual";
    return autosave.envelope.savedAt >= manual.envelope.savedAt
      ? "autosave"
      : "manual";
  }

  function readProblem(result: StorySaveReadResult): string | null {
    if (result.kind === "corrupt") return `${result.slot}: ${result.reason}`;
    if (result.kind === "incompatible")
      return `${result.slot}: save was written by a newer version (schema ${String(result.found)})`;
    return null;
  }

  function writeProblem(result: StorySaveWriteResult): string {
    if (result.kind === "stale")
      return `Save was changed elsewhere (revision ${String(result.currentRevision)})`;
    if (result.kind === "failed")
      return result.reason === "quota"
        ? "Storage is full"
        : result.reason === "unavailable"
          ? "Storage is unavailable"
          : "Storage write failed";
    return "";
  }

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

  $: applyResolution(resolution);
  $: encounterLabel =
    state.encounterId === null
      ? "the duel"
      : ENCOUNTER_LABELS[state.encounterId];
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
  /** Takes the one result this encounter is allowed to produce. A resolution
      already applied is ignored, so a re-render cannot advance the story a
      second time on the same duel. */
  function applyResolution(next: StoryDuelResolution | null): void {
    if (next === null || next === appliedResolution) return;
    appliedResolution = next;
    handoffError = null;
    state = reduceStory(state, {
      type: "battle-result",
      result: storyBattleResult(next),
    });
    dirty = true;
  }

  /** Asks the shell for a duel. Nothing here starts one: the answer is only
      whether the pre-duel checkpoint survived, and a checkpoint that did not
      leaves the player on this screen with the attempt still available. */
  async function beginHandoff(): Promise<void> {
    const encounterId = state.encounterId;
    if (encounterId === null) {
      handoffError = HANDOFF_INTERRUPTED;
      return;
    }
    handoffError = null;
    const outcome = await onencounter({
      encounterId,
      label: ENCOUNTER_LABELS[encounterId],
      state,
    });
    if (outcome === "checkpoint-failed") handoffError = CHECKPOINT_FAILED;
  }

  function startEncounter(): void {
    dispatch({ type: "start-battle" });
    void beginHandoff();
  }

  function retryEncounter(): void {
    state = {
      ...state,
      screen: "battle-mock",
      outcome: null,
      outcomeScene: null,
    };
    void beginHandoff();
  }

  function returnToMap(): void {
    handoffError = null;
    state = {
      ...state,
      screen: "map",
      outcome: null,
      outcomeScene: null,
      encounterId: null,
    };
  }

  function resumeSnapshot(snapshot: StoryState): void {
    state = { ...restoreStoryState(snapshot), screen: snapshot.savedScreen };
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
  async function deleteManualSave(): Promise<boolean> {
    try {
      await saves.clear(MANUAL_SLOT);
    } catch (error) {
      storageOperationError = `Delete failed: ${errorMessage(error)}`;
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
  async function retryStorageAccess(): Promise<boolean> {
    return await hydrate();
  }
  /* Both save paths overwrite unconditionally: the overlay already asked the
     player to confirm, and this screen is the only writer of these two slots.
     T19's checkpoint writes its own slot with an expected revision. */
  async function manualSave(): Promise<void> {
    if (storageOperationError !== null) {
      saveMode = "failure";
      return;
    }
    const snapshot = { ...state, savedScreen: state.screen };
    saveMode = "saving";
    const result = await saves.write(MANUAL_SLOT, snapshot, null);
    saveMode = result.kind === "written" ? "success" : "failure";
    if (result.kind === "written") {
      manualState = snapshot;
      latestSaveSlot = "manual";
      dirty = false;
    } else storageOperationError = writeProblem(result);
  }
  async function retryManualSave(): Promise<void> {
    if (storageOperationError !== null && !(await retryStorageAccess())) return;
    await manualSave();
  }
  async function autosaveReward(): Promise<void> {
    if (storageOperationError !== null) {
      autosaveStatus = "failure";
      return;
    }
    const snapshot = { ...state, savedScreen: "reward" as const };
    const result = await saves.write(AUTOSAVE_SLOT, snapshot, null);
    autosaveStatus = result.kind === "written" ? "success" : "failure";
    if (result.kind === "written") {
      autosaveState = snapshot;
      latestSaveSlot = "autosave";
      dirty = false;
    } else storageOperationError = writeProblem(result);
  }
  async function retryAutosave(): Promise<void> {
    if (storageOperationError !== null && !(await retryStorageAccess())) return;
    await autosaveReward();
  }
  function continueOutcome(): void {
    dispatch({ type: "continue-outcome" });
    if (state.screen === "reward") void autosaveReward();
  }
  function acknowledgeReward(): void {
    dispatch({ type: "acknowledge-reward" });
  }
  async function reset(): Promise<void> {
    try {
      /* Every slot, not just the two this screen writes: a reset that left the
         duel checkpoint behind would resume a duel the story no longer has. */
      await Promise.all(STORY_SLOT_KEYS.map((slot) => saves.clear(slot)));
    } catch (error) {
      storageOperationError = `Reset failed: ${errorMessage(error)}`;
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
  function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : "Storage request failed";
  }
</script>

<div class="story-app" data-cy="story-app" bind:this={root}>
  {#if storageOperationError}
    <section
      class="storage-error"
      role="alert"
      aria-labelledby="storage-error-heading"
      data-cy="story-storage-error"
    >
      <div data-cy="story-storage-error-copy">
        <h2 id="storage-error-heading" data-cy="story-storage-error-heading">
          Prototype storage needs attention
        </h2>
        <p data-cy="story-storage-error-message">{storageOperationError}</p>
      </div>
      <button
        type="button"
        class="secondary"
        data-cy="story-storage-error-retry"
        onclick={() => void retryStorageAccess()}>Retry storage</button
      >
      <button
        type="button"
        class="secondary"
        data-cy="story-storage-error-reset"
        onclick={() => void reset()}>Reset prototype storage</button
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
      onutility={(utility) => openOverlay(utility)}
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
        data-cy="story-completion-panel"
      >
        <p data-cy="story-completion-message">
          <strong data-cy="story-completion-message-label">Updated map:</strong> Old
          Arena completed. Archive available.
        </p>
        <button
          type="button"
          data-cy="story-completion-save"
          onclick={() => openOverlay("save")}>Save progress</button
        ><button
          type="button"
          class="secondary"
          data-cy="story-completion-end"
          onclick={() => go("end")}>End prototype</button
        >
      </section>{/if}
  {:else if state.screen === "pre-battle"}
    <PreBattleScreen
      allowReturn={true}
      onstart={startEncounter}
      onreturn={() => go("map")}
    />
  {:else if state.screen === "battle-mock"}
    <BattleHandoffScreen
      label={encounterLabel}
      error={handoffError}
      onretry={retryEncounter}
      onreturn={returnToMap}
    />
  {:else if state.screen === "outcome"}
    <OutcomeScreen
      outcome={state.outcome ?? "win"}
      oncontinue={continueOutcome}
      onretry={retryEncounter}
      onreturn={returnToMap}
    />
  {:else if state.screen === "reward"}
    <RewardScreen
      {autosaveStatus}
      onretry={() => void retryAutosave()}
      oncontinue={acknowledgeReward}
    />
  {:else}
    <main class="end-screen" data-cy="story-end-screen">
      <p class="eyebrow" data-cy="story-end-eyebrow">End of the prologue</p>
      <h1 data-cy="story-end-heading">Prototype complete</h1>
      <p data-cy="story-end-body">
        The authored prologue stops here. Later chapters continue from the
        updated map.
      </p>
      <div data-cy="story-end-actions">
        <button
          type="button"
          data-cy="story-end-replay"
          onclick={() => void reset()}>Replay from the title</button
        ><button
          type="button"
          class="secondary"
          data-cy="story-end-return-map"
          onclick={() => go("map")}>Return to the updated map</button
        >
      </div>
    </main>
  {/if}

  {#if state.screen !== "title" && state.screen !== "load" && state.screen !== "end" && state.screen !== "narrative"}
    <button
      type="button"
      class="global-menu secondary"
      data-cy="story-global-menu"
      aria-label="Open menu"
      onclick={(event) => openOverlay("pause", event)}
      ><GearIcon cy="story-global-menu-icon" /></button
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
      onsave={() => void manualSave()}
      onretry={() => void retryManualSave()}
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
    border: 2px solid var(--danger);
    border-radius: 0.5rem;
    background: color-mix(in srgb, var(--danger-surface) 95%, transparent);
  }
  .storage-error div {
    flex: 1 1 16rem;
  }
  .storage-error h2,
  .storage-error p {
    margin: 0.2rem;
  }
  .global-menu {
    position: fixed;
    z-index: 25;
    right: max(0.5rem, env(safe-area-inset-right));
    top: max(0.5rem, env(safe-area-inset-top));
    display: grid;
    place-items: center;
    width: 48px;
    height: 48px;
    padding: 0;
    border-radius: 50%;
    background: color-mix(in srgb, var(--bg) 87%, transparent);
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
    background: color-mix(in srgb, var(--bg) 95%, transparent);
    box-shadow: 0 1rem 3rem color-mix(in srgb, var(--shadow) 73%, transparent);
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
      radial-gradient(circle at 60% 30%, var(--field-glow), transparent 30%),
      var(--bg);
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

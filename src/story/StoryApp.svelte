<script lang="ts">
  import { afterUpdate, getContext, onDestroy, onMount } from "svelte";
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
    playbackDelayMs,
    playbackHalt,
    playbackNotice,
    type PlaybackMode,
  } from "./playback/story-playback.ts";
  import { createStoryPlaybackSettingsStore } from "./playback/story-playback-settings-store.ts";
  import {
    readStoryReadLog,
    withBeatRead,
    writeStoryReadLog,
  } from "./playback/story-read-log.ts";
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
  import { TOAST_CONTEXT_KEY, type ToastPublisher } from "../shell/index.ts";
  import SettingsOverlay from "./overlays/SettingsOverlay.svelte";
  import StoryTopBar from "./components/StoryTopBar.svelte";
  import BattleHandoffScreen from "./screens/BattleHandoffScreen.svelte";
  import IllustratedMapScreen from "./screens/IllustratedMapScreen.svelte";
  import LoadScreen from "./screens/LoadScreen.svelte";
  import NarrativeScreen from "./screens/NarrativeScreen.svelte";
  import OutcomeScreen from "./screens/OutcomeScreen.svelte";
  import PreBattleScreen from "./screens/PreBattleScreen.svelte";
  import RewardScreen from "./screens/RewardScreen.svelte";
  /* The shop's screens are not imported here: they are a chunk of their own,
     loaded when the player walks in. `./shop/shop-screens.ts` records what
     that buys. Its data modules stay static — this screen reads them itself,
     and they are a fraction of the size. */
  import {
    contentsOf,
    fetchShopSetData,
    isSetReleased,
    resolveCardRarity,
    type ShopSetData,
  } from "./shop/data/shop-set-data.ts";
  import { openablePicks, openBoosters } from "./shop/data/pack-generator.ts";
  import { singlePriceDp } from "./shop/data/shop-pricing.ts";
  import { runtimeCatalog } from "../decks/catalog/runtime-catalog.ts";
  import { catalogByCode } from "../decks/catalog/pinned-ruleset.ts";
  import type { DeckBuilderCardView } from "../decks/catalog/ocg-card-mapper.ts";
  import { encounterDeck } from "./decks/encounter-deck.ts";
  import { preBattleDeckOptions } from "./decks/pre-battle-decks.ts";
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
  /* Leaving the story for its deck editor. Reported rather than routed: the
     shell owns the URL, and a route change unmounts this domain — so the run
     has to be on disk before the shell acts on this, and a refused write must
     leave the player where they are. */
  export let ondecks: () => void = () => undefined;
  export let onmainmenu: () => void = () => {
    globalThis.location.hash = "#/";
  };

  /* Which main-menu entry sent the player here, so the shell's menu and this
     domain's title screen are not two menus in a row (ADR-051). `null` is a
     story route reached any other way — a bookmark, the address bar, a duel
     handing a settled session back — which still opens on the title.

     The union is written out rather than imported: it is the shell's
     `StoryEntryIntent` (`src/shell/shell-store.ts`), and the visual novel may
     not reach into the shell for three string literals. */
  export let storyEntryIntent: "new" | "continue" | "load" | null = null;

  const CHECKPOINT_FAILED =
    "Your progress could not be saved, so the duel was not started. Free some storage and try again.";
  const HANDOFF_INTERRUPTED =
    "The duel was interrupted before it started. Try again or return to the map.";
  const DECK_UNPLAYABLE =
    "The deck this save is set to duel with cannot be played. Return to the map and choose another, or repair it in the deck editor.";
  const CATALOG_UNAVAILABLE = "The card database could not load.";

  interface StoryHeaderConfig {
    readonly showShop: boolean;
    readonly showDecks: boolean;
    readonly title: string | null;
    readonly objective: string | null;
    readonly showSettings: boolean;
  }

  /** Keeps global story chrome derived from screen state in one place. */
  function storyHeaderConfig(
    current: StoryState,
    setName: string,
    openedCount: number,
  ): StoryHeaderConfig {
    const title =
      current.screen === "map"
        ? "City signal map"
        : current.screen === "shop-greeting" || current.screen === "shop-browse"
          ? "Card Shop"
          : current.screen === "shop-cards"
            ? setName || "Card list"
            : current.screen === "shop-sell"
              ? "Sell Cards"
              : current.screen === "shop-opening"
                ? "Opening packs"
                : current.screen === "shop-results"
                  ? `You opened ${String(openedCount)} cards`
                  : null;
    const hasStoryContext =
      current.screen !== "title" && current.screen !== "load";
    return {
      showShop: hasStoryContext && !current.screen.startsWith("shop-"),
      showDecks: hasStoryContext,
      title,
      objective: current.screen === "map" ? current.objective : null,
      showSettings: true,
    };
  }

  /* The screens that need the card database. The shop ones name, picture or
     price a card; greeting and browse list sets rather than cards, so neither
     pays for the read. The briefing needs it to decide which of the save's
     decks may be fielded, and refuses to decide without it. */
  const CATALOG_SCREENS: ReadonlySet<StoryScreen> = new Set([
    "pre-battle",
    "shop-cards",
    "shop-opening",
    "shop-results",
    "shop-sell",
  ]);

  /* The overlays expose one manual slot and the autosave stream; the store
     carries three manual slots and the pre-duel checkpoint for the duel
     handoff, which writes them without going through this screen. */
  const MANUAL_SLOT: StorySlotKey = "manual:1";
  const AUTOSAVE_SLOT: StorySlotKey = "autosave";
  const saves = createStorySaveRepository(globalThis.indexedDB);
  /* Auto and Skip read their pacing from here; the settings overlay writes
     it. Reader preferences, so they live outside the save slots. */
  const playbackSettings = createStoryPlaybackSettingsStore();

  const entryIntent = storyEntryIntent;
  let state =
    resumeState !== null
      ? restoreStoryState(resumeState)
      : entryIntent === null || entryIntent === "new"
        ? reduceStory(createInitialStoryState(), { type: "new-game" })
        : createInitialStoryState();
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
  /* Read once, at mount, for the same reason `appliedResolution` above takes a
     resolution once: the entry belongs to the click that chose it, and a later
     flush of the prop must not throw a player who has walked on back to the
     screen they came in by. */
  let manualState: StoryState | null = null;
  let autosaveState: StoryState | null = null;
  let latestSaveSlot: "manual" | "autosave" | null = null;
  let storageOperationError: string | null = null;
  let overlay: Overlay = null;
  let overlayTrigger: HTMLElement | null = null;
  let saveMode: "idle" | "saving" | "success" | "overwrite" | "failure" =
    "idle";
  let autosaveStatus: "idle" | "pending" | "success" | "failure" = "idle";
  let dirty = false;
  let inputId = 0;
  let previousScreen: StoryScreen = state.screen;
  let shopData: ShopSetData | null = null;
  let shopDataError: string | null = null;
  let shopDataLoading = false;
  /* Full views, not a name/image projection: `resolveCardRarity` infers a
     rarity from ATK/type fields when the shop data misses a code. */
  let cardViewByCode: ReadonlyMap<number, DeckBuilderCardView> = new Map();
  /* Tracked as a flag rather than as `size > 0`, so a read that answered is
     never mistaken for one still in flight and retried on every flush. */
  let catalogReady = false;
  let catalogError: string | null = null;
  let catalogLoading = false;
  let boosterDialogOpen = false;
  let root: HTMLElement;
  let playback: PlaybackMode = "off";
  let playbackMessage: string | null = null;
  const toasts = getContext<ToastPublisher | undefined>(TOAST_CONTEXT_KEY);
  let playbackTimer: ReturnType<typeof setTimeout> | null = null;
  let playbackKey = "";
  /* Profile-wide rather than per save: skip fast-forwards what this player has
     read, including beats read in a run that was later loaded over. */
  let readBeats: ReadonlySet<string> = readStoryReadLog();

  onDestroy(() => stopPlaybackTimer());

  onMount(() => {
    if (resumeState !== null || resolution !== null) onhandled();
    /* Safe to call on every mount: reading never writes, and a slot this build
       cannot parse resolves to "no save" rather than a thrown mount.

       The entry is applied after it, never beside it: Continue resumes the
       newer of the two player slots, and which one that is only exists once
       storage has answered. */
    void hydrate().then(() => applyEntryIntent());
  });

  /** Applies shell menu intent after save hydration. */
  function applyEntryIntent(): void {
    if (state.screen !== "title") return;
    if (entryIntent === "load") go("load");
    else if (entryIntent === "continue" && state.progressExists) continueGame();
    else if (entryIntent === "new") newGame();
  }

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
    if (
      state.screen.startsWith("shop-") &&
      shopData === null &&
      !shopDataLoading &&
      shopDataError === null
    )
      void loadShopData();
    if (
      CATALOG_SCREENS.has(state.screen) &&
      !catalogReady &&
      !catalogLoading &&
      catalogError === null
    )
      loadCatalog();
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

  $: inShop = state.screen.startsWith("shop-");
  /* Null until both card sources are in hand: rarity decides what a card
     sells for, and resolving it without the shop data degrades every unknown
     card to `common` — as does resolving it without the catalog, which is
     what `resolveCardRarity` infers a rarity from for a code no set sells. A
     sale is irreversible, so the screen waits rather than pays the floor
     price for a ghost rare. */
  $: sellableCards =
    shopData === null || !catalogReady
      ? null
      : Object.entries(state.collection).map(([codeKey, owned]) => {
          const code = Number(codeKey);
          const view = cardViewByCode.get(code);
          return {
            code,
            owned,
            name: shopNameByCode.get(code) ?? view?.name ?? `#${code}`,
            imageUrl: view?.imageUrl ?? null,
            rarity: resolveCardRarity(code, shopData, view),
          };
        });
  $: boosterTotal = Object.values(state.boosters).reduce((a, b) => a + b, 0);
  $: shopNameByCode = new Map(
    (shopData?.sets ?? []).flatMap((s) =>
      s.cards.map((c) => [c.code, c.name] as const),
    ),
  );
  $: openedCardViews = (state.openedCards ?? []).map(({ code, rarity }) => ({
    code,
    rarity,
    name:
      shopNameByCode.get(code) ?? cardViewByCode.get(code)?.name ?? `#${code}`,
    imageUrl: cardViewByCode.get(code)?.imageUrl ?? null,
    /* The whole catalog card, for the reveal screen's zoom: name and art are
       enough to draw a tile, not to read out an effect. Null until the catalog
       lands, which the zoom reads as "nothing to magnify yet". */
    view: cardViewByCode.get(code) ?? null,
  }));
  $: shopSet = shopData?.sets.find(({ id }) => id === state.shopSetId) ?? null;
  $: shopSetName = shopSet?.name ?? "";
  $: shopCards = (shopSet?.cards ?? []).map((card) => {
    /* The set data lists what is for sale; what a card does comes from the
       catalog, which this screen already waits on for the art. Both are
       absent for the frame before it lands, and the shared preview panel
       renders a name with no text rather than a claim about the card. */
    const view = cardViewByCode.get(card.code);
    return {
      code: card.code,
      name: card.name,
      description: view?.description ?? "",
      imageUrl: view?.imageUrl ?? null,
      rarity: card.rarity,
      priceDp: singlePriceDp(card.rarity),
    };
  });
  /* Null until the catalog lands, which the briefing renders as "still
     checking" rather than as a refusal: an empty catalog calls every card
     missing, so a verdict reached from one would lock the save out of every
     deck it owns. Scoped to the screen that asks, because it revalidates every
     deck in the save on every flush. */
  $: preBattleDeckChoices =
    state.screen === "pre-battle" && catalogReady
      ? preBattleDeckOptions(state, cardViewByCode)
      : null;
  $: header = storyHeaderConfig(state, shopSetName, openedCardViews.length);
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
  /* Playback is driven from here rather than from a reactive statement: it
     schedules an advance, and an advance is what re-runs it. The key makes
     that loop terminate at one timer per beat — an update that changes
     nothing playback depends on leaves the pending beat alone instead of
     restarting its countdown. */
  afterUpdate(() => {
    if (state.screen === "narrative") markRead(beat.id);
    const key = [
      playback,
      state.screen,
      state.narrativeIndex,
      activeChoices.length,
      overlay ?? "none",
      readBeats.size,
      $playbackSettings.autoSpeedSeconds,
      $playbackSettings.skipUnread,
    ].join("|");
    if (key === playbackKey) return;
    playbackKey = key;
    drivePlayback();
  });

  /** Records a beat as read the moment it is on screen, which is what Skip
      later consults. Written through on every new beat: a session that ends
      in a crash still keeps what was read up to it. */
  function markRead(id: string): void {
    const next = withBeatRead(readBeats, id);
    if (next === readBeats) return;
    readBeats = next;
    writeStoryReadLog(next);
  }

  function stopPlaybackTimer(): void {
    if (playbackTimer === null) return;
    clearTimeout(playbackTimer);
    playbackTimer = null;
  }

  function togglePlayback(mode: "auto" | "skip"): void {
    playbackMessage = null;
    playback = playback === mode ? "off" : mode;
  }

  /** The single owner of the playback timer: one beat is never queued twice,
      and a run that has to stop always says why instead of going quiet. */
  function drivePlayback(): void {
    stopPlaybackTimer();
    if (playback === "off") return;
    /* An overlay or a screen change is the player taking the scene back. */
    if (state.screen !== "narrative" || overlay !== null) {
      playback = "off";
      return;
    }
    const halt = playbackHalt(playback, {
      hasChoices: activeChoices.length > 0,
      atLastBeat: state.narrativeIndex >= PROLOGUE.beats.length - 1,
      nextBeatRead: readBeats.has(
        PROLOGUE.beats[state.narrativeIndex + 1]?.id ?? "",
      ),
      skipUnread: $playbackSettings.skipUnread,
    });
    if (halt !== null) {
      const message = playbackNotice(playback, halt);
      if (toasts === undefined) playbackMessage = message;
      else toasts.show({ message, tone: "info" });
      playback = "off";
      return;
    }
    playbackTimer = setTimeout(
      () => {
        playbackTimer = null;
        advanceBeat();
      },
      playbackDelayMs(playback, $playbackSettings.autoSpeedSeconds),
    );
  }

  async function loadShopData(): Promise<void> {
    shopDataLoading = true;
    shopDataError = null;
    try {
      shopData = await fetchShopSetData();
    } catch (error) {
      shopDataError =
        error instanceof Error ? error.message : "Shop data unavailable";
    } finally {
      shopDataLoading = false;
    }
  }

  /**
   * Reads the card database the shop names, pictures and prices cards from.
   *
   * Not awaited before the shop renders: this is a fetch of the whole packaged
   * snapshot, and every shop screen but Sell already has a name and a price
   * for each card from the shop data — the catalog only adds the art, which
   * folds in when it lands and falls back to the placeholder until then.
   * Sell is the exception and waits on `catalogReady`, because it is the one
   * screen whose numbers the catalog changes.
   */
  function loadCatalog(): void {
    catalogLoading = true;
    catalogError = null;
    void runtimeCatalog().then(
      (loaded) => {
        cardViewByCode = catalogByCode(loaded);
        catalogReady = true;
        catalogLoading = false;
      },
      (error: unknown) => {
        catalogLoading = false;
        catalogError = `${CATALOG_UNAVAILABLE} ${
          error instanceof Error ? error.message : String(error)
        }`;
      },
    );
  }

  /** One Retry for the sell screen, which reads both sources and so can be
      held up by either. Retries only what actually failed. */
  function retrySellSources(): void {
    if (shopDataError !== null) {
      shopDataError = null;
      void loadShopData();
    }
    if (catalogError !== null) loadCatalog();
  }

  /** Opens only what the loaded data can fill. A pick naming a set with no
      contents — a tampered save, or a data file that dropped the set — grants
      nothing, so its packs stay on the shelf instead of being spent on a
      reveal that has no cards in it. */
  function openPicks(
    picks: readonly { readonly setId: string; readonly count: number }[],
    mode: "sequential" | "all",
  ): void {
    boosterDialogOpen = false;
    const data = shopData;
    if (data === null) return;
    const contents = (setId: string) => contentsOf(data, setId);
    const openable = openablePicks(picks, contents);
    if (openable.length === 0) return;
    dispatch({
      type: "open-boosters",
      picks: openable,
      mode,
      cards: openBoosters(openable, contents, Math.random),
    });
  }

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

  /** Asks the shell for a duel, with the deck this save is set to fight it
      with. Nothing here starts one: the answer is only whether the pre-duel
      checkpoint survived, and a checkpoint that did not leaves the player on
      this screen with the attempt still available.

      The save is read once, up front. Resolving the deck is a read of the card
      database, so there is a gap between the click and the handoff that the
      player can leave through — and a checkpoint written from the state as it
      stands after that would record a screen they already walked away from. */
  async function beginHandoff(): Promise<void> {
    const current = state;
    const encounterId = current.encounterId;
    if (encounterId === null) {
      handoffError = HANDOFF_INTERRUPTED;
      return;
    }
    handoffError = null;
    try {
      /* The briefing already refused every deck this save cannot field, so a
         null here is the same save answering differently — a card database
         that changed under it, or a retry reached from the outcome screen
         without ever passing the briefing. */
      const deck = await encounterDeck(current);
      if (deck === null) {
        handoffError = DECK_UNPLAYABLE;
        return;
      }
      const outcome = await onencounter({
        encounterId,
        label: ENCOUNTER_LABELS[encounterId],
        state: current,
        deck,
      });
      if (outcome === "checkpoint-failed") handoffError = CHECKPOINT_FAILED;
      else if (outcome === "deck-rejected") handoffError = DECK_UNPLAYABLE;
    } catch {
      /* The card database or the duel's own chunk never arrived. Both are a
         duel that did not start for a reason retrying can fix, which is what
         this screen already offers. */
      handoffError = HANDOFF_INTERRUPTED;
    }
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
  /** Advance the player asked for. Any manual input ends playback: the reader
      taking the scene back is exactly what Auto and Skip yield to. */
  function advance(): void {
    if (playback !== "off") {
      playback = "off";
      playbackMessage = null;
    }
    advanceBeat();
  }
  function advanceBeat(): void {
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
    saveMode =
      result.kind === "written"
        ? toasts === undefined
          ? "success"
          : "idle"
        : "failure";
    if (result.kind === "written") {
      manualState = snapshot;
      latestSaveSlot = "manual";
      dirty = false;
      if (toasts !== undefined) {
        overlay = null;
        toasts.show({ message: "Game saved.", tone: "success" });
      }
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
    autosaveStatus = "pending";
    const snapshot = { ...state, savedScreen: "reward" as const };
    const result = await saves.write(AUTOSAVE_SLOT, snapshot, null);
    autosaveStatus =
      result.kind === "written"
        ? toasts === undefined
          ? "success"
          : "idle"
        : "failure";
    if (result.kind === "written") {
      autosaveState = snapshot;
      latestSaveSlot = "autosave";
      dirty = false;
      toasts?.show({ message: "Autosave complete.", tone: "success" });
    } else storageOperationError = writeProblem(result);
  }
  /** Leaves for the deck editor, but only once this run is on disk.

      The editor opens the newest of the two player slots and the shell unmounts
      this domain the moment the route changes, so a briefing reached through a
      new game, a shop trip and a walk to the arena would otherwise take all
      three with it. A refused write keeps the player on the briefing with the
      storage banner, the way a refused checkpoint keeps them on the handoff
      screen rather than starting a duel it could not record.

      Storage already known bad is tried again rather than refused up front, as
      the two save paths above refuse it: those report into a dialog the player
      opened, while this one is the only way off a screen that is already
      blocking them, and a permission or quota that has since been fixed must
      not keep them there. */
  async function openDeckEditor(): Promise<void> {
    const snapshot = { ...state, savedScreen: state.screen };
    const result = await saves.write(AUTOSAVE_SLOT, snapshot, null);
    if (result.kind !== "written") {
      storageOperationError = writeProblem(result);
      return;
    }
    autosaveState = snapshot;
    latestSaveSlot = "autosave";
    dirty = false;
    ondecks();
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
  <StoryTopBar
    dp={state.dp}
    showShop={header.showShop}
    showDecks={header.showDecks}
    title={header.title}
    objective={header.objective}
    showSettings={header.showSettings}
    onshop={() => dispatch({ type: "open-shop" })}
    ondecks={() => void openDeckEditor()}
    onsettings={() => openOverlay("settings")}
  >
    {#if inShop}
      <button
        type="button"
        class="secondary compact"
        data-cy="story-top-bar-boosters"
        onclick={() => (boosterDialogOpen = true)}>{boosterTotal} packs</button
      >
    {/if}
  </StoryTopBar>
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
  <div class="story-body" data-cy="story-screen-body">
    {#if state.screen === "load"}
      <LoadScreen
        onload={loadSlot}
        ondelete={deleteManualSave}
        onback={onmainmenu}
      />
    {:else if state.screen === "narrative"}
      <NarrativeScreen
        {beat}
        narrativeIndex={state.narrativeIndex}
        choices={activeChoices}
        selectedChoice={state.choice}
        choiceResponse={state.narrativeIndex === 13
          ? state.choiceResponse
          : null}
        {playback}
        playbackNotice={playbackMessage}
        onadvance={advance}
        ontoggleplayback={togglePlayback}
        onchoose={choose}
        onutility={(utility) => openOverlay(utility)}
      />
    {:else if state.screen === "map"}
      <IllustratedMapScreen
        locations={state.locations}
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
            <strong data-cy="story-completion-message-label"
              >Updated map:</strong
            > Old Arena completed. Archive available.
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
        decks={preBattleDeckChoices}
        deckRecords={state.decks}
        catalog={cardViewByCode}
        defaultDeckId={state.defaultDeckId}
        decksError={catalogError}
        onselectdeck={(id) => dispatch({ type: "deck-set-default", id })}
        onretrydecks={loadCatalog}
        onstart={startEncounter}
        onreturn={() => go("map")}
        onopendecks={openDeckEditor}
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
    {:else if inShop}
      <!-- One boundary for the whole shop, entered the way the shell enters a
         domain: `{#await}` around the import, a pending line, and something
         that says so if the chunk never arrives. -->
      {#await import("./shop/shop-screens.ts")}
        <!-- Announced rather than drawn, the way the shell announces
           `collection-pending`: the chunk is a cache read in the ordinary
           case, and a placeholder that flashes for a frame reads as a fault. -->
        <p class="visually-hidden" data-cy="story-shop-pending">
          Opening the shop
        </p>
      {:then shop}
        {#if state.screen === "shop-greeting"}
          <svelte:component
            this={shop.ShopGreetingScreen}
            onnavigate={(target) =>
              dispatch({
                type: "shop-navigate",
                to: target === "buy" ? "browse" : "sell",
              })}
            onleave={() => dispatch({ type: "leave-shop" })}
          />
        {:else if state.screen === "shop-browse"}
          <svelte:component
            this={shop.ShopBrowseScreen}
            sets={shopData?.sets ?? null}
            error={shopDataError}
            dp={state.dp}
            onbuy={(setId, count) =>
              dispatch({
                type: "buy-packs",
                setId,
                count,
                released: isSetReleased(shopData, setId),
              })}
            onviewcards={(setId) => dispatch({ type: "view-set-cards", setId })}
            onretry={() => {
              shopDataError = null;
              void loadShopData();
            }}
            onback={() => dispatch({ type: "shop-navigate", to: "greeting" })}
          />
        {:else if state.screen === "shop-cards"}
          <svelte:component
            this={shop.ShopCardListScreen}
            setName={shopSetName}
            dp={state.dp}
            cards={shopCards}
            onbuysingle={(code, rarity) =>
              dispatch({ type: "buy-single", code, rarity })}
            onback={() => dispatch({ type: "shop-navigate", to: "browse" })}
          />
        {:else if state.screen === "shop-sell"}
          <svelte:component
            this={shop.ShopSellScreen}
            cards={sellableCards}
            error={shopDataError ?? catalogError}
            {state}
            onsell={(items) => dispatch({ type: "sell-cards", items })}
            onretry={retrySellSources}
            onback={() => dispatch({ type: "shop-navigate", to: "greeting" })}
          />
        {:else if state.screen === "shop-opening"}
          <svelte:component
            this={shop.BoosterOpeningScreen}
            cards={openedCardViews}
            settings={playbackSettings}
            onfinish={() => dispatch({ type: "finish-opening" })}
            onback={() => dispatch({ type: "acknowledge-opened" })}
          />
        {:else if state.screen === "shop-results"}
          <svelte:component
            this={shop.BoosterResultsScreen}
            cards={openedCardViews}
            oncontinue={() => dispatch({ type: "acknowledge-opened" })}
          />
        {/if}
      {:catch error}
        <!-- The shop's chunk never arrived: a stale build, a half-cached
           reload, an offline one. The way out is a reload, which the player is
           told about rather than sent through — a browser remembers a failed
           module load, so walking back in would fail the same way, and a
           reload from here would drop story progress since the last save.
           Leaving the shop keeps it, and keeps Save reachable. -->
        {@const reason =
          error instanceof Error ? error.message : "The shop could not load."}
        <section
          class="shop-load-error"
          role="alert"
          aria-labelledby="shop-load-error-heading"
          data-cy="story-shop-load-error"
        >
          <p class="eyebrow" data-cy="story-shop-load-error-eyebrow">
            Card shop stopped
          </p>
          <h1
            id="shop-load-error-heading"
            data-cy="story-shop-load-error-heading"
          >
            The shop could not open
          </h1>
          <p data-cy="story-shop-load-error-message">{reason}</p>
          <p data-cy="story-shop-load-error-advice">
            Reload the page to try again. Leave the shop first if you have
            progress you have not saved.
          </p>
          <button
            type="button"
            class="secondary"
            data-cy="story-shop-load-error-leave"
            onclick={() => dispatch({ type: "leave-shop" })}
            >Leave the shop</button
          >
        </section>
      {/await}
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
  </div>

  {#if overlay === "history"}<HistoryOverlay
      entries={historyEntries}
      onclose={closeOverlay}
      restoreFocusTo={overlayTrigger}
    />
  {:else if overlay === "settings"}<SettingsOverlay
      settings={playbackSettings}
      onclose={closeOverlay}
      restoreFocusTo={overlayTrigger}
    />
  {:else if overlay === "pause"}<PauseOverlay
      unsaved={dirty}
      onclose={closeOverlay}
      restoreFocusTo={overlayTrigger}
      onaction={(action) => {
        if (action === "resume") closeOverlay();
        else if (action === "main-menu") onmainmenu();
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

  {#if boosterDialogOpen && shopData !== null}
    <!-- The same chunk the screens came from, so this import is a lookup in a
         map the browser has already filled: the pill that opens this dialog
         only renders inside the shop. Rendered from here rather than beside
         the screens so it stays the last modal in the document — that order is
         what `OverlayShell` reads to decide which dialog Escape closes. -->
    {#await import("./shop/shop-screens.ts") then shop}
      <svelte:component
        this={shop.BoosterInventoryDialog}
        boosters={state.boosters}
        setNameOf={(id) => shopData!.sets.find((s) => s.id === id)?.name ?? id}
        onopen={(picks) => openPicks(picks, "sequential")}
        onopenall={(picks) => openPicks(picks, "all")}
        onclose={() => {
          boosterDialogOpen = false;
        }}
      />
    {/await}
  {/if}
</div>

<style>
  /* The shell gives the story a fixed-size region inside the 16:9 stage, so
     the domain root fills that box rather than the viewport. */
  .story-app {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 0;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    contain: layout;
    overflow: hidden;
  }
  .story-body {
    position: relative;
    grid-row: 2;
    min-height: 0;
    overflow: hidden;
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
  .shop-load-error,
  .end-screen {
    min-height: 100%;
    display: grid;
    place-content: center;
    justify-items: start;
    gap: 1rem;
    height: 100%;
    min-height: 0;
    overflow: auto;
    padding: clamp(1rem, 8cqw, 7rem);
    background:
      radial-gradient(circle at 60% 30%, var(--field-glow), transparent 30%),
      var(--bg);
  }
  .shop-load-error p,
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

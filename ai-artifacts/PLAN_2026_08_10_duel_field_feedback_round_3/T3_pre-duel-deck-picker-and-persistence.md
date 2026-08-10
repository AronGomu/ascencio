# T3: Pre-duel deck picker and persisted UI state

**Plan:** `./ai-artifacts/PLAN_2026_08_10_duel_field_feedback_round_3.md`
**Depends:** T2
**Commit outcome:** The app opens on a deck picker instead of auto-starting a duel; the chosen pair and the (not yet used) window positions survive a page reload.

## Context (self-contained)

- Goal: ship the 30 items of `feedback.md`. Item 12 asks for four archetype decks plus "a selection menu where I can select my deck and the opponent's deck" before starting a duel.
- This slice is one vertical transaction: picker selection must cross strict command validation, rebuild selected preset, survive replacement-worker rematch/reset, and persist. None of those seams is independently user-visible or safe to merge with auto-start still active. T2 already owns full-pool dependency loading/factory primitives; T14 owns persisted-window store/mutation.
- Out of scope here: window dragging (T14), link detection (T11), the opponent policy (T4), any field or layout change.
- Assumptions in force: **A4** six decks, MVP pair is the default. **A15** one versioned `localStorage` key `ygo.ui.v1` holding `{ windows: { zoneList, confirm }, decks: { player, opponent } }`; unparseable or wrong-version data is discarded and defaults are used; no other UI setting becomes persistent. **A21** any moved or deleted `data-cy` asserted in `e2e/duel-smoke.spec.ts` is updated in the same commit.

## Requirements

- The app no longer auto-starts a duel. On worker-ready it shows a deck picker with two lists — yours and the opponent's — and a Start button.
- Both lists show all six decks from the registry. The initial selection is the persisted pair, or the MVP pair when nothing is persisted.
- Start begins a duel with the two chosen decks. The worker builds and validates the preset for exactly that pair.
- `DuelResultDialog`'s existing rematch button replaces/reinitializes the Worker, then replays the **same** pair when the replacement emits `ready`. A new "Change decks" button replaces/reinitializes the Worker and returns to the picker **without** starting.
- The chosen pair persists to `localStorage` and is restored on reload.
- Unparseable, wrong-version or unknown-deck-id persisted data is discarded silently and the defaults are used. Persistence never throws, including when `localStorage` is unavailable.
- Every rendered element carries a unique `data-cy` per the project's HTML element contract.

## Inputs

- `src/app/stores/duel-store.ts:105` — `start(): boolean` on the `DuelStore` interface; `:306` — `const context = client.startDuel(MVP_PRESET_ID)` inside `startCurrentDuel`; `:112` — `restart(): Promise<boolean>`.
- `src/app/App.svelte` — the auto-start block:
  ```
  $: if ($duel.status === "idle" && $duel.coreVersion !== null && !autoStartedWorkerGenerations.has($duel.context.workerGeneration)) {
    autoStartedWorkerGenerations.add($duel.context.workerGeneration);
    queueMicrotask(() => duel.start());
  }
  ```
  and the `{#if duelBoard || $duel.snapshot}` block that renders `.duel-row`, and the `{#if $duel.result}` block rendering `DuelResultDialog`.
- `src/app/DuelWorkerClient.ts:65` — `startDuel(duelId: DuelId): DuelClientContext | null` on the interface; `:163` — the implementation; `:179` — `this.#post({ type: "startDuel", duelId })`.
- `src/duel/contracts/duel-command.ts:16` — the `startDuel` variant; `:46-49` — its parser branch with `requireOnlyKeys(command, ["type", "duelId"])`.
- `src/worker/DuelWorkerRuntime.ts:51` — `readonly preset: MvpPreset` on the resources type; `:219-220` — the `case "startDuel"` dispatch; `:314` — `#startDuel(duelId, events)`; `:322` — `if (duelId !== resources.preset.id)`; `:341-342`, `:390-397` — every other `resources.preset` read.
- `src/worker/create-browser-runtime.ts` — builds `preset` during the `"preset"` progress stage and calls `loadActiveDuelDependencies(assets, uniqueDeckCodes(preset.player, preset.opponent), ...)`, then `validateDeck` twice.
- `src/worker/create-node-runtime.ts` — the same three call sites.
- `src/app/components/DuelResultDialog.svelte` — has `onrestart` and a diagnostics button.
- `e2e/duel-smoke.spec.ts` — every test currently assumes a duel is already starting when the page loads.
- **From Depends (T2):** terminal commit `171253b97a04ac62789eb3ddce0b2bc048e43f3d` is pushed on `plan/duel-field-feedback-round-3`. `src/duel/presets/deck-catalog.ts` exports `type DeckId = "mvp-player" | "mvp-opponent" | "burning-abyss" | "nekroz" | "shaddoll" | "spellbook"`, `interface DeckMetadata { id, name, fileName }`, `DECK_CATALOG: readonly DeckMetadata[]`, `deckMetadata(id)`, `isDeckId(value): value is DeckId`, `DEFAULT_PLAYER_DECK_ID = "mvp-player"`, `DEFAULT_OPPONENT_DECK_ID = "mvp-opponent"`. `src/duel/presets/deck-sources-browser.ts` exports `DECK_SOURCES: ReadonlyMap<DeckId, string>`. `src/duel/presets/deck-sources-node.ts` exports `loadDeckSources(): Promise<ReadonlyMap<DeckId, string>>`. `src/duel/presets/reviewed-card-pool.ts` exports `reviewedCardPool(sources): ReadonlySet<number>` — 120 codes for the bundled decks. `src/duel/presets/duel-preset.ts` exports `interface DuelPreset { id, playerDeckId, opponentDeckId, player, opponent }` and `createDuelPreset(playerDeckId, opponentDeckId, sources): DuelPreset`, whose id is still the temporary `MVP_PRESET_ID`. T3 replaces it with pair-derived identity. `validateDeck` requires `reviewedPool: ReadonlySet<number>` whenever card data is supplied.

## API surface this ticket creates

`src/app/stores/persisted-ui-state.ts`:

```ts
export const PERSISTED_UI_STATE_KEY = "ygo.ui.v1";

export interface PersistedWindowPosition {
  readonly x: number;
  readonly y: number;
}

export interface PersistedUiState {
  readonly version: 1;
  readonly windows: {
    readonly zoneList: PersistedWindowPosition | null;
    readonly confirm: PersistedWindowPosition | null;
  };
  readonly decks: {
    readonly player: DeckId;
    readonly opponent: DeckId;
  };
}

export const DEFAULT_PERSISTED_UI_STATE: PersistedUiState;

/** Never throws. Any read, parse, version or shape failure yields the defaults. */
export function readPersistedUiState(
  storage?: Pick<Storage, "getItem"> | null,
): PersistedUiState;

/** Never throws. A write failure (quota, private mode, missing storage) is swallowed. */
export function writePersistedUiState(
  next: PersistedUiState,
  storage?: Pick<Storage, "setItem"> | null,
): void;
```

Validation rules for `readPersistedUiState`: the parsed value must be a plain object with `version === 1`; `decks.player` and `decks.opponent` must each satisfy `isDeckId`, otherwise **that field alone** falls back to its default; a window position is kept only when both `x` and `y` are finite numbers, otherwise that window falls back to `null`. `storage` defaults to `globalThis.localStorage` when it exists and `null` otherwise.

`src/app/components/DeckPicker.svelte`:

```
export let decks: readonly DeckMetadata[];
export let playerDeckId: DeckId;
export let opponentDeckId: DeckId;
export let disabled = false;
export let onselect: (player: DeckId, opponent: DeckId) => void = () => undefined;
export let onstart: () => void = () => undefined;
```

`data-cy` values: root `deck-picker`; the two columns `deck-picker-column-player` and `deck-picker-column-opponent`; each option button `` `deck-picker-option-${side}-${deck.id}` `` where `side` is `player` or `opponent`; the start button `deck-picker-start-button`. The selected option carries `aria-pressed="true"`.

Extend `src/duel/presets/duel-preset.ts`:

```ts
export function duelPresetId(
  playerDeckId: DeckId,
  opponentDeckId: DeckId,
): DuelId;
```

Exact value: `duelId(`bundled-v1:${playerDeckId}:vs:${opponentDeckId}`)`. `createDuelPreset` uses it. This makes existing `DuelTrace.presetId` identify the matchup without a diagnostics schema migration.

`DuelStore` interface change:

```ts
start(playerDeckId: DeckId, opponentDeckId: DeckId): boolean;
restart(): Promise<boolean>; // replacement Worker; start last pair on `ready`
reset(): Promise<boolean>;   // replacement Worker; stay idle/picker on `ready`
```

`DuelClient` interface change:

```ts
startDuel(
  duelId: DuelId,
  playerDeckId: DeckId,
  opponentDeckId: DeckId,
): DuelClientContext | null;
```

`DuelCommand` change:

```ts
| {
    readonly type: "startDuel";
    readonly duelId: DuelId;
    readonly playerDeckId: DeckId;
    readonly opponentDeckId: DeckId;
  }
```

`parseDuelCommand`'s `startDuel` branch uses `requireOnlyKeys(command, ["type", "duelId", "playerDeckId", "opponentDeckId"])` and rejects a deck id failing `isDeckId` with `DuelCommandValidationError("Duel startDuel command deck id is not a bundled deck")`.

`DuelWorkerRuntime` resources change: `readonly preset: MvpPreset` becomes

```ts
readonly createPreset: (
  playerDeckId: DeckId,
  opponentDeckId: DeckId,
) => DuelPreset;
```

`#startDuel(duelId, playerDeckId, opponentDeckId, events)` calls `resources.createPreset(playerDeckId, opponentDeckId)` once and uses the returned preset for the id check (`duelId !== preset.id`) and for every read that previously went through `resources.preset`.

## TDD

1. **Red** — write the failing tests named below first. Run them, capture the failure.
2. **Green** — minimum code to pass.
3. **Refactor** — only if needed. Keep green.

## Test plan

New `tests/unit/persisted-ui-state.test.ts`:

| Test | Input | Expect |
| ---- | ---- | ---- |
| `returns defaults when storage is null` | `readPersistedUiState(null)` | deep-equals `DEFAULT_PERSISTED_UI_STATE` |
| `returns defaults when the key is absent` | stub `getItem` → `null` | defaults |
| `returns defaults for unparseable JSON` | `getItem` → `"{"` | defaults, no throw |
| `returns defaults for a wrong version` | `getItem` → `'{"version":2,...}'` | defaults |
| `falls back per field for an unknown deck id` | persisted `decks.player === "not-a-deck"`, `decks.opponent === "nekroz"` | player is `"mvp-player"`, opponent is `"nekroz"` |
| `drops a window position with a non-finite coordinate` | `windows.confirm === { x: 10, y: NaN }` | `windows.confirm === null` |
| `round-trips a valid state` | write then read against one in-memory storage stub | deep-equals what was written |
| `a throwing setItem does not propagate` | `setItem` throws `QuotaExceededError` | `writePersistedUiState` returns normally |

New `tests/component/DeckPicker.test.ts`:

| Test | Input | Expect |
| ---- | ---- | ---- |
| `renders one option per deck in both columns` | `decks: DECK_CATALOG` | 6 buttons match `deck-picker-option-player-*`, 6 match `deck-picker-option-opponent-*` |
| `marks the selected deck in each column` | `playerDeckId: "nekroz"` | `deck-picker-option-player-nekroz` has `aria-pressed="true"`, the other five `"false"` |
| `clicking an option reports the new pair` | click `deck-picker-option-opponent-shaddoll` | `onselect` called once with `("nekroz", "shaddoll")` |
| `start reports once` | click `deck-picker-start-button` | `onstart` called once |
| `disabled blocks start` | `disabled: true` | `deck-picker-start-button` is disabled and `onstart` is not called |

Extend `tests/component/AppChrome.test.ts`:

| Test | Input | Expect |
| ---- | ---- | ---- |
| `shows the deck picker instead of auto-starting` | app rendered with a ready worker stub | `deck-picker` is in the document and the stub's `startDuel` has not been called |
| `starting from the picker passes pair-derived preset id and both deck ids` | select `burning-abyss` / `shaddoll`, click start | stub `startDuel` called once with `("bundled-v1:burning-abyss:vs:shaddoll", "burning-abyss", "shaddoll")` |

Extend `tests/unit/duel-command.test.ts` (locate the existing parser test file first; if the parser has no test file, create `tests/unit/duel-command.test.ts`):

| Test | Input | Expect |
| ---- | ---- | ---- |
| `parses a startDuel command with deck ids` | `{ type: "startDuel", duelId: "mvp-preset-v1", playerDeckId: "nekroz", opponentDeckId: "shaddoll" }` | parsed value keeps both ids |
| `rejects a startDuel command with an unknown deck id` | `playerDeckId: "evil"` | throws `DuelCommandValidationError` |
| `rejects a startDuel command missing the deck ids` | `{ type: "startDuel", duelId: "mvp-preset-v1" }` | throws `DuelCommandValidationError` |

Extend `tests/unit/duel-store.test.ts`:

| Test | Input | Expect |
| ---- | ---- | ---- |
| `start forwards pair identity and both deck ids to the client` | `store.start("nekroz", "spellbook")` | client stub received `("bundled-v1:nekroz:vs:spellbook", "nekroz", "spellbook")` |
| `restart replays the last started pair after replacement readiness` | `start("nekroz","spellbook")`, `restart()`, emit replacement `ready` | no early second start; after `ready`, second `startDuel` carries same ids |
| `reset replaces the worker without starting` | start then `reset()`, emit replacement `ready` | state returns idle/ready; no second `startDuel` |

## Impl steps

- [x] 1. Write `tests/unit/persisted-ui-state.test.ts`. Run `npm run test:unit -- persisted-ui-state` — fails on the missing module.
- [x] 2. Create `src/app/stores/persisted-ui-state.ts` with the surface and validation rules above. Re-run — green.
- [x] 3. Add the three parser tests. Run — fails.
- [x] 4. Edit `src/duel/contracts/duel-command.ts`: extend the `startDuel` variant with `playerDeckId` and `opponentDeckId`, and its parser branch with `requireOnlyKeys(command, ["type","duelId","playerDeckId","opponentDeckId"])` plus two `isDeckId` guards. Re-run — green.
- [x] 5. Edit `src/app/DuelWorkerClient.ts`: widen `startDuel` on the interface and the class to `(duelId, playerDeckId, opponentDeckId)`, and post all three fields.
- [x] 6. Add `duelPresetId` to `duel-preset.ts` with exact pair-derived value and change `createDuelPreset.id` to use it. Edit `src/worker/DuelWorkerRuntime.ts`: replace `readonly preset: MvpPreset` with `readonly createPreset: (playerDeckId: DeckId, opponentDeckId: DeckId) => DuelPreset`; change `case "startDuel"` to pass `command.playerDeckId` and `command.opponentDeckId`; in `#startDuel`, call `createPreset` once into local `preset` and replace every `resources.preset` read at lines ~322, ~330, ~341-342 and ~390-397 with it. The command `duelId` must equal pair-derived `preset.id`; mismatch remains `Unknown preset duel`. A `createPreset` throw is reported through existing `deck_validation_failed` path.
- [x] 7. Edit `src/worker/create-browser-runtime.ts`: retain T2's whole-reviewed-pool dependencies. Move both `validateDeck` calls into a `createPreset` closure that builds the preset with `createDuelPreset(playerDeckId, opponentDeckId, DECK_SOURCES)` and validates both decks against `catalogCodes`, `dependencies.cards` and `reviewedCardPool(DECK_SOURCES)`. Return `createPreset` in the resources object in place of `preset`.
- [x] 8. Edit `src/worker/create-node-runtime.ts` the same way, using `await loadDeckSources()` captured once during initialization.
- [x] 9. Add the two `duel-store` tests. Run — fails.
- [x] 10. Edit `src/app/stores/duel-store.ts`: change `start()` to `start(playerDeckId: DeckId, opponentDeckId: DeckId)`; have `startCurrentDuel` take the pair, remember it in module-local `lastStartedDecks`, and call `client.startDuel(duelPresetId(playerDeckId, opponentDeckId), playerDeckId, opponentDeckId)`. Generalize `replaceAndInitialize(pendingPair)` with module-local `pendingReplacementStart`. `restart()` requires `lastStartedDecks`, stores that pair, then replaces/initializes; `reset()` stores null, then replaces/initializes. In the existing client-event subscriber, after reducing an accepted replacement `ready` event, consume `pendingReplacementStart` once and call `startCurrentDuel(pair)` only when non-null. Clear pending state before calling Start so duplicate/stale ready events cannot double-start. Re-run — green.
- [x] 11. Write `tests/component/DeckPicker.test.ts`. Run — fails.
- [x] 12. Create `src/app/components/DeckPicker.svelte` with the props and `data-cy` values above. Two columns of option buttons plus a Start button. Re-run — green.
- [x] 13. Edit `src/app/App.svelte`: read `let persistedUi = readPersistedUiState()` once; add `let pickerOpen = true`; delete auto-start block/generation set; render picker when ready with no snapshot; on select replace only `persistedUi.decks` and call `writePersistedUiState`; on Start close picker and call `duel.start(persistedUi.decks.player, persistedUi.decks.opponent)`. T14 may wrap these pure functions in a store when window positions become mutable.
- [x] 14. Edit `src/app/components/DuelResultDialog.svelte`: add a `onchangedecks: () => void` prop and a button with `data-cy="duel-result-change-decks-button"` labelled `Change decks`. Wire rematch to `duel.restart()`; wire Change decks to set `pickerOpen = true` and `await duel.reset()`. Replacement `ready` must leave the picker open and issue no start. Pick retained persisted pair remains highlighted.
- [x] 15. Add the two `AppChrome` tests. Run — adjust until green.
- [x] 16. Update `e2e/duel-smoke.spec.ts`: add a shared helper `async function startPresetDuel(page)` that waits for `[data-cy="deck-picker-start-button"]` to be enabled and clicks it, and call it at the top of every test that previously relied on auto-start. Do not change any other assertion.
- [x] 17. Run the chromium e2e suite (command in Validation) and fix only the drift this ticket caused.

## Outputs

- Files created: `src/app/stores/persisted-ui-state.ts`, `src/app/components/DeckPicker.svelte`, `tests/unit/persisted-ui-state.test.ts`, `tests/component/DeckPicker.test.ts`.
- Files edited: `src/duel/contracts/duel-command.ts`, `src/app/DuelWorkerClient.ts`, `src/worker/DuelWorkerRuntime.ts`, `src/worker/create-browser-runtime.ts`, `src/worker/create-node-runtime.ts`, `src/app/stores/duel-store.ts`, `src/app/App.svelte`, `src/app/components/DuelResultDialog.svelte`, `tests/component/AppChrome.test.ts`, `tests/unit/duel-store.test.ts`, `tests/unit/duel-command.test.ts`, `e2e/duel-smoke.spec.ts`.
- Public API change: `startDuel` and `DuelStore.start` take a deck pair; `DuelStore` gains `reset()`; `restart()` becomes replacement-ready-aware; the `startDuel` worker command carries two deck ids; `DuelWorkerRuntime` resources expose `createPreset` instead of `preset`.
- Migration / config: first use of `localStorage`, key `ygo.ui.v1`. A user with no prior state sees the MVP pair preselected.

## Validation

- [x] `npm run test:unit` passes
- [x] `npm run test:component` passes
- [x] `npm run test:integration` passes
- [x] `npm run typecheck`, `npm run lint`, `npm run format:check` pass
- [x] `npm run build` succeeds
- [x] chromium e2e passes, run foreground with:
      ```bash
      cd /home/aron/projects/ascencio
      timeout 590 nix-shell -p playwright-driver.browsers glib gtk3 nss nspr dbus atk cups \
        libdrm expat libx11 libxcomposite libxdamage libxext libxfixes libxrandr mesa \
        alsa-lib at-spi2-atk at-spi2-core cairo pango xorg.xvfb --run '
      export PLAYWRIGHT_BROWSERS_PATH=/home/aron/projects/ascencio/.tmp/pw-browsers
      npx playwright test --project=chromium
      '
      ```
- [x] manual check: `npm run dev`, confirm the picker appears instead of a duel, pick Burning Abyss vs Shaddoll, press Start, confirm the duel opens with those decks
- [x] manual check: reload the page and confirm the picker reopens with Burning Abyss and Shaddoll still selected
- [x] manual check: `localStorage.getItem("ygo.ui.v1")` in the devtools console returns a JSON string with `"version":1`
- [x] manual check: finish or surrender a duel, press **Change decks**, confirm the picker returns
- [x] app functional — no broken path from this slice
- [x] commit msg draft: `feat(app): choose both decks before the duel starts`

# T4: Automatic prompt resolution and prompt trimming

**Plan:** `./artifacts/PLAN_2026_08_09_duel_field_feedback_round_2.md`
**Depends:** none
**Commit outcome:** A settings toggle (on by default) makes the client answer prompts that carry no real decision — chains with nothing to activate, single-option prompts — without asking; the Shuffle Deck action is no longer offered.

## Context (self-contained)

- Goal: ship 17 duel-field feedback items. This slice is items 7, 8 and 9.
- This slice: today every prompt reaches the player. A `chain` prompt whose only choice is `Pass` still opens the modal `PromptDialog` titled "Choose a chain response" and demands a click. `src/worker/protocol/PromptRegistry.ts` also offers a `Shuffle Deck` idle command that the user does not want. `src/app/stores/ui-settings-store.ts` currently holds only `showDuelHud` and `showWorkspace`.
- Out of scope here: automatic *placement* (T5 owns it, and it reuses the wiring this ticket lays down), the chain UI (T11), stack targets (T6), removing `PromptDialog` itself.
- Assumptions in force:
  - **A2** UI settings are in-memory for the session; a reload resets them to defaults.
  - **A4** "system hints" means: chain prompts with no activatable option, plus prompts that carry no real decision (`option` with exactly one choice, `selectPosition` with exactly one choice, a forced `chain` with exactly one choice). A `selectPosition` with two positions stays manual.
  - **A14** `ChoiceAction` keeps its `"shuffle"` member; only the emission is removed.

## Requirements

1. `src/app/stores/ui-settings-store.ts` gains **two** booleans, both defaulting to `true`:
   ```ts
   export interface UiSettingsState {
     readonly showDuelHud: boolean;
     readonly showWorkspace: boolean;
     readonly autoPlaceCards: boolean;        // consumed by T5
     readonly autoResolveTrivialPrompts: boolean; // consumed here
   }
   ```
   with setters `setAutoPlaceCards(value: boolean)` and `setAutoResolveTrivialPrompts(value: boolean)` written in the same `update((state) => Object.freeze({ ...state, … }))` style as the existing two. `DEFAULT_UI_SETTINGS` becomes `{ showDuelHud: false, showWorkspace: false, autoPlaceCards: true, autoResolveTrivialPrompts: true }`.
2. `src/app/components/SettingsDialog.svelte` gains two checkboxes, placed after the existing two, wired to new props `onautoplacecards` and `onautoresolvetrivialprompts`:
   - label text `Place cards automatically`, `data-cy="settings-auto-place-cards-label"` on the `<label>` and `data-cy="settings-auto-place-cards-checkbox"` on the `<input>`.
   - label text `Skip prompts with a single answer`, `data-cy="settings-auto-resolve-label"` / `data-cy="settings-auto-resolve-checkbox"`.
   `src/app/App.svelte` wires them to `uiSettings.setAutoPlaceCards` and `uiSettings.setAutoResolveTrivialPrompts`.
3. New module `src/app/prompts/auto-response.ts`:
   ```ts
   import type { ChoiceId } from "../../duel/contracts/ids.ts";
   import type { PlayerPrompt } from "../../duel/contracts/player-prompt.ts";

   /**
    * The choice ids that answer a prompt carrying no real decision, or `null`
    * when the player must decide. Never returns an empty array: a prompt that
    * needs an empty response is a decision, not a formality.
    */
   export function trivialPromptResponse(
     prompt: PlayerPrompt,
   ): readonly ChoiceId[] | null;
   ```
   Rules, evaluated in order, all requiring `prompt.player === 0`:
   - `prompt.kind === "chain"`: let `activatable = prompt.choices.filter((c) => c.action !== "pass")`.
     - `activatable.length === 0` → return the `pass` choice's id (or `null` if there is no `pass` choice — a forced chain with nothing in it should never happen; do not guess).
     - `activatable.length === 1 && prompt.choices.length === 1` → return that single id (a forced chain with exactly one option).
     - otherwise → `null`.
   - `prompt.kind === "option"` and `prompt.choices.length === 1` → return that id.
   - `prompt.kind === "selectPosition"` and `prompt.choices.length === 1` → return that id.
   - everything else → `null`.
   Additional guard applied to every branch: return `null` unless `prompt.minimum <= 1 && prompt.maximum >= 1`.
4. `src/app/App.svelte` answers a trivial prompt exactly once per prompt id. Implementation:
   ```ts
   let autoResolvedPromptId: PromptId | null = null;
   $: maybeAutoResolvePrompt(
     $duel.prompt,
     $duel.responsePending,
     $uiSettings.autoResolveTrivialPrompts,
   );

   function maybeAutoResolvePrompt(
     prompt: PlayerPrompt | null,
     responsePending: boolean,
     enabled: boolean,
   ): void {
     if (prompt === null) {
       autoResolvedPromptId = null;
       return;
     }
     if (!enabled || responsePending || autoResolvedPromptId === prompt.id) return;
     const choiceIds = trivialPromptResponse(prompt);
     if (choiceIds === null) return;
     autoResolvedPromptId = prompt.id;
     queueMicrotask(() => duel.respond(choiceIds));
   }
   ```
   `queueMicrotask` matches the existing auto-start pattern in the same file (`queueMicrotask(() => duel.start())`), which keeps the reactive statement free of a synchronous store write.
5. `src/worker/protocol/PromptRegistry.ts`: delete
   ```ts
   if (message.shuffle)
     addSimpleChoice(bindings, id, "shuffle", "Shuffle Deck");
   ```
   from the `SELECT_IDLE_COMMAND` case. Leave `"shuffle"` in `ChoiceAction`, in `CHOICE_ACTIONS` in `src/app/prompts/interaction-spec.ts`, in `src/app/presentation/card-action-label.ts` and in `idleAction()` untouched — the engine constant still exists and nothing else must change shape.
6. Every new rendered element carries a unique kebab-case `data-cy`.

## Inputs

- `src/app/stores/ui-settings-store.ts` — full file (38 lines): `UiSettingsState`, `UiSettingsStore`, `DEFAULT_UI_SETTINGS`, `createUiSettingsStore`.
- `src/app/components/SettingsDialog.svelte` — full file (99 lines); the two existing checkbox blocks are the pattern to copy, including the `handleShowDuelHud(event)` shape that reads `(event.currentTarget as HTMLInputElement).checked`.
- `src/app/App.svelte` — the `<SettingsDialog … />` call site (`onshowduelhud`, `onshowworkspace`, `onclose`), the existing `queueMicrotask(() => duel.start())` reactive block, and `duel.respond(choiceIds)` from `createDuelStore`.
- `src/app/stores/duel-store.ts` — `respond(choiceIds: readonly ChoiceId[]): boolean` refuses unless `status === "awaiting-input"` and `!responsePending`, and validates the selection; a rejected auto-response surfaces a recoverable error, which is why the once-per-prompt-id guard matters.
- `src/duel/contracts/player-prompt.ts` — `PlayerPrompt`, `PromptChoice`, `PromptKind`, `ChoiceAction`.
- `src/duel/contracts/ids.ts` — `ChoiceId`, `PromptId`.
- `src/worker/protocol/PromptRegistry.ts` — the `SELECT_IDLE_COMMAND` case; the shuffle line sits directly after `if (message.to_ep) addSimpleChoice(bindings, id, "endPhase", "End turn");`.
- `tests/unit/prompt-registry.test.ts`, `tests/component/AppChrome.test.ts`, `tests/unit/data-cy-coverage.test.ts`.
- **From Depends:** none.

## TDD

1. **Red** — add `tests/unit/auto-response.test.ts`, extend `tests/unit/prompt-registry.test.ts` with the no-shuffle assertion, and add the settings-checkbox assertions to `tests/component/AppChrome.test.ts`. Run `npm run test:unit && npm run test:component`; the new cases must fail.
2. **Green** — implement the store fields, the dialog checkboxes, `auto-response.ts`, the `App.svelte` wiring and the registry deletion.
3. **Refactor** — only if needed. Keep green.

## Test plan

| Test | Input | Expect |
| --- | --- | --- |
| `passes a chain with nothing to activate` | `chain` prompt, choices `[{ id: "p", action: "pass" }]`, min 0 max 1 | `["p"]` |
| `keeps a chain with a real option` | `chain` prompt, choices `[{ id: "a", action: "activate", card }, { id: "p", action: "pass" }]` | `null` |
| `answers a forced single-option chain` | `chain` prompt, choices `[{ id: "a", action: "activate", card }]`, no pass | `["a"]` |
| `answers a single option prompt` | `option` prompt with one choice `o1` | `["o1"]` |
| `keeps a two-option prompt` | `option` prompt with two choices | `null` |
| `answers a single-position prompt` | `selectPosition` with one choice `z1` | `["z1"]` |
| `keeps a two-position prompt` | `selectPosition` with two choices | `null` |
| `never answers on behalf of the opponent` | any of the above with `player: 1` | `null` |
| `never answers a multi-select prompt` | `option` prompt with one choice but `minimum: 2` | `null` |
| `idle command no longer offers shuffle` | build a `SELECT_IDLE_COMMAND` engine message with `shuffle: true` through the existing registry test harness | the produced prompt's `choices` contain no choice with `action === "shuffle"` |
| `settings expose the two new toggles` | render the app chrome, open Settings | `settings-auto-place-cards-checkbox` and `settings-auto-resolve-checkbox` are present and `checked` |
| `toggling auto-resolve calls its setter` | click `settings-auto-resolve-checkbox` | the `onautoresolvetrivialprompts` callback receives `false` |

## Impl steps

- [x] 1. Create `tests/unit/auto-response.test.ts` with the nine `trivialPromptResponse` cases from the table. Build prompts as plain literals typed `PlayerPrompt`, copying the fixture style already used in `tests/unit/interaction-spec.test.ts`.
- [x] 2. Add the `idle command no longer offers shuffle` case to `tests/unit/prompt-registry.test.ts`.
- [x] 3. Add the two settings cases to `tests/component/AppChrome.test.ts`.
- [x] 4. Run `npm run test:unit && npm run test:component`; confirm the new cases fail.
- [x] 5. In `src/app/stores/ui-settings-store.ts`, add `autoPlaceCards` and `autoResolveTrivialPrompts` to `UiSettingsState`, to `DEFAULT_UI_SETTINGS` (both `true`), to `UiSettingsStore`, and implement `setAutoPlaceCards` / `setAutoResolveTrivialPrompts`.
- [x] 6. In `src/app/components/SettingsDialog.svelte`, add `export let onautoplacecards: (value: boolean) => void;` and `export let onautoresolvetrivialprompts: (value: boolean) => void;`, two `handle…` functions and the two `<label>`/`<input>` blocks with the `data-cy` values above.
- [x] 7. In `src/app/App.svelte`, pass `onautoplacecards={uiSettings.setAutoPlaceCards}` and `onautoresolvetrivialprompts={uiSettings.setAutoResolveTrivialPrompts}` to `<SettingsDialog>`.
- [x] 8. Create `src/app/prompts/auto-response.ts` with `trivialPromptResponse` exactly as specified.
- [x] 9. In `src/app/App.svelte`, add the `autoResolvedPromptId` variable, the `maybeAutoResolvePrompt` function and the reactive statement exactly as specified, importing `trivialPromptResponse` and `PromptId`.
- [x] 10. In `src/worker/protocol/PromptRegistry.ts`, delete the two-line `if (message.shuffle)` block from the `SELECT_IDLE_COMMAND` case.
- [x] 11. Run `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run test:component`, `npm run test:integration`.

## Outputs

- Added: `src/app/prompts/auto-response.ts`, `tests/unit/auto-response.test.ts`.
- Edited: `src/app/stores/ui-settings-store.ts`, `src/app/components/SettingsDialog.svelte`, `src/app/App.svelte`, `src/worker/protocol/PromptRegistry.ts`, `tests/unit/prompt-registry.test.ts`, `tests/component/AppChrome.test.ts`.
- Public contract for successors:
  - `UiSettingsState.autoPlaceCards: boolean` and `UiSettingsState.autoResolveTrivialPrompts: boolean`, both default `true`; setters `setAutoPlaceCards`, `setAutoResolveTrivialPrompts`.
  - `SettingsDialog` props `onautoplacecards` and `onautoresolvetrivialprompts`.
  - `trivialPromptResponse(prompt): readonly ChoiceId[] | null` in `src/app/prompts/auto-response.ts`.
  - `App.svelte` holds `autoResolvedPromptId: PromptId | null` and `maybeAutoResolvePrompt(prompt, responsePending, enabled)`; T5 adds a sibling function, it does not fold into this one.
  - No prompt ever carries `action: "shuffle"` again.
- No migration, no config change.

## Validation

- [x] `npm run format:check` exits 0
- [x] `npm run lint` exits 0
- [x] `npm run typecheck` exits 0
- [x] `npm run test:unit` exits 0
- [x] `npm run test:component` exits 0
- [x] `npm run test:integration` exits 0 (the registry change is covered there too)
- [ ] manual check: `npm run dev`, play a turn — no "Choose a chain response" dialog appears when you have nothing to chain, and the Main Phase action list no longer contains `Shuffle Deck`
- [ ] app functional — a chain prompt that *does* offer an activation still reaches you
- [ ] commit msg draft: `feat(app): auto-answer prompts that carry no decision`
</content>

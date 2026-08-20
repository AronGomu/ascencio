# T5: Automatic placement and single-click actions

**Plan:** `./artifacts/PLAN_2026_08_09_duel_field_feedback_round_2.md`
**Depends:** T4
**Commit outcome:** With auto-place on (the default) a summon/set/activation never asks where; with it off, one click on a legal zone plays the card immediately and one click outside every legal target cancels the pending action.

## Context (self-contained)

- Goal: ship 17 duel-field feedback items. This slice is items 4, 5 and 6.
- This slice: today choosing an action on a hand card opens a chip menu even when the card offers exactly one action; the engine then sends a `selectPlace` prompt, the player toggles a zone, and a `Confirm placement` button in `FieldActionBar` submits it. There is no way to abandon a placement except a `Cancel` button that only exists when the prompt is cancelable.
- Out of scope here: the drag-and-drop path (it already short-circuits placement through `pendingPlacement` and must keep working untouched), stack targets (T6), the chain UI (T11).
- Assumptions in force:
  - **A11** "most central space" is the fixed rank `[2, 1, 3, 0, 4]` over the offered sequence; extra monster zones rank after every main sequence (5 before 6); player-0 places rank before player-1 places.
  - **A12** an outside click cancels only when `prompt.cancelable` is true. A non-cancelable prompt keeps the outside click inert — no error, no toast.
- **From Depends (T4):**
  - `src/app/stores/ui-settings-store.ts` exposes `UiSettingsState.autoPlaceCards: boolean` (default `true`) and `setAutoPlaceCards(value: boolean)`.
  - `src/app/components/SettingsDialog.svelte` already renders the `Place cards automatically` checkbox (`data-cy="settings-auto-place-cards-checkbox"`) wired through the `onautoplacecards` prop; **this ticket adds no settings UI.**
  - `src/app/prompts/auto-response.ts` exports `trivialPromptResponse(prompt): readonly ChoiceId[] | null`.
  - `src/app/App.svelte` holds `let autoResolvedPromptId: PromptId | null = null;` and
    ```ts
    function maybeAutoResolvePrompt(
      prompt: PlayerPrompt | null,
      responsePending: boolean,
      enabled: boolean,
    ): void { … }
    ```
    driven by a reactive statement. This ticket **rewrites that signature** to take the settings object and to consult both resolvers.
  - No prompt carries `action: "shuffle"` any more.

## Requirements

1. New module `src/app/prompts/auto-placement.ts`:
   ```ts
   import type { ChoiceId } from "../../duel/contracts/ids.ts";
   import type { PlayerPrompt, PromptPlace } from "../../duel/contracts/player-prompt.ts";

   /** Lower is more central. Deterministic and total over every `PromptPlace`. */
   export function placementRank(place: PromptPlace): number;

   /**
    * The single most central place offered by a `selectPlace` prompt, or `null`
    * when the prompt is not a plain one-of-many placement decision.
    */
   export function centralPlacementResponse(
     prompt: PlayerPrompt,
   ): readonly ChoiceId[] | null;
   ```
   `placementRank`:
   ```ts
   const MAIN_CENTRALITY: readonly number[] = Object.freeze([2, 1, 3, 0, 4]);

   export function placementRank(place: PromptPlace): number {
     const playerTerm = place.player === 0 ? 0 : 1_000;
     if (place.location === "monster" && place.sequence > 4)
       return playerTerm + 100 + (place.sequence - 5);
     const index = MAIN_CENTRALITY.indexOf(place.sequence);
     return playerTerm + (index < 0 ? 50 + place.sequence : index);
   }
   ```
   `centralPlacementResponse` returns `null` unless **all** of: `prompt.player === 0`, `prompt.kind === "selectPlace"`, `prompt.minimum === 1`, `prompt.maximum === 1`. `selectDisabledField` must never auto-answer even though it shares the `placeSelection` spec kind. It then takes every choice with `place !== undefined`, returns `null` if there are none, sorts by `placementRank(place)` ascending with `choice.id.localeCompare(other.id)` as the tie-break, and returns `[first.id]`.
2. `src/app/App.svelte` rewrites the T4 auto-resolution hook:
   ```ts
   $: maybeAutoResolvePrompt(
     $duel.prompt,
     $duel.responsePending,
     $uiSettings,
   );

   function maybeAutoResolvePrompt(
     prompt: PlayerPrompt | null,
     responsePending: boolean,
     settings: UiSettingsState,
   ): void {
     if (prompt === null) {
       autoResolvedPromptId = null;
       return;
     }
     if (responsePending || autoResolvedPromptId === prompt.id) return;
     const choiceIds =
       (settings.autoResolveTrivialPrompts ? trivialPromptResponse(prompt) : null) ??
       (settings.autoPlaceCards ? centralPlacementResponse(prompt) : null);
     if (choiceIds === null) return;
     autoResolvedPromptId = prompt.id;
     queueMicrotask(() => duel.respond(choiceIds));
   }
   ```
   The drag-and-drop placement intent in `src/app/stores/duel-store.ts` keeps priority automatically: it answers from inside the client subscription, so `responsePending` is already `true` by the time this reactive statement runs.
3. **One click starts the action.** In `src/app/components/DuelField.svelte`, `activateCard(card)`'s `case "cardAction":` becomes: read `const choices = spec.cardChoices.get(card.targetId) ?? [];` — when `choices.length === 1` dispatch `{ type: "chooseChoice", choiceId: choices[0].id }`; otherwise keep dispatching `{ type: "openMenu", target: card.targetId }`.
4. **One click places it.** In the same file, `activateZone(zone)` becomes: when `spec.kind === "placeSelection" && spec.constraints.maximum === 1` dispatch `{ type: "chooseChoice", choiceId: choice.id }`; otherwise keep dispatching `{ type: "toggleChoice", choiceId: choice.id }`.
5. **Click outside cancels.** `src/app/components/DuelField.svelte` gets a click handler on its root `<section class="duel-field">`:
   ```ts
   const INTERACTIVE_SELECTOR =
     "[data-field-target], .card-action-chips, .field-action-bar, .field-phase-strip, .field-end-turn";

   function dismissOnOutsideClick(event: MouseEvent): void {
     if (spec === null || pending) return;
     if (!spec.constraints.cancelable) return;
     /* A `single`-family prompt rejects an empty response outright
        (`validatePromptSelection` requires exactly one choice for it, even when
        the prompt is cancelable), so cancelling one would only raise
        `invalid_response`. Chain prompts are the live example: they are
        `single` and cancelable at the same time. T11 gives them their own
        outside-click behaviour. */
     if (spec.constraints.controlFamily === "single") return;
     const origin = event.target;
     if (origin instanceof Element && origin.closest(INTERACTIVE_SELECTOR) !== null)
       return;
     dispatch({ type: "cancel" });
   }
   ```
   Wire it as `onclick={dismissOnOutsideClick}`. Do not call `preventDefault` or `stopPropagation`. Add the two Svelte a11y ignore comments already used elsewhere in the repo for a non-interactive element with a click handler.

   Reference facts you need and must not re-derive: `promptControlFamily` (`src/app/prompts/prompt-control-family.ts`) maps `selectPlace` and `selectDisabledField` to `"multiple"` and `chain`, `idleCommand`, `battleCommand`, `option`, `selectPosition` to `"single"`. `validatePromptSelection` (`src/app/prompts/prompt-selection.ts`) accepts an empty selection only for the `multiple` and `order` families, and only when `prompt.cancelable`. `spec.constraints.controlFamily` already carries the family.
6. **The redundant Confirm goes away.** In `src/app/prompts/interaction-spec.ts`, `fieldActionBarRequired(spec)` gains a leading branch:
   ```ts
   if (spec.kind === "placeSelection" && spec.constraints.maximum === 1)
     return nonEndPhaseGlobalChoiceCount(spec) > 0;
   ```
   where `nonEndPhaseGlobalChoiceCount` is the existing `[...spec.globalChoices.values()].filter((choice) => choice.action !== "endPhase").length` expression, extracted into a module-private helper so both branches share it. In `src/app/components/duel-field/FieldActionBar.svelte`, the Confirm/Cancel block condition becomes
   ```svelte
   {#if spec.kind !== "cardAction" && spec.kind !== "nonField" && !(spec.kind === "placeSelection" && spec.constraints.maximum === 1)}
   ```
7. Every rendered element keeps a unique kebab-case `data-cy`; this ticket adds no new elements.

## Inputs

- `src/app/prompts/auto-response.ts` — sibling module; same file layout and doc-comment style.
- `src/app/App.svelte` — the T4 `autoResolvedPromptId` / `maybeAutoResolvePrompt` block and its reactive statement; the `$uiSettings` store instance created by `createUiSettingsStore()`.
- `src/app/stores/ui-settings-store.ts` — `UiSettingsState` (now four booleans).
- `src/app/stores/duel-store.ts` — `armPlacementIntent`, `pendingPlacement`, and the client subscription that calls `acceptResponse([placementChoiceId])`. Read only; do not change.
- `src/app/prompts/pending-placement.ts` — `resolvePendingPlacementChoice`. Read only.
- `src/app/components/DuelField.svelte` — `activateCard`, `activateZone`, `dispatch`, the root `<section class="duel-field" …>` element, `export let spec: ActiveInteractionSpec | null`, `export let pending = false`.
- `src/app/prompts/interaction-spec.ts` — `fieldActionBarRequired`, `InteractionConstraints` (`maximum`, `cancelable`).
- `src/app/components/duel-field/FieldActionBar.svelte` — the `{#if spec.kind !== "cardAction" && spec.kind !== "nonField"}` block holding Confirm/Cancel/validation.
- `src/app/prompts/interaction-session.ts` — the `cancel` action submits an empty choice list and is only honoured when `spec.constraints.cancelable`.
- `src/duel/contracts/player-prompt.ts` — `PromptPlace` is `{ player: PlayerIndex; location: "monster" | "spellTrap" | "field" | "pendulum"; sequence: number }`.
- `tests/component/DuelField.test.ts`, `tests/component/FieldActionBar.test.ts`, `tests/unit/interaction-spec.test.ts`.
- **From Depends (T4):** listed in Context above.

## TDD

1. **Red** — add `tests/unit/auto-placement.test.ts`, the `fieldActionBarRequired` case in `tests/unit/interaction-spec.test.ts`, and the three `DuelField` interaction cases. Run `npm run test:unit && npm run test:component`; all new cases must fail.
2. **Green** — implement `auto-placement.ts`, rewrite the `App.svelte` hook, change `activateCard`/`activateZone`, add the outside-click handler, adjust `fieldActionBarRequired` and the `FieldActionBar` condition.
3. **Refactor** — only if needed. Keep green.

## Test plan

| Test | Input | Expect |
| --- | --- | --- |
| `ranks the centre monster zone first` | `placementRank` over sequences 0-4, location `monster`, player 0 | ascending rank order is `2, 1, 3, 0, 4` |
| `ranks extra monster zones after the main row` | `placementRank({player:0,location:"monster",sequence:5})` | greater than `placementRank` of every sequence 0-4 and less than sequence 6 |
| `ranks the opponent side last` | same sequence, `player: 1` vs `player: 0` | player 1's rank is greater |
| `picks the central place` | `selectPlace` prompt offering monster sequences `0, 2, 4` | `["<id of sequence 2>"]` |
| `falls back to the next most central` | `selectPlace` prompt offering monster sequences `0, 3, 4` | `["<id of sequence 3>"]` |
| `ignores prompts that are not selectPlace` | `selectDisabledField` prompt with one place choice | `null` |
| `ignores multi-place prompts` | `selectPlace` with `minimum: 2` | `null` |
| `ignores prompts addressed to the opponent` | `selectPlace`, `player: 1` | `null` |
| `single-choice card fires the action directly` | render `DuelField` with a `cardAction` spec whose card has one choice `c1`; click the card target | `oninteraction` receives `{ type: "chooseChoice", choiceId: "c1", key }` — **not** `openMenu` |
| `multi-choice card still opens the menu` | same with two choices | `oninteraction` receives `{ type: "openMenu", target }` |
| `zone click submits a single placement` | render with a `placeSelection` spec, `maximum: 1`; click a zone | `oninteraction` receives `{ type: "chooseChoice", choiceId, key }` |
| `outside click cancels a cancelable prompt` | `placeSelection` spec with `cancelable: true`; click `duel-field-board-surface` | `oninteraction` receives `{ type: "cancel", key }` |
| `outside click is inert when not cancelable` | same with `cancelable: false` | `oninteraction` not called |
| `outside click is inert for a single-choice prompt` | `cardAction` spec from a `chain` prompt with `cancelable: true` and `controlFamily: "single"`; click `duel-field-board-surface` | `oninteraction` not called |
| `outside click ignores clicks on targets` | click a zone that is a field target | no `cancel` action dispatched |
| `single placement needs no confirm bar` | `fieldActionBarRequired` with a `placeSelection` spec, `maximum: 1`, no global choices | `false` |
| `single placement still shows the bar for global choices` | same but with one non-`endPhase` global choice | `true` |

## Impl steps

- [x] 1. Create `tests/unit/auto-placement.test.ts` with the eight `placementRank` / `centralPlacementResponse` cases.
- [x] 2. Add the two `fieldActionBarRequired` cases to `tests/unit/interaction-spec.test.ts`.
- [x] 3. Add the six `DuelField` cases to `tests/component/DuelField.test.ts`. (Added 7: the table's full set, plus fixed 4 pre-existing tests whose fixtures directly conflicted with the new one-click/auto-place behaviour — see report.)
- [x] 4. Run `npm run test:unit && npm run test:component`; confirm the new cases fail. (Confirmed via targeted runs before each impl piece landed; see report for the exact failing-then-passing sequence.)
- [x] 5. Create `src/app/prompts/auto-placement.ts` with `MAIN_CENTRALITY`, `placementRank` and `centralPlacementResponse` exactly as specified.
- [x] 6. In `src/app/App.svelte`, import `centralPlacementResponse` and `UiSettingsState`, change `maybeAutoResolvePrompt` to the three-argument settings form above, and change the reactive statement to pass `$uiSettings`.
- [x] 7. In `src/app/components/DuelField.svelte`, change `activateCard`'s `cardAction` branch to fire `chooseChoice` when there is exactly one choice.
- [x] 8. In `src/app/components/DuelField.svelte`, change `activateZone` to fire `chooseChoice` for a `placeSelection` spec with `maximum === 1`.
- [x] 9. In `src/app/components/DuelField.svelte`, add `INTERACTIVE_SELECTOR`, `dismissOnOutsideClick` and `onclick={dismissOnOutsideClick}` on the root section, with the a11y ignore comments. (`svelte-check` required both `a11y_no_noninteractive_element_interactions` and `a11y_click_events_have_key_events` for a `<section>`, not the `<div>` pairing used by SettingsDialog/MenuDialog — used the pair `svelte-check` actually demanded.)
- [x] 10. In `src/app/prompts/interaction-spec.ts`, extract `nonEndPhaseGlobalChoiceCount(spec)` and add the leading `placeSelection` branch to `fieldActionBarRequired`.
- [x] 11. In `src/app/components/duel-field/FieldActionBar.svelte`, extend the Confirm/Cancel block condition as specified.
- [x] 12. Run `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run test:component`. All exit 0 (520 unit, 150 component).
- [x] 13. Run the chromium e2e suite (see Validation). If a spec fails because a placement no longer needs `field-action-bar-confirm`, update the spec to the new one-click flow — that is the intended behaviour change. (Full suite 18/18 green; the keyboard-only duel walker required disabling `settings-auto-place-cards-checkbox` alongside the existing auto-resolve toggle, and `chooseValidFieldSubset`/`setHandMonsterWithKeyboard` needed updating for the one-click zone/card-action path — see report.)

## Outputs

- Added: `src/app/prompts/auto-placement.ts`, `tests/unit/auto-placement.test.ts`.
- Edited: `src/app/App.svelte`, `src/app/components/DuelField.svelte`, `src/app/prompts/interaction-spec.ts`, `src/app/components/duel-field/FieldActionBar.svelte`, `tests/unit/interaction-spec.test.ts`, `tests/component/DuelField.test.ts`, and any e2e spec that drove the old two-step placement.
- Public contract for successors: `placementRank(place)` and `centralPlacementResponse(prompt)` in `src/app/prompts/auto-placement.ts`; `fieldActionBarRequired` returns `false` for single-place prompts with no extra global choices; `DuelField` cancels on an outside click when the prompt is cancelable.
- No migration, no config change.

## Validation

- [x] `npm run format:check` exits 0
- [x] `npm run lint` exits 0
- [x] `npm run typecheck` exits 0
- [x] `npm run test:unit` exits 0 (520 passed)
- [x] `npm run test:component` exits 0 (150 passed)
- [x] chromium e2e exits 0: (18/18 passed; re-ran the two seed-random duel-walking specs — keyboard-only walker and drag-and-drop — an extra 2x each to confirm, plus one flaky unrelated hover assertion re-run clean; see report)
  ```bash
  cd /home/aron/projects/ascencio
  timeout 590 nix-shell -p playwright-driver.browsers glib gtk3 nss nspr dbus atk cups \
    libdrm expat libx11 libxcomposite libxdamage libxext libxfixes libxrandr mesa \
    alsa-lib at-spi2-atk at-spi2-core cairo pango xorg.xvfb --run '
  export PLAYWRIGHT_BROWSERS_PATH=/home/aron/projects/ascencio/.tmp/pw-browsers
  npx playwright test --project=chromium
  '
  ```
  **This exact command was verified green by the orchestrator on 2026-08-10** (`1 passed` on `-g "production bundle initializes"`). Run it verbatim from the repo root.
  - `PLAYWRIGHT_BROWSERS_PATH=.tmp/pw-browsers` is mandatory. That directory holds symlinks to the nix-patched browsers in `/nix/store/8ilw3r312xcs1ylxg4g274rhf2frp9z4-playwright-browsers` under the revision names playwright 1.61 expects (`chromium-1228 -> chromium-1217`). The mismatched revision numbers are deliberate and fine.
  - Without the override, Playwright picks `~/.cache/ms-playwright`, whose binaries are unpatched and die with `libglib-2.0.so.0: cannot open shared object file`. That error means the override is missing, not that the `-p` list is wrong.
  - `playwright-driver.browsers` and `xorg.xvfb` are both required in the `-p` list even though Xvfb is never launched. Do not simplify the list.
  - If `.tmp/pw-browsers` is gone, recreate it: `S=/nix/store/8ilw3r312xcs1ylxg4g274rhf2frp9z4-playwright-browsers` (rebuild with `nix-build '<nixpkgs>' -A playwright-driver.browsers --no-out-link` if the path is garbage-collected), then `mkdir -p .tmp/pw-browsers && cd .tmp/pw-browsers && ln -sfn $S/chromium-1217 chromium-1228 && ln -sfn $S/chromium_headless_shell-1217 chromium_headless_shell-1228 && ln -sfn $S/ffmpeg-1011 ffmpeg-1011 && ln -sfn $S/firefox-1511 firefox-1532`.
  - Run it in the **foreground**, blocking. Runs take 1-5 min; `webServer` builds and starts the preview itself, so do not hand-start `npm run preview`.
  - The duel seed is random per run (`crypto.getRandomValues`). A single pass of a duel-walking test proves little; if a duel-walking test is the one you changed, run the suite 3 times before calling it green.
- [ ] manual check with auto-place **on**: `npm run dev`, summon a monster — it lands in the centre zone with no second prompt
- [ ] manual check with auto-place **off**: summon a monster — the legal zones halo, one click on a zone plays the card, one click on empty field cancels
- [ ] app functional — dragging a hand card onto a zone still works and still wins over auto-placement
- [ ] commit msg draft: `feat(field): place cards automatically and act in one click`
</content>

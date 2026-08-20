# T8: Full Control toggle + Ctrl hold

**Plan:** `./artifacts/PLAN_2026_08_16_duel_feedback_round_4.md`
**Depends:** none
**Commit outcome:** "Full Control" checkbox at bottom-right of the duel field; unchecked = chain windows for your own effects/actions auto-pass; checked (or Ctrl held) = every core decision surfaces; Ctrl release reverts unless manually checked.

## Context (self-contained)

- Goal: duel feedback round 4 — YGO story duel simulator (Svelte 5). User spec (grilled + confirmed, see `artifacts/GRILL_2026_08_16_duel_feedback_round_4/ANSWERS.md`): checkbox "Full Control" bottom-right of duel field. Checked → EVERY ocgcore decision surfaces (all auto answers off). Unchecked → chain windows caused by your own effects/actions auto-pass. Opponent's meaningful action + anything activatable → always prompt, full control or not. Holding Ctrl temporarily checks it; release unchecks unless manually checked.
- Decision (ADR-028 `docs/ADR/028_ADR_full_control_and_default_chain_pass.md`):
  - OFF (default): existing auto-resolution (`trivialPromptResponse`, `centralPlacementResponse`, ADR-009) stays, PLUS: a `chain` prompt for player 0 auto-passes when it is attributed to the player, where attribution =
    1. chain non-empty → last chain link's `controller`;
    2. chain empty → player of the last `summon | specialSummon | flipSummon | set | positionChanged | attack` presentation event since the last `turnStarted`; none → the turn player.
  - ON (or Ctrl held): ALL auto-resolution disabled — trivial, chain pass, auto-place. Every decision surfaces.
  - Session-only, default unchecked, not persisted.
- Fact (scouted): `MSG_SELECT_CHAIN` carries no actor field (`vendor/ocgcore-wasm/0.1.2/dist/index.d.ts` — `spe_count`/`hint_timing` only). Presentation events DO carry `player` (`src/battle/duel/contracts/duel-presentation-event.ts`): `summon|specialSummon|flipSummon|set` + `player`, `positionChanged` (check its fields — if no `player`, derive from `card.controller`; if absent, drop positionChanged from the attribution list and note it), `attack` + `player`, `turnStarted` + `player`.
- This slice: settings store field, auto-response functions, App wiring (Ctrl listeners + gating + actor tracking), toggle component + CSS.
- Out of scope here: persistence, SettingsDialog entry, story shell, opponent-side behavior changes.
- Assumptions in force: prompt auto-resolution lives in `App.svelte` `maybeAutoResolvePrompt` reactive statement (one attempt per prompt id via `autoResolvedPromptId`).

## Requirements

- `UiSettingsState` gains `fullControl: boolean` (default `false`) + `setFullControl(value)`.
- Two new functions in `src/battle/app/prompts/auto-response.ts`:
  ```ts
  export function lastActionActor(
    events: readonly DuelPresentationEvent[],
    turnPlayer: PlayerIndex,
  ): PlayerIndex;
  ```
  Scan `events` from the end: first `summon|specialSummon|flipSummon|set|positionChanged|attack` → its `player`; hitting `turnStarted` first → `turnPlayer`. Empty list → `turnPlayer`.
  ```ts
  export function ownEffectChainPassResponse(
    prompt: PlayerPrompt,
    snapshot: PublicDuelState | null,
    actor: PlayerIndex,
  ): readonly ChoiceId[] | null;
  ```
  Returns `[passChoice.id]` iff: `prompt.kind === "chain"`, `prompt.player === 0`, a choice with `action === "pass"` exists, and (`snapshot !== null && snapshot.chain.length > 0` ? `snapshot.chain.at(-1)!.controller === 0` : `actor === 0`). Else `null`.
- App: `ctrlHeld` via `<svelte:window onkeydown onkeyup onblur>`; `effectiveFullControl = $uiSettings.fullControl || ctrlHeld`; auto-resolve gate:
  - `effectiveFullControl === true` → skip ALL auto answers (mark `autoResolvedPromptId = prompt.id` so unchecking mid-prompt never answers a prompt the player already saw).
  - else → `trivialPromptResponse(prompt)` ?? `ownEffectChainPassResponse(prompt, $duel.snapshot, actor)` ?? (`autoPlaceCards` ? `centralPlacementResponse(prompt)` : null), where `actor = lastActionActor($duel.presentationEvents.map(({ event }) => event), $duel.snapshot?.turnPlayer ?? 0)`.
- New `src/battle/app/components/duel-field/FullControlToggle.svelte`:
  ```ts
  export let effective: boolean;
  export let onchange: (value: boolean) => void;
  ```
  Markup: `<label class="full-control-toggle" data-cy="full-control-toggle"><input type="checkbox" checked={effective} onchange={(e) => onchange(e.currentTarget.checked)} data-cy="full-control-checkbox" /><span class="full-control-toggle__text" data-cy="full-control-label">Full Control</span></label>`. Every element carries `data-cy` (repo gate `tests/unit/data-cy-coverage.test.ts`).
- Placement: rendered in `App.svelte` inside `<div class="duel-field-slot">`, sibling after `DuelFieldErrorBoundary`. CSS in `src/styles/app.css`: `.duel-field-slot { position: relative; }` (add if absent) and `.full-control-toggle { position: absolute; right: 0.5rem; bottom: 0.5rem; z-index: var(--duel-field-layer-control); display: inline-flex; gap: 0.3rem; align-items: center; font-size: 0.7rem; color: var(--muted); }`.

## Inputs

- `src/battle/app/stores/ui-settings-store.ts` — `UiSettingsState`, `DEFAULT_UI_SETTINGS`, setter pattern of `setAutoPlaceCards`.
- `src/battle/app/prompts/auto-response.ts` — `trivialPromptResponse` (pass-choice lookup pattern).
- `src/battle/app/App.svelte` — `maybeAutoResolvePrompt(prompt, responsePending, settings)` + its `$:` statement; `$duel.presentationEvents` (`SequencedPresentationEvent[]`, `{ sequence, event }`).
- `src/battle/duel/contracts/public-duel-state.ts` — `PublicChainLink.controller`, `PublicDuelState.chain`, `turnPlayer`.
- `src/battle/duel/contracts/duel-presentation-event.ts` — event union (verify `positionChanged` actor field before listing it).
- Tests: `tests/unit/auto-response.test.ts`, `tests/unit/ui-settings-store.test.ts`, new `tests/component/FullControlToggle.test.ts`.

## TDD

1. **Red**
   - `tests/unit/auto-response.test.ts` — `lastActionActor`:
     - `attributes to the player of the latest action event` (events `[turnStarted p1, summon p1, attack p0]` → 0).
     - `falls back to the turn player after a fresh turn` (events end with `turnStarted p1` → 1).
     - `falls back to the turn player with no events` (`[]`, turnPlayer 1 → 1).
   - `tests/unit/auto-response.test.ts` — `ownEffectChainPassResponse`:
     - `passes a chain window responding to the player's own effect` (chain tail controller 0, activatable choice present → `[passId]`).
     - `keeps prompting when the opponent owns the last chain link` (tail controller 1 → `null`).
     - `passes an empty-chain window after the player's own action` (`chain: []`, actor 0 → `[passId]`).
     - `keeps prompting an empty-chain window after an opponent action` (`chain: []`, actor 1 → `null`).
     - `keeps prompting without a pass choice` (→ `null`).
   - `tests/unit/ui-settings-store.test.ts` — `fullControl defaults off and toggles`.
   - `tests/component/FullControlToggle.test.ts` (new) — `renders the Full Control label`, `reports checkbox changes`, `reflects the effective value`.
2. **Green** — impl below.
3. **Refactor** — none.

## Test plan

| Test | Input | Expect |
| ---- | ----- | ------ |
| latest action event wins | […, attack p0] | actor 0 |
| turnStarted resets attribution | […, turnStarted p1] | actor 1 (turn player) |
| own chain tail passes | tail controller 0 | `[passChoiceId]` |
| opponent chain tail prompts | tail controller 1 | `null` |
| own-action empty chain passes | chain [], actor 0 | `[passChoiceId]` |
| opponent-action empty chain prompts | chain [], actor 1 | `null` |
| no pass choice | — | `null` |
| fullControl store + toggle component | ops/clicks | default off; onchange fires; checked reflects prop |

## Impl steps

- [ ] 1. Verify `positionChanged` event actor field in `duel-presentation-event.ts`; fix the attribution list accordingly.
- [ ] 2. Write unit tests; `npm run test:unit -- tests/unit/auto-response.test.ts tests/unit/ui-settings-store.test.ts`; red.
- [ ] 3. `ui-settings-store.ts`: add `fullControl: false` + `setFullControl` (interface + impl).
- [ ] 4. `auto-response.ts`: implement `lastActionActor` + `ownEffectChainPassResponse`.
- [ ] 5. Unit tests green.
- [ ] 6. Component test (red) → create `FullControlToggle.svelte` → green.
- [ ] 7. `App.svelte`: `ctrlHeld` window listeners (`e.key === "Control"`; blur clears); `effectiveFullControl`; extend `maybeAutoResolvePrompt(prompt, responsePending, settings, fullControl, snapshot, events)` per Requirements + update its `$:` statement deps; render toggle in `.duel-field-slot`.
- [ ] 8. CSS block per Requirements.
- [ ] 9. `npm run test:unit && npm run test:component && npm run typecheck && npm run lint`.
- [ ] 10. Manual check: toggle off — own spell activation: no chain window; own summon: no response window; opponent activation with your trap set: window appears. Hold Ctrl: checkbox ticks + windows appear for own effects; release: unticks. Manual check survives Ctrl release. Toggle on: placement + single-option prompts surface too.

## Outputs

- Files touched: `ui-settings-store.ts`, `auto-response.ts`, `App.svelte`, new `FullControlToggle.svelte`, `src/styles/app.css`, `tests/unit/auto-response.test.ts`, `tests/unit/ui-settings-store.test.ts`, new `tests/component/FullControlToggle.test.ts`.
- Public API: `UiSettingsState.fullControl`, `lastActionActor(events, turnPlayer)`, `ownEffectChainPassResponse(prompt, snapshot, actor)`.
- Migrate/config: none (session-only).

## Validation

- [ ] tests pass: `npm run test:unit`, `npm run test:component`
- [ ] manual check: matrix in step 10
- [ ] app functional — no broken path from this slice
- [ ] commit msg draft: `feat(field): Full Control toggle gates own-effect windows, Ctrl holds it`

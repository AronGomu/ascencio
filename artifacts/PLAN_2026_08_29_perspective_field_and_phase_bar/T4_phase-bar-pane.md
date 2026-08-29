# T4: Phase bar pane replaces the centre strip

**Plan:** `./artifacts/PLAN_2026_08_29_perspective_field_and_phase_bar.md`
**Depends:** T1
**Commit outcome:** phases live in a full-height vertical pane right of the duel field (opponent red top half, player blue bottom half); the centre `PhaseStrip` is deleted; End turn is a chip that goes warning-yellow when enabled.

## Context (self-contained)

- Goal: perspective field + relocated phase UI. This slice is the phase UI.
- This slice: new `PhaseBar.svelte` mounted in `App.svelte`'s `.duel-shell`, `PhaseStrip.svelte` + `EndTurnButton.svelte` + their CSS removed.
- Out of scope here: any field/board change beyond deleting the strip mount; DuelRail stays untouched (still shows turn/phase text + LP).
- Assumptions in force: A1 (bar sits between field slot and DuelRail), A2 (LP stays in DuelRail).

## Requirements

- Pane layout (validated prototype `artifacts/prototype_field_perspective.html`): full shell height, split at the exact middle. Bottom half = player, blue tint; top half = opponent, red tint; both gradients fade toward the middle seam.
- Player half, middle → down: Draw, Standby, Main 1, Battle, Main 2, End turn. Opponent half, middle → up: Draw, Standby, Main 1, Battle, Main 2, End — DOM top-to-bottom therefore `end, main2, battle, main1, standby, draw`.
- Chip behavior = existing `PhaseStrip` contract, unchanged:
  - `<button>` only when `!disabled && phaseSlotChoices(spec).has(slot)`; otherwise `<span role="presentation">` (inert, `pointer-events: none`).
  - Current phase (from `phaseSlotForDuelPhase(phase)`) wears the accent ring — on the half belonging to `turnPlayer` only.
  - Click dispatches `{ type: "chooseChoice", choiceId, key: spec.key }` via `oninteraction`.
  - aria-label: `"{label} phase" + ", current" + ", available"` as applicable.
- End turn: chip-shaped (pill, same metrics as other chips), rendered as `<button data-cy="field-end-turn-button">`; label = `endPhaseChoice(spec)?.label ?? "End turn"` (engine label wins, e.g. "End Battle Phase"); disabled unless the choice exists; enabled state = warning yellow (`var(--warning)` bg, `var(--ink-on-warning)` text, hover `var(--selected-strong)`); disabled state = the same muted chip recipe as inert phase chips (no yellow, no 0.55-opacity yellow).
- Opponent End chip: plain chip, never a button (opponent turns never offer the local player a choice — `spec` is null/empty then).
- The opponent half lights `data-current-phase` when `turnPlayer === 1`, player half when `turnPlayer === 0`.
- Every element carries unique kebab-case `data-cy` (`tests/unit/data-cy-coverage.test.ts` enforces).

## Inputs

- **From T1:** nothing runtime — only that `FieldGeometry.bandY/emzX` consumers may change; this ticket deletes the last one (`PhaseStrip`).
- `src/battle/app/prompts/phase-transitions.ts` — `PHASE_SLOT_LABELS`, `phaseSlotChoices`, `phaseSlotForDuelPhase`, `PhaseSlot` (reuse; `PHASE_SLOTS_LEFT/RIGHT` become dead — delete them and their import sites).
- `src/battle/app/prompts/interaction-spec.ts` — `endPhaseChoice(spec)`.
- `src/battle/app/components/duel-field/PhaseStrip.svelte`, `EndTurnButton.svelte` — delete.
- `src/battle/app/components/DuelField.svelte:1372-1380` — strip mount to remove (T2 may have moved it inside the plane wrapper; delete wherever it sits). Only the `{extraMonsterZones}` pass-through at the mount dies — the `extraMonsterZones` derivation (`:293`) stays, it feeds `createFieldRenderLayout` and `getFieldWindows`. `phase` prop: trace remaining consumers before deleting.
- `src/battle/app/App.svelte:1440-1533` — `.duel-shell` grid; `$duel.snapshot.turnPlayer` available (already passed to DuelRail `:1521`).
- `src/styles/app.css` — `.field-phase-strip*`, `.field-end-turn` blocks to delete; `.duel-shell` `grid-template-columns` to extend.
- `tests/component/PhaseStrip.test.ts` — replace with `PhaseBar.test.ts`.
- `tests/component/EndTurnButton.test.ts` — delete (component dies); port its label/disable cases into `PhaseBar.test.ts`.
- `tests/unit/phase-transitions.test.ts:3-4,49-58` — imports and asserts `PHASE_SLOTS_LEFT`/`PHASE_SLOTS_RIGHT`; drop those cases with the exports.
- `e2e-acceptance/full-height-field.spec.ts` — acceptance consumer for live board/phase-bar geometry and 44px actionable controls.

## Interface contract (level 5)

- **Produces:**

```svelte
<!-- src/battle/app/components/PhaseBar.svelte (app-level pane, sibling of DuelRail) -->
export let phase: DuelPhase = "unknown"; export let turnPlayer: PlayerIndex = 0; export
let spec: ActiveInteractionSpec | null = null; export let disabled = false; export
let oninteraction: (action: InteractionSessionAction) => unknown = () => false;
```

```html
<aside class="phase-bar" data-cy="phase-bar" role="group" aria-label="Duel phases">
  <div class="phase-bar__half phase-bar__half--opponent" data-cy="phase-bar-opponent"
       data-current-phase={turnPlayer === 1 ? currentSlot : undefined}>
    <!-- chips data-cy="phase-bar-opp-{slot}", slot ∈ end,main2,battle,main1,standby,draw (DOM order) -->
  </div>
  <div class="phase-bar__half phase-bar__half--player" data-cy="phase-bar-player"
       data-current-phase={turnPlayer === 0 ? currentSlot : undefined}>
    <!-- chips data-cy="phase-bar-you-{slot}", slot ∈ draw,standby,main1,battle,main2 -->
    <button data-cy="field-end-turn-button" class="phase-chip phase-chip--end-turn" ...>
  </div>
</aside>
```

```css
.duel-shell {
  grid-template-columns: var(--preview-w) auto var(--phase-bar-w, 8rem) minmax(
      var(--rail-min),
      1fr
    );
}
.phase-bar {
  display: flex;
  flex-direction: column;
  min-height: 0;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}
.phase-bar__half {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px;
  min-height: 0;
}
.phase-bar__half--opponent {
  justify-content: flex-end;
  border-bottom: 1px solid var(--border);
  background: linear-gradient(
    0deg,
    color-mix(in srgb, var(--danger) 30%, var(--surface)),
    color-mix(in srgb, var(--danger) 12%, var(--surface))
  );
}
.phase-bar__half--player {
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--phase-player) 30%, var(--surface)),
    color-mix(in srgb, var(--phase-player) 12%, var(--surface))
  );
}
/* .phase-chip: reuse .field-phase-chip recipe (pill, min-block-size 34px, width 100%);
   .is-current / .is-available identical to the strip's rules.
   .phase-chip--end-turn:not(:disabled) { background: var(--warning); color: var(--ink-on-warning); }
   .phase-chip--end-turn:hover:not(:disabled) { background: var(--selected-strong); } */
```

Blue: no existing blue token — introduce `--phase-player: #2b5f9e;` beside the other theme tokens in `tokens.css` rather than hardcoding in the rule (both themes if a light theme block exists).

- **Consumes (binding, from existing modules — do not redesign):**
  - `phaseSlotChoices(spec): ReadonlyMap<PhaseSlot, InteractionChoice>` — availability.
  - `phaseSlotForDuelPhase(phase): PhaseSlot | null` — current.
  - `endPhaseChoice(spec): InteractionChoice | null` — End turn label + enable.
  - `oninteraction({type:"chooseChoice", choiceId, key: spec.key})` — dispatch, same as `App.svelte` already passes `duel.dispatchInteraction`.
- **Errors:** none; empty/null `spec` renders a fully inert bar.
- **Invariants:**
  - `data-cy="field-end-turn-button"` value preserved (existing e2e reference it).
  - Exactly one current carrier across the bar at any time (or none for `unknown`). During the player's End Phase the player half has no `end` chip — the End-turn button itself carries `.is-current` then (it is the sixth slot of that half).
  - Bar never renders during deck pick (mounted inside the same `{#if duelBoard || $duel.snapshot}` shell block).
- **Integration links:** trigger click on `[data-cy="phase-bar-you-battle"]` → dispatch `duel.dispatchInteraction` chooseChoice → engine advances phase → Worker projects new snapshot → observe `data-current-phase="battle"` on the player half. Covered by component test with stubbed `oninteraction` + e2e phase advance.

## TDD

1. **Red** — port `PhaseStrip.test.ts` cases to `tests/component/PhaseBar.test.ts` (availability, current, dispatch, aria) + new ones (halves, order, turnPlayer routing, End turn label/yellow).
2. **Green** — component + mount + CSS.
3. **Refactor** — delete strip/EndTurnButton/CSS/dead exports; keep green.

## Test plan

| Test              | Input                                             | Expect                                                                                    |
| ----------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| order player      | render, any state                                 | player half DOM order draw→standby→main1→battle→main2→end-turn                            |
| order opponent    | render                                            | opponent half DOM order end→main2→battle→main1→standby→draw                               |
| availability      | spec offering battle+end at main1                 | `phase-bar-you-battle` is BUTTON; draw/standby/main1/main2 are SPAN                       |
| dispatch          | click `phase-bar-you-battle`                      | `oninteraction` called with `{type:"chooseChoice", choiceId, key}`                        |
| current routing   | `phase="main1"`, `turnPlayer=1`                   | opponent `main1` chip `.is-current`; player `main1` chip not                              |
| end turn label    | spec with endPhaseChoice label "End Battle Phase" | button text "End Battle Phase", enabled                                                   |
| end turn disabled | `spec=null`                                       | button disabled, no warning background class logic applied (assert via class/attr)        |
| disabled prop     | `disabled=true`, offering spec                    | zero BUTTON chips, End turn disabled                                                      |
| end-phase current | `phase="end"`, `turnPlayer=0`                     | End-turn button has `.is-current`; no other player-half chip does                         |
| aria              | current+available slot                            | label "Battle phase, current, available"                                                  |
| strip gone        | repo grep                                         | `PhaseStrip`, `EndTurnButton`, `field-phase-strip`, `PHASE_SLOTS_LEFT` absent from `src/` |

## Impl steps

- [x] 1. Red `tests/component/PhaseBar.test.ts`; verify: targeted Vitest fails because `PhaseBar.svelte` does not exist.
- [x] 2. `PhaseBar.svelte` + `--phase-player` token + CSS; verify: targeted `PhaseBar.test.ts` passes.
- [x] 3. Mount in `App.svelte` between field slot and DuelRail; pass `phase`, `turnPlayer`, `spec: fieldInteractionSpec`, `disabled: $duel.responsePending`, `oninteraction: duel.dispatchInteraction`; extend `.duel-shell` columns; verify: `npm run check:headless` passes.
- [x] 4. Delete PhaseStrip/EndTurnButton mounts, files, CSS blocks, `PHASE_SLOTS_LEFT/RIGHT`; drop now-unused DuelField props (trace first; keep the `extraMonsterZones` derivation); verify: `grep -R -E "PhaseStrip|EndTurnButton|field-phase-strip|PHASE_SLOTS_(LEFT|RIGHT)" src tests` returns no matches.
- [x] 5. Delete `tests/component/PhaseStrip.test.ts` + `tests/component/EndTurnButton.test.ts`; trim `tests/unit/phase-transitions.test.ts` slot-array cases; verify: `npx vitest run tests/component/PhaseBar.test.ts tests/component/DuelField.test.ts tests/unit/phase-transitions.test.ts tests/unit/data-cy-coverage.test.ts` passes.

## Post-review repair

- [x] 6. Register `e2e-acceptance/full-height-field.spec.ts` as a T4 Input — verify: ticket Inputs name the acceptance consumer and its geometry/44px coverage.
- [x] 7. Include the engine End choice label plus current/available suffixes in the button's accessible name — verify: `npx vitest run tests/component/PhaseBar.test.ts` passes a component assertion for `End Battle Phase, current, available`.
- [x] 8. Match the locked opponent/player gradient directions and strengths; correct stale phase-strip/field-width comments in touched source/CSS — verify: targeted source grep contains no stale strip comments and CSS declarations match the T4 interface contract.
- [x] 9. Rewrite acceptance phase checks around the live phase bar, remove obsolete strip-only geometry, preserve 44px actionable-control proof — verify: `npm run test:acceptance` passes.
- [x] 10. Run combined repair gate — verify: focused Vitest, `npm run check:headless`, `PLAYWRIGHT_PORT=4302 npx playwright test e2e/duel-smoke.spec.ts`, `npm run test:acceptance`, narrow 1280×720 smoke when separate, and diff/secret/residue/conflict checks all pass after final mutation.

## Validation

- [x] `npm run check:headless`; verify: exit 0.
- [x] `npx playwright test`; verify: exit 0, including any spec touching `field-end-turn-button` or phase chips.
- [ ] manual: full duel turn cycle through the bar; verify: opponent turn shows red-half highlight and every opponent chip is inert.
- [x] no silent-failure swallow added; verify: final diff adds no empty catch or ignored error (`none` expected).
- [x] app functional; verify: at 1280×720 `--phase-bar-w` bar column stays visible without crushing field.
- [ ] commit msg draft: `feat(duel): move phases into a split vertical bar beside the field`; verify: local commit subject matches exactly.

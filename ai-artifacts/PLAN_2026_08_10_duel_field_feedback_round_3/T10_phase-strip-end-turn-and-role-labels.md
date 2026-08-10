# T10: Phase strip, End turn button and role labels

**Plan:** `./ai-artifacts/PLAN_2026_08_10_duel_field_feedback_round_3.md`
**Depends:** T7
**Commit outcome:** Draw→Battle sits left of the shared Extra Monster Zones; Main 2 plus one yellow End turn button sits right; the old End chip is gone; header life points are labelled only `Opponent` and `You`; retired field status pills stay absent.

## Context (self-contained)

- Goal: ship all 30 items of `feedback.md`.
- Covers items 8, 22, 24 and 26.
- Round 2 already deleted field status pills; item 26 is a regression lock, not a component deletion.
- Current phase strip splits three chips left (`draw`, `standby`, `main1`) and three right (`battle`, `main2`, `end`), while `EndTurnButton` is separately absolute at field right. Item 24 requires the button to occupy the End chip's role, not coexist with it.
- Out of scope: battle dialog routing (T15), hiding EMZ/continuous strip (T11), deck names (never shown), changing engine phase choices.
- **From T7:** central/shared coordinates may have shifted. Browser rectangles, not hardcoded comments, prove no overlap.

## Requirements

- Rendered left phase group is exactly `draw`, `standby`, `main1`, `battle` in that order.
- Rendered right phase group contains `main2`, then exactly one `EndTurnButton`.
- No `field-phase-chip-end` exists. `end` stays in `PhaseSlot`, `PHASE_SLOT_LABELS`, `phaseSlotForDuelPhase` and choice mapping so current End phase can still be represented and `EndTurnButton` can consume `endPhase`.
- `EndTurnButton` moves inside `PhaseStrip`; `DuelField.svelte` no longer renders a second copy.
- End button retains `data-cy="field-end-turn-button"`, existing choice label, disabled/pending logic, one dispatch, yellow/warning style, and ≥44×44 px target.
- Left group's right edge remains left of the left shared EMZ. Right group's left edge remains right of the right shared EMZ. No playable field target overlaps a phase/button rect.
- `DuelHeaderBar` renders static visible role labels `Opponent` beside p1 LP and `You` beside p0 LP. LP selectors and formatting stay.
- No deck/archetype name appears in header or field.
- No `field-status-pills`, `prio-pill`, `phase-pill`, or opponent-hand status badge exists inside `.duel-field`. `CardPreviewPanel` status remains; ADR-010/round 2 assigned current-action status there.

## Inputs

- `src/app/prompts/phase-transitions.ts` — `PHASE_SLOTS_LEFT`, `PHASE_SLOTS_RIGHT`, `PHASE_SLOT_LABELS`, phase mapping and `phaseSlotChoices`.
- `src/app/components/duel-field/PhaseStrip.svelte:49-92` — loops left and right arrays.
- `src/app/components/duel-field/EndTurnButton.svelte` — accepted dispatch/disabled behaviour; no business-logic rewrite.
- `src/app/components/DuelField.svelte:43-44` — imports both; `:481-482` renders both siblings.
- `src/styles/app.css:815-862` — strip/groups/chips; `:1274-1285` — separately absolute end button.
- `src/app/components/DuelHeaderBar.svelte:11-38` — p1/p0 avatar + LP; `data-cy="duel-header-life-points-p1|p0"` must survive.
- `tests/unit/phase-transitions.test.ts`, `tests/component/PhaseStrip.test.ts`, `tests/component/EndTurnButton.test.ts`, `tests/component/DuelHeaderBar.test.ts`.
- `tests/component/DuelField.test.ts:173-175` — negative status-pill assertions already exist.
- `docs/ADR/010_ADR_in_field_phase_navigation.md` — round-2 phase placement decision; amend its consequences rather than creating a competing ADR.
- **From Depends (T7):** labels and geometry final; T10 uses actual shared EMZ DOM rects.

## API changes

`phase-transitions.ts`:

```ts
export const PHASE_SLOTS_LEFT = [
  "draw",
  "standby",
  "main1",
  "battle",
] as const;
export const PHASE_SLOTS_RIGHT = ["main2"] as const;
```

`PhaseStrip.svelte` imports `EndTurnButton` and renders it after the right loop with existing `{spec}`, `{disabled}`, `{oninteraction}` props.

`DuelHeaderBar` markup uses separate elements so tests/CSS do not parse combined text:

```html
<span data-cy="duel-header-role-p1">Opponent</span>
<p data-cy="duel-header-life-points-p1">8,000 LP</p>
...
<span data-cy="duel-header-role-p0">You</span>
<p data-cy="duel-header-life-points-p0">8,000 LP</p>
```

Before snapshot, roles remain and LP values are `—`.

## TDD

1. **Red** — slot arrays, phase DOM grouping, header roles and browser position checks.
2. **Green** — repartition arrays, move one component, adjust CSS.
3. **Refactor** — remove obsolete absolute-button gutter/comment only after overlap tests pass.

## Test plan

Update `tests/unit/phase-transitions.test.ts`:

| Test | Expect |
| ---- | ---- |
| rendered slot partition | left deep-equals `draw,standby,main1,battle`; right deep-equals `main2` |
| end compatibility | `PHASE_SLOT_LABELS.end` exists; `phaseSlotForDuelPhase("end") === "end"`; `endPhase` choice maps to end |

Update `tests/component/PhaseStrip.test.ts`:

| Test | Input | Expect |
| ---- | ---- | ---- |
| `renders five phase chips and one End turn button` | null spec | draw/standby/main1/battle/main2 exist; end chip absent; End button exists disabled |
| `places Battle in left and Main 2 plus End in right` | — | left children are four chips; right children are main2 chip then end button |
| `End button dispatches the endPhase choice` | spec with end | one `chooseChoice` call with id/key |
| `disabled blocks phase and End controls` | offered battle/end, disabled | no dispatch |
| existing current-phase semantics | phase end | no end chip current; group gets an accessible status e.g. root `data-current-phase="end"`; End button remains ordinary action |

Keep `tests/component/EndTurnButton.test.ts` as isolated contract; update only parent-placement assumptions if any.

Update/create `tests/component/DuelHeaderBar.test.ts`:

| Test | Input | Expect |
| ---- | ---- | ---- |
| `labels both life totals by role` | `[8000,7500]` | roles `Opponent`, `You`; p1 LP `7,500 LP`; p0 `8,000 LP` |
| `keeps roles before state arrives` | null | roles visible; both LP `—` |
| `does not render deck names` | all props | header text excludes six catalog display names |

Keep/extend `DuelField.test.ts` negative assertions for old pill selectors and assert only one End button.

E2E responsive matrix:

- left group right ≤ shared-left EMZ left − 1 px;
- right group left ≥ shared-right EMZ right + 1 px;
- Battle rect belongs to left group; Main2 and End belong right;
- no `field-phase-chip-end`;
- End target width/height ≥44;
- each control rect has zero intersection with every `[data-field-target]` rect;
- role labels visible; no catalog names in header.

## Impl steps

- [ ] 1. Update slot-array unit expectations and PhaseStrip component tests. Run focused tests red.
- [ ] 2. Change `PHASE_SLOTS_LEFT/RIGHT` exactly. Keep end mapping APIs.
- [ ] 3. Import/render `EndTurnButton` inside PhaseStrip after Main2. Add `data-current-phase={currentSlot}` to root for end-phase accessibility/testing.
- [ ] 4. Remove the EndTurnButton import/render from `DuelField.svelte`. Assert DOM has one button.
- [ ] 5. Rewrite phase CSS: left/right placement still clears shared EMZ; `.field-end-turn` becomes normal-flow within right group, no absolute `right/top/transform`. Keep min dimensions 2.75rem.
- [ ] 6. Remove or shrink `.duel-field`'s unconditional bottom gutter that existed solely for the separately absolute End button. Preserve any T9/T14 window spacing; measure default field height again.
- [ ] 7. Add static role spans to `DuelHeaderBar.svelte`; style role muted, LP warning colour; keep settings button.
- [ ] 8. Add header tests, status-pill regression and e2e rect assertions. Run focused then full suites.
- [ ] 9. Amend `docs/ADR/010_ADR_in_field_phase_navigation.md` with dated `Round 3 amendment`: Battle joins left group, End chip is replaced by existing button, optional no-EMZ continuity is delegated to ADR-018. Do not rewrite ADR history.

## Outputs

- Files edited: `src/app/prompts/phase-transitions.ts`, `src/app/components/duel-field/PhaseStrip.svelte`, `src/app/components/DuelField.svelte`, `src/app/components/DuelHeaderBar.svelte`, `src/styles/app.css`, phase/header/field tests, `e2e/duel-smoke.spec.ts`, `docs/ADR/010_ADR_in_field_phase_navigation.md`.
- Public API: phase arrays change members; `PhaseSlot` remains compatible.
- Behaviour: one End control instead of chip + button; role labels visible.
- Migration / config: none.

## Validation

- [ ] `npm run test:unit -- phase-transitions` passes
- [ ] `npm run test:component -- PhaseStrip EndTurnButton DuelHeaderBar DuelField` passes
- [ ] `npm run typecheck`, `npm run lint`, `npm run format:check` pass
- [ ] `npm run build` succeeds
- [ ] full chromium e2e passes using pinned command from T5
- [ ] manual 1366×768: Draw/Standby/Main1/Battle left; Main2/yellow End right; no overlap; one End button
- [ ] manual header: only `Opponent` and `You`, no deck names
- [ ] app functional — no broken path from this slice
- [ ] commit msg draft: `refactor(field): fold end turn into the phase strip`

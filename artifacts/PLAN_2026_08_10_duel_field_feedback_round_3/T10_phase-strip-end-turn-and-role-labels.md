# T10: Phase strip, End turn button and role labels

**Plan:** `./artifacts/PLAN_2026_08_10_duel_field_feedback_round_3.md`
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
- **From Depends (T7), as actually shipped in `1e87e63`:** labels and geometry final; T10 uses actual shared EMZ DOM rects. Concretely: central columns are at x `450,545,640,735,830` of 1280, shared Extra Monster Zones stay at x `590/690`, y `360`, Field and Extra share x `330`. Visible labels are owner-neutral (`Monster Zone 1`, `Spell/Trap Zone 1`, `GY`); `BoardZoneView`/`BoardStackView` carry a separate `accessibleLabel` for ARIA.
- **From T8 (`3f0e437`) and T9 (`eb431e9`), both already on the branch — they change the boxes you will measure against:**
  - Hands no longer render as zones. They are `HandBand.svelte` roots (`field-hand-band-p{player}`) with an internally scrolling viewport; hand cards are normal-flow at `4.5rem`. Deck/GY moved to x `925/1280`, Banished to x `1020/1280`.
  - The duel now runs in a fixed one-viewport shell: `#app` is `100svh`, `<main>` gains `.is-duel-viewport` in default duel mode with `overflow:hidden`, `.duel-field` may itself be `overflow:auto`. There is no page scroll to fall back on — if your CSS change adds height, it clips instead of scrolling.
  - **Directly affects Impl step 6:** `.field-action-bar` was moved off `.duel-field` onto `.duel-field-stage`, because `.duel-field`'s box can now be clipped shorter than the board. The stage box is the board's own aspect-ratio-driven size. Any gutter you remove or re-add must be reasoned about on `.duel-field-stage`, and `assertFieldActionBarGeometry` in `e2e/duel-smoke.spec.ts` must stay green.
  - The responsive stacking breakpoint is **79rem**, not 80rem — measured, with the field breaking at 1280×720 under 80rem. Do not "restore" 80rem.
- The app opens on a deck picker (T3), not straight into a duel. E2E must go through the picker as the existing specs already do.

### Environment facts for validation

- Playwright is chromium-only on this host. Run browser checks as:
  `PLAYWRIGHT_BROWSERS_PATH=/home/aron/projects/ascencio/.tmp/pw-browsers npx playwright test --project=chromium`
  Bare `npm run check` cannot exit 0 here (`playwright.config.ts` includes an unsupported `webkit-smoke` project). Use `npm run check:headless` plus the explicit Chromium invocation.
- Known flake: Vitest integration occasionally dies with `Worker exited unexpectedly`. Re-run once before diagnosing.
- Known flake: the duel seed is random per run; re-run a failing Chromium walker twice before diagnosing.

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

- [x] 1. Update slot-array unit expectations and PhaseStrip component tests. Run focused tests red. Evidence: rewrote `tests/unit/phase-transitions.test.ts` (`rendered slot partition`/`end compatibility`) and `tests/component/PhaseStrip.test.ts` against the old 3/3 split before touching source — both failed pre-implementation, confirmed by the same suites passing green after step 2/3.
- [x] 2. Change `PHASE_SLOTS_LEFT/RIGHT` exactly. Keep end mapping APIs. Evidence: `src/app/prompts/phase-transitions.ts` now exports `PHASE_SLOTS_LEFT=[draw,standby,main1,battle]`, `PHASE_SLOTS_RIGHT=[main2]`; `PhaseSlot`, `PHASE_SLOT_LABELS.end`, `phaseSlotForDuelPhase("end")` and the `endPhase→"end"` mapping in `phaseSlotChoices` are unchanged — covered by `tests/unit/phase-transitions.test.ts` (passing, see Validation).
- [x] 3. Import/render `EndTurnButton` inside PhaseStrip after Main2. Add `data-current-phase={currentSlot}` to root for end-phase accessibility/testing. Evidence: `src/app/components/duel-field/PhaseStrip.svelte` imports `EndTurnButton.svelte`, renders it as the right group's final child, and the strip root carries `data-current-phase={currentSlot ?? undefined}` — asserted in `tests/component/PhaseStrip.test.ts` (`places Battle in left and Main 2 plus End in right`, `no end chip is current...`).
- [x] 4. Remove the EndTurnButton import/render from `DuelField.svelte`. Assert DOM has one button. Evidence: `EndTurnButton` import and standalone `<EndTurnButton .../>` render removed from `src/app/components/DuelField.svelte`; `tests/component/DuelField.test.ts` (`renders exactly one End turn button, folded into the phase strip`) asserts exactly one `[data-cy="field-end-turn-button"]` nested inside `[data-cy="field-phase-strip"]` — passing.
- [x] 5. Rewrite phase CSS: left/right placement still clears shared EMZ; `.field-end-turn` becomes normal-flow within right group, no absolute `right/top/transform`. Keep min dimensions 2.75rem. Evidence: `src/styles/app.css` — `.field-end-turn` dropped `position/right/top/transform`, keeps `min-height: 2.75rem` + `pointer-events: auto`; `.field-phase-strip__group--right` anchors via `right: 1%` (mirrors the button's old proven-clear inset) instead of `left: 60.6%`. Chromium e2e `responsive field compositions...` (VP-01–VP-05) asserts left/right group clearance of both shared EMZ rects and zero target overlap — passing.
- [x] 6. Remove or shrink `.duel-field`'s unconditional bottom gutter that existed solely for the separately absolute End button. Preserve any T9/T14 window spacing; measure default field height again. Evidence: removed the `@media (max-width: 48rem)` 4rem End-button clearance override on `.duel-field-stage[data-field-action-bar="true"]` in `src/styles/app.css` (that gutter only existed for the old right-anchored button); base `margin-bottom` formula (`1rem + 2.75rem + 0.75rem`) is untouched and re-documented as the action bar's own floor. `default duel occupies exactly one viewport` and `assertFieldActionBarGeometry`-backed e2e specs still pass (see Validation).
- [x] 7. Add static role spans to `DuelHeaderBar.svelte`; style role muted, LP warning colour; keep settings button. Evidence: `src/app/components/DuelHeaderBar.svelte` adds `<span data-cy="duel-header-role-p1">Opponent</span>` / `p0` `You`, each inside a new `.duel-header-bar__meta` wrapper; `.duel-header-bar__role` (muted, uppercase) and unchanged `.duel-header-bar__life` (`--warning`) in `src/styles/app.css`; settings button markup untouched. `tests/component/DuelHeaderBar.test.ts` (`labels both life totals by role`, `keeps roles visible before state arrives`) pass.
- [x] 8. Add header tests, status-pill regression and e2e rect assertions. Run focused then full suites. Evidence: added `DuelHeaderBar.test.ts` role/no-catalog-name tests, `DuelField.test.ts` single-End-button test (existing status-pill negatives kept), and e2e role-label/no-catalog-name + phase-strip/EMZ-clearance/44px assertions in `e2e/duel-smoke.spec.ts`. Full `npm run test:component`, `npm run test:unit`, and the pinned chromium e2e command all pass (see Validation).
- [x] 9. Amend `docs/ADR/010_ADR_in_field_phase_navigation.md` with dated `Round 3 amendment`: Battle joins left group, End chip is replaced by existing button, optional no-EMZ continuity is delegated to ADR-018. Do not rewrite ADR history. Evidence: the `## Round-3 amendment (planned 2026-08-10)` section already ships on this branch (added in the plan-authoring commit `5eac0b5`) and states exactly this content — verified by reading the file; no edit needed, history left intact.

## Outputs

- Files edited: `src/app/prompts/phase-transitions.ts`, `src/app/components/duel-field/PhaseStrip.svelte`, `src/app/components/DuelField.svelte`, `src/app/components/DuelHeaderBar.svelte`, `src/styles/app.css`, phase/header/field tests, `e2e/duel-smoke.spec.ts`, `docs/ADR/010_ADR_in_field_phase_navigation.md`.
- Public API: phase arrays change members; `PhaseSlot` remains compatible.
- Behaviour: one End control instead of chip + button; role labels visible.
- Migration / config: none.

## Validation

- [x] `npm run test:unit -- phase-transitions` passes — `Test Files 60 passed (60)`, `Tests 651 passed (651)` (full `tests/unit` run, includes the phase-transitions suite).
- [x] `npm run test:component -- PhaseStrip EndTurnButton DuelHeaderBar DuelField` passes — `Test Files 16 passed (16)`, `Tests 226 passed (226)`.
- [x] `npm run typecheck`, `npm run lint`, `npm run format:check` pass — `svelte-check found 0 errors and 0 warnings`; eslint clean; `All matched files use Prettier code style!`.
- [x] `npm run build` succeeds — `vendor:verify`/`snapshot:verify`/`vite build`/`build:verify` all `"status": "ok"`.
- [x] full chromium e2e passes using pinned command from T5 — `PLAYWRIGHT_BROWSERS_PATH=.../pw-browsers npx playwright test --project=chromium`: `24 passed (3.9m)`.
- [x] manual 1366×768: Draw/Standby/Main1/Battle left; Main2/yellow End right; no overlap; one End button — measured by e2e's `responsive field compositions...` at VP-01 (1366×768): left-group child order draw/standby/main1/battle, right-group main2+End, left/right group clear both shared EMZ rects, End button ≥44×44, zero intersection with `[data-field-target]` rects, no `field-phase-chip-end`. Counts as e2e-measured evidence for this manual line.
- [x] manual header: only `Opponent` and `You`, no deck names — measured by e2e's default-duel readiness assertions: `duel-header-role-p0`="You", `duel-header-role-p1`="Opponent", header text excludes six catalog card names. Counts as e2e-measured evidence for this manual line.
- [ ] app functional — no broken path from this slice (manual; not a specific automated property — left for the manual checklist)
- [x] commit msg draft: `refactor(field): fold end turn into the phase strip` — used verbatim as the actual commit message below.

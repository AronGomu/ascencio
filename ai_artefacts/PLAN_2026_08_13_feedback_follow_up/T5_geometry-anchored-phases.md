# T5: Geometry-anchored phases

**Plan:** `./ai_artefacts/PLAN_2026_08_13_feedback_follow_up.md`
**Depends:** T4
**Commit outcome:** Phase chips + primary End turn consume `FieldGeometry`; split/continuous profiles avoid every zone/stack with ≥44px hit targets.

## Context (self-contained)

- Goal: Place legal phase navigation inside free mid band derived from same profile/scale as board.
- This slice: Geometry only. Existing phase-choice mapping/dispatch remains engine-projected.
- Out of scope here: profile recomputation, rail status, shell sizing, prompt controls, card-list.
- Assumptions: Worker `layout.extraMonsterZones` decides profile. EMZ split wraps pair; no-EMZ run is Draw→Standby→Main 1→Battle→Main 2; End turn independently right-anchored.

## Requirements

- Add `geometry:FieldGeometry` prop to `PhaseStrip.svelte`.
- EMZ: left group right edge aligns left edge of EMZ pair; Main 2 starts right of pair.
- no-EMZ: both semantic arrays visually form one centered ordered run; no duplicate End chip.
- End turn right edge aligns board inner right margin; primary sizing from `--chip-size`.
- Strip/group pointer-events none; only legal controls pointer-events auto.
- Every actual phase button + End turn uses `min-inline-size:44px;min-block-size:44px;display:inline-grid;place-items:center` at all viewports. Visual font scales separately via `--chip-size`.
- Group gap = `max(2px, geometry.pitch*.025)`; `flex-wrap:nowrap`. If controls cannot fit available pocket with 44px minima, geometry/browser test fails; never shrink hit targets or overlap zones.
- Preserve `phaseSlotChoices`, `phaseSlotForDuelPhase`, `oninteraction({type:"chooseChoice",…})` exactly.

## Inputs

- `src/app/components/duel-field/PhaseStrip.svelte`, `EndTurnButton.svelte`.
- `src/app/prompts/phase-transitions.ts`; `tests/component/PhaseStrip.test.ts`, `EndTurnButton.test.ts`; `tests/unit/phase-transitions.test.ts`.
- `docs/ADR/010_ADR_in_field_phase_navigation.md`, `018_ADR_conditional_extra_monster_zones.md`, `019_ADR_full_height_duel_shell_and_pixel_geometry.md`.
- `ai_artefacts/manual_test_checklist.md` — append/update only T5 human checks; preserve all other sections.
- **From Depends:** `FieldRenderLayout.geometry` includes `pitch`, `margin`, `width`, `bandY`, `emzX`; `DuelField` owns current render layout.

## API

```ts
export let geometry: FieldGeometry;
```

Preserve all existing props. Root inline vars:

```text
--phase-y: geometry.bandY px
--phase-left-emz: geometry.emzX[0] - geometry.box/2 px
--phase-right-emz: geometry.emzX[1] + geometry.box/2 px
--phase-right-edge: geometry.width - geometry.margin px
--chip-size: max(9px, geometry.pitch*.1) px
--label-size: max(7px, geometry.pitch*.085) px
```

## TDD

1. **Red** — component semantics + Chromium rect/no-overlap/hit target tests.
2. **Green** — prop/style vars/profile CSS.
3. **Refactor** — delete obsolete fixed-percentage anchors only after both profiles pass.

## Test plan

| Test                                                   | Input                    | Expect                                                 |
| ------------------------------------------------------ | ------------------------ | ------------------------------------------------------ |
| `anchors split groups around EMZ placements`           | EMZ geometry             | group edges outside pair; no overlap                   |
| `centers continuous no-EMZ run`                        | no-EMZ                   | visual order exact; one run in band                    |
| `anchors End turn independently`                       | both                     | right edge≈inner board edge                            |
| `preserves offered-choice semantics`                   | battle/main2/end choices | only offered transitions buttons; exact IDs dispatched |
| `keeps controls clear of zones/stacks`                 | 3 viewports×2 profiles   | no rect intersections                                  |
| `keeps actionable controls at least forty-four pixels` | 1366×768                 | width,height≥44                                        |
| `reduced motion changes no semantics`                  | media reduce             | same controls/text/order                               |

## Impl steps

- [x] 1. Extend `PhaseStrip.test.ts` + acceptance spec with exact names above; prove current fixed anchors fail.
- [x] 2. Add `geometry` prop/import; pass from `DuelField` render layout.
- [x] 3. Compute inline CSS vars only from geometry; keep current phase/choice maps untouched.
- [x] 4. Update profile CSS: split EMZ groups; continuous no-EMZ flex run; separate End turn anchor.
- [x] 5. Update EndTurnButton styles only; no callback/API change.
- [x] 6. Remove stale percent anchors/fixed 16:9 assumptions from phase rules.
- [x] 7. Run component/unit + viewport Chromium matrix.

## Outputs

- Modified: PhaseStrip, optional EndTurnButton styling, DuelField call, app.css, focused tests/acceptance.
- Public API: one required `geometry:FieldGeometry` prop.
- No data/config/migration.

## Validation

- [x] `npx vitest run tests/component/PhaseStrip.test.ts tests/component/EndTurnButton.test.ts tests/unit/phase-transitions.test.ts` → exit 0.
- [x] `npm run typecheck && npm run lint` → exit 0.
- [x] `npx playwright test --config=playwright.acceptance.config.ts --project=chromium e2e-acceptance/full-height-field.spec.ts --grep "phase|End turn"` → exit 0.
- [ ] manual keyboard check — each legal phase button + End turn reachable/activates same `ChoiceId`.
- [x] app functional — `npm run build` exits 0.
- [ ] commit msg draft: `feat(field): anchor phase controls to pixel geometry`

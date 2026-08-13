# T3: Pixel board rendering

**Plan:** `./ai_artefacts/PLAN_2026_08_13_feedback_follow_up.md`
**Depends:** T2
**Commit outcome:** Production board uses explicit px placements; zones are square with concentric slots; stacks/cards align; Defense/Set rotation works.

## Context (self-contained)

- Goal: Make validated px geometry visible without making board domain/nav viewport-dependent.
- This slice: Observe visible field size, create `FieldRenderLayout`, feed zones/stacks/field cards. Existing shell/header/hands/phase placement remain until later tickets.
- Out of scope here: hand scrollbar/paging removal, final `100svh` measurements, phase anchors, rail, preview, settings, card-list.
- Assumptions in force: Worker snapshot `layout.extraMonsterZones` is profile authority; render placement comes from stable `zoneId`; rotate inner art, scale positioned outer card.

## Requirements

- Add outer `.duel-field-slot` (`data-cy="duel-field-slot"`) as available-budget owner. It fills middle shell column + receives one `ResizeObserver`.
- Inner `.duel-field` receives explicit `geometry.width/height`, remains field root + floating-window boundary. Never observe this geometry-sized inner node → no feedback cycle.
- Recompute from slot `clientWidth/clientHeight` + EMZ profile. Zero-sized pre-mount uses finite fallback `createFieldRenderLayout(profile, 1280, 720)`; slot observer replaces it after measurement.
- `FieldBoard.svelte` consumes `renderLayout`; must not use `BoardZoneView.x/y/width/height` for painted placement.
- Zone DOM: square outer footprint + concentric `.duel-field-zone__slot`.
- `CardControl` outer article owns px position + hover scale; `.duel-field-card__art` owns Defense/Set rotation.
- `faceUpDefense` → `is-defense`; `faceDownDefense` → `is-set`; face-down image/back behavior unchanged.
- Preserve every stable `data-zone-id`, `data-field-target`, `aria-label`, focus/drag/action attr.

## Inputs

- `docs/ADR/019_ADR_full_height_duel_shell_and_pixel_geometry.md`.
- `src/app/App.svelte`, `src/app/components/DuelField.svelte`, `duel-field/FieldBoard.svelte`, `ZoneControl.svelte`, `CardControl.svelte`, `StackControl.svelte`.
- `src/styles/app.css`, `tests/component/DuelField.test.ts`, `tests/unit/global-styles.test.ts`.
- **From Depends:** `FieldRenderLayout { geometry, zones }`, `FieldPlacement`, `createFieldRenderLayout`; acceptance scenarios `field-emz`, `field-no-emz`, `field-defense`; dedicated config command.

## Component API

```ts
// FieldBoard.svelte
export let renderLayout: FieldRenderLayout;

// ZoneControl.svelte
export let placement: FieldPlacement;

// CardControl.svelte
export let placement: FieldPlacement | null = null;

// StackControl.svelte
export let placement: FieldPlacement;
```

`HandBand` may keep legacy style temporarily. Field card/stack call sites pass `renderLayout.zones.get(card.zoneId|stack.id)` and fail visibly in dev/test if missing; never fall back to stale normalized render coords.

## TDD

1. **Red** — component assertions for slots/attrs/classes/alignment; Chromium px metrics against existing scenarios.
2. **Green** — add observer/data flow/px CSS/inner rotation with minimum selectors.
3. **Refactor** — remove only stale field-zone/card/stack percent render declarations; retain nav data + hand rules needed by T4.

## Test plan

| Test | Input | Expect |
| ---- | ----- | ------ |
| `renders one concentric slot per painted zone` | deterministic board | each `[data-zone-id]` has slot; same centre |
| `preserves zone semantics under px placement` | actionable zone | IDs/names/targets/focus unchanged |
| `aligns cards and stacks by PhysicalZoneId` | occupied monster + 4 stacks | centre equals matching placement |
| `marks Defense and Set on inner art` | face-up/down Defense | classes; card back for Set; stable card ID |
| `keeps five-pixel rendered gaps` | EMZ/no-EMZ Chromium | adjacent outer rect gap `5±0.5px` |
| `keeps slot six pixels wider than card` | Chromium | delta `6±0.5px` |
| `rotates without cancelling hover placement` | Defense hover | bbox ≈box×cardWidth; outer centre unchanged |
| `recomputes after boundary resize` | ResizeObserver | board width/height changes; profile consistent |

## Impl steps

- [x] 1. Extend `tests/component/DuelField.test.ts` + `e2e-acceptance/full-height-field.spec.ts`; run red. Criterion: focused Vitest/Playwright assertions fail before production edits.
- [x] 2. Add `.duel-field-slot` wrapper in App/current shell; bind slot element into DuelField via exact prop `export let layoutBoundaryElement:HTMLElement|null=null` (forward through ErrorBoundary). Observe slot, not inner field; disconnect on destroy; recompute profile change. Criterion: component test observes one boundary observer, fallback geometry, resize recompute, disconnect.
- [x] 3. Thread `renderLayout` into `FieldBoard`; map each non-hand zone/card/stack by stable physical ID. Criterion: component assertions show matching physical IDs share px centres; missing placement throws visibly.
- [x] 4. Replace `ZoneControl` percent style with px placement; add `.duel-field-zone__slot` with unique `data-cy` per zone. Criterion: every painted zone has one uniquely identified concentric slot plus px inline vars.
- [x] 5. Add optional `placement` to `CardControl`; for `layout="field"` require it; compose scale outer + rotation inner. Criterion: Defense/Set tests show `is-defense`/`is-set` on article, inner-art rotation, stable outer centre.
- [x] 6. Add required placement to `StackControl`; keep image lease/click/preview behavior. Criterion: component tests retain stack attrs/events/image while centre matches zone placement.
- [x] 7. Replace conflicting field CSS only; preserve 44px focus/interaction layers. Criterion: global-style tests assert px geometry, square zones, concentric slots, outer scale, inner rotation, 44px controls.
- [x] 8. Extend acceptance scenarios with explicit occupied Defense/Set cards; run Chromium metrics. Criterion: ticket Playwright command passes gap, slot delta, rotation, ratio, resize checks.

## Outputs

- Touched: App + ErrorBoundary + listed Svelte components, `src/styles/app.css`, focused tests, acceptance field scenarios/spec.
- Cross-ticket contract: `.duel-field-slot[data-cy="duel-field-slot"]` owns available budget; `.duel-field[data-cy="duel-field"]` owns geometry size + floating windows. T7 preserves split.
- Public component APIs exactly above.
- No new persistence/config beyond existing acceptance harness.

## Validation

- [x] `npx vitest run tests/component/DuelField.test.ts tests/unit/global-styles.test.ts tests/unit/data-cy-coverage.test.ts` → exit 0.
- [x] `npm run typecheck && npm run lint` → exit 0.
- [x] `npx playwright test --config=playwright.acceptance.config.ts --project=chromium e2e-acceptance/full-height-field.spec.ts --grep "pixel board|Defense|Set|ratio"` → exit 0.
- [x] `npm run build` → production verifier exit 0; harness excluded.
- [ ] manual check — current real duel remains actionable; focus + drag still work. Criterion: human verifies pointer action, keyboard focus, hand drag in real duel.
- [x] app functional — existing focused smoke `npx playwright test e2e/duel-smoke.spec.ts --project=chromium --grep "production bundle initializes"` passes. Criterion: command exits 0.
- [x] commit msg draft: `feat(field): render square zones from pixel geometry`. Criterion: final commit subject matches exactly.

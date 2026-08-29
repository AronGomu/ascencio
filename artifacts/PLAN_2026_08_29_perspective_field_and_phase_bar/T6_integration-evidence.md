# T6: Chromium evidence, budgets, checklist, docs

**Plan:** `./artifacts/PLAN_2026_08_29_perspective_field_and_phase_bar.md`
**Depends:** T4, T5
**Commit outcome:** the whole feature is proven in Chromium (perspective fill, drag over the transform, phase bar cycle, toggles), build budgets pass, the manual checklist and glossary describe the shipped state.

## Context (self-contained)

- Goal: perspective field + phase bar + toggles, all landed in T1–T5.
- This slice: end-to-end proof and documentation. Field acceptance uses automated Chromium evidence only (AGENTS `## Purpose and status`).
- Out of scope here: new features, visual tuning, refactors.
- Assumptions in force: A4 — the portrait quarter-turn compose check happens here for real.

## Requirements

- One Playwright spec (extend existing duel e2e, `e2e/`) covering:
  1. Perspective fill: plane rect vs board rect top gap ≤ 8px; opponent-hand card projected height < player-hand card projected height (ratio < 0.9).
  2. Drag over the transform: hand card → monster zone → placed (existing flow, now asserting under the plane).
  3. Phase bar: Main 1 → click `phase-bar-you-battle` → `data-current-phase="battle"`; End turn button label/state; opponent turn renders zero buttons in the bar.
  4. Toggles: settings dialog → uncheck shadows + labels → board attrs flip; reload → still off.
  5. Portrait viewport (390×844, rotated stage): drag a hand card — drop lands on the pointed zone (A4 evidence).
- `npm run build:verify` green — perspective/phase-bar CSS+JS must fit the duel domain budget; if over, report exact numbers, do not trim someone else's bytes.
- `artifacts/manual_test_checklist.md` (durable): replace the phase-strip steps with phase-bar steps; add perspective, fan, toggle steps.
- `docs/GLOSSARY.md`: add/update entries — "Phase bar", "Perspective plane", "Virtual height" (make-glossary-aron conventions).
- `docs/architecture/architecture.md`: field-rendering row points at the new ADRs (written at plan close, numbered 060/061 — cite by path).

## Inputs

- **From T4:** `data-cy` contract: `phase-bar`, `phase-bar-opponent`, `phase-bar-player`, `phase-bar-you-{slot}`, `phase-bar-opp-{slot}`, `field-end-turn-button`; halves carry `data-current-phase`.
- **From T5:** `data-card-shadows`/`data-zone-labels` on `[data-cy="duel-field-board"]`; settings checkboxes `settings-show-card-shadows-checkbox`, `settings-show-zone-labels-checkbox`.
- **From T2/T3:** `[data-cy="duel-field-board-plane"]`; hand cards under `[data-cy="field-hand-band-p0"]` / `-p1`.
- `e2e/` existing duel specs + `playwright.config.ts` (Chromium project).
- `artifacts/manual_test_checklist.md`, `docs/GLOSSARY.md`, `docs/architecture/architecture.md`.

## Interface contract (level 5)

- **Produces:** test code + docs only. Assertions verbatim:

```ts
const board = page.locator('[data-cy="duel-field-board"]');
const plane = page.locator('[data-cy="duel-field-board-plane"]');
const gap = (await plane.boundingBox())!.y - (await board.boundingBox())!.y;
expect(gap).toBeGreaterThanOrEqual(-1);      // plane top not above board
expect(gap).toBeLessThanOrEqual(8);          // filled

const oppCard = page.locator('[data-cy="field-hand-band-p1"] [data-cy^="field-card-"]').first();
const youCard = page.locator('[data-cy="field-hand-band-p0"] [data-cy^="field-card-"]').first();
expect((await oppCard.boundingBox())!.height / (await youCard.boundingBox())!.height).toBeLessThan(0.9);
```

(If hand card `data-cy` prefix differs, read it from `CardControl.svelte` — do not guess; the checklist entry must quote the real one. Note `[data-cy^="field-card-"]` also matches the nested `field-card-target-${id}` span (`CardControl.svelte:353`): `.first()` is safe, count assertions on the prefix are not.)

- **Consumes:** T4/T5 `data-cy` values exactly as listed above — binding.
- **Errors:** flaky-wait failures are real failures; use Playwright auto-wait on locators, no `waitForTimeout` for state (screenshot settling excepted, ≤500ms).
- **Invariants:** spec runs headless Chromium only (product browser family); no new test skips introduced.
- **Integration links:** trigger `npx playwright test e2e/<spec>` → observe HTML report + screenshots under `playwright-report/`; checklist cites the spec filename.

## TDD

1. **Red** — new e2e assertions fail on pre-T2 code is not demonstrable at this point (T2–T5 landed); instead, mutate-check one assertion locally (flip `toBeLessThan(0.9)` to `toBeGreaterThan`) to prove the test bites, then restore.
2. **Green** — run full suite.
3. **Refactor** — none.

## Test plan

| Test | Input | Expect |
| --- | --- | --- |
| fill | started duel, 1440×900 | plane/board top gap in [-1, 8]px |
| depth gradient | same | opp-hand/you-hand height ratio < 0.9 |
| drag | drag `field-card-*` from p0 hand to empty monster zone | zone drop-candidate class during drag; card leaves hand after drop |
| phase cycle | Main 1 → Battle → Main 2 → End turn | `data-current-phase` follows; after End turn, player half has zero buttons |
| toggles persist | uncheck both, reload | board attrs `"false"`, checkboxes unchecked |
| portrait drag | 390×844 viewport | drop resolves on the pointed zone |
| budgets | `npm run build:verify` | exit 0 |

## Impl steps

- [ ] 1. Write/extend e2e spec; mutate-check one assertion; restore.
- [ ] 2. `npx playwright test` full duel set green.
- [ ] 3. `npm run build:verify` — record numbers in the commit body.
- [ ] 4. Update `artifacts/manual_test_checklist.md` (phase bar section replaces phase strip; perspective + toggles steps).
- [ ] 5. `docs/GLOSSARY.md` + `docs/architecture/architecture.md` updates.

## Validation

- [ ] `npm run check:headless && npx playwright test && npm run build:verify` — all green, outputs quoted in report
- [ ] manual: checklist steps executed once top-to-bottom on the new build
- [ ] no silent-failure swallow added — `none` expected
- [ ] app functional — full duel playable start → End turn cycles → concede/result
- [ ] commit msg draft: `chore(duel): prove perspective field and phase bar in Chromium and refresh docs`

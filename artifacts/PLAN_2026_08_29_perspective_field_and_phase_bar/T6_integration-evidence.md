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
- `e2e/duel-smoke.spec.ts`, `e2e-acceptance/full-height-field.spec.ts`, and `playwright.config.ts` (Chromium project).
- `src/battle/app/components/duel-field/HandBand.svelte`, `CardControl.svelte`, and `FieldBoard.svelte` for hand layout and transformed fan geometry.
- `src/shell/card-preview/OverlayScrollbar.svelte` + `tests/component/OverlayScrollbar.test.ts` for pointer capture and negative row-reverse scrolling.
- `src/battle/app/presentation/stage-frame.ts` + `tests/unit/stage-frame.test.ts` for transformed pointer-coordinate mapping.
- `src/styles/app.css` portrait shell-variable, active-candidate depth, hand fan, and overlay-scrollbar seams.
- `.tmp/T6_manual_test_checklist.patch`, `artifacts/manual_test_checklist.md`, `docs/GLOSSARY.md`, `docs/architecture/architecture.md`.

## Interface contract (level 5)

- **Produces:** Chromium test evidence + docs, plus evidence-driven portrait/scrollbar CSS repairs only. Assertions verbatim:

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

- [x] 1. Write/extend `e2e/duel-smoke.spec.ts`; focused Chromium test passes, deliberate depth-ratio mutation fails, restored test passes.
- [x] 2. Run `PLAYWRIGHT_PORT=4304 npx playwright test e2e/duel-smoke.spec.ts`; command exits 0 with 42 passes and 1 existing data-dependent skip.
- [x] 3. Run `npm run build:app && npm run build:verify`; command exits 0 with shell 93,666/115,000, Worker 149,859/200,000, battle 350,389/488,750, deck-editor 134,769/172,500, and story 132,815/172,500 bytes.
- [x] 4. Keep checklist change in `.tmp/T6_manual_test_checklist.patch`; `git apply --check .tmp/T6_manual_test_checklist.patch` exits 0 without staging scratch.
- [x] 5. Update `docs/GLOSSARY.md` + `docs/architecture/architecture.md`; `npm run check:headless` validates docs-adjacent repo gates.

## Acceptance repair

- [x] 6. Reproduce A1/A2 in Chromium and capture layout, projected, hit-target, pointer-capture, and row-reverse scroll evidence; focused `e2e-acceptance/full-height-field.spec.ts` run exits nonzero with both named failures observed.
  - A1 finding (`e2e-acceptance/full-height-field.spec.ts`): layout is not clipped — first `offsetLeft=0` at `scrollLeft=0`; final card endpoint `offsetLeft + offsetWidth=1364` stays inside `scrollLeft + clientWidth=1384`. The old transformed edge (`254.159`) extends `5.225px` past the viewport edge (`259.384`) because the endpoint card is fanned `-5deg`; assertion was stale.
  - A2 finding (`src/shell/card-preview/OverlayScrollbar.svelte`, `src/styles/app.css`): bottom opponent thumb centre hits `field-zone-p1:spellTrap:1`, so `pointerDown` never runs, pointer capture never starts, and `scrollLeft` remains `0`. Moving the mirrored opponent track to its top/outward edge changes the real Chromium hit to `field-hand-p1-scrollbar-thumb`; existing pointer mapping then preserves negative row-reverse writes.
- [x] 7. Repair A1 without hiding clipping: endpoint assertion uses non-transformed `offsetLeft`/`offsetWidth`/`scrollLeft`/`clientWidth`; projected tolerance is mathematically derived from the ±5° fan overhang; focused endpoint test passes three consecutive runs.
- [x] 8. Repair A2 at the proven test or runtime seam, add a real Chromium pointer-hit assertion, preserve negative row-reverse scrolling plus component coverage; focused row-reverse test and `tests/component/OverlayScrollbar.test.ts` pass.
- [x] 9. Run final gates after the last source/test mutation: focused repairs 6/6; acceptance 41/41; portrait T6 3/3; desktop T6 3/3; duel smoke 42 passed + 1 existing data-dependent skip; component 7/7; legacy 23/23; unit 1,790/1,790; integration 39/39; `npm run build:app && npm run build:verify` exits 0 with budgets recorded in step 3.
- [x] 10. Verify `.tmp/T6_manual_test_checklist.patch` still applies, perform mutate-check plus diff/secret/residue/debug scans, and complete fresh inline review; all checks report no blocker and scratch patch stays untracked/unstaged.

## Validation

- [x] `npm run check:headless && PLAYWRIGHT_PORT=4304 npx playwright test e2e/duel-smoke.spec.ts && npm run build:app && npm run build:verify` — all exit 0; headless passes 23 legacy, 1,790 unit and 39 integration tests; duel smoke passes 42 with 1 existing skip; exact budgets are quoted in step 3.
- [x] Chromium T6 flows execute checklist-equivalent perspective, phase, drag, toggle steps; focused T6 + full duel spec pass.
- [x] `git diff -U0 -- e2e/duel-smoke.spec.ts src/styles/app.css` added lines contain no debug/residue, merge markers, or secret literals.
- [x] App functional — full duel spec includes start → End turn cycles → result; command passes.
- [x] `npm run test:acceptance` exits 0 with 41 passes, including repaired hand endpoint and row-reverse thumb tests.
- [x] Commit created with `chore(duel): prove perspective field and phase bar in Chromium and refresh docs`; `git show -s --format=%s HEAD` matches.

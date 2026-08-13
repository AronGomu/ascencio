# T2: Conditional Chromium acceptance harness

**Plan:** `./ai_artefacts/PLAN_2026_08_13_feedback_follow_up.md`
**Depends:** T1
**Commit outcome:** Deterministic real-component scenarios run in dedicated Chromium build; normal production bundle contains no harness entry.

## Context (self-contained)

- Goal: Measured prototype acceptance needs deterministic EMZ/no-EMZ, Defense/Set, 6/20-card hand, long preview, exact/range card-list states. Random real duel cannot reliably reach them.
- This slice: Add acceptance-only Vite entry + dedicated Playwright config. Initial field scenarios load current production components. Later slices extend same harness.
- Out of scope here: geometry visual changes, app query backdoors, Worker bypass inside `App.svelte`, card-list scenarios, product behavior changes.
- Assumptions in force: harness exists only when env `ACCEPTANCE_SCENARIOS=1`; existing `playwright.config.ts` + real-duel smoke stay unchanged.

## Requirements

- Normal `npm run build` must not emit `dist/acceptance.html` or acceptance-only JS.
- Acceptance build uses real Svelte components + `src/styles/app.css`; fixture state only replaces Worker/store startup.
- Dedicated config runs Chromium only from `e2e-acceptance/`; existing normal config never discovers these specs.
- Unsupported/missing `scenario` renders explicit failure marker; no silent default.
- Every harness-rendered HTML element under `src/app/` gets unique `data-cy`.

## Inputs

- `vite.config.ts`, `playwright.config.ts`, `scripts/verify-browser-build.ts` — production build boundary.
- `tests/fixtures/board-view-model.ts` — reference fixture patterns; do not import tests into browser source.
- `src/app/components/DuelField.svelte`, `src/app/components/duel-field/FieldBoard.svelte` — real render targets.
- `docs/ADR/019_ADR_full_height_duel_shell_and_pixel_geometry.md` — Chromium evidence authority.
- **From Depends:** `src/field/duel-field-geometry.ts` exports `computeFieldGeometry`, `createFieldRenderLayout`, `FieldRenderLayout`; no DOM consumes them yet.

## Required files + contract

Create:

```text
acceptance.html
playwright.acceptance.config.ts
src/acceptance-main.ts
src/app/acceptance/AcceptanceHarness.svelte
src/app/acceptance/acceptance-scenario.ts
src/app/acceptance/full-height-field-scenarios.ts
e2e-acceptance/harness.spec.ts
e2e-acceptance/full-height-field.spec.ts
```

`src/app/acceptance/acceptance-scenario.ts`:

```ts
export type AcceptanceScenarioId =
  | "field-emz"
  | "field-no-emz"
  | "field-defense";

export function acceptanceScenarioId(search: string): AcceptanceScenarioId | null;
```

`vite.config.ts`: set `build.rollupOptions.input` to `index.html` normally; add `acceptance.html` only when `process.env.ACCEPTANCE_SCENARIOS === "1"`.

`playwright.acceptance.config.ts`:

- `testDir: "./e2e-acceptance"`, Chromium project only, `workers:1`.
- Base URL `http://127.0.0.1:4203/ygo-story-duel/acceptance.html`.
- Web server runs vendor/snapshot verify, acceptance Vite build, preview port 4203. Do not run `build:verify` against acceptance build because its extra JS is not production transfer.
- Exact command: `npm run vendor:verify && npm run snapshot:verify && ACCEPTANCE_SCENARIOS=1 npm run build:app -- --base=/ygo-story-duel/ && npm run preview -- --host 127.0.0.1 --port 4203 --strictPort --base=/ygo-story-duel/`.
- Normal-build exclusion runs before dedicated Playwright launch because acceptance web server overwrites `dist`.

## TDD

1. **Red** — add Playwright harness specs first: normal build exclusion + acceptance scenario URL/selector expectations.
2. **Green** — add conditional entry/config/harness + minimum deterministic field fixtures.
3. **Refactor** — keep fixture builders focused; no generic test framework or production `App.svelte` branch.

## Test plan

| Test | Input | Expect |
| ---- | ----- | ------ |
| `normal build excludes acceptance entry` | env unset | no `dist/acceptance.html`; grep built JS no `field-defense` |
| `acceptance build serves deterministic field scenarios` | 3 scenario query values | matching `data-acceptance-scenario`; real field/board visible |
| `unknown scenario fails visibly` | `?scenario=nope` | `data-cy="acceptance-scenario-error"`; no fallback board |
| `harness uses stable profile data` | EMZ/no-EMZ | `data-extra-monster-zones=true/false`; 34/32 zones |
| `production build verification remains green` | `npm run build` | existing verifier exit 0 |

## Impl steps

- [ ] 1. Create `e2e-acceptance/harness.spec.ts` + placeholder `full-height-field.spec.ts`; run dedicated config; confirm missing page/config failure.
- [ ] 2. Add `acceptance.html`, `src/acceptance-main.ts`, scenario parser, deterministic field fixture builders.
- [ ] 3. Add `AcceptanceHarness.svelte`; mount real field components + global CSS; emit scenario/error hooks only in acceptance entry.
- [ ] 4. Add conditional multi-page input in `vite.config.ts`; normal input remains only `index.html`.
- [ ] 5. Add `playwright.acceptance.config.ts` on port 4203; leave `playwright.config.ts` unchanged.
- [ ] 6. Run normal build first; assert `dist/acceptance.html` absent + built JS contains no acceptance scenario IDs.
- [ ] 7. Run dedicated acceptance suite; then run `data-cy` coverage.

## Outputs

- Created files listed above.
- Touched: `vite.config.ts` only.
- Acceptance URL: `/ygo-story-duel/acceptance.html?scenario=<AcceptanceScenarioId>`.
- No public product API, persistence, Worker/config schema change.

## Validation

- [ ] `rm -rf dist && npm run build` → exit 0; `test ! -e dist/acceptance.html`.
- [ ] `npx vitest run tests/unit/data-cy-coverage.test.ts` → exit 0.
- [ ] `! grep -R "field-defense" dist/assets dist/index.html` after normal build → exit 0.
- [ ] `npx playwright test --config=playwright.acceptance.config.ts --project=chromium e2e-acceptance/harness.spec.ts` → exit 0.
- [ ] `npm run typecheck && npm run lint` → exit 0.
- [ ] manual check — unknown scenario shows explicit error; normal app URL unchanged.
- [ ] app functional — normal `npm run build` + production verifier pass.
- [ ] commit msg draft: `test(browser): add isolated acceptance scenarios`

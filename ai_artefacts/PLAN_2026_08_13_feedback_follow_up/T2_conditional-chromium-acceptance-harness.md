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
- **Plan-defect fact (scouted):** `src/field/board-view-model.ts` exports `mapSnapshotToBoard(snapshot: PublicDuelState, cardTexts: ReadonlyMap<number, BoardCardText> = new Map(), prompt?: PlayerPrompt | null): BoardMappingResult`. Narrow `result.ok`; `result.value` is the `BoardViewModel` passed to `DuelField`. `tests/fixtures/duel-field-public-events.ts:85-102` is the existing fixture pattern. No extra adapter/dependency object is required; supply local acceptance card texts only when stable names matter.

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

- [x] 1. Create `e2e-acceptance/harness.spec.ts` + placeholder `full-height-field.spec.ts`; validation: dedicated Playwright invocation fails because config/page is missing. Evidence: command exited 1 with `playwright.acceptance.config.ts does not exist`.
- [x] 2. Add `acceptance.html`, `src/acceptance-main.ts`, scenario parser, deterministic field fixture builders; validation: files exist and `npm run typecheck` accepts their contracts. Evidence: `npm run typecheck` found 0 errors and 0 warnings.
- [x] 3. Add `AcceptanceHarness.svelte`; mount real field components + global CSS; emit scenario/error hooks only in acceptance entry; validation: dedicated harness spec observes scenario/error selectors. Evidence: 5 Chromium specs passed.
- [x] 4. Add conditional multi-page input in `vite.config.ts`; normal input remains only `index.html`; validation: normal build omits `dist/acceptance.html` and acceptance build emits it. Evidence: normal exclusion passed; post-acceptance `test -e dist/acceptance.html` passed.
- [x] 5. Add `playwright.acceptance.config.ts` on port 4203; leave `playwright.config.ts` unchanged; validation: dedicated Chromium command starts preview on port 4203 and passes. Evidence: exact command completed with 5 passed.
- [x] 6. Run normal build first; validation: `test ! -e dist/acceptance.html` and `! grep -R "field-defense" dist/assets dist/index.html` both exit 0. Evidence: combined command exited 0; verifier returned `status: ok`.
- [x] 7. Run dedicated acceptance suite; then run `data-cy` coverage; validation: both exact commands in Validation exit 0. Evidence: Chromium 5 passed; Vitest 30 passed.

## Outputs

- Created files listed above.
- Touched: `vite.config.ts` only.
- Acceptance URL: `/ygo-story-duel/acceptance.html?scenario=<AcceptanceScenarioId>`.
- No public product API, persistence, Worker/config schema change.

## Validation

- [x] `rm -rf dist && npm run build` → exit 0; `test ! -e dist/acceptance.html`. Evidence: combined command exited 0.
- [x] `npx vitest run tests/unit/data-cy-coverage.test.ts` → exit 0. Evidence: 1 file, 30 tests passed.
- [x] `! grep -R "field-defense" dist/assets dist/index.html` after normal build → exit 0. Evidence: combined normal-build command exited 0.
- [x] `npx playwright test --config=playwright.acceptance.config.ts --project=chromium e2e-acceptance/harness.spec.ts` → exit 0. Evidence: 5 passed in 3.4s.
- [x] `npm run typecheck && npm run lint` → exit 0. Evidence: 0 Svelte errors/warnings; ESLint exited 0.
- [x] manual check — automated equivalent: Playwright unknown-scenario assertion passes and normal `index.html` production build remains unchanged. Evidence: unknown + missing scenario specs passed; normal build exclusion passed.
- [x] app functional — `rm -rf dist && npm run build` exits 0, including production verifier. Evidence: verifier returned `status: ok`, snapshot ID, 243 runtime files.
- [x] commit msg draft: commit exists with exact subject `test(browser): add isolated acceptance scenarios`; validation: `git log -1 --pretty=%s` matches. Evidence: commit `be99dd9` created with exact subject.

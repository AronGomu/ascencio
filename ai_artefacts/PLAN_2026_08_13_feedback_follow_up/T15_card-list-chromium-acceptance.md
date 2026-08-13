# T15: Card-list Chromium acceptance

**Plan:** `./ai_artefacts/PLAN_2026_08_13_feedback_follow_up.md`
**Depends:** T14
**Commit outcome:** Deterministic Chromium automates approved checks 1–36 plus range/Hand/duplicate-choice compatibility; full headless/build/production regression passes.

## Context (self-contained)

- Goal: Close implementation with browser evidence for px geometry, transforms, overflow, colors, collapse, focus, responsive fit.
- This slice: Acceptance fixtures/spec + minimal bug fixes discovered by browser. Production behavior already component-green in T14.
- Out of scope: new product behavior, Worker/WASM, changing accepted dimensions/copy/state policy.
- Assumptions: dedicated harness excluded from production build; Chromium is acceptance authority; Firefox/WebKit smoke optional hygiene.

## Requirements

- Extend exact existing source `src/app/acceptance/card-list-dialog-scenarios.ts`.
- Add deterministic fixtures:
  - `CARD_LIST_SINGLE_TARGET`
  - `CARD_LIST_MULTIPLE_TARGETS`
  - `CARD_LIST_MIXED_TARGETS`
  - `CARD_LIST_RANGE_TARGETS`
  - `CARD_LIST_HAND_MIXED_TARGETS`
  - `CARD_LIST_DUPLICATE_CHOICES`
  - `CARD_LIST_STALE_SELECTION`
- Resolver supports IDs `card-list-single`, `card-list-multiple`, `card-list-mixed`, `card-list-range`, `card-list-hand-mixed`, `card-list-duplicate`, `card-list-stale`.
- Every scenario mounts real production components + state callbacks; no prod `App.svelte` branch.
- Explicit screenshots attach wide browse, mixed target, max-locked target, 320px responsive states.
- Browser test uses rect/computed styles only for visual claims; semantic callback/state claims remain component tests too.
- Minimal bug fixes allowed only when tied to failing listed check; no refactor/new behavior.

## Inputs

- `ai-artifacts/PROTOTYPE_SPEC_card-list-dialog.md` §12 checks 1–36.
- `e2e-acceptance/card-list-dialog.spec.ts`, `src/app/acceptance/card-list-dialog-scenarios.ts`, `AcceptanceHarness.svelte`, dedicated config.
- T10–T14 production components/model/styles + all focused tests.
- `docs/ADR/021_ADR_card_list_dialog_modes_and_selection.md`.
- **From Depends:** exact/range UI green; target sorting/dismiss/collapse; physical tiles/actions/menu; browse scenarios already automated.

## Acceptance matrix

| Checks | Chromium group |
| ---- | ----- |
| 1–5 | no errors/network dependency; 1320×600 cap; title/count/physical tiles |
| 6–10 | centering/overflow, 144px/8px, 1.60 zoom, name opacity, browse no selection |
| 11–16 | action seam/click, sort restore, browse chrome/footer, no evaluator UI, drag |
| 17–21 | single0/1, multiple0/3, mixed0/2, full labels/gap, exact notice |
| 22–28 | max red/disabled priority, pointerleave reset, draft preservation, unselect, restore green, stale fail-close |
| 29–32 | mandatory/cancelable chrome, collapse coordinates, one visible + |
| 33–36 | 780/320 fit, nowrap overflow, edge zoom/menu, logical keyboard route |
| Extra | range inclusive Validate, Hand notice/order, duplicate menu IDs/keyboard/max |

Exact browser tolerance:

- Dialog/card/gap ±0.5px; centered delta≤1px.
- Hover ratio `1.60±0.02` after ≥150ms.
- Menu/art rendered gap `[-4,0]px`.
- Mixed badge/art gap `5±1px`.
- Collapse minus/plus x/y delta≤0.5px; root `58±0.5` both axes.
- Document `scrollWidth===clientWidth` at 780×900, 320×568.

## TDD

1. **Red** — add scenario + checks before browser polish; capture precise failures.
2. **Green** — minimum fixture wiring/CSS/component corrections per failed check.
3. **Refactor** — only dedupe test helpers (`rect`, `computed`, `expectInsideViewport`, screenshot attach); no prod abstraction.

## Test plan

| Test | Input | Expect |
| ---- | ----- | ------ |
| `approved browse metrics` | browse six | checks1–16 |
| `exact target modes` | single/multiple/mixed | checks17–32 |
| `responsive overflow and keyboard` | overflow at780/320 | checks33–36 |
| `range compatibility` | min1,max3 | Validate counts1..3, lock at3 |
| `Hand source compatibility` | Hand+GY+Deck | full labels/fixed notice order |
| `duplicate choice compatibility` | 2 IDs/address | one tile; menu2; each answerable/max-safe |
| `stale selection fails closed` | stale ID | Validate disabled; draft not trimmed |
| `normal bundle excludes scenarios` | normal build | no acceptance page/fixture IDs |

## Impl steps

- [ ] 1. Add all named fixture exports + resolver IDs to `card-list-dialog-scenarios.ts`; mount through harness.
- [ ] 2. Expand `e2e-acceptance/card-list-dialog.spec.ts` into acceptance groups above; add deterministic callbacks/state updates.
- [ ] 3. Add shared test-only helper fns inside spec or `e2e-acceptance/helpers.ts` only when used ≥2 groups.
- [ ] 4. Add explicit screenshot attachments via `testInfo.outputPath` + `testInfo.attach` for 4 named states.
- [ ] 5. Run dedicated Chromium; fix only concrete check failures in owning component/style with focused regression test.
- [ ] 6. Run all focused unit/component suites; then full headless.
- [ ] 7. Run normal build + verify acceptance exclusion; then full production Chromium real-duel suite.
- [ ] 8. Record cmd outputs/check coverage in commit notes; leave no `.only`, debug route, generated screenshots tracked.

## Outputs

- Modified: acceptance scenario source/harness/spec; optional `e2e-acceptance/helpers.ts`; minimal production bugfix files only if browser reveals defects.
- Browser evidence in Playwright test output, not source tree.
- No public API/schema change.

## Validation

- [ ] `npx playwright test --config=playwright.acceptance.config.ts --project=chromium e2e-acceptance/card-list-dialog.spec.ts` → checks 1–36 + 3 compatibility groups pass.
- [ ] `npx vitest run tests/unit/card-list-dialog-model.test.ts tests/component/ProjectedChoiceMenu.test.ts tests/component/ZoneListDialog.test.ts tests/component/DuelField.test.ts` → exit 0.
- [ ] `npm run check:headless` → exit 0.
- [ ] `rm -rf dist && npm run build` → verifier exit 0; no `dist/acceptance.html`; no scenario IDs in normal JS.
- [ ] `npx playwright test --project=chromium` → full production Chromium suite pass.
- [ ] `git status --short` → no generated screenshots/reports staged/tracked.
- [ ] manual check — attached screenshots readable; keyboard route focus visible; no hidden identity appears.
- [ ] app functional — startup, duel actions, browse, target Validate, reload settings all work.
- [ ] commit msg draft: `test(card-list): lock Chromium prototype acceptance`

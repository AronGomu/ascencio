# T11 implementation / acceptance report

State: **blocked pending independent review and legacy `check:browser` repair**.

Baseline: `f3f3c541fd912717bc743d7a6508c3ebda7c5e82` (accepted T10 repair); T9 `344ffe2d5bbf1beafad53ad6d10dc517bbaf1b2a`.

## Evidence

| Area | Result | Proof |
| --- | --- | --- |
| Boundaries / entrypoints | PASS | `artifacts/T11-EVIDENCE/01-boundaries.log`: 97/97 exact exports, foreign static/type/dynamic/re-export/require/worker forms, Content outgoing zero, Shell composition scope, data-cy, chunk closure |
| DTO / concealment | PASS | `artifacts/T11-EVIDENCE/23-aggregate-matrix.log`: 285/285 runtime DTO, hidden identity/image, save/crash, update/cleanup tests |
| Type / lint / format | PASS | `artifacts/T11-EVIDENCE/17-check-headless-final.log`: 0 type errors; 4 pre-existing Svelte warnings; full lint and format green |
| Vendor / assets / snapshot | PASS | Same headless log: vendor 21 files; canonical data 14,794 records; set images 92 plus 19 approved provider-null; full images 14,579; runtime snapshot verified |
| Build / budgets | PASS | `artifacts/T11-EVIDENCE/04-build.log`: Shell 99,224; Worker 139,056; Battle 315,612; Deck Editor 173,486; Story 171,867 bytes; unchanged ceilings pass |
| Native core flows | PASS | `artifacts/T11-EVIDENCE/native-core/playwright-report.json`: 11/11; screenshots/traces listed by `native-paths.txt` |
| Native DOM acceptance | PASS | `artifacts/T11-EVIDENCE/22-test-acceptance.log`: Chromium 41/41 |
| Full headless | PASS | `artifacts/T11-EVIDENCE/17-check-headless-final.log`: legacy 220; unit 2,699; integration 54 plus all quality/data gates |
| Full browser | BLOCKED | `artifacts/T11-EVIDENCE/20-check-browser-final.log`: component/build/reproducible stages pass; legacy `test:e2e` fails readiness-era assumptions; bounded after 20 minutes |

## Implemented changes

| Path | Change / reason |
| --- | --- |
| `eslint.config.js` | Prune `.pi-subagents/`, `.tmp/`, `artifacts/` as generated/scratch roots. Fixes 2,113 parser failures without hiding production source. |
| `e2e/asset-root-urls.spec.ts` | Prettier-only normalization required by exact headless gate. Runtime assertion left unchanged and still reports stale font URL failure. |
| `e2e-core/core-boot.spec.ts` | Replace obsolete pre-discovery DM tile expectation with explicit Content Actions status/disabled-install assertions. Root/subpath source-only CORE remains zero-Worker/zero-runtime-request. |
| `tests/component/content-installer.test.ts` | Delete two-line zero-test shell already declaring supersession by `InstallContentScreen.test.ts`; Git baseline provides recovery. Real replacement suite remains 3 tests; full component total 1,237. |
| `docs/ADR/089`–`094` | Mark implemented; cite full immutable accepted SHAs for T1–T10 facts. |
| `docs/README.md`, `docs/architecture/architecture.md` | Route implemented Content/module architecture to ADRs and immutable SHAs; no ephemeral links. |
| `artifacts/manual_test_checklist.md` | Replace obsolete combined installer flow with explicit check/install/activate, pause/resume, forward saves, two-tab cleanup, CORE consent flows. Boxes remain unchecked. |
| `artifacts/T11-EVIDENCE/` | Exact logs, exits, source inventory, acceptance matrix, native JSON/screenshots/traces. |

No production `src/` file changed. No budget, public API, vendor, image lock, save schema, or delivery policy changed.

## Asset blocker resolution

| Fact | Evidence |
| --- | --- |
| Initial failure | `05-test-unit-initial.log`: 4 failures; `ENOENT: no such file or directory, open 'assets/shared/card-images/cropped/32864.jpg'`; set lock contained 42 images absent from current manifest; setup `codeReady: false`. |
| Canonical crop acquisition | `node scripts/download-images.ts --kind cropped --chapter chapter-01`; internal max two attempts/file, 15 s timeout, provider rate cap. 1,591 downloaded, 36 cached, zero missing/failures. |
| Canonical set acquisition | `npm run assets:sets`; 92 files acquired/pinned, 19 authoring-approved provider-null IDs, zero failures. |
| Green proof | `10-assets-focused-green.log`: 74/74. `08-assets-verify.log`: all canonical verifiers pass. `09-content-setup-verify.log`: `codeReady: true`. |
| Rights boundary | `publishReady: false` remains. No redistribution approval inferred from download. No lock regeneration, mock art, credential read/output, paid transfer, upload, or deploy. |

Acquired bytes live under ignored canonical roots. They are local prerequisites, not staged source changes.

## Aggregate matrix

Full cell-by-cell matrix: `artifacts/T11-EVIDENCE/acceptance-matrix.md`.

| Matrix group | Result |
| --- | --- |
| Required-only install/offline/all domains/real WASM | PASS native Chromium; optional-media requests `[]` |
| Save generation/crash/quota/CAS/storage loss | PASS native plus unit |
| Cancel/pause/explicit resume/concurrency four | PASS unit plus accepted native Cache/IDB harness |
| Cleanup/saves/decks/settings/CORE/unknown cache preservation | PASS native Chromium; before/after save and deck hashes equal |
| CORE incompatible/unapproved/approved cold update/two tabs | PASS unit plus native Chromium controller identity |
| Hidden identity/DTO paths/manifests/Blob/functions/art lookup | PASS static boundary/runtime parser/concealment suites |

## Browser blocker diagnosis

`npm run check:browser` reached `npm run test:e2e` after component, build, budgets, and reproducibility passed. Failures are current, not hidden:

- B1. `e2e/admin-console.spec.ts`: direct `#/admin` now routes to `#/install-content` until Content selection exists; test expects ungated Admin DOM.
- B2. `e2e/deck-editor.spec.ts`: direct deck routes now route to Content gate; tests wait up to 180 s for editor controls without installing fixture Content.
- B3. `e2e/asset-root-urls.spec.ts`: requests obsolete `fonts/forum-latin.woff2`; private build emits hashed CSS asset. Expected SHA `21eb0ef1...`, received SPA fallback SHA `6eaa15ad...`.
- B4. Exact suite is 139 tests with 180 s legacy timeouts; run was bounded at 20 minutes after 8 observed failures rather than consuming hours. Log and failure screenshots/traces retained under existing Playwright output.

Repair needs explicit test-harness product decision: provision selected progressive Content for domain tests, or redefine tests as CORE-only gate cases. T11 does not restore compiled content or bypass readiness.

## Process / safety

- S1. Original T10 D1/P1 strict TDD chronology remains permanently unchecked; repair evidence does not rewrite it.
- S2. Graph remains stale because known backend quota was not retried. Repo source/tests are authority; state recorded in `source-inventory.json`.
- S3. Existing user files, recovery worktrees, saves/settings fixtures, feedback files, vendor, and unrelated untracked artifacts preserved.
- S4. No subagents, stage, commit, push, PR, deploy, system apply, publication, or portable `.pi/skills` mutation.
- S5. No added `|| true`, empty catch, redirected failure, or unobserved Promise. Existing runtime sites unchanged.

## Assumptions

A1. Local loopback Playwright with real installed Chromium counts as native production-browser evidence, not native mobile evidence.

A2. Accepted predecessor SHAs are immutable implementation anchors even though T11 creates no commit by instruction.

A3. Publication prerequisites (`LICENSE_EVIDENCE_REQUIRED`, `HOST_SETUP_REQUIRED`, `DEVICE_ACCESS_REQUIRED`) remain user-owned/external and do not block private Chromium code readiness; they do block `publishReady`.

## Review gate

Independent reviewer required. T11 cannot be marked accepted while `npm run check:browser` remains failed.

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "Narrow T11 diagnostics/gate repairs only: no production src changes, no budget/API/vendor/lock widening; canonical missing assets acquired through existing scripts."
    },
    {
      "id": "criterion-2",
      "status": "satisfied",
      "evidence": "Exact command exits/logs in artifacts/T11-EVIDENCE/commands.json; 97 boundary, 285 aggregate, 2699 unit, 11 native core, 41 native acceptance results plus screenshots/traces/source inventory."
    }
  ],
  "changedFiles": [
    "artifacts/IMPLEMENTATION-LEDGER-T4-through-T11.md",
    "artifacts/IMPLEMENTATION-REPORT-T11.md",
    "artifacts/PLAN_2026_09_13_content_module_rearchitecture/T11_acceptance.md",
    "artifacts/T11-EVIDENCE/",
    "artifacts/manual_test_checklist.md",
    "assets/shared/card-images/cropped/ (1,591 canonical ignored assets acquired)",
    "assets/shared/set-images/ (canonical ignored archive refreshed to 92 images)",
    "generated/card-images/archive/cropped-download-report.json",
    "generated/content/setup-report.json",
    "docs/ADR/089_ADR_canonical_cards_and_focused_decks.md",
    "docs/ADR/090_ADR_pure_shared_svelte_views.md",
    "docs/ADR/091_ADR_shell_composes_semantic_content_ports.md",
    "docs/ADR/092_ADR_immutable_per_file_content_delivery.md",
    "docs/ADR/093_ADR_atomic_release_selector_and_save_generations.md",
    "docs/ADR/094_ADR_explicit_media_updates_and_cleanup.md",
    "docs/README.md",
    "docs/architecture/architecture.md",
    "e2e-core/core-boot.spec.ts",
    "e2e/asset-root-urls.spec.ts",
    "eslint.config.js",
    "tests/component/content-installer.test.ts (deleted)"
  ],
  "testsAddedOrUpdated": [
    "e2e-core/core-boot.spec.ts",
    "e2e/asset-root-urls.spec.ts (format only)",
    "tests/component/content-installer.test.ts (deleted superseded zero-test shell)"
  ],
  "commandsRun": [
    {
      "command": "npm run check:headless",
      "result": "passed",
      "summary": "Format/lint/type; legacy 220; unit 2699; integration 54; vendor/assets/snapshot all passed."
    },
    {
      "command": "npm run build",
      "result": "passed",
      "summary": "Private production build and unchanged domain/Worker budgets passed."
    },
    {
      "command": "npm run test:core",
      "result": "passed",
      "summary": "Native Chromium 11/11; T11 screenshots/traces retained."
    },
    {
      "command": "npm run test:acceptance -- --reporter=line,json",
      "result": "passed",
      "summary": "Native Chromium 41/41."
    },
    {
      "command": "npm run check:browser",
      "result": "failed",
      "summary": "Component/build/reproducibility passed; legacy test:e2e readiness/font assumptions failed; run bounded at 20 minutes."
    }
  ],
  "validationOutput": [
    "Boundary/data-cy/chunk 97/97; aggregate DTO/concealment/lifecycle 285/285.",
    "Canonical asset RED 4 failures -> GREEN 74/74; setup codeReady true.",
    "Build bytes: shell 99224, worker 139056, battle 315612, deck-editor 173486, story 171867.",
    "Native observations: five domains plus real WASM duel, zero optional-media requests, preserved saves/decks/settings/CORE/unknown cache.",
    "No staged files."
  ],
  "residualRisks": [
    "blocker: npm run check:browser legacy test:e2e suite is not provisioned with progressive Content and retains obsolete root font URL assertion.",
    "blocker for publication only: license evidence, host setup, native-device evidence remain absent; publishReady false.",
    "review required: independent T11 acceptance not yet performed.",
    "process deviation: original T10 strict TDD chronology remains unmet and unchecked.",
    "graph index stale due known backend quota; no repeated call made."
  ],
  "noStagedFiles": true,
  "diffSummary": "Acceptance-only config/test cleanup, canonical ignored asset acquisition, implemented-status docs/checklist, complete T11 evidence; no production src/API/vendor/budget change.",
  "reviewFindings": [
    "blocker: e2e/admin-console.spec.ts and e2e/deck-editor.spec.ts assume gameplay/admin routes without selected progressive Content.",
    "blocker: e2e/asset-root-urls.spec.ts asserts obsolete unhashed root font URL.",
    "no blocker in exact entrypoint/domain/DTO/concealment/headless/build/core-native/acceptance-native gates."
  ],
  "manualNotes": "Overall T11 state blocked despite criteria evidence: full check:browser not green and independent review pending. No manual checklist item was checked."
}
```

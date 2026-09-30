# Tooling audit checkpoint

## Review

- R1 **Done:** confirmed 6 actionable findings. HEAD `456551dc1cf8fc4e9fdb754095f3a8279f5b2c37`. Findings pre-existing; none dirty-only.
- R2 **Correct:** delivery pipeline checks source identity/hashes, rejects symlinks, verifies ZIP structure, performs pointer CAS. Evidence: `scripts/lib/asset-delivery/source-files.ts:50–100`, `path-guards.ts:113–142`, `verify-archive.ts:51–103`, `progressive-publisher.ts:295–324`.
- R3 **Fixed:** none. User work untouched. No staging/commits/downloads/publication.
- R4 **Coverage incomplete:** parent requested checkpoint. 113/141 `scripts/` files fully read. Remaining coverage below.
- R5 **Blocker:** resolve F1/F2 before relying on tooling’s file-safety guarantees. Resolve F3 before claiming clean-checkout CI readiness.

## Findings

### F1 — High/P1: cache validation accepts enclosing user repo

**Evidence:** `scripts/lib/sources.ts:60–64` treats successful `git rev-parse --git-dir` as cache validation. Git searches parent dirs. `:99–108` subsequently runs sparse-checkout operations, fetch, forced checkout. Pin validation occurs afterward, `:111–112`.

Existing cache dir lacking own `.git` → enclosing project repo accepted → Git mutations target user checkout. Offline mode still runs sparse-checkout operations.

**Observed read-only repro:**

```sh
git -C scripts rev-parse --git-dir --show-toplevel
```

Resolved project `.git` + project root, despite `scripts/` not being independent repo.

Production `syncRepository` also exercised with mocked FS/mutating Git commands. Actual discovery used `scripts/`; function proceeded to `["sparse-checkout","disable"]`. No Git mutation executed.

**Minimal fix:** require cache’s canonical worktree root to equal requested cache dir; validate expected origin before mutation. Reject invalid existing dirs without deleting unknown contents. Validate allowed cache parents against symlinks.

**Regression:** extend `tests/sources.test.ts`: nested non-repo cache, wrong-origin repo, linked cache parent; assert zero mutation commands.

```sh
node --test tests/sources.test.ts tests/paths.test.ts
```

**Origin:** HEAD; file unchanged.

### F2 — High/P1: missing scratch marker becomes permission to claim/delete existing dir

**Evidence:** `scripts/core-source-only-server.ts:23–36`. Missing marker returns normally, without distinguishing absent scratch from existing unowned scratch. Recursive `mkdir` accepts existing dir; subsequent `writeFile` adds ownership marker. Failure cleanup `:94–96` then recursively deletes claimed dir.

**Repro:** pre-existing `.tmp/core-source-only-default/user.txt`, no ownership marker; first build command fails → entire scratch removed.

**Observed safe repro:** imported production script with all FS writes/deletes + child processes mocked. Output:

```text
npm ci failed with 1
```

Captured operations: `claim-marker`, then `recursive-delete`, same scratch path. No actual scratch mutation/deletion.

**Minimal fix:** distinguish absent dir from missing marker. Existing unowned dir → refuse. Create fresh scratch exclusively; use per-run ownership token.

**Regression:** new `tests/core-source-only-server.test.ts`: absent dir allowed; existing unmarked dir untouched; failed build only cleans genuinely owned scratch.

```sh
node --test tests/core-source-only-server.test.ts
```

**Origin:** HEAD; file unchanged.

### F3 — High/P1: CI never produces required set-image archive

**Evidence:**

- F3A `.github/workflows/ci.yml:29–38`: restores `.cache/upstream` + `generated`; runs only `assets:mvp`.
- F3B `scripts/lib/mvp-assets.ts:72–114`: no `download-set-images.ts` stage.
- F3C `package.json:20,51`: headless gate unconditionally runs `assets:sets:verify`.
- F3D `scripts/verify-set-images.ts:27–29,77–84`: requires `assets/shared/set-images/manifest.json`.
- F3E `git ls-files assets generated`: only core icon + story placeholder tracked; required archive absent from source.

Clean runner cannot acquire required set manifest through configured steps. Legacy cache paths do not restore current `assets/shared/set-images` location.

**Repro:** trace emitted stage graph against verifier prerequisites; confirmed missing producer. Clean-runner network reproduction intentionally not executed.

**Minimal fix:** explicit set acquisition before isolated headless gate, or verified pinned archive restore. Cache current asset roots; update stale archived runtime paths at `.github/workflows/ci.yml:69,85`.

**Regression:** extend stage/workflow contract test to assert every mandatory verifier input has producer/restore path.

```sh
node --test tests/mvp-assets.test.ts
```

Then CI owner reruns cold-cache workflow after fix.

**Origin:** HEAD. Dirty workflow change only Node 24 → 26; dirty package changes do not introduce omission.

### F4 — Medium/P2: core/content browser suites absent from standard CI execution

**Evidence:** `package.json:47–53` runs default E2E + acceptance only. Their configs target `e2e/`, `e2e-acceptance/`. Separate suites require:

- F4A `playwright.core.config.ts:8–10`: `e2e-core/`, excluding chapter delivery.
- F4B `playwright.content.config.ts:4–5`: `e2e-content/`, excluding built installer.
- F4C `playwright.content-built.config.ts:4–5`: built installer.
- F4D `playwright.t3.config.ts:8–9`: chapter delivery.

CI invokes `npm run check`, not these configs. `tests/unit/content-tooling-gates.test.ts:9–29` checks format/lint/typecheck inclusion, never browser execution.

Offline shell, update consent, atomic activation, installer integration can regress without standard browser gate detecting failures.

**Minimal fix:** wire independent core suite into CI. Prepare deterministic verified content fixture; wire remaining content suites explicitly. Strengthen gate contract to check execution commands.

**Exact regression cmds after prerequisite setup:**

```sh
./node_modules/.bin/playwright test -c playwright.core.config.ts --project=chromium
./node_modules/.bin/playwright test -c playwright.content.config.ts
./node_modules/.bin/playwright test -c playwright.content-built.config.ts
./node_modules/.bin/playwright test -c playwright.t3.config.ts
```

Real/built/chapter tests require valid `CONTENT_RUN`; do not invoke against arbitrary run.

**Origin:** HEAD. Dirty package/workflow changes unrelated.

### F5 — Medium/P2: browser verifier compares content filenames, not packaged bytes

**Evidence:** `scripts/verify-browser-build.ts:120–135` verifies source run, compares expected object keys with packaged filenames. No packaged object length/hash comparison. Producer hashes bytes before copying, `scripts/lib/vite-core-content.ts:94–105,240–246`; standalone verifier does not independently validate copied output.

**Repro:** valid selected-content build; replace existing `dist/content/parts/<hash>.zip` bytes without renaming. Content-selection verification still accepts filenames. Runtime later rejects corrupted object.

**Minimal fix:** hash every packaged selected object against corresponding `snapshot.objects` descriptor; compare byte counts too.

**Regression:** new verifier test mutates same-length ZIP bytes, truncates object, retains filenames; all must fail.

```sh
node --test tests/browser-build-verification.test.ts
```

Proposed test file; not created.

**Origin:** HEAD; file unchanged.

### F6 — Medium/P2: offline cached source bytes not bound to pinned commit

**Evidence:** `scripts/lib/sources.ts:106–112` skips checkout offline, validates only HEAD SHA. No tracked/untracked worktree-content validation. `scripts/sync-assets.ts:95–126,328–409,431–456` reads filesystem DBs/scripts/strings, including discovered extra matching files.

Pinned HEAD + edited Lua/DB, or extra `release-*.cdb` → regenerated snapshot labels altered bytes with pinned upstream revision. Generated checksums prove self-consistency, not upstream provenance.

**Repro:** isolated valid cache at pinned HEAD; edit tracked Lua or add matching DB; offline source validation still passes HEAD check. Destructive/cache mutation repro not executed.

**Minimal fix:** reject dirty/untracked source inputs offline, or read source blobs directly from pinned commit. Preserve unknown local files; never silently clean them.

**Regression:** extend `tests/sources.test.ts` with dirty tracked file + extra relevant untracked file cases.

```sh
node --test tests/sources.test.ts
```

**Origin:** HEAD; file unchanged.

## Validation

- V1 `node --version` → `v26.7.0`.
- V2 `node --test tests/mvp-assets.test.ts tests/run-lock.test.ts` → **6 passed**.
- V3 `node --test tests/sources.test.ts tests/paths.test.ts tests/tar.test.ts tests/images.test.ts` → **10 passed**.
- V4 `node scripts/verify-vendor.ts` → `"status": "ok"`, 21 files.
- V5 F1 production-fn mock repro → parent repo accepted; mutation command selected. Mutation mocked.
- V6 F2 production-script mock repro → unowned scratch claimed, scheduled recursive deletion. All effects mocked.
- V7 Stage-graph probe → set-image producer absent; mandatory verifier present.
- V8 Final `git diff --name-only --cached` → empty. Tracked dirty summary remained 19 files, 45 insertions, 43 deletions.
- V9 Full build/typecheck/Vitest/browser suites skipped. Parent coordinating resources; no broad-run pass claimed.

## Coverage ledger

### Fully read

- C1 **113/141 script files:** all `scripts/**/*.ts` except explicit C2–C4 remainder below. Includes producer/publisher, migration, profile scan/promotion, source/path guards, ZIP writer/verifier, acquisition CLIs, runtime generation/verification, Vite delivery helpers, fixture servers/teardowns.
- C2 **Root configs:** `package.json`, `eslint.config.js`, `prettier.config.js`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, all six `playwright*.config.ts`.
- C3 **Workflow:** `.github/workflows/ci.yml`.
- C4 **Context:** `AGENTS.md`.
- C5 **Tests/fixtures:** `tests/mvp-assets.test.ts`, `tests/run-lock.test.ts`, `tests/sources.test.ts`, `tests/paths.test.ts`, `tests/vite-config.test.ts`, `tests/unit/content-tooling-gates.test.ts`, `tests/unit/app-build-identity.test.ts`, `tests/unit/core-content-transport.test.ts`, `tests/fixtures/runtime-build-constants.ts`, `tests/fixtures/node-duel-worker-harness.ts`.

### Partial source reads

- D1 `scripts/generate-shop-sets.ts`: lines 1–35, 370–422.
- D2 `scripts/lib/content-setup.ts`: lines 1–170, 330–508; additional symbol/error search.
- D3 `scripts/lib/asset-delivery/asset-result.ts`: tail visible; initial lines truncated.
- D4 `tests/progressive-publisher.test.ts`: lines 1–325; remaining test names/risk terms searched.
- D5 `download-mvp-assets.sh`, `download-mvp-assets.cmd`, `tests/integration/node-worker-thread.test.ts`, `tests/integration/duel-session.test.ts`: dirty diffs only.
- D6 `package-lock.json`: status/diff summary only; dependency graph unreviewed.

### Search-only / no full source inspection

Risk/API searches covered `scripts/` broadly; search hits do not establish full review. These 25 remaining script files need source review:

```text
scripts/lib/active-card-data-manifest.ts
scripts/lib/active-card-text-manifest.ts
scripts/lib/active-image-manifest.ts
scripts/lib/asset-delivery/chapter-gameplay.ts
scripts/lib/asset-delivery/chapter-profile.ts
scripts/lib/asset-delivery/player-bundle.ts
scripts/lib/asset-delivery/verify-chapter-gameplay.ts
scripts/lib/capped-response-body.ts
scripts/lib/catalog.ts
scripts/lib/chapter-content-source.ts
scripts/lib/chapter-set-id.ts
scripts/lib/chapter-set-media.ts
scripts/lib/chapter-source-policy.ts
scripts/lib/content-setup-decks.ts
scripts/lib/domain-chunk-closure.ts
scripts/lib/image-content-lock.ts
scripts/lib/images.ts
scripts/lib/limits.ts
scripts/lib/model.ts
scripts/lib/set-images.ts
scripts/lib/shop-set-fold.ts
scripts/lib/shop-set-image-codes.ts
scripts/lib/strings.ts
scripts/lib/transform.ts
scripts/lib/vite-runtime-assets.ts
```

- E1 `e2e/`, `e2e-core/`, `e2e-content/`, `e2e-acceptance/`, `tests/fixtures/`: inventory + targeted setup/cleanup/mutation/skip searches; test bodies largely uninspected.
- E2 Remaining asset-delivery/producer/unit/integration tests: inventoried; not fully read/run.
- E3 App build-date consumers searched; no active consumer found. No reproducibility finding raised from unused constant.
- E4 Agent-skill scripts under dotdirs, ignored/generated outputs, other docs, full lockfile, root asset-data configs, ignore files: uninspected. No clean claim.

## Assumptions

- A1 “Scripts” scope interpreted as project `scripts/` + root acquisition launchers, not vendored agent-skill tooling.
- A2 Graphify unavailable per task → inventory/source fallback.
- A3 Read-only instruction overrides artifact-write request. Runtime persists this report to supplied authoritative path.
- A4 Tests creating/removing their own fixture dirs permitted; source/workspace edits prohibited. Executed lock tests clean owned fixtures.

## Residual risks / next actions

- N1 Parent: prioritize F1/F2 safeguards; add isolated regression tests before invoking affected tools.
- N2 Parent: finish listed script/source gaps, especially `player-bundle.ts`, `verify-chapter-gameplay.ts`, `vite-runtime-assets.ts`, content producer tests.
- N3 Publisher concern, **not promoted to finding:** idempotent branch checks remote manifest only, `progressive-publisher.ts:276–283`; lost/corrupt payload recovery not exercised. Clarify recovery contract, add fault-injection test.
- N4 Dirty Worker timeout/exit-code changes read, not runtime-validated. Parent should run focused Node Worker integration tests.
- N5 No actual cache mutation, scratch deletion, remote transport, downloads, builds, publication performed. Mock repros demonstrate selected control flow, not destructive effects.

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "Six concrete findings F1-F6 include severity, file:line evidence, reproduction conditions, minimal fixes, exact regression commands. F1/F2 additionally demonstrated through production code with mocked mutations."
    }
  ],
  "changedFiles": [],
  "testsAddedOrUpdated": [],
  "commandsRun": [
    {
      "command": "git status --short; git diff --stat; git diff --name-only --cached",
      "result": "passed",
      "summary": "Existing user changes inspected; staged set empty."
    },
    {
      "command": "git -C scripts rev-parse --git-dir --show-toplevel",
      "result": "passed",
      "summary": "Non-repository child resolves enclosing project repository, confirming F1 discovery behavior."
    },
    {
      "command": "node --experimental-test-module-mocks --input-type=module [inline syncRepository probe]",
      "result": "passed",
      "summary": "Actual Git discovery accepted enclosing repository; subsequent sparse-checkout mutation intercepted by mock."
    },
    {
      "command": "node --experimental-test-module-mocks --input-type=module [inline core-source-only-server probe]",
      "result": "passed",
      "summary": "Mocked missing-marker case claimed existing scratch then selected recursive deletion after mocked npm failure. No actual writes/deletes."
    },
    {
      "command": "node --input-type=module [inline buildAssetStages/package-script probe]",
      "result": "passed",
      "summary": "Confirmed missing set-image producer plus mandatory verifier; specialized browser configurations absent from standard check."
    },
    {
      "command": "node --test tests/mvp-assets.test.ts tests/run-lock.test.ts",
      "result": "passed",
      "summary": "6 tests passed."
    },
    {
      "command": "node --test tests/sources.test.ts tests/paths.test.ts tests/tar.test.ts tests/images.test.ts",
      "result": "passed",
      "summary": "10 tests passed."
    },
    {
      "command": "node scripts/verify-vendor.ts",
      "result": "passed",
      "summary": "Frozen vendor verification passed: 21 files."
    },
    {
      "command": "npm run check",
      "result": "not-run",
      "summary": "Parent requested checkpoint; broad validation/resource coordination deferred."
    }
  ],
  "validationOutput": [
    "Node v26.7.0",
    "16 targeted Node tests passed",
    "Vendor verifier: status ok, files 21",
    "113 of 141 project script files fully read; 28 partial/search-only gaps explicitly listed",
    "All six actionable findings pre-existing in HEAD; none attributed to user dirty changes"
  ],
  "residualRisks": [
    "Audit incomplete at parent-requested checkpoint; remaining source/test coverage listed.",
    "Full typecheck/build/browser/integration validation not run.",
    "Publisher remote payload recovery under idempotent retry remains untested.",
    "Dirty Worker harness changes not runtime-validated."
  ],
  "noStagedFiles": true,
  "diffSummary": "No audit edits. Existing user dirty work preserved.",
  "reviewFindings": [
    "High/P1 F1: scripts/lib/sources.ts:60-112 - cache validation can select enclosing user Git repository before mutation.",
    "High/P1 F2: scripts/core-source-only-server.ts:23-36,94-96 - missing ownership marker permits claiming then recursively deleting existing unowned scratch.",
    "High/P1 F3: .github/workflows/ci.yml:29-38; scripts/lib/mvp-assets.ts:72-114; package.json:20,51 - required set-image archive lacks CI producer/restore.",
    "Medium/P2 F4: package.json:47-53 - specialized core/content browser suites omitted from standard CI execution.",
    "Medium/P2 F5: scripts/verify-browser-build.ts:120-135 - packaged content filenames checked without packaged byte/hash verification.",
    "Medium/P2 F6: scripts/lib/sources.ts:106-112 - offline worktree bytes not authenticated against pinned commit."
  ],
  "manualNotes": "Read-only restriction honored. Runtime must persist report to authoritative tooling-audit.md path. No destructive repro, remote publication, downloads, source edits, or commits performed."
}
```

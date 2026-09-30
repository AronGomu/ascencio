# Tooling implementation — F2–F5

## State

- S1 **Done:** F2 scratch ownership, F3 CI producer/cache paths, F5 packaged-byte verification. Base `6704f2a`; isolated worktree `/home/aron/Projects/ascencio/.tmp/codebase-audit-tooling`.
- S2 **Partial:** F4 execution wiring added. Core browser execution deferred: source-only harness runs `npm ci`, prohibited during this task. Deterministic installer execution exposed dormant test failures; Content worker owns their repair. Private suites remain explicit, prerequisite-checked, outside standard CI.
- S3 **Evidence:** final focused Node **20/20**, Vitest **2/2**, scoped Prettier/ESLint/TypeScript passed. Browser suite **6 passed / 5 failed** before integration; no browser-green claim.
- S4 **Safety:** no downloads, package installation, publication, system apply, staging, commits, pushes, subagents. `scripts/lib/sources.ts`, `tests/sources.test.ts`, `e2e-content/installer.spec.ts` final diffs empty.

## Finding dispositions

### F2 — High/P1 — fixed

- F2A `scripts/lib/core-source-scratch.ts:26–45`: exclusive nonrecursive scratch creation; existing paths rejected, never claimed. Parent symlinks rejected; ownership marker created with `wx`.
- F2B `scripts/lib/core-source-scratch.ts:48–64`: removal requires real directory, regular marker, matching per-run token. Missing scratch allowed; existing unmarked scratch rejected. Old static marker grants nothing.
- F2C `playwright.core.config.ts:2–5`, `scripts/core-source-only-server.ts:17–20`, `scripts/core-source-only-teardown.ts:11–15`: fresh Playwright-run UUID shared with servers/teardown; direct server fallback creates UUID. Copy failures now share owned cleanup with build failures.
- F2D `tests/core-source-only-server.test.ts`: six disposable-fixture cases cover fresh ownership/failure cleanup, unowned preservation, stale/foreign markers, symlinks, concurrent claim exclusion, invalid inputs. No destructive reproduction against real project scratch.
- F2E Residual: interrupted runs can leave scratch. New runs intentionally refuse it. Human inspects stale directory before choosing recovery; no automatic deletion of old ownership.

### F3 — High/P1 — fixed; cold-run validation pending

- F3A `.github/workflows/ci.yml:29–47`: cache canonical engine/data/runtime/card/set-image roots; versioned key includes producer/helpers, chapter inputs, shop source, image/source locks. Explicit `assets:sets && assets:sets:verify` precedes isolated headless gate.
- F3B `.github/workflows/ci.yml:78,94–96`: canonical runtime-manifest archive paths; specialized browser failure evidence uploaded.
- F3C `tests/mvp-assets.test.ts:44–86`: workflow contract asserts producer ordering, verifier, current asset cache roots, identity inputs, archive path migration.
- F3D No network acquisition run. CI owner must validate cold-cache workflow; upstream availability/hash drift remains fail-closed.

### F4 — Medium/P2 — wiring fixed; browser integration blocked

- F4A `package.json:48–55`: standard `check:browser` executes `test:core` plus `test:content:fixtures`. `playwright.content-fixture.config.ts:6–9` selects only deterministic `installer.spec.ts`, not real/built/T7 cases.
- F4B `tests/unit/content-tooling-gates.test.ts:6–27`: freezes execution chain, config selection, explicit private-suite separation. Existing format/lint/typecheck assertions retained.
- F4C `package.json:50`, `scripts/verify-content-browser-run.ts:10–31`: explicit `test:content:legacy` preflight requires valid `CONTENT_RUN`, verifies bundle, requires legacy runtime/data manifests before executing content, built-content, T3 configs. No silent skips or fake fixture substitutions.
- F4D `e2e-content/t7-runtime.spec.ts:19–20,59–63` still reads `generated/runtime/current/manifest.json` plus `generated/assets/current/**`. Migrated `assets/shared/**` alone cannot satisfy it. Neither legacy directory exists in parent checkout at inspection.
- F4E Parent-supplied `generated/asset-delivery/current.json` names `generated/asset-delivery/runs/d99ee74f-da25-4e18-aa61-265feffed264`, but that run directory is absent. Read-only `verifyBundle` failed exactly: `AssetDeliveryError: ASSET_REFERENCE_MISSING`; path `generated/asset-delivery/runs/d99ee74f-da25-4e18-aa61-265feffed264/candidate.json`. Pointer is not usable verified content. Generated files untouched.
- F4F Initial deterministic execution: 6 passed, 5 failed. Stale imports target `/src/battle/content-activation.ts`, `/src/battle/storage/installed-runtime-receipt.ts`; Content worker owns adapter-path/legacy-DB assertion fixes. First reload case also returned `{"kind":"failed","code":"CONTENT_STORAGE_UNAVAILABLE","packId":null,"path":null}`.
- F4G Temporary test-only probe routed root document to blank same-origin HTML, updated stale adapter paths. First reload case then passed. This suggests live shell DB interference; not established app defect. Probe still had 5 failures: obsolete DB-upgrade assertion plus intermittent imports. Trace console confirmed `Failed to load resource: net::ERR_NETWORK_CHANGED`; not all import failures were missing files. No retries/skip masks added.
- F4H Parent steering honored: probe diff inspected/preserved temporarily, then installer spec restored byte-identical HEAD. Content worker diff inspected read-only. **Integrate Content worker repair first; Content reviewer must assess shell interference, rerun deterministic gate.** Tooling does not retain competing test edits.
- F4I `--list` confirms 11 core tests/5 files, 11 installer cases/1 file at baseline. Content worker changes case inventory; listing is not execution evidence.

### F5 — Medium/P2 — fixed

- F5A `scripts/verify-browser-build.ts:128`, `scripts/lib/browser-content-verification.ts:10–34`: retain exact selected filename closure; independently stream/hash every packaged index/catalog/manifest/part against selected snapshot byte count + SHA-256. Reuse existing guarded `digestSource`.
- F5B `tests/browser-build-verification.test.ts:34–64`: create real verified producer bundle in owned fixture, copy content, flip packaged ZIP byte without renaming/changing length. Source bundle remains valid; packaged verifier rejects.
- F5C Additional cases cover exact bytes, same-length corruption across all four object classes, truncation, missing/extra objects. No real content mutation.

### F1 / F6 — excluded

- F1A Base includes main fix `6704f2a`. No edits to source-cache implementation/tests. `git diff --exit-code -- scripts/lib/sources.ts tests/sources.test.ts` passed.

## Additional review — no out-of-scope fixes

- R1 **28/28 previous source gaps fully read**, 4,379 lines. Supplement to earlier audit's 113/141 baseline files, not claim every current source/test was independently reread here.
- R2 **Low/P3, unpatched:** `scripts/generate-shop-sets.ts:385–392` calls `fetch(url)` without timeout, then unbounded `response.json()`. Stalled/oversized upstream response can hang/exhaust one-shot generator. Existing bounded primitive: `scripts/lib/capped-response-body.ts:16–45`. Static evidence only; no network reproduction. Outside F2–F5.
- R3 `scripts/lib/catalog.ts:34–73` materializes SQLite results before aggregate record-limit check. Resource-hardening concern; not promoted to separate verified finding. Pinned upstream/cache guards reduce exposure; oversized-input fault injection absent.
- R4 No further actionable findings established from supplementary read. Pure schema/mapping review is not runtime validation.

### Exact supplementary coverage

```text
scripts/generate-shop-sets.ts
scripts/lib/content-setup.ts
scripts/lib/asset-delivery/asset-result.ts
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

- C1 Remaining prior-audit gaps: full lockfile/dependency graph, launcher/integration bodies, remaining publisher/test corpus, ignored/generated content, agent tooling. No broader coverage claim.

## Changed integration files

```text
.github/workflows/ci.yml
package.json
playwright.core.config.ts
playwright.content-fixture.config.ts
scripts/core-source-only-server.ts
scripts/core-source-only-teardown.ts
scripts/lib/core-source-scratch.ts
scripts/lib/browser-content-verification.ts
scripts/verify-browser-build.ts
scripts/verify-content-browser-run.ts
tests/core-source-only-server.test.ts
tests/browser-build-verification.test.ts
tests/content-browser-run.test.ts
tests/mvp-assets.test.ts
tests/unit/content-tooling-gates.test.ts
tsconfig.json
```

## Integration overlap

- I1 `package.json`, `.github/workflows/ci.yml` overlap owner's dirty main files. Apply narrow hunks only; preserve owner's Node 26 engine/setup changes, unrelated package scripts/docs. Worker leaves baseline Node 24 lines unchanged; whole-file replacement would regress owner edits.
- I2 No lockfile, docs, application, source-cache, Content-owned E2E diffs. Final installer-spec diff empty.
- I3 Existing untracked `node_modules` symlink predates task; retained. Browser diagnostics remain under worktree `artifacts/CORE_ACCEPTANCE/T6/`, excluded from integration. No staged files.
- I4 Removed owned scratch `.tmp/tooling-installer-probe.patch`, empty `.tmp/ship-t3-20260909/fixtures`, empty `.tmp/ship-t3-20260909`, blank probe screenshot `artifacts/CORE_ACCEPTANCE/T4/installer-core-locked.png`, list-only `artifacts/T10-EVIDENCE/playwright-report.json` plus empty parent dir. Test-owned fixture dirs cleaned by hooks.

## Validation

- V1 RED: new workflow contract failed `set-image producer must precede isolated headless gate`; Vitest execution contract failed missing `npm run test:core`.
- V2 RED: extracted original scratch/filename-only behavior produced 9/12 failures, each `Missing expected rejection.` Missing-module setup failures preceded extraction; not counted as behavioral proof.
- V3 GREEN: `node --test tests/core-source-only-server.test.ts tests/browser-build-verification.test.ts tests/mvp-assets.test.ts tests/content-browser-run.test.ts` → 20 passed, 0 failed.
- V4 GREEN: `./node_modules/.bin/vitest run tests/unit/content-tooling-gates.test.ts` → 2 passed.
- V5 GREEN: scoped Prettier/ESLint/strict TypeScript checks. First TypeScript invocation lacked `--ignoreConfig`: `error TS5112: tsconfig.json is present but will not be loaded if files are specified on commandline. Use '--ignoreConfig' to skip this error.` Corrected invocation passed.
- V6 Browser execution failed as F4F–F4G; report/trace evidence retained in worktree `artifacts/CORE_ACCEPTANCE/T6/`. Full app build, core execution, private browser execution, cold-cache CI not run. Parent's separate build/asset passes are parent evidence, not worker evidence.
- V7 `git diff --check`, protected-path diff checks, staged-set check passed. Graphify unavailable: `/bin/bash: line 1: graphify: command not found`; direct source fallback used.

Scoped quality command executed successfully:

```bash
mapfile -t ts_files < <({ git diff --name-only -- '*.ts'; git ls-files --others --exclude-standard -- '*.ts'; } | sort -u)
./node_modules/.bin/prettier --check "${ts_files[@]}" package.json tsconfig.json .github/workflows/ci.yml &&
./node_modules/.bin/eslint "${ts_files[@]}" &&
./node_modules/.bin/tsc --ignoreConfig --noEmit --target ES2023 --module NodeNext --moduleResolution NodeNext --allowImportingTsExtensions --strict --noUncheckedIndexedAccess --exactOptionalPropertyTypes --skipLibCheck --types node,vite/client,vitest/globals "${ts_files[@]}"
```

## Assumptions

- A1 Approved scope permits focused helper extraction, config wiring, fixture-only regression generation. Real downloads/install/publication remain prohibited.
- A2 Standard CI may run source-only core plus deterministic API fixtures. Private real/built/T3 suites require valid private inputs, not synthetic replacement disguised as legacy acceptance.
- A3 Filesystem parent is trusted project root; scratch parent/directory/marker symlinks rejected. Guards do not claim OS-level protection against malicious concurrent directory replacement.
- A4 Per parent steering, Content worker remains sole owner of installer-spec repair. Tooling gate depends on integrated correction; no competing patch retained.

## Exact next actions

- N1 Parent: request fresh reviewer on listed 16 integration files, prioritizing scratch ownership/token lifecycle, workflow prerequisites, packaged verification.
- N2 Parent: integrate narrowly while preserving Node 26/user hunks; include Content worker correction. Run `npm run test:content:fixtures`; resolve reload/DB interference before accepting browser gate.
- N3 Authorized runner: run `npm run test:core`, then cold-cache workflow. Worker skipped core execution because harness invokes package installation.
- N4 Private-input owner: restore/recover complete immutable legacy run plus required legacy runtime/data trees; verify before setting `CONTENT_RUN`. Then run `CONTENT_RUN=generated/asset-delivery/runs/<verified-run-id> npm run test:content:legacy`. Existing dangling pointer is insufficient. No generated-file repair performed here.

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "F2-F5 dispositions include severity, exact paths, regression evidence; F4 browser/private-input blockers explicitly documented. All 28 prior tooling source gaps fully read; additional unpatched Low/P3 resource-bound finding recorded."
    }
  ],
  "changedFiles": [
    ".github/workflows/ci.yml",
    "package.json",
    "playwright.core.config.ts",
    "playwright.content-fixture.config.ts",
    "scripts/core-source-only-server.ts",
    "scripts/core-source-only-teardown.ts",
    "scripts/lib/core-source-scratch.ts",
    "scripts/lib/browser-content-verification.ts",
    "scripts/verify-browser-build.ts",
    "scripts/verify-content-browser-run.ts",
    "tests/core-source-only-server.test.ts",
    "tests/browser-build-verification.test.ts",
    "tests/content-browser-run.test.ts",
    "tests/mvp-assets.test.ts",
    "tests/unit/content-tooling-gates.test.ts",
    "tsconfig.json",
    "/home/aron/Projects/ascencio/artifacts/codebase-audit/tooling-worker.md"
  ],
  "testsAddedOrUpdated": [
    "tests/core-source-only-server.test.ts",
    "tests/browser-build-verification.test.ts",
    "tests/content-browser-run.test.ts",
    "tests/mvp-assets.test.ts",
    "tests/unit/content-tooling-gates.test.ts"
  ],
  "commandsRun": [
    {
      "command": "node --test tests/core-source-only-server.test.ts tests/browser-build-verification.test.ts tests/mvp-assets.test.ts tests/content-browser-run.test.ts",
      "result": "passed",
      "summary": "20 passed; disposable scratch, valid producer bundle, corruption, workflow, prerequisite regressions. Behavioral red evidence captured before fixes."
    },
    {
      "command": "./node_modules/.bin/vitest run tests/unit/content-tooling-gates.test.ts",
      "result": "passed",
      "summary": "2 passed after execution-gate contract red."
    },
    {
      "command": "mapfile -t ts_files < <({ git diff --name-only -- '*.ts'; git ls-files --others --exclude-standard -- '*.ts'; } | sort -u); ./node_modules/.bin/prettier --check \"${ts_files[@]}\" package.json tsconfig.json .github/workflows/ci.yml && ./node_modules/.bin/eslint \"${ts_files[@]}\" && ./node_modules/.bin/tsc --ignoreConfig --noEmit --target ES2023 --module NodeNext --moduleResolution NodeNext --allowImportingTsExtensions --strict --noUncheckedIndexedAccess --exactOptionalPropertyTypes --skipLibCheck --types node,vite/client,vitest/globals \"${ts_files[@]}\"",
      "result": "passed",
      "summary": "Scoped format, lint, strict types passed."
    },
    {
      "command": "./node_modules/.bin/playwright test -c playwright.content-fixture.config.ts --list",
      "result": "passed",
      "summary": "11 baseline deterministic installer cases discovered."
    },
    {
      "command": "./node_modules/.bin/playwright test -c playwright.core.config.ts --project=chromium --list",
      "result": "passed",
      "summary": "11 core cases across 5 files discovered; no execution claim."
    },
    {
      "command": "./node_modules/.bin/playwright test -c playwright.content-fixture.config.ts",
      "result": "failed",
      "summary": "6 passed, 5 failed. Dormant stale imports/DB expectations, reload storage error, environmental ERR_NETWORK_CHANGED. Temporary probe restored; Content worker owns test repairs."
    },
    {
      "command": "node --input-type=module -e 'import {verifyBundle} from \"./scripts/lib/asset-delivery/verify-bundle.ts\"; const snapshot=await verifyBundle(\"/home/aron/Projects/ascencio\", \"generated/asset-delivery/runs/d99ee74f-da25-4e18-aa61-265feffed264\"); console.log(JSON.stringify({verified:true,player:snapshot.prod!==null,objects:snapshot.objects.length}));'",
      "result": "failed",
      "summary": "ASSET_REFERENCE_MISSING: supplied current pointer targets absent run/candidate.json. Read-only; generated files untouched."
    },
    {
      "command": "git diff --check; git diff --name-only --cached; git diff --exit-code -- scripts/lib/sources.ts tests/sources.test.ts e2e-content/installer.spec.ts",
      "result": "passed",
      "summary": "Whitespace clean, staged set empty, excluded/Content-owned files unchanged."
    },
    {
      "command": "npm run test:core",
      "result": "not-run",
      "summary": "Harness runs npm ci; package installations prohibited."
    },
    {
      "command": "npm run test:content:legacy",
      "result": "not-run",
      "summary": "Verified legacy run unavailable; legacy generated runtime/data prerequisites also absent."
    }
  ],
  "validationOutput": [
    "20 Node tests passed",
    "2 Vitest tests passed",
    "Scoped Prettier, ESLint, strict TypeScript passed",
    "Core list: 11 tests / 5 files; fixture list: 11 tests / 1 file",
    "Browser execution: 6 passed / 5 failed; integration unresolved",
    "28/28 supplementary tooling source files fully read"
  ],
  "residualRisks": [
    "F4 browser gate must pass after Content worker integration; shell-reload DB interference remains reviewer action.",
    "Private CONTENT_RUN pointer is dangling; legacy runtime/data trees absent. Real/built/T3 suites remain outside standard CI until valid inputs exist.",
    "Core source-only execution and cold-cache CI not run because installation/downloads prohibited.",
    "Existing stale scratch intentionally refused; human inspection required after interrupted runs.",
    "Low/P3 generate-shop-sets.ts fetch lacks timeout/body cap; outside approved fixes.",
    "Full lockfile, remaining tests, publisher fault cases not exhaustively reviewed/run."
  ],
  "noStagedFiles": true,
  "diffSummary": "16 focused integration files: token-bound scratch ownership; canonical CI caches/set-image producer; core/deterministic execution gates plus explicit private preflight; independent packaged SHA-256/length checks; regression tests. No app, lockfile, sources.ts, or Content-owned E2E diff.",
  "reviewFindings": [
    "High/P1 F2 fixed: scripts/lib/core-source-scratch.ts:26-64 rejects existing unowned scratch and foreign cleanup tokens.",
    "High/P1 F3 fixed pending cold CI: .github/workflows/ci.yml:29-47 caches current assets and produces/verifies required set images before isolated gate.",
    "Medium/P2 F4 partial: package.json:48-55 wires execution; Content test integration and private prerequisite recovery remain blockers.",
    "Medium/P2 F5 fixed: scripts/lib/browser-content-verification.ts:27-33 independently verifies packaged bytes against snapshot descriptors.",
    "Low/P3 unpatched: scripts/generate-shop-sets.ts:385-392 lacks fetch timeout/body cap; static evidence, no network reproduction."
  ],
  "manualNotes": "Fresh review required. Integrate package.json/.github/workflows/ci.yml hunks surgically; preserve owner's Node26 changes. Content worker owns installer.spec.ts repair; tooling file restored byte-identical HEAD. Existing node_modules symlink retained; generated browser diagnostics excluded from code integration. No commits/staging/publication/install/downloads."
}
```

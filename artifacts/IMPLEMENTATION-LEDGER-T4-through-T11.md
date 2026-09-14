# Implementation ledger — T4 through T11

## Objective

Reconcile accepted T1–T3 lane baseline into root `main` without implementing T4, while preserving both original commit histories, root documentation intent, root untracked work, and original detached lane as recovery copy. Continue approved plan with T4–T11 pending after P1.

## Run

| Field | Value |
| --- | --- |
| Worker/run | `e85218fb` |
| Route | Parent-verified `openai-codex/gpt-5.6-sol:high`, fresh context; child runtime exposes no direct model metadata |
| Writer | Sole root writer; no subagents |
| Retries | `0` |
| Escalation | Route metadata confirmed by parent before first edit; no product/scope escalation |

## P1 — baseline reconciliation

State: **ACCEPTED — independent review passed**

Review: `.pi-subagents/artifacts/outputs/5dc22844-8569-4e7a-9d1d-6e16f1668c07/artifacts/REVIEW-baseline-reconciliation.md`; parent reran ancestry plus 269-lane/244-transfer SHA checks.

- [x] P1.1 Inventory root/lane SHAs, statuses, path hashes, transfer decisions before reconciliation. Validation: `python -m json.tool artifacts/BASELINE-RECONCILIATION-T4.json` exits 0; inventory records root `b197f885f0ff0122f8748249908a9e2a1fe15601`, lane `010401956d0cd59d8e6dda91bd367040f5de669e`, 269 lane entries, 244 transfer paths.
- [x] P1.2 Create append-only merge preserving both original SHAs, resolve only `docs/GLOSSARY.md` to root deletion. Validation: merge commit `cd35be0bb518de264ddc91d0cb937a287f78785b`; `git merge` reported only `docs/GLOSSARY.md`; root deletion retained; ADR-089–094 present; staging empty after commit.
- [x] P1.3 Transfer accepted lane source/tests with collision-safe baseline checks; leave lane byte-identical. Validation: collision count 0; all 244 root paths match inventory worktree hashes/absence; lane HEAD `010401956d0cd59d8e6dda91bd367040f5de669e`, status SHA-256 `62474facecad7d8a42141885886929a767e461b7472694dce012dc519fd71dab`, path mismatches 0.
- [x] P1.4 Commit accepted T1–T3 transfer plus pre-mutation inventory without unrelated root artifacts. Validation: commit `e338808ffbe790d8dc9a3210a7467535fb293c58`; no-rename staged allowlist 245/245 exact; secret-pattern hits 0; staged diff check passed; ledger/report/logs remain untracked task artifacts alongside preserved root untracked work.
- [x] P1.5 Run requested baseline validation and publish exact evidence. Validation: `git diff --check` exit 0; `npm run typecheck` exit 0 with 0 errors/4 warnings; requested Vitest exit 0 with 4 files/121 tests; ancestry/preservation exit 0; `git diff --cached --quiet` exit 0; exact logs/report published under `artifacts/BASELINE-RECONCILIATION/` and `artifacts/IMPLEMENTATION-REPORT-baseline-reconciliation.md`.

## T4 — deterministic per-file producer and safe publisher

State: **ACCEPTED retry1 — independent review clean; parent reran 21/21 tests.** Evidence: `artifacts/REVIEW-T4-repair.md` (00fed4de); parent inspected shared derivation plus producer/publisher source. T5 ready.

- [x] T4.1 Write named producer/publisher/50k tests before implementation. Validation: `node --test tests/progressive-producer.test.ts tests/progressive-publisher.test.ts` exit 1 with `ERR_MODULE_NOT_FOUND`; log `artifacts/T4-EVIDENCE/red-node-tests.log`.
- [x] T4.2 Implement progressive producer/parser/verify CLI. Validation: `green-node-tests.log` 10/10; `green-manifest-vitest.log` 3/3; exact CLI help exit 0.
- [x] T4.3 Implement conditional publisher plus local fake SDK transport tests. Validation: file→manifest→pointer order, HEAD/GET immutable identity, max-two network retry, same-ETag CAS race, stale predecessor, idempotence pass.
- [x] T4.4 Run exact acceptance/regression/type checks; publish report. Validation: typecheck 0 errors/4 pre-existing warnings; producer regressions 34/34; content/boundary regressions 130/130; report `artifacts/IMPLEMENTATION-REPORT-T4.md`.

Worker/run: sole root writer; initial route `openai-codex/gpt-5.6-sol:high`; retry1 parent-verified `openai-codex/gpt-6-astra:high` per N3; no children. Retries: `1`. Reason: failed Sol-high T4 acceptance; parent accepts `artifacts/REVIEW-T4.md` findings R1/R2/R3. P1 accepted, unchanged.

- [x] T4.R1 Add changed-source successor regression; verify archived predecessor with freshness disabled, preserve candidate freshness. Validation: red Node exit 1 (`CONTENT_SOURCE_STALE`); green Node 55/55 exit 0; regression also rejects corrupted archived object/current stale publish before remote calls.
- [x] T4.R2 Parse `FrozenInventory`, share complete manifest/roster derivation, reject omissions/ownership/MIME/descriptor corruption. Validation: red Node includes 9 `Missing expected rejection.` failures; green Node verifies both freshness modes plus publish rejects before any SDK call.
- [x] T4.R3 Retain length-conflict test; add same-length byte flip/one-GET/hash-rejection regression. Validation: red/green runs pass this test against unchanged publisher implementation; no fabricated R3 implementation failure.
- [x] T4.R4 Finish requested Vitest/typecheck/targeted format/lint/diff checks; publish retry1 report. Validation: Node 55/55; Vitest 41/41; typecheck 0 errors/4 pre-existing warnings; targeted Prettier/ESLint/diff/staging exit 0; 2015 tracked baseline hashes unchanged. Exact commands/exit codes under `artifacts/T4-REPAIR-EVIDENCE/`; report `artifacts/IMPLEMENTATION-REPORT-T4-repair.md`. Independent review still required.

Risks/deps: T1 wire/parser reused unchanged; T8 semantic validator absent → live publication blocked by `PUBLISH_SEMANTIC_VALIDATION_REQUIRED`. Rights/config/credential gate present before future live transport. No upload/deploy/vendor/config work.

Paths: `package.json`; `scripts/content-publish.ts`; `scripts/lib/asset-delivery/{content-cli,content-publish-cli,progressive-error,progressive-producer,progressive-publisher}.ts`; `tests/{progressive-producer,progressive-publisher,asset-delivery-bundle}.test.ts`; `tests/unit/progressive-manifest.test.ts`; T4 ticket/ledger/report/evidence.

## T5 — verified progressive staging and explicit resume

| Field | Value |
| --- | --- |
| Objective | Stage, resume, read, seal, and explicitly clean immutable per-file structural Content without activation or optional-media acquisition |
| Depends | T4 accepted at `5c2ddff`; T1–T3 baseline `e338808` |
| Route/model | Initial Sol-high acceptance failed; retry1 parent-registered `openai-codex/gpt-6-astra:high` per N3; sole root writer; no subagents |
| State | **ACCEPTED retry1** — `artifacts/REVIEW-T5-repair.md`; parent inspected repaired storage/parsers, reran 91/91 focused tests |
| Risks | Native Chromium local structural harness passes; not production Shell/T9 integration. Cleanup caller lock ownership remains external contract; T9 activation intentionally absent |
| Paths | `src/content/{contracts/progressive-content-store.ts,index.ts,storage/content-cache.ts,storage/content-database.ts,storage/progressive-content-store.ts,storage/progressive-storage-validation.ts}`; legacy alias consumers; progressive tests/fixture; boundary test; T5 ticket/report/evidence |
| Retries | `1` — parent accepts `artifacts/REVIEW-T5.md` B1/B2/B3/N1 |
| Parent decision | Exact T5 `DownloadProgress`/`DownloadJob` names approved; legacy public shapes moved narrowly to `LegacyDownloadProgress`/`LegacyDownloadJob` aliases with runtime behavior unchanged |

- [x] T5.1 Write named storage/download/boundary tests first. Validation: focused red exit 1 with 13 `openProgressiveContentStore is not a function`/public-inventory failures; `artifacts/T5-EVIDENCE/red-vitest.log`.
- [x] T5.2 Implement structural DB/cache/receipts, bounded transport, resumable concurrency-4 jobs, cache-only reader/seal, explicit cleanup. Validation: focused green 55/55; `artifacts/T5-EVIDENCE/green-vitest.log`.
- [x] T5.3 Preserve legacy flow and frozen exception while exposing exact progressive contract. Validation: 66/66 affected Content regressions, boundary suite green, typecheck 0 errors.
- [x] T5.4 Publish validation/report without commit, stage, push, or deploy. Validation: `artifacts/IMPLEMENTATION-REPORT-T5.md`; targeted ESLint/Prettier/diff/staging evidence.

## T5 retry1 — accepted B1/B2/B3/N1 repair

- [x] T5.R1 Remove global download lock reacquisition; retain per-job exclusion. Validation: `red-vitest.log` fails Shell-held-exclusive/cross-store tests; `green-vitest-attempt1.log` passes both. `browser-native-result.json` records native Chromium two-tab `CONTENT_JOB_CONFLICT` plus bounded Shell-held-exclusive completion.
- [x] T5.R2 Enumerate strict owned cache keys independently of file rows; retain full active allow-set/unknown/legacy data; surface partial cleanup failures. Validation: red orphan/cache-delete regressions fail; green quota-immediate-delete, unused media/noncanonical/legacy preservation, cache-delete retry, IDB-clear retry pass. Native Chromium injected file-row quota leaves real Cache body without row; immediate delete-all removes body, preserves unknown/legacy keys.
- [x] T5.R3 Check late cancellation before/after complete persistence. Validation: four red tests abort during last Cache/file-row/progress/complete write; green persists paused, rejects `CONTENT_CANCELLED`, emits no complete. Native Cache.put abort also records paused.
- [x] T5.R4 Validate persisted job exact shape/DB key/UUID/manifest/closed sorted chapters/kind/progress identity/phase/safe bounded counters before list/open/resume. Validation: 22 corruption cases plus two closure/order cases red→green; metadata/network unchanged on rejection with `CONTENT_INTEGRITY_FAILED`.
- [x] T5.R5 Final requested focused/regression/type/lint/format/diff checks; repair report/evidence. Validation: 91/91 focused, 66/66 affected, typecheck 0 errors/4 pre-existing warnings, full T5 targeted ESLint/Prettier, native Chromium, diff/staging checks pass. `artifacts/IMPLEMENTATION-REPORT-T5-repair.md`; exact logs/exit codes under `artifacts/T5-REPAIR-EVIDENCE/`. Baseline ledger/ticket Markdown Prettier warnings independently reproduced in before snapshots; preserved, not broadly reformatted. Independent acceptance still required.

## T6 — Story semantic release + forward save generations

| Field | Value |
| --- | --- |
| State | **ACCEPTED retry1** — integration review clean; B1/B2 independently cleared `artifacts/REVIEW-T6-repair.md`; parent inspected generation tx/parser, reran 95/95 save tests |
| Model/route | Failed Astra-high acceptance → parent-routed `openai-codex/gpt-6-astra:high` retry1 per N3; sole root writer; no children |
| Retries | `1` — parent accepts `artifacts/REVIEW-T6-integrity.md` B1/B2; integration review clean |
| Dependencies | T5 accepted `8a0d513`; T4 `5c2ddff`; T1–T3 `e338808` |
| Risk/boundary | Parent-approved intermediate Story refusal without selected semantic inputs; T9 owns final lifecycle lease enforcement + production selector injection. No alternate lock/selector/bootstrap generation/legacy binding bridge |
| Paths | `src/story/ports/`, generation files under `src/story/saves/`, StoryApp/collection/shop/deck/handoff consumers; `src/shell/adapters/`, Shell mount/menu/admin/handoff consumers; boundary config/tests; exact inventory `artifacts/T6-EVIDENCE/changed-files.json` |
| Validation | retry1 exact requested Vitest 193/193 (120 + 73 additions); affected 819/819; typecheck 0 errors/4 existing warnings; scoped ESLint/Prettier/diff/staging exit 0; preservation 2210 unchanged / 5 intentional existing-file changes. Initial native Chromium evidence retained, not rerun |
| Report | `artifacts/IMPLEMENTATION-REPORT-T6-repair.md`; retry1 logs/exits/commands/repair-only diff under `artifacts/T6-REPAIR-EVIDENCE/`; initial report/evidence retained |

- [x] T6.1 Write named tests first. Validation: `red-vitest.log`, exit 1; missing semantic ports/migration + forbidden Content fixture. Existing legacy save suite stays green.
- [x] T6.2 Implement pure StoryRelease/parser/continuity + Shell-only staged translation. Validation: metadata bounds, duplicate definitions/order, references, optional map/set media, canonical abort; Story imports no root Content.
- [x] T6.3 Implement Story DB v2 generation stores, strict schema6, five-slot COW/seals, CAS/source snapshots. Validation: concurrent idempotence, narrative beat-ID remap, quota abort/source hashes, corrupt/future refusal, descriptor/absence verification, active mutable-slot reopen, unchanged legacy schema1–5.
- [x] T6.4 Inject generation repository across Story/manual/autosave/checkpoint/deck/editor/handoff/admin/menu. Validation: 746 affected checks; completed chapter binding survives checkpoint handback; admin clears only supplied generation; missing injection refuses Story explicitly.
- [x] T6.5 Publish checked evidence without commit/stage/push/deploy. Validation: exact commands in `final-commands.json`, Chromium result/trace/screenshots, `git diff --cached --quiet` exit 0. Review gate remains required.

## T6 retry1 — bounded B1/B2 repair

- [x] T6.R1 Add sparse schema6/seal regressions before implementation. Validation: exact T6 command plus 73 additions exits 1: 65 failed / 128 passed; `artifacts/T6-REPAIR-EVIDENCE/red-vitest.log`. Existing location-density/storage-error cases already pass; not claimed as new RED failures.
- [x] T6.R2 Reject sparse binding/StoryState arrays only at generation entry; retain typed write failure, semantic migration refusal, unchanged source rows. Validation: exact T6 green 193/193, including 24 sparse parse/write/raw-source cases; `artifacts/T6-REPAIR-EVIDENCE/green-vitest.log`. Historical parser untouched.
- [x] T6.R3 Clone/validate seals within semantic boundary before DB access; strictly validate scalar IDs/source/revision plus dense slots. Validation: malformed/uncloneable cases reject exact `STORY_MIGRATION_FAILED` with zero DB opens; valid seals retain unavailable/quota mappings. Exact T6 green 193/193.
- [x] T6.R4 Run affected suites/typecheck/lint/format/diff/staging checks; publish repair-only diff, logs, report. Validation: affected 819/819; typecheck 0 errors/4 existing warnings; scoped ESLint/Prettier/diff/staging exit 0; 2210 baseline regular files unchanged, 5 intentional changes, zero unexpected changes. `artifacts/IMPLEMENTATION-REPORT-T6-repair.md`; `artifacts/T6-REPAIR-EVIDENCE/commands.json`, `scope-result.json`. Required independent review pending.

## T7 — semantic Battle runtime injection

| Field | Value |
| --- | --- |
| State | **ACCEPTED retry1** — `artifacts/REVIEW-T7-repair.md` clears runtime/measurement findings; parent inspected hash/shutdown guards, reran client/real-WASM tests exit 0 |
| Writer | Sole root writer; no subagents; no commit/push/deploy |
| Depends | Accepted T6 baseline `86631c9`; frozen `ocgcore-wasm@0.1.2` |
| Boundary | Shell alone loads/decodes Content; Battle accepts clone-safe `BattleRuntimeInput` through `BattleRuntimeSource`; optional media remains non-authoritative |
| Evidence | Initial evidence retained: `artifacts/T7-EVIDENCE/`; repair supersedes acceptance/performance claims: `artifacts/T7-REPAIR-EVIDENCE/`, `artifacts/IMPLEMENTATION-REPORT-T7-repair.md` |
| Route/retry | Failed Sol-high acceptance → parent-routed `openai-codex/gpt-6-astra:high`, retry1 per N3; sole root writer, no subagents |
| Retry reason | Parent accepts runtime review B1–B4 (missing Worker frozen hash, shutdown late events, missing public command, wrong version-mismatch code), integration B1 (non-reproducible Worker-only measurement), malformed prior acceptance JSON |

- [x] T7.1 Capture RED-first parser failure, then implement bounded exact runtime DTO validation. Validation: `red-vitest.log` fails missing Battle runtime module; focused green covers duplicate/dense/bounds/script/allowed-pool cases.
- [x] T7.2 Move installed Content lookup/decoding and runtime receipt preparation to Shell adapters; remove Content imports from Battle. Validation: domain boundary scan passes; obsolete Worker receipt/fallback readers removed.
- [x] T7.3 Transfer fresh WASM once; initialize `OcgCoreAdapter` only inside Worker; retain runtime support versus chapter permission. Validation: client transfer/replacement/late-load tests plus both-seat real-WASM rejection pass.
- [x] T7.4 Preserve replay identity, concealment, production seed path, optional-image degradation. Validation: Worker/client/facade/component regressions pass; card visibility suite green; browser transferred buffer detached.
- [x] T7.5 Run exact acceptance, vendor/type checks, real WASM/Chromium evidence, startup/heap/payload comparison. Initial validation: exact 61/61; vendor 21 files; typecheck 0 errors/4 existing warnings; Chromium ready→prompt→result. Initial startup/heap comparison withdrawn: omitted Shell source assembly, missing rerunnable commands; superseded by T7.R4 below.

## T7 retry1 — bounded runtime B1–B4 + measurement B1 repair

- [x] T7.R1 Add named regressions before implementation. Validation: `red-vitest.log` exit 1, 7 failed/80 passed; intended failures cover mutant-before-initialize, actual-version typed code, shutdown/replace/dispose/synchronous races, exact public port inventory. Compile-only command equality checked by typecheck, not claimed runtime RED.
- [x] T7.R2 Pin SHA-256 inside Worker before engine initialization; preserve typed actual-version failure; export exact public InitializeRuntimeCommand reused internally. Validation: `green-vitest.log` 87/87; exact T7 65/65; typecheck 0 errors/4 existing warnings; pin equals unchanged vendor manifest + WASM source digest.
- [x] T7.R3 Ignore late non-disposal events/errors throughout shutdown, including synchronous post and replace/dispose race; retain disposed acknowledgement. Validation: client regressions plus affected suites 202/202; no stale listener/store updates, replacement initializes, racing dispose creates no new Worker.
- [x] T7.R4 Retain rerunnable same-interval baseline/new client-to-Worker benchmark including Shell source.load; count both isolate heaps/process RSS correctly. Validation: `node --expose-gc artifacts/T7-REPAIR-EVIDENCE/benchmark.mjs`, `benchmark-attempt2.log` exit 0; five fresh-process samples/lane; baseline immutable `86631c98f616efc49ecf61e5a3e259c6130bd404`; identical 2136-file input digest; median startup 546.72 → 416.52 ms, combined sampled heap high-water 191753256 → 147289680 bytes. Node warm installed-storage harness, not browser-wide heap/absolute peak; no >20% regression, no DTO optimization required.
- [x] T7.R5 Publish exact commands/exits, valid schema-shaped acceptance JSON, vendor/scoped quality/preservation evidence. Validation: repair report plus commands.json/validation logs; acceptance validator exit 0 (JSON, required fields, arrays, status/result enums); vendor 21 files, scoped ESLint/Prettier 10 files clean; 2239 pre-existing files unchanged/11 intentional changes/zero unexpected; diff/staging exit 0. Native Chromium 1/1 passed: frozen WASM ready→prompt→result, mutant rejected/no ready; graph updater/full lint/old installer skipped with recorded existing blockers. Parent review remains required.

## Pending implementation order

- [x] T4 → T5. Validation: T4 accepted at `5c2ddff`; T5 independently accepted; parent verified 91/91 focused tests. Native Chromium evidence in T5 repair report.
- [ ] T6/T7 → T8. Validation: execute dependency-gated ticket acceptance contracts only after T5 and required T3/T2 baselines.
- [ ] T9 → T10 → T11. Validation: execute sequential ticket acceptance contracts; aggregate final boundary/Chromium evidence at T11.

## Paths

| Role | Path |
| --- | --- |
| Approved plan | `artifacts/PLAN_2026_09_13_content_module_rearchitecture.md` |
| Pre-mutation inventory | `artifacts/BASELINE-RECONCILIATION-T4.json` |
| Validation logs | `artifacts/BASELINE-RECONCILIATION/` |
| Final report | `artifacts/IMPLEMENTATION-REPORT-baseline-reconciliation.md` |
| Recovery lane | `.tmp/worktrees/content-rearchitecture-t1-20260913` |

## Risks

- R1. Merge carries 15 accepted historical lane commits. Root-only doc commit must remain represented; sole predicted conflict is deleted `docs/GLOSSARY.md` versus lane modification.
- R2. T1–T3 transfer spans 244 source/test/config paths. Collision checks must reject any post-inventory root drift before copy.
- R3. Requested validation is narrow. Passing it does not prove full repository suite; failing baseline checks will be reported, not broadly repaired.
- R4. Lane-local artifacts remain only in recovery lane except attributable facts copied into reconciliation report; original lane must remain untouched.

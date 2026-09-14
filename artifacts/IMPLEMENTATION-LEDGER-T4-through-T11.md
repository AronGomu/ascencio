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

## Pending implementation order

- [ ] T4 → T5. Validation: execute ticket-specific acceptance contracts only after P1 review approval.
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

# T4 implementation report

## State

**DONE — independent review required. T5 not started.**

## Outcome

A1. `content:pack` now emits schema3 per-file candidates from canonical `scanAssetProfiles` → `playerPayload` bytes. Output uses full SHA-256 file keys, immutable manifest key, canonical pointer bytes.

A2. `content:verify --check-sources` rehashes current selected files, vendor inputs, prepared metadata source inputs, derived payload bytes. Changed source → `CONTENT_SOURCE_STALE`.

A3. `content:publish --check` validates local candidate without network. Publisher transport uses AWS SDK conditional commands against injected local fake: files → manifest → ETag CAS pointer. Divergent immutable object → `PUBLISH_IMMUTABLE_CONFLICT`; stale predecessor/CAS → `PUBLISH_CONFLICT`; network work retries at most twice.

A4. Live CLI checks config, rights evidence, source scope, publisher env presence. T8 semantic validator absent → no live transport reachable; gate remains `PUBLISH_SEMANTIC_VALIDATION_REQUIRED`.

A5. Developer ZIP producer stays under `assets:bundle`; 34 producer regressions pass.

## Changed paths — commands/core

B1. `package.json`

B2. `scripts/content-publish.ts`

B3. `scripts/lib/asset-delivery/content-cli.ts`

B4. `scripts/lib/asset-delivery/content-publish-cli.ts`

B5. `scripts/lib/asset-delivery/progressive-error.ts`

## Changed paths — producer/tests

C1. `scripts/lib/asset-delivery/progressive-producer.ts`

C2. `scripts/lib/asset-delivery/progressive-publisher.ts`

C3. `tests/progressive-producer.test.ts`

C4. `tests/progressive-publisher.test.ts`

C5. `tests/unit/progressive-manifest.test.ts`

## Changed paths — regression/evidence

D1. `tests/asset-delivery-bundle.test.ts`

D2. `artifacts/PLAN_2026_09_13_content_module_rearchitecture/T4_per-file-producer.md`

D3. `artifacts/IMPLEMENTATION-LEDGER-T4-through-T11.md`

D4. `artifacts/IMPLEMENTATION-REPORT-T4.md`

D5. `artifacts/T4-EVIDENCE/*`

## TDD evidence

E1. Red: `artifacts/T4-EVIDENCE/red-node-tests.log` — exit 1; both target suites failed with `ERR_MODULE_NOT_FOUND` before implementation.

E2. Green: `artifacts/T4-EVIDENCE/green-node-tests.log` — exit 0; 10/10 producer/publisher tests.

E3. Manifest bound: `artifacts/T4-EVIDENCE/green-manifest-vitest.log` — exit 0; 3/3, including 50,000 accept, 50,001 reject, legacy schema reject.

## Required validation

F1. `node --test tests/progressive-producer.test.ts tests/progressive-publisher.test.ts` → exit 0; 10 pass, 0 fail.

F2. `npx vitest run tests/unit/progressive-manifest.test.ts --reporter=verbose` → exit 0; 3 pass, 0 fail.

F3. `npm run content:pack -- --help` → exit 0; exact progressive pack syntax printed.

F4. `npm run content:publish -- --help` → exit 0; `content:publish --run PATH [--check]` printed.

F5. `npm run content:verify -- --help` → exit 0; progressive verify syntax printed.

## Regression validation

G1. `npm run typecheck` → exit 0; 0 errors, 4 pre-existing Svelte/CSS warnings.

G2. `node --test tests/asset-delivery-bundle.test.ts tests/asset-delivery-metadata-repairs.test.ts` → exit 0; 34 pass, 0 fail. Includes real fixture `content:pack` + source-checking `content:verify`; legacy ZIP producer remains green.

G3. `npx vitest run tests/unit/progressive-release.test.ts tests/unit/progressive-fixture.test.ts tests/unit/domain-boundaries.test.ts --reporter=verbose` → exit 0; 130 pass, 0 fail.

G4. Targeted Prettier check, ESLint, `git diff --check` → exit 0.

G5. `git diff --cached --quiet` → exit 0; no staged files.

## Graph validation

H1. `graphify . --update` → exit 0; log records external Gemini 429 warning plus partial semantic extraction warning. No tracked graph diff.

## Producer cases covered

I1. Deterministic manifest/pointer/object bytes across source creation order.

I2. One-byte source mutation detected from current source, not frozen candidate consistency.

I3. 50,000 files accepted within bound; 50,001 rejected.

I4. Failed file upload leaves latest pointer absent; generic network error attempts exactly twice.

## Publisher cases covered

J1. Same-predecessor publishers read same ETag; one CAS wins, loser gets `PUBLISH_CONFLICT`.

J2. Candidate bound to release1 rejects after release2 becomes current, before pointer write.

J3. Existing same key with divergent bytes/length rejects without overwrite.

J4. Files precede manifest; manifest precedes pointer; identical retry performs no writes.

## Assumptions

K1. T1 `src/content/contracts/progressive-release.ts` plus parsers are authoritative wire. Reused unchanged.

K2. `semanticValidated: true` is test/internal publisher authorization only. T8 must supply real domain continuity validation before CLI can call publisher.

K3. `--check` is local dry run. It needs no owner config/credentials because it performs no remote call.

K4. Legacy `content:verify` behavior remains only for legacy run dirs without `progressive/`; new candidates select progressive verifier. This preserves developer archive verification during migration.

## Swallowed-error inventory

L1. `none`: no retained `|| true`, empty catch, redirected failure, unobserved Promise.

L2. Catch blocks either map malformed candidate to `CONTENT_INVALID_MANIFEST`, source mismatch/read failure to `CONTENT_SOURCE_STALE`, approval/config failure to `PUBLISH_APPROVAL_REQUIRED`, remote failure after two attempts to `PUBLISH_NETWORK_FAILED`.

## Residual risks

M1. T8 semantic continuity validator absent. Live publication intentionally blocked; no R2 upload/deploy occurred.

M2. Fake SDK transport proves command conditions/order/error handling, not real R2 hosting behavior or account policy.

M3. Owner approval/config/credentials are absent locally. Success branch of live approval gate remains unobserved until owner evidence exists; no secrets printed.

M4. `graphify . --update` exited 0 with external Gemini quota warning. Code/test evidence unaffected; graph output has no tracked diff.

## Parent decision

N1. Review T4 diff plus evidence. If accepted, commit draft: `feat(content): publish immutable files without ZIP churn`.

N2. Do not start T5 from this worker result. Parent owns next ticket/delegation.

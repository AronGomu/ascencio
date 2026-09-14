# T4 Independent Review

**State: blocked.** T4 needs 2 fixes before acceptance. T8 semantic continuity remains intentionally pending.

## Review

- R1 **Blocker — updated release cannot name previous release.** `packProgressiveRelease()` verifies `previousRun` with `checkSources: true` at `scripts/lib/asset-delivery/progressive-producer.ts:218-228`. Historic inventory therefore gets compared with current workspace. Normal content change after release 1 makes release 2 fail `CONTENT_SOURCE_STALE`, despite new inventory correctly hashing new bytes. Repro: pack sequence 1 from `{"release":1}`, replace canonical source plus inventory digest with `{"release":2}`, pack sequence 2 using sequence-1 `previousRun` → `ProgressiveError: CONTENT_SOURCE_STALE`. This violates predecessor/monotonic release flow required by `artifacts/PLAN_2026_09_13_content_module_rearchitecture/T4_per-file-producer.md:23,133`. Smallest fix: verify historic predecessor integrity with `verifyProgressiveRelease(root, previousRun, false)`; retain `true` for candidate verify/publish. Test: mutate source, rebuild current inventory, assert sequence 2 packs with sequence-1 predecessor.
- R2 **Blocker — verifier accepts manifest subset plus forged ownership metadata.** `verifyProgressiveRelease()` casts unparsed `inventory.json` at `scripts/lib/asset-delivery/progressive-producer.ts:403`, maps payload by path at `:404-410`, then checks only manifest → payload membership/digest at `:411-417`. No payload → manifest cardinality check. No equality check for producer-derived `mediaType`, `role`, `required`, `packIds`. Repro: pack 4 payload files, remove optional media from manifest, recanonicalize manifest/pointer/candidate plus manifest object, retain original inventory/sources; `verifyProgressiveRelease(..., true)` succeeds with 3 files. T8 semantic continuity does not own this structural producer-wire invariant; T4 R1/R2 require canonical `PayloadFile` roster plus ownership at ticket `:21-22`. Smallest fix: parse inventory with `parseFrozenInventory`, derive complete expected `ReleaseFile[]` through shared pure producer helper, deep-compare exact sorted roster against manifest before object reads. Test omission plus role/`packIds` tampering; both must return `CONTENT_INVALID_MANIFEST` from verify plus publish.
- R3 **Medium test gap — same-length immutable collision branch unproved.** Test seeds `"different"` at `tests/progressive-publisher.test.ts:324-336`; chosen first fixture file is 92 bytes, injected object is 9 bytes. Rejection therefore occurs on length at `scripts/lib/asset-delivery/progressive-publisher.ts:233-235`; divergent same-length GET/hash/byte checks at `:236-243` are not exercised. Impl appears correct. Smallest test: seed different bytes matching candidate object length, assert `PUBLISH_IMMUTABLE_CONFLICT`, unchanged remote bytes, one `GetObjectCommand` for key.

## Correct / passed scope

- P1 Canonical seam correct in producer: `playerPayload()` supplies raw/derived bytes at `scripts/lib/asset-delivery/progressive-producer.ts:21-22,244-246`; raw files get before/copy/after digest checks at `:146-174`; current-candidate freshness rehashes selected, vendor, metadata inputs plus derived bytes at `:435-466`.
- P2 Schema/wire caps pass: parser enforces 32 MiB budget, 50,000 files, 99 chapters, safe sums, 256 MiB/file, strict hashes/paths/order at `src/content/parsers/progressive-release.ts:20-120` plus `src/content/parsers/progressive-file.ts:14-60`. Focused Vitest: 3/3 pass, including 50,000 accept plus 50,001 reject.
- P3 Publisher order/CAS logic correct: predecessor identity plus strictly increasing sequence at `scripts/lib/asset-delivery/progressive-publisher.ts:258-280`; files → manifest → pointer CAS at `:282-301`; injected SDK-command fake executes `IfNoneMatch`/`IfMatch` behavior at `tests/progressive-publisher.test.ts:93-178`. Focused Node: 10/10 pass.
- P4 CLI strictness/dry run correct: unknown flag exits 1 with `CONTENT_INVALID_MANIFEST`; help commands exact. `--check` only runs local verifier at `scripts/lib/asset-delivery/content-publish-cli.ts:65-89`; module imports no transport/client → no remote path.
- P5 Legacy developer archive path preserved. Producer regressions: 34/34 pass. Content/parser/boundary regressions: 130/130 pass. Typecheck: 0 errors, 4 pre-existing warnings.

## T8 boundary

- T1 **Intentional pending, not T4 defect:** live CLI verifies candidate, checks config/rights/env, then rejects `PUBLISH_SEMANTIC_VALIDATION_REQUIRED` at `scripts/lib/asset-delivery/content-publish-cli.ts:73-76`. No live transport reachable before T8 validator wiring.
- T2 **Observed limitation:** valid approval/config/credential branch not executable locally because owner files/env are absent. Static order is correct. No real R2 call made.

## Assumptions

- A1 `previousRun` binds immutable historic manifest identity/integrity; it must not require historic source hashes to equal current workspace after intentional content update. Ticket sequence semantics support this reading at `artifacts/PLAN_2026_09_13_content_module_rearchitecture/T4_per-file-producer.md:23,133`.
- A2 Review baseline is HEAD `e338808` plus listed modified/untracked T4 files. No source edits, commits, staging, subagents, remote calls.

## Residual risks

- RR1 Fake SDK transport proves local command conditions/order/errors, not real Cloudflare R2 behavior/account policy. Matches T4 no-live constraint.
- RR2 Current candidate metadata remains unsigned/local. T8 semantic validation cannot replace R2 structural roster fix.
- RR3 Full app/browser suite not run; focused T4, producer regressions, content boundary regressions, typecheck ran.

## Files touched

- F1 `artifacts/REVIEW-T4.md` only. Source tree unchanged; staging empty.

## Next action

- N1 Fix R1 plus R2, add 3 regressions: changed-source successor, omitted payload, ownership tamper. Then rerun focused 10 Node tests plus new cases.

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "R1-R3 provide severity, exact file:line evidence, repro outcome, smallest fix/test; P1-P5 plus RR1-RR3 provide passed scope and residual risks."
    }
  ],
  "changedFiles": [
    "artifacts/REVIEW-T4.md"
  ],
  "testsAddedOrUpdated": [],
  "commandsRun": [
    {
      "command": "graphify query \"T4 per-file producer PayloadFile freshness schema caps CAS predecessor identity sequence monotonicity idempotence immutable collision dryrun CLI\"",
      "result": "passed",
      "summary": "Located producer, publisher, CLI, parser, tests, contracts."
    },
    {
      "command": "node --test tests/progressive-producer.test.ts tests/progressive-publisher.test.ts",
      "result": "passed",
      "summary": "10 tests passed, 0 failed."
    },
    {
      "command": "npx vitest run tests/unit/progressive-manifest.test.ts --reporter=verbose",
      "result": "passed",
      "summary": "3 tests passed, including 50,000/50,001 bounds."
    },
    {
      "command": "node --test tests/asset-delivery-bundle.test.ts tests/asset-delivery-metadata-repairs.test.ts && npx vitest run tests/unit/progressive-release.test.ts tests/unit/progressive-fixture.test.ts tests/unit/domain-boundaries.test.ts --reporter=dot",
      "result": "passed",
      "summary": "34 Node regressions plus 130 Vitest regressions passed."
    },
    {
      "command": "npm run typecheck",
      "result": "passed",
      "summary": "0 errors; 4 pre-existing warnings."
    }
  ],
  "validationOutput": [
    "V1: Changed-source successor repro returned `ProgressiveError: CONTENT_SOURCE_STALE`.",
    "V2: Manifest-subset repro returned success with original 4 payload files versus verified 3; omitted `chapters/chapter-01/card.png`.",
    "V3: `npm run --silent content:publish -- --check --bogus` exited 1 with `CONTENT_INVALID_MANIFEST`.",
    "V4: `git diff --check e338808 --` passed; `git diff --cached --quiet` passed."
  ],
  "residualRisks": [
    "RR1: Fake transport cannot attest real R2/account-policy behavior; live calls intentionally forbidden in T4.",
    "RR2: Valid owner approval/config/credential branch remains unexecuted locally.",
    "RR3: Full app/browser suite not run."
  ],
  "noStagedFiles": true,
  "diffSummary": "T4 adds schema3 per-file producer/verifier, content publish CLI, S3 conditional publisher, focused tests; review found successor freshness blocker plus verifier exact-roster blocker.",
  "reviewFindings": [
    "R1 blocker: scripts/lib/asset-delivery/progressive-producer.ts:218-228 - historic predecessor source freshness blocks normal changed-source successor.",
    "R2 blocker: scripts/lib/asset-delivery/progressive-producer.ts:403-417 - verifier accepts canonical manifest subset and does not validate producer-derived ownership fields.",
    "R3 medium test gap: tests/progressive-publisher.test.ts:324-336 - divergent immutable fixture differs in length, bypassing same-length digest branch."
  ],
  "manualNotes": "T8 semantic validation is intentionally pending; live CLI block at content-publish-cli.ts:73-76 is correct T4 behavior, not finding."
}
```

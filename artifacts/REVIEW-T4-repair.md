# T4 repair independent review

**State: accepted.** No T4 repair blockers found.

## Assumptions

- A1 `previousRun` means archived release integrity, not equality against current workspace sources. Candidate verify/publish retains current-source freshness.
- A2 Requested `repair-source.diff` resolves to `artifacts/T4-REPAIR-EVIDENCE/repair-source.diff`.

## Review

- R1 Correct — historic/current separation. `packProgressiveRelease()` verifies predecessor with `checkSources: false` at `scripts/lib/asset-delivery/progressive-producer.ts:152-162`. Release-object, manifest, pointer, candidate, parsed inventory, derived-roster checks still run at `scripts/lib/asset-delivery/progressive-producer.ts:280-326`. Current candidate rehash only remains under `checkSources` at `:327-365`. Changed-source successor regression passes at `tests/progressive-producer.test.ts:253-309`.
- R2 Correct — exact complete manifest equality. Verifier parses `inventory.json` through real `parseFrozenInventory()` at `scripts/lib/asset-delivery/progressive-producer.ts:295`, derives roster/descriptors through shared `deriveProgressiveManifest()` at `:296-302`, canonical-byte compares full expected manifest before payload object reads at `:303-309`. Shared helper derives path/version/bytes/MIME/role/required/packIds plus chapter descriptors at `scripts/lib/asset-delivery/progressive-manifest.ts:68-119`; `parseProgressiveManifest()` validates result. Omission, ownership, MIME, snapshot, descriptor tamper regressions pass at `tests/progressive-producer.test.ts:311-415`.
- R3 Correct — same-length collision test. Test copies candidate object, flips byte, proves equal length plus distinct SHA-256, asserts `PUBLISH_IMMUTABLE_CONFLICT`, unchanged remote bytes, exactly one `GetObjectCommand`, absent latest pointer at `tests/progressive-publisher.test.ts:344-374`. Publisher GET/hash/byte branch remains at `scripts/lib/asset-delivery/progressive-publisher.ts:230-243`.
- R4 Blocker — none. Repair diff moves duplicated producer derivation into one pure helper; no behavior broadening found. Duplicate roster paths still reject through `parseProgressiveManifest()` before pack output.

## Evidence

- E1 `node --test tests/progressive-producer.test.ts tests/progressive-publisher.test.ts` → passed: 21 passed, 0 failed.
- E2 `npx vitest run tests/unit/progressive-manifest.test.ts --reporter=verbose` → passed: 3 passed, 0 failed; 50,000 accepted, 50,001 rejected.
- E3 `git diff --cached --name-only` → passed: no staged paths.

## Residual risks

- K1 T8 semantic validation remains intentionally pending; `PUBLISH_SEMANTIC_VALIDATION_REQUIRED` blocks live publish. Outside T4 repair.
- K2 Fake SDK tests attest local conditional/CAS behavior, not real R2 account policy. No live remote call run.
- K3 Full app/browser suite not run. Focused T4 Node/Vitest checks pass.

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "R1-R4 provide inspected path:line findings. No blocker found; historic/current separation, parsed inventory-derived canonical manifest equality, and same-length collision coverage verified."
    }
  ],
  "changedFiles": [
    "scripts/lib/asset-delivery/progressive-producer.ts",
    "scripts/lib/asset-delivery/progressive-manifest.ts",
    "tests/progressive-producer.test.ts",
    "tests/progressive-publisher.test.ts",
    "artifacts/REVIEW-T4-repair.md"
  ],
  "testsAddedOrUpdated": [
    "tests/progressive-producer.test.ts",
    "tests/progressive-publisher.test.ts"
  ],
  "commandsRun": [
    {
      "command": "node --test tests/progressive-producer.test.ts tests/progressive-publisher.test.ts",
      "result": "passed",
      "summary": "21 passed, 0 failed."
    },
    {
      "command": "npx vitest run tests/unit/progressive-manifest.test.ts --reporter=verbose",
      "result": "passed",
      "summary": "3 passed, 0 failed; 50,000-entry bound accepted and 50,001 rejected."
    },
    {
      "command": "git diff --cached --name-only",
      "result": "passed",
      "summary": "No staged paths."
    }
  ],
  "validationOutput": [
    "Historic predecessor uses verifyProgressiveRelease(root, previousRun, false) at scripts/lib/asset-delivery/progressive-producer.ts:155-159; candidate freshness remains at :327-365.",
    "Parsed frozen inventory and canonical expected-manifest equality run before object reads at scripts/lib/asset-delivery/progressive-producer.ts:295-309.",
    "Same-length byte-flip collision validates GET branch at tests/progressive-publisher.test.ts:344-374."
  ],
  "residualRisks": [
    "T8 semantic validation and live publish remain intentionally blocked.",
    "Fake SDK transport does not prove real R2/account policy behavior.",
    "Full app/browser suite not run."
  ],
  "noStagedFiles": true,
  "diffSummary": "Repair separates archived predecessor integrity from current-source freshness, adds shared parsed-inventory manifest derivation plus canonical full-manifest equality, and adds same-length immutable collision coverage.",
  "reviewFindings": [
    "R1 correct: scripts/lib/asset-delivery/progressive-producer.ts:152-162 preserves historic integrity without current-workspace freshness.",
    "R2 correct: scripts/lib/asset-delivery/progressive-producer.ts:295-309 rejects any manifest not exactly derived from parsed inventory.",
    "R3 correct: tests/progressive-publisher.test.ts:344-374 reaches same-length GET/hash collision path.",
    "R4 no blockers found."
  ],
  "manualNotes": "Acceptance attested. T5 may start after parent records this gate."
}
```
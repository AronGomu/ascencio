## Review

- R1 **Verdict — no in-scope security blocker.** Requested `insteadOf` bypass needs control of Git config affecting cached repo; repo-local config can supply rewrite, so bypass is real. However, parent accepted any valid repo at cache path (`456551dc1cf8fc4e9fdb754095f3a8279f5b2c37:scripts/lib/sources.ts:62-64`). PR adds best-effort source-consistency check; it grants no new capability. Hostile local cache/config remains pre-existing trust-boundary risk, not regression.
- R2 **Note · low security severity:** `git remote get-url origin` expands `url.*.insteadOf`; installed `git remote` docs state this explicitly. Therefore malicious cached repo can store nonmatching origin plus repo-local rewrite yielding configured URL at `.tmp/pr-review-20260921/pr-34/scripts/lib/sources.ts:64-66`. This weakens check against deliberately hostile caches. Production path still requires reviewed 40-hex locks (`.tmp/pr-review-20260921/pr-34/assets-source-lock.json:3-5`, `.tmp/pr-review-20260921/pr-34/scripts/sync-assets.ts:265-277,290-304`) then compares `HEAD` with pin (`.tmp/pr-review-20260921/pr-34/scripts/lib/sources.ts:115-116,127-135`). Pin reduces wrong-revision risk; it does not prove clean worktree or provenance. Treat hostile cache as residual risk, not covered security boundary.
- R3 **Note · low functional regression:** normal global/system `insteadOf` config can rewrite stored expected HTTPS URL to SSH/mirror form. One-sided comparison then rejects valid cache at `.tmp/pr-review-20260921/pr-34/scripts/lib/sources.ts:64-66`; offline path fails at lines 76-82, online path removes/reclones cache at lines 84-100. Impact: offline availability failure plus cache churn/network cost, no integrity/confidentiality gain for attacker. PR already discloses equivalent-URL rejection, so non-blocking for stated strict consistency scope. Cleaner follow-up: read raw `remote.origin.url` via `git config --get remote.origin.url`, add tests with isolated global/system config.
- R4 **Correct · credential handling:** added command captures URL only in local variable; `runGit` logs args/status, not stdout (`.tmp/pr-review-20260921/pr-34/scripts/lib/sources.ts:18-50`). Mismatch throws static text at lines 65-66; diagnostic carries configured hardcoded URL plus static detail at lines 69-75. Tests assert username/password/full URL absent from stderr plus error cause (`.tmp/pr-review-20260921/pr-34/tests/sources.test.ts:79-137`). No added credential-log finding.
- R5 **Correct · focused regression coverage:** wrong-origin rejection covered at `.tmp/pr-review-20260921/pr-34/tests/sources.test.ts:44-77`; credential-safe failure covered at lines 79-137. `artifacts/pr-review-20260921/validation-34.json` records `node --test tests/sources.test.ts`: 5 passed, 0 failed; ESLint plus Prettier passed.
- R6 **Note · CI:** `artifacts/pr-review-20260921/ci-summary-34.json` attributes full-gate failure to `downloadCroppedCardImages failed with exit code 1; rerun to resume safely`, unrelated to changed source. Parent reports combined typecheck matches baseline pre-existing fixture `unknown`→`Error` TS2345.

## State

- S1 **done.** Read-only adjudication complete. Source edits: none. Output written only to required artifact path.
- S2 **Files touched:** `/home/aron/Projects/ascencio/.pi-subagents/artifacts/outputs/86c61106-291e-48ac-ba5d-60fbd8589810/artifacts/pr-review-20260921/review-34-adjudication.md`.
- S3 **Assumption:** PR statement intentionally limits guarantee to consistency check, not hostile-local-state provenance. Under stronger threat model where cache/config is untrusted, R2 needs fix plus worktree/object verification beyond this PR.
- S4 **Validation:** exact candidate source hash matched commit `eaad2ee69eb5e8ce7f21f91f50d1e1320ad70d4c`; caller matched parent; parent validation artifact confirms targeted tests. No tests rerun per task.
- S5 **Blocker + next human action:** none. Merge decision may proceed. Optional follow-up: replace expanded lookup with raw config lookup to remove R2/R3 ambiguity.

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "R1-R6 provide verdict, severity, exact file/line refs, validation evidence, and residual risks."
    }
  ],
  "changedFiles": [
    "/home/aron/Projects/ascencio/.pi-subagents/artifacts/outputs/86c61106-291e-48ac-ba5d-60fbd8589810/artifacts/pr-review-20260921/review-34-adjudication.md"
  ],
  "testsAddedOrUpdated": [],
  "commandsRun": [
    {
      "command": "git show 456551dc1cf8fc4e9fdb754095f3a8279f5b2c37:scripts/lib/sources.ts; nl -ba .tmp/pr-review-20260921/pr-34/scripts/lib/sources.ts",
      "result": "passed",
      "summary": "Parent and candidate control flow compared with line refs."
    },
    {
      "command": "GIT_PAGER=cat git help remote | col -b",
      "result": "passed",
      "summary": "Installed docs confirm get-url expands insteadOf and pushInsteadOf."
    },
    {
      "command": "git show eaad2ee69eb5e8ce7f21f91f50d1e1320ad70d4c:scripts/lib/sources.ts | sha256sum; sha256sum .tmp/pr-review-20260921/pr-34/scripts/lib/sources.ts",
      "result": "passed",
      "summary": "Both hashes a9e983a83eb3fd9b55732cc70e464f7fe427ea290e001fb5e8d9d419a2508bf8."
    },
    {
      "command": "graphify query \"scripts/lib/sources.ts callers git remote origin source consistency checks\"",
      "result": "failed",
      "summary": "graphify: command not found; direct source/caller inspection used."
    }
  ],
  "validationOutput": [
    "V1: Candidate source byte identity confirmed against eaad2ee69eb5e8ce7f21f91f50d1e1320ad70d4c.",
    "V2: artifacts/pr-review-20260921/validation-34.json records 5/5 targeted tests passing plus ESLint/Prettier passing.",
    "V3: Installed Git docs confirm get-url rewrite behavior.",
    "V4: No credential-bearing get-url stdout reaches diagnostics or error chain."
  ],
  "residualRisks": [
    "RR1: Hostile cached repo can use repo-local insteadOf to bypass URL consistency comparison; pre-existing hostile-local-state threat, not cryptographic provenance.",
    "RR2: Normal insteadOf config can reject valid cache, breaking offline sync or causing online cache churn.",
    "RR3: Pinned HEAD does not establish clean worktree integrity during offline reuse."
  ],
  "noStagedFiles": true,
  "diffSummary": "PR adds expanded-origin equality check plus wrong-origin and credential-redaction tests; no source edits made during review.",
  "reviewFindings": [
    "RF1: no blocker — malicious insteadOf bypass is real but requires hostile local cache/config and does not regress parent security.",
    "RF2: low — normal insteadOf rewrite can falsely reject valid caches at scripts/lib/sources.ts:64-66.",
    "RF3: no credential leak — URL stdout is not logged; mismatch diagnostic and cause are static."
  ],
  "manualNotes": "Targeted tests not rerun per task; parent validation artifact supplied passing evidence. Shared CI image-fetch failure and baseline-matching TS2345 are unrelated."
}
```

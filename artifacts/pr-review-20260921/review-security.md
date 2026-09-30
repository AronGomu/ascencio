# Security PR Review

## Review state

- H1 State: `done`. Reviewed exact PR head objects, full changed prod files, relevant callers/contracts, full supplied diffs.
- H2 Evidence: `git diff origin/main...<head>`, `git show <head>:<path>`, `git merge-tree`; all 7 heads exist locally. `origin/main` = `2d721a50177994fb5003cf90b012e67a19842623`.
- H3 Files touched: report only. No repo source/test edits. No remote mutation.
- H4 Assumption: task text + PR artifacts remain operative because requested `/home/aron/Projects/ascencio/plan.md` + `/home/aron/Projects/ascencio/progress.md` do not exist.
- H5 CI: excluded from code verdicts. Parent owns full-gate failure investigation.
- H6 Cross-file compatibility: every head branches from `456551dc1cf8fc4e9fdb754095f3a8279f5b2c37`, 4 commits behind `origin/main`; intervening main changes touch shell/deck-editor only. `git merge-tree` found no conflicts for reviewed heads.

## PR #28 — Approve

- A1 Head: `7b3d205b6338e0e0fcbc1b2834e24ad488b2df5f`.
- A2 Correct: failed read/size validation now cancels reader before lock release while preserving primary error when `cancel()` rejects. `src/content/storage/progressive-storage-validation.ts:126-135`:

```diff
+    try {
+      await reader.cancel();
+    } catch {
+      console.warn("CONTENT_RESPONSE_CANCEL_FAILED");
+    }
     if (signal.aborted) throw new StoreContentError("CONTENT_CANCELLED");
     throw error;
```

- A3 Test adequacy: public `cacheManifest` regression proves oversized stream cancellation + `CONTENT_INTEGRITY_FAILED` (`tests/unit/progressive-download.test.ts:700-724`). Targeted add: make `cancel()` reject; assert original integrity error survives + static warning contains no response data. Add aborted-stream case.
- A4 Residual risk: `Content-Length` rejection occurs before reader acquisition (`src/content/storage/progressive-storage-validation.ts:101-113`) → response body is not explicitly canceled. Existing PR limit; no regression from patch.

## PR #30 — Approve

- B1 Head: `e7958de939a4f640c33ccfd4888b916a15d8a579`.
- B2 Correct: verifier checks each card/text/image record against same `numeric-id-modulo` invariant used by producer. `scripts/verify-assets.ts:301-308`:

```diff
+      const expectedShard = (record.code % shardCount)
+        .toString(16)
+        .padStart(2, "0");
+      if (expectedShard !== name) {
+        failures.push(
+          `${label} ${record.code} is in shard ${name}; expected shard ${expectedShard}`,
+        );
+      }
```

- B3 Compatibility: producer uses `catalogShard(code)` → `(code % CATALOG_SHARD_COUNT).toString(16).padStart(2, "0")` (`scripts/lib/transform.ts:46-48`). New legacy test is discovered by `node --test tests/*.test.ts` (`package.json:43`).
- B4 Test adequacy: regression proves card `65` in shard `02` fails (`tests/verify-assets.test.ts:15-126`). Targeted add: table-drive card/text/image mismatch paths; add invalid non-number, non-safe, negative code records.
- B5 Residual risk: JSON is cast, not schema-parsed (`scripts/verify-assets.ts:285-286`); negative multiples or numeric strings can satisfy modulo placement. Pre-existing broad verifier limitation; patch fulfills wrong-shard scope for valid records.

## PR #34 — Request changes

- C1 Head: `eaad2ee69eb5e8ce7f21f91f50d1e1320ad70d4c`.
- C2 Medium: origin check compares Git-rewritten URL, not raw configured origin. Repo-local `url.<expected>.insteadOf=<attacker>` can make attacker origin resolve to expected → check passes for offline, non-pinned `syncRepository` callers. Vulnerable check at `scripts/lib/sources.ts:63-66`:

```diff
+    const repository = runGit(["remote", "get-url", "origin"], directory);
+    if (repository !== definition.repository) {
+      throw new Error("Cached source repository mismatch");
+    }
```

- C3 Evidence: read-only command `git -c "url.https://expected.invalid/repo.git.insteadOf=$(git config --get remote.origin.url)" remote get-url origin` returned `https://expected.invalid/repo.git` while raw `remote.origin.url` remained `git@github.com:AronGomu/ascencio.git`. `git remote get-url` therefore cannot attest raw origin. Production `sync-assets` uses pinned 40-hex refs (`assets-source-lock.json`; `scripts/lib/sources.ts:127-135`), reducing production impact, but exported fn + new `main`-ref regression do not enforce that precondition.
- C4 Required fix: read raw local config with includes disabled, require exactly one `remote.origin.url`, compare exact value; separately decide whether any effective URL rewrite is permitted. Keep diagnostics static. Add spoof regression: attacker raw origin + repo-local `url.*.insteadOf` mapping to expected must reject offline.
- C5 Correct: static mismatch error avoids credential disclosure (`scripts/lib/sources.ts:66`); new credential assertions cover diagnostics + cause (`tests/sources.test.ts:86-137`).
- C6 Residual risk: origin equality remains consistency signal, not cryptographic provenance. Pinned commit validation remains real prod integrity control.

## PR #36 — Approve

- D1 Head: `ab1b7de84b5af2ab0f198b94eea0a698875e1039`.
- D2 Correct: effect formatting now gates on same viewer/controller/location/position policy used by prompt-card redaction. Hidden branch short-circuits before card-name/description lookup. `src/battle/worker/protocol/PromptRegistry.ts:151-169`:

```diff
+  const contextIdentityVisible =
+    contextCard !== undefined &&
+    isPromptCardIdentityVisible(contextCard, raw.prompt.player);
...
-    message.description !== 0n
+    message.description !== 0n &&
+    contextIdentityVisible
```

- D3 Compatibility: player-1 prompts stay Worker-internal (`src/battle/worker/HeadlessDuelController.ts:218-235`); only player-0 prompt returns to UI. Visible prompts retain formatted text through existing tests (`tests/unit/prompt-registry.test.ts:353-398`).
- D4 Test adequacy: regression asserts no code, name, or message for face-down opponent banished card (`tests/unit/prompt-registry-visibility.test.ts:40-60`). Targeted add: visibility matrix for opponent hand/extra/banished, graveyard, face-up zones, fixed slots, overlay-address prompt cards.
- D5 Residual risk: direct boundary fixture does not prove native core emits exact hidden `SELECT_EFFECT_YES_NO` combination. No leak remains in exercised production formatter/redactor path.

## PR #37 — Approve

- E1 Head: `a2a9f70ed5bd14d0d81285d9df672410e2af13c5`.
- E2 Correct: opponent card moving to concealed non-fixed state loses code + correlation ID; fixed-slot remembered identity remains allowed. `src/battle/worker/projection/DuelStateProjector.ts:1416-1424`:

```diff
+    else if (
+      playerIndex === 1 &&
+      !isFixedLocation(publicLocation) &&
+      card.code !== undefined
+    ) {
+      this.#rotatePublicIdentity(card);
+      delete card.code;
+    }
```

- E3 Compatibility: emitted `positionChanged` already omits opponent code when face-down (`src/battle/worker/projection/DuelStateProjector.ts:428-434`); snapshot invariant rejects concealed opponent codes outside fixed slots (`:1955-1973`). Patch repairs producer before validator boundary.
- E4 Test adequacy: regression verifies code omission, ID rotation, face-down state (`tests/unit/opponent-position-concealment.test.ts:10-53`); modified legacy test also parses public event (`tests/unit/duel-state-projector.test.ts:249-281`). Targeted add: face-up→face-down opponent Extra Deck case; fixed monster/spell slot keeps attested code + ID; own-card transition keeps identity.
- E5 Residual risk: exact transition uses synthetic engine messages, not native duel. Existing snapshot assertion remains fail-closed backstop.

## PR #39 — Approve

- F1 Head: `3ab646c30f39b9d1f588170aae0f0237d9194946`.
- F2 Correct: every role now requires RFC token-like `type/subtype`; media keeps allowed top-level restriction. CR/LF, whitespace, parameters cannot reach `Response` headers. `src/content/parsers/progressive-file.ts:44-49`:

```diff
+    !/^[A-Za-z0-9!#$%&'*+.^_`|~-]+\/[A-Za-z0-9!#$%&'*+.^_`|~-]+$/.test(
+      v.mediaType,
+    ) ||
+    (role === "media" && !/^(?:image|audio|video)\//.test(v.mediaType)) ||
```

- F3 Compatibility: producer emits extension-mapped token/token values (`scripts/lib/asset-delivery/progressive-manifest.ts:90`); sinks set `Content-Type` only after parser validation (`src/content/storage/progressive-content-store.ts:344-357`, `src/content/create-content-installer.ts:330`).
- F4 Test adequacy: regression proves required-file CRLF injection rejection (`tests/unit/progressive-release.test.ts:308-313`). Targeted add: CR-only, LF-only, tab/space, empty side, MIME parameters; valid punctuation token case.
- F5 Residual risk: MIME is metadata, not payload proof; SHA-256 + semantic consumers remain integrity controls.

## PR #62 — Approve

- G1 Head: `fdbc3317dfa0c13c13372240acdbf424d6e8f6e5`.
- G2 Correct: lexical path validation now precedes canonical containment; metadata/hash reads use resolved target, rejecting directory + leaf symlinks outside root. `src/battle/worker/assets/runtime-snapshot-node.ts:112-128`:

```diff
+      canonicalRoot ??= await realpath(assetRoot);
+      const canonicalPath = await realpath(absolutePath);
+      const relative = path.relative(canonicalRoot, canonicalPath);
+      if (
+        relative === ".." ||
+        relative.startsWith(`..${path.sep}`) ||
+        path.isAbsolute(relative)
+      )
+        throw new Error(`Artifact path escapes snapshot root: ${file.path}`);
+      const metadata = await stat(canonicalPath);
...
+      const digest = sha256(await readFile(canonicalPath));
```

- G3 Compatibility: Node runtime verifies snapshot before dependency reads (`src/battle/worker/create-node-runtime.ts:47-58,96-104`). Existing `safeArtifactPath` lexical contract remains unchanged for loader callers.
- G4 Test adequacy: regression proves directory-symlink escape rejection (`tests/unit/runtime-snapshot-root-containment.test.ts:10-35`). Targeted add: leaf symlink escape; in-root symlink acceptance; missing root; manifest with zero files.
- G5 Residual risk: loader later reopens lexical paths (`src/battle/worker/assets/active-duel-dependencies-node.ts:16-22`) → mutable hostile FS can swap links/files after verification. PR explicitly excludes TOCTOU. `buildRuntimeSnapshotManifest` also reads `manifest.json` before this canonical verifier (`runtime-snapshot-node.ts:38-43`); treat root/manifest as trusted bootstrap input or harden separately.

## Overall

- I1 Code verdicts: approve #28, #30, #36, #37, #39, #62. Request changes #34 for rewrite-spoofable origin check.
- I2 Exact next action: #34 author adds raw-origin check + local `insteadOf` spoof regression, then parent reruns targeted source tests/full gate. No code blocker found in other reviewed PRs.

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "A2-B5, C2-C6, D2-G5 provide concrete path:line findings, severity for PR #34, test recommendations, residual risks."
    }
  ],
  "changedFiles": [
    "A1 /home/aron/Projects/ascencio/.pi-subagents/artifacts/outputs/5c8a9cb4-7bec-4d40-b209-fcabcc55777d/artifacts/pr-review-20260921/review-security.md"
  ],
  "testsAddedOrUpdated": [],
  "commandsRun": [
    {
      "command": "git show <head>:<changed-production-file>",
      "result": "passed",
      "summary": "B1 Full changed production files inspected at all 7 exact head SHAs."
    },
    {
      "command": "git diff --check origin/main...<head>",
      "result": "passed",
      "summary": "B2 No whitespace errors across reviewed production diffs."
    },
    {
      "command": "git merge-tree $(git merge-base origin/main <head>) origin/main <head>",
      "result": "passed",
      "summary": "B3 No merge conflicts for any reviewed head."
    },
    {
      "command": "git -c url.https://expected.invalid/repo.git.insteadOf=<raw-origin> remote get-url origin",
      "result": "passed",
      "summary": "B4 Demonstrated get-url rewrite: effective expected URL while raw origin differed."
    },
    {
      "command": "targeted/full tests",
      "result": "not-run",
      "summary": "B5 Parent explicitly owns test runs + CI investigation."
    }
  ],
  "validationOutput": [
    "C1 Reviewed heads exist as commit objects; origin/main = 2d721a50177994fb5003cf90b012e67a19842623.",
    "C2 All reviewed heads are one PR commit over 456551dc1cf8fc4e9fdb754095f3a8279f5b2c37; no changed-path overlap with 4 newer main commits.",
    "C3 Rewrite probe output: raw git@github.com:AronGomu/ascencio.git; effective https://expected.invalid/repo.git."
  ],
  "residualRisks": [
    "D1 PR #28 pre-reader Content-Length rejection does not explicitly cancel body.",
    "D2 PR #30 verifier still trusts JSON record shape/code type.",
    "D3 PR #34 origin equality is not provenance; current effective-URL check is rewrite-spoofable.",
    "D4 PR #36/#37 native-engine hidden-card scenarios remain synthetic-boundary tested.",
    "D5 PR #62 excludes mutable-filesystem TOCTOU; bootstrap manifest read is outside canonical artifact verifier."
  ],
  "noStagedFiles": true,
  "diffSummary": "Review artifact only; no repository source/test changes.",
  "reviewFindings": [
    "E1 medium: scripts/lib/sources.ts:63-66 - git remote get-url applies url.*.insteadOf rewriting, allowing raw-origin mismatch to appear expected; request changes for PR #34.",
    "E2 no blockers: PRs #28, #30, #36, #37, #39, #62 approved with documented residual risks."
  ],
  "manualNotes": "F1 plan.md and progress.md were requested but absent. PR artifacts + task text supplied sufficient scope. Full-gate failures intentionally excluded from code verdicts."
}
```

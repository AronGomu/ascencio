# Asset/security PR review

Status: **done** — read-only code review. No repo or remote mutation.

## Review

- A1 **Correct:** all seven heads exist locally, each directly descends from base `456551dc1cf8fc4e9fdb754095f3a8279f5b2c37`; `git diff origin/main...<head>` matches supplied PR file inventory.
- A2 **Correct:** `origin/main` is `2d721a50177994fb5003cf90b012e67a19842623`; its post-base changes touch unrelated shell/editor files. `git merge-tree` reports no conflict for reviewed heads.
- A3 **Blocker:** none found in reviewed code.
- A4 **Note:** every PR metadata file reports `full-gate: FAILURE`. Code verdicts below remain Approve; merge remains CI-gated. Supplied `ci-67-failed.log` is not one of reviewed PR runs, so cannot establish each run’s cause. It shows asset regeneration failing on two cropped images with `"Expected JPEG, received image/jpeg"`, then `"downloadCroppedCardImages failed with exit code 1; rerun to resume safely"` at lines 1940, 2010, 2740-2742.
- A5 **Note:** requested `/home/aron/Projects/ascencio/plan.md` plus `/home/aron/Projects/ascencio/progress.md` do not exist (`ENOENT`). Review used supplied metadata/diffs, exact Git objects, full production files, callers.

## PR #29 — fix(assets): reject unknown image download options

- B1 **Verdict: Approve.** SHA `8b263a83717e3d6d1e42db4f60d2f9335c3e20c4`.
- B2 **Correct — CLI allowlist closes silent-default path.** `scripts/download-images.ts:170-200` now rejects any non-boolean option absent from value-option allowlist before value parsing. Top-level parse occurs at `scripts/download-images.ts:26`; filesystem path resolution, lock acquisition, directory creation start at lines 27, 49, 52 → malformed args fail before writes/network.
- B3 **Correct — producer callers remain compatible.** `scripts/lib/mvp-assets.ts:65-100` emits only `--concurrency`, `--requests-per-second`, `--force`, `--kind`; all accepted. Documented direct args at `README.md:225-242` remain accepted.
- B4 **Actual diff:**

```diff
+    if (
+      !argument?.startsWith("--") ||
+      ![
+        "--assets",
+        "--output",
+        "--concurrency",
+        "--requests-per-second",
+        "--limit",
+        "--kind",
+        "--chapter",
+      ].includes(argument)
+    ) {
       throw new Error(`Unknown argument: ${argument ?? "<missing>"}`);
```

- B5 **Test cmd:** `npx vitest run tests/unit/image-download-cli.test.ts`.
- B6 **Residual risk:** regression at `tests/unit/image-download-cli.test.ts:5-20` proves exit + stderr ordering, not absence of writes directly; source ordering at `scripts/download-images.ts:26-52` supplies that evidence. Live downloads intentionally untested.

## PR #32 — fix(build): serve CORE metadata URLs with query strings

- C1 **Verdict: Approve.** SHA `7da053c66a9c742e659f2ea49daf257e9bc4ba63`.
- C2 **Correct — pathname parsed before exact allowlist dispatch.** `scripts/lib/vite-core-content.ts:114-136` rejects `%`, backslash, hash; WHATWG `URL.pathname` removes query; middleware still serves only exact `core-bootstrap.json`, `core-release.json`, `app-icon.svg`, verified object-map keys.
- C3 **Correct — method/integrity controls unchanged.** `scripts/lib/vite-core-content.ts:137-172` still limits to GET/HEAD; `verifiedObject()` hashes bytes at lines 94-106. Regression asserts 200 plus no fallthrough at `tests/unit/core-content-transport.test.ts:99-105`; traversal rejection remains at lines 121-123.
- C4 **Actual diff:**

```diff
-  if (/%|\\|\?|#/.test(requestUrl)) return null;
+  if (/%|\\|#/.test(requestUrl)) return null;
   const pathname = new URL(requestUrl, "http://vite.local").pathname;
```

- C5 **Test cmd:** `npx vitest run tests/unit/core-content-transport.test.ts`.
- C6 **Residual risk:** direct middleware test does not launch Vite/Chromium. Query support applies to every exact allowlisted object path, not only `core-release.json`; immutable object identity remains path-keyed, so query cannot widen object selection.

## PR #54 — fix(asset-delivery): reject malformed numeric prerelease versions

- D1 **Verdict: Approve.** SHA `fcfe2cd8dd44dfe7f9165a1a495e558b223b80fd`.
- D2 **Correct — SemVer prerelease numeric rule enforced.** `scripts/lib/asset-delivery/schema.ts:88-97` accepts numeric `0` or nonzero-leading digits; alphanumeric/hyphen identifiers use `\d*[A-Za-z-][0-9A-Za-z-]*`; build metadata retains leading-zero allowance. `parseChannel()` consumes parser at `scripts/lib/asset-delivery/identity.ts:10-16`; asset inventory package version consumes it at `scripts/lib/asset-delivery/scan-assets.ts:184-190`.
- D3 **Correct — boundary controls cover malformed + valid near-neighbors.** `tests/asset-delivery-release-version.test.ts:11-23` rejects `1.0.0-01`, `1.0.0-alpha.01`; accepts `-0`, `-alpha.01x`, `+01`.
- D4 **Actual diff:**

```diff
-    !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.test(
+    !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.test(
```

- D5 **Test cmd:** `node --test tests/asset-delivery-release-version.test.ts`.
- D6 **Residual risk:** focused test omits empty/double-dot prerelease cases; regex rejects them, while existing parser suites provide broader grammar coverage per PR description. Input already capped to 512 chars by `text()` at `schema.ts:41-50`.

## PR #55 — fix(assets): bind archive verification to object digest

- E1 **Verdict: Approve.** SHA `7f05b75c5e49e5288e16ae97c0cbf4261abbbcb5`.
- E2 **Correct — structure, entries, digest share one fd.** `scripts/lib/asset-delivery/verify-archive.ts:40-57` captures pathname stat, opens with `O_NOFOLLOW`, binds handle identity; lines 57-108 verify ZIP structure + declared entry digests; lines 109-132 hash exact same `ZipFileReader` handle in 1 MiB reads, recheck pathname/handle identity, compare `ref` bytes/hash.
- E3 **Correct — pre-hash removal does not leave binary refs unchecked.** `scripts/lib/asset-delivery/verify-bundle.ts:43-63` records binary refs without independent path read. Every dev/core archive is immediately passed to `verifyArchive()` at lines 85-123. `walkContentClosure()` discovers each content part; `verify-bundle.ts:210-285` verifies every manifest part. Exact closure equality remains at lines 294-299.
- E4 **Correct — bounded reads preserved.** `verifyArchive.ts:31-37` applies archive/file-count limits before open. `ZipFileReader.readUint8Array()` at `scripts/lib/asset-delivery/zip-file-reader.ts:14-41` rejects invalid ranges, caps allocation, fails on short reads.
- E5 **Actual diff:**

```diff
+  const before = await sourceStat(root, relative);
+  if (!before?.isFile() || before.size !== BigInt(ref.bytes))
+    fail("ASSET_INTEGRITY_FAILED", ref.key);
...
+    const archiveHash = createHash("sha256");
+    let archiveBytes = 0;
+    while (archiveBytes < source.size) {
+      const chunk = await source.readUint8Array(
+        archiveBytes,
+        Math.min(1024 * 1024, source.size - archiveBytes),
+      );
+      archiveHash.update(chunk);
+      archiveBytes += chunk.length;
+    }
...
+    if (
+      !sameDigest(ref, {
+        bytes: archiveBytes,
+        sha256: archiveHash.digest("hex"),
+      })
+    )
+      fail("ASSET_INTEGRITY_FAILED", ref.key);
```

- E6 **Test cmd:** `node --test tests/asset-delivery-archive-identity.test.ts tests/asset-delivery-bundle.test.ts tests/asset-delivery-zip-structure.test.ts`.
- E7 **Residual risk:** no hostile-filesystem transaction guarantee after final stat; PR states same limit. New regression `tests/asset-delivery-archive-identity.test.ts:12-46` covers valid ZIP + wrong ObjectRef digest, not active in-place mutation or >4 GiB real archive.

## PR #56 — fix(content): reject noncanonical producer candidates

- F1 **Verdict: Approve.** SHA `3a92443b7214c297e37100eeab1e993e4a6d299c`.
- F2 **Correct — producer/verifier byte contract aligned.** Producer writes `canonicalBytes(candidate)` at `scripts/lib/asset-delivery/progressive-producer.ts:209-221`. Verifier parses strict candidate shape at lines 262-301; new check at lines 409-425 requires parsed value’s canonical bytes equal stored bytes before identity relations pass.
- F3 **Correct — all consumers cross same verifier.** CLI verify uses `verifyProgressiveRelease()` at `scripts/lib/asset-delivery/content-cli.ts:83-101`; pack validates predecessor at `progressive-producer.ts:160-175`; publisher validates before upload + immediately before pointer CAS at `scripts/lib/asset-delivery/progressive-publisher.ts:261-270,309-317`.
- F4 **Actual diff:**

```diff
       !Buffer.from(canonicalBytes(pointer)).equals(Buffer.from(pointerBytes)) ||
+      !Buffer.from(canonicalBytes(candidate)).equals(
+        Buffer.from(candidateBytes),
+      ) ||
       pointer.releaseSequence !== manifest.releaseSequence ||
```

- F5 **Test cmd:** `node --test tests/progressive-producer.test.ts`.
- F6 **Residual risk:** canonicality is integrity/format enforcement, not authenticity; authorized metadata replacement remains possible. Test at `tests/progressive-producer.test.ts:595-617` covers pretty-print alteration; alternate noncanonical key order/escape spellings follow same byte comparison.

## PR #57 — fix(assets): reject changed profile selection before sync write

- G1 **Verdict: Approve.** SHA `728f432ae93c83cf773e4ce12cad79758654ea6c`.
- G2 **Correct — snapshot used for scan is pinned across scan/write boundary.** `scripts/lib/asset-delivery/profile-sync.ts:28-42` captures parsed selection, passes it directly to `scanAssetProfiles()` for write mode, reloads + canonical-compares before diagnostics/inventory write at lines 43-50. Changed selection returns `ASSET_SOURCE_CHANGED` through `assetCli()` → exit 2, no inventory write.
- G3 **Correct — broader scan race checks remain.** `scripts/lib/asset-delivery/scan-assets.ts:92-176` rechecks asset enumeration, per-file identity, profile declarations; lines 184-199 derive validated inventory. Common lock is acquired for write mode at `profile-sync.ts:24-27`, released in `finally` at lines 56-58.
- G4 **Actual diff:**

```diff
+      const selection = await loadSelection(root);
       const report = flags.has("--check")
         ? await checkAssetProfiles(root)
         : await scanAssetProfiles(
             root,
-            await loadSelection(root),
+            selection,
             EMPTY_RETAINED_METADATA,
             null,
           );
+      if (
+        !Buffer.from(canonicalBytes(selection)).equals(
+          Buffer.from(canonicalBytes(await loadSelection(root))),
+        )
+      )
+        fail("ASSET_SOURCE_CHANGED", "asset-profiles/nightly.json");
```

- G5 **Test cmd:** `node --test tests/profile-sync-selection-race.test.ts tests/asset-delivery-profiles.test.ts`.
- G6 **Residual risk:** cooperating writers honor common lock; uncooperative A→B→A edits or edits after final reread remain outside guarantee, matching PR limits. `--check` performs an extra internal selection load via `checkAssetProfiles()` (`scan-assets.ts:211-220`), but before/after comparison still rejects stable semantic change during check.

## PR #58 — fix(decks): reject unusable cards at published-deck boundary

- H1 **Verdict: Approve.** SHA `50af8ca6c46c58ad3709304e394e8c4be72add98`.
- H2 **Correct — published validator now matches draft rule.** `src/decks/validation/validate-published-decks.ts:20-28` applies TOKEN or scope bit `8` rejection to every card in main/extra/side. Existing draft validator uses identical predicate at `src/decks/deck-validation.ts:138-147`.
- H3 **Correct — both producer and legacy consumers inherit boundary.** Release semantic validation calls validator at `src/shell/release-validation.ts:87-91`; legacy installed gameplay maps `record.ot` to `scope`, then validates at `src/shell/adapters/legacy-gameplay-validation.ts:15-44`.
- H4 **Actual diff:**

```diff
-        if (hasOcgType(definition.type, OCG_TYPE.TOKEN)) fail();
+        if (
+          hasOcgType(definition.type, OCG_TYPE.TOKEN) ||
+          (definition.scope & 8) !== 0
+        )
+          fail();
```

- H5 **Test cmd:** `npx vitest run tests/unit/decks/published-deck-validation.test.ts tests/unit/cards.test.ts`.
- H6 **Residual risk:** new fixture at `tests/unit/decks/published-deck-validation.test.ts:39-47` covers normal scope `1` + exact illegal scope `8`, not composite scope bits; bitmask implementation handles composites. Live release/engine duel remains untested.

## Validation evidence

- I1 `git cat-file -t <head>` → `commit` for all seven SHAs; `git show -s --format='%H %P %s'` confirms common direct parent/base.
- I2 `git diff --check origin/main...<head>` → no output for all seven heads.
- I3 `git diff --stat origin/main...<head>` → exact supplied changed-file sets for PRs #29, #32, #54-#58.
- I4 `git merge-tree $(git merge-base origin/main <head>) origin/main <head>` inspection → no conflict markers for all seven heads.
- I5 Tests not run per task: parent owns test execution. Commands above are exact targeted review recommendations.
- I6 Dirty local files ignored. Inspection used `git show <headRefOid>:<path>` plus revision-scoped `git grep`, not worktree production contents.

## Assumptions

- J1 Code verdict evaluates diff correctness/security. Existing red required CI remains external merge gate, not automatic code-level `Block`, because task says parent diagnoses full-gate failure.
- J2 Supplied `pr-N.json` + `pr-N.diff` are review metadata; exact Git head objects are source of truth when reading full files/callers.
- J3 Graphify skipped because task records parent attempt as unavailable.

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "Per-PR verdicts, exact SHAs, path:line evidence, actual diff snippets, test commands, residual risks supplied for PRs #29, #32, #54, #55, #56, #57, #58."
    }
  ],
  "changedFiles": [],
  "testsAddedOrUpdated": [],
  "commandsRun": [
    {
      "command": "git cat-file -t <head> && git show -s --format='%H %P %s' <head>",
      "result": "passed",
      "summary": "All seven exact head SHAs exist as commits with declared common base parent."
    },
    {
      "command": "git diff --check origin/main...<head>",
      "result": "passed",
      "summary": "No whitespace errors for any reviewed PR diff."
    },
    {
      "command": "git merge-tree $(git merge-base origin/main <head>) origin/main <head>",
      "result": "passed",
      "summary": "No merge conflict markers for reviewed heads against origin/main."
    },
    {
      "command": "targeted test commands listed per PR",
      "result": "not-run",
      "summary": "Parent owns tests per task."
    }
  ],
  "validationOutput": [
    "V1. Exact head inspection completed via git show; full changed production files plus callers reviewed.",
    "V2. All seven code verdicts: Approve; no code blockers found.",
    "V3. All seven metadata records show full-gate failure; merge remains CI-gated pending parent diagnosis."
  ],
  "residualRisks": [
    "R1. Targeted/full tests not run by reviewer; parent owns execution.",
    "R2. Supplied PR #67 CI log cannot prove failure cause for each reviewed PR run.",
    "R3. Hostile filesystem transactionality and live network/publication flows remain outside reviewed tests, as detailed per PR."
  ],
  "noStagedFiles": true,
  "diffSummary": "Read-only review of seven one-commit PRs; no implementation files changed.",
  "reviewFindings": [
    "F1. no blockers: scripts/download-images.ts:170-200 — unknown option allowlist is fail-fast before side effects.",
    "F2. no blockers: scripts/lib/vite-core-content.ts:114-136 — query stripping retains exact path allowlist and traversal guards.",
    "F3. no blockers: scripts/lib/asset-delivery/schema.ts:88-97 — numeric prerelease leading zeroes rejected without narrowing valid alphanumeric/build identifiers.",
    "F4. no blockers: scripts/lib/asset-delivery/verify-archive.ts:40-132 — archive structure, entries, identity, digest bind to one open handle.",
    "F5. no blockers: scripts/lib/asset-delivery/progressive-producer.ts:409-425 — candidate canonical bytes enforced consistently with producer.",
    "F6. no blockers: scripts/lib/asset-delivery/profile-sync.ts:28-50 — changed selection rejected before inventory write.",
    "F7. no blockers: src/decks/validation/validate-published-decks.ts:20-28 — ILLEGAL scope bit validation matches draft boundary."
  ],
  "manualNotes": "plan.md and progress.md were absent. Dirty worktree ignored. No repo/remote mutations or subagents."
}
```

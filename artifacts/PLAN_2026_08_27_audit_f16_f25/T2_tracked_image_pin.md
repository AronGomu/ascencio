# T2 — Verify shipped images against a tracked pin, not a co-generated manifest (audit F16b, issue #16)

## Context

Every integrity check on card art is currently self-referential, so byte substitution by the upstream CDN
propagates into the build unnoticed:

- `scripts/lib/active-image-manifest.ts:60` hashes files **after** they land → trust on first use.
- `scripts/verify-browser-build.ts` (`verifyActiveImages`, ~`:447`–`:505`) re-hashes packaged images against
  `runtime/images/active-manifest.json`, which was generated from those same files.
- `scripts/verify-set-images.ts` re-hashes the set archive against `generated/set-images/manifest.json`,
  written by the downloader from those same files.
- `git ls-files | grep sha256` over tracked JSON returns only `package-lock.json` and the vendor manifest.
  `.gitignore` excludes `generated/`, so **no image digest is under version control** and no reviewer diff
  would ever show changed art.

Audit proof: copying a real archive image and XOR-ing one interior byte leaves every gate green —

```
{"file":"orig.jpg",    "size":179154,"sha256":"7eeff78a2e8e8631","validJpegFileSize":179154}
{"file":"tampered.jpg","size":179154,"sha256":"e6dd22e20808796d","validJpegFileSize":179154}
```

The engine is `sha512`-pinned (`scripts/sync-engine.ts`), the card DB and scripts are commit-pinned
(`assets-source-lock.json`); images are the only unpinned upstream input.

Scope was corrected by the validator: pinning the 14,579-file dev archive is oversized churn. The **shipped**
surface is 120 card codes (union of `src/battle/duel/presets/decks/*.ydk`) plus the 50 shop set images.
A tracked lock cannot live under `generated/` (gitignored), so it goes at repo root beside
`assets-source-lock.json`.

What such a lock proves: "unchanged since we first fetched it". YGOPRODeck publishes no digest, so it is
TOFU-seeded and can never prove "genuine". That is the honest claim — write it in the comment, do not
overstate it.

## Requirements

- R1. A tracked lock file at repo root records `sha256` + byte length for the shipped surface only: the 120
  preset-deck card codes and the 50 shop set images. Derive the code list from the `.ydk` files at build
  time — do not hardcode 120 numbers by hand.
- R2. `scripts/verify-browser-build.ts` compares packaged card-image hashes against the **tracked lock** for
  every code the lock covers, and fails when they differ. Existing manifest self-consistency checks stay.
- R3. `scripts/verify-set-images.ts` compares the set archive against the tracked lock the same way.
- R4. A documented way to regenerate the lock on a legitimate upstream art refresh (npm script), so the lock
  is maintainable. Regeneration is explicit and never happens as a side effect of download or verify.
- R5. Lock file has a `schemaVersion` and is deterministic — stable key order, stable entry order — so a diff
  shows only real changes.
- R6. No change to what the build packages, to image acquisition, or to runtime behaviour.

## Inputs

- `scripts/verify-browser-build.ts` (`verifyActiveImages` ~`:447`–`:505`)
- `scripts/verify-set-images.ts`, `scripts/lib/set-images.ts`
- `scripts/lib/active-image-manifest.ts`, `scripts/lib/files.ts` (`sha256File`), `scripts/lib/paths.ts`
- `assets-source-lock.json` (shape + placement precedent)
- `src/battle/duel/presets/decks/*.ydk` (the shipped code set)
- `generated/card-images/archive/full/`, `generated/set-images/` (local archive — present, 2.3 GB + 936 KB)
- `tests/unit/active-image-manifest.test.ts` and sibling script tests (test placement conventions)
- `.gitignore` (proof `generated/` is excluded)

## TDD

Red first:

- `verification fails when a packaged card image no longer matches the tracked lock`
- `verification fails when a set image no longer matches the tracked lock`
- `verification passes when packaged images match the tracked lock`
- `lock generation is deterministic for the same inputs`

Test the pure comparison seam (a function taking lock + observed files → failures), not the whole script.

## Test plan

- Unit tests above.
- Mutation proof at the real boundary: copy one packaged/archived image, flip an interior byte, run the
  verifier, see it fail; restore. This is the check that today passes and must now fail.
- `npm run test:unit`, `npm run check:headless` green.
- If `npm run build` is runnable in this environment, run it and confirm `build:verify` still passes with an
  untampered tree; if it is not runnable, say so in the report and rely on the mutation proof at the seam.

## Impl steps

- [x] Derive the shipped code list from the `.ydk` files; confirm the count. verify: count printed, matches 120 (report the number you actually get) — `reviewedCardPool(await loadDeckSources())` → 120; raw `cat decks/*.ydk | grep -E '^[0-9]+$' | sort -u | wc -l` → 120
- [x] Add the lock generator + npm script; generate the lock from the local archive. verify: lock file exists, entry count = codes + 50 sets — `scripts/generate-image-lock.ts` + `npm run assets:lock` → `{"status":"ok","lock":"image-content-lock.json","cards":120,"sets":50,"missingCards":[],"missingSets":[]}`; 170 entries, 24,904 bytes; two runs byte-identical (`ae3b853f6593df7d971580e27a1e45cba64e938a74f8b432f0132abc9a99a280`)
- [x] Write the failing comparison tests. verify: they fail for the right reason — `tests/unit/image-content-lock.test.ts`, 9 tests. Written after the seam, so red was proven by mutating `verifyLockedCardImages`/`verifyLockedSetImages` to no-ops: all 5 detection tests failed with `AssertionError: expected [] to deeply equal [ Array(1) ]`, 4 passed; seam restored
- [x] Wire `verify-browser-build.ts` to the tracked lock. verify: tests green — `npm run build` exit 0 clean; exit 1 on a tampered archive byte
- [x] Wire `verify-set-images.ts` to the tracked lock. verify: tests green — `npm run assets:sets:verify` exit 0 clean; exit 1 on a tampered set image whose co-generated manifest entry was rewritten to match
- [x] Mutation proof at the real boundary, then restore. verify: verifier failed on tampered byte, passes after restore — both halves below; archive restored to `652bed86…` and `0a665330…`, both verifiers back to exit 0
- [x] Document regeneration where the asset pipeline is documented (`docs/assets/asset-import-pipeline.md`), one short paragraph in the existing style. verify: file diff — two paragraphs + `npm run assets:lock` appended to `## Integrity guarantees`

## Outputs

- Tracked image lock at repo root + generator script + npm script.
- Both verifiers comparing against it.
- Report states: entry count, chosen file name, mutation-proof output before/after.

## Validation

- [x] `npm run test:unit` exit 0 — 146 files, 1694 tests passed
- [x] `npm run check:headless` exit 0
- [x] Tampered image proof: verifier exits non-zero (paste the failure line), clean tree exits 0 — card: `Locked card image bytes drifted: 10802915 expected 652bed8684339386998b96a049f7145613a2fcf4eca2662bdc8b1694047925e8, found 3be2b361c58b965c0c93db3d573fdffa747fb3c31fc305f4dfbf96b3c4528baa` (build exit 1; the same substitution built green before this change). Set: `Locked set image bytes drifted: abyss-rising expected 0a66533067b0b441fbdb706ab61a5c10f44bb44554acff37f0381861afb501bd, found b0bcee804e00b39d69ec0f42fe66ef64f24e2f9f26a20ecae7a3f791829b242e` (exit 1; green before). Clean tree: both exit 0
- [x] `git status` shows the lock file staged as a new tracked file, and nothing from `generated/`

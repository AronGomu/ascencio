# Repository directory migrations

A directory cleanup must declare its file-level contract before applying edits.
Copy the shape of `evaluator-schemas.json` (types in
`scripts/lib/repository-migration/manifest.ts`):

- `moves`: exact source/destination files and the original SHA-256 bytes.
- `deletions`: intentional file removals; directories are never recursively removed.
- `consumers`: exact owned files and literal, nonempty replacements, in order.
- `exclusions`: exact paths or directory prefixes ending in `/`.
- `protectedPathExceptions`: exact protected files with reviewable reasons.
- `requiredResources`: destination files with SHA-256 pins.
- `referenceChecks`: obsolete literal text, owned scan paths, and exact historical
  document exceptions with reasons. Include all active consumer roots; references
  outside those declared roots are intentionally outside this check's scope.

Vendor files, dependency lockfiles and bundled `.github/skills/` content are
protected by default. Explicit exceptions can authorize a particular file, but
`vendor/ocgcore-wasm/0.1.2/` is always frozen. Exclusions take precedence over
exceptions. Symlink paths, traversal and overlapping writes are rejected.

For a new migration, commit its manifest first, then record that commit as the
base. Keep the migration isolated from unrelated work. Run with Node 26:

```sh
node scripts/check-repository-migration.ts apply config/migrations/my-move.json
node scripts/check-repository-migration.ts check config/migrations/my-move.json --base <manifest-commit>
npm run test:context
npm test -- --tests test/tooling/repository-migration.test.ts test/tooling/bot-evaluation-tooling.test.ts
```

`apply` preflights inputs and changes only the declared files. It is not a
transaction across filesystem failures; if interrupted, inspect the Git diff
before retrying. `check --base` audits the working tree against the exact base,
including untracked files, and rejects undeclared changes and extra consumer
edits. It checks working-tree content, not a separately staged snapshot; stage
only after this audit and recheck if content changes. The exported read-only
`checkMigration(root, manifest, { base? })` returns sorted diagnostics for local
callers; invalid contracts throw. The CLI exits nonzero on either kind of failure.

Without `--base`, the check validates retained destination pins, retired paths,
and obsolete references. It does not claim an audit of the original migration
or of unrelated changes. The retained `evaluator-schemas.json` records the schema
move in commit `2e9489fb33b4d60cd4c9a541154362059c8f4bb7`; it is a resource guard,
not a manifest for replaying that entire repository reorganization. Future
intentional schema edits must update the reviewed pins.

The existing targeted selector explicitly maps evaluator resources, Rust sources,
schema generation and migration manifests to `bot-evaluation-tooling.test.ts`.
Deleted and renamed paths participate even when absent from the current inventory.
No separate test runner or hosted workflow is introduced.

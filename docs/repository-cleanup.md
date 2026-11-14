# Repository cleanup

Run `npm run repo:cleanup -- inspect .tmp/cleanup-review.json` from the repository root. Supply an optional base after the manifest path; default is `main`. Inspection changes no Git refs or worktrees and refuses to overwrite a report.

The manifest enumerates only branches, remote-tracking refs and archive tags, excluding internal agent checkpoint refs. Commit tips are deduplicated; commit subjects are capped at 30 per group. Worktree status lists changed paths without dumping patches or generated evidence.

Interpret the three independent questions:

- Ancestry: commits listed outside the base history have not been merged under those identities.
- Patch equivalence: `equivalentPatches` are already represented by equivalent patches; `uniquePatches` lack that equivalence. Merge-only history can have neither.
- Functional overlap: `requires-review` is intentional. Compare current entry points, commands, contracts and relevant tests before deciding whether a unique patch adds missing functionality. Record the finding in the manifest; ancestry alone cannot establish obsolescence.

Inspection is not a backup. Preserve any work that should survive cleanup separately. The tool never deletes active worktrees or ordinary branches. Retire those only after accounting for dirty files and checking process ownership.

For explicitly authorized archive disposal, fill `deletion.tags` with `{ "ref": "refs/tags/archive/...", "sha": "expected-object-id" }`. Add `"remote": "origin"` for remote tags; list local and remote operations separately. Fill `deletion.archives` with absolute paths to direct `.tmp/merge-cleanup-*` directories. These directories may contain dirty snapshots and recovery bundles: deletion removes them too.

Run `npm run repo:cleanup -- delete .tmp/cleanup-review.json`. Every target is validated before deletion, the repository/base must match inspection, and tag deletion checks expected object IDs (including remote leases). The command prints deleted targets and final working-tree status. A network failure can leave a partially completed operation; re-inspect remaining targets before retrying. The manifest is an audit record, not proof that unreachable Git objects were physically erased; normal Git retention still applies.

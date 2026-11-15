# Per-loss review

Current workflow: publish version-4 readable loss files with `bot:analysis-slices`, then prepare a fresh queue with `loss-review-queue.ts`. Each distinct subagent claims exactly one loss and reads its complete Markdown file. Queue remaining losses within declared runtime capacity. Submit one primary finding plus every supported secondary reason; exact choices are validated against authoritative evidence. Completion replaces page acknowledgements. Queue status supplies existing per-match reports once all losses in that match complete; the publication coordinator submits those through slice checkpoints. Slices group publication only and do not define analyst ownership. Full coverage requires every lost game; no clustering or sampling substitution.

Use the queue CLI `node scripts/bot-improvement/loss-review-queue.ts SESSION REQUEST.json`; inspect its `LossReviewAction` type for exact fields. Preserve old claims/cursors and create a new cohort when migrating encoded packets.

## Publication and coverage

Read before dispatch. Verify finalized completed target-loss evidence and pin evaluation, source/version, packet identities and hashes. Supply only allowlisted target-loss Markdown and exact-choice evidence maps; full two-actor, opponent-only and non-loss gameplay remain excluded. A no-loss slice reports zero reviewed and opens no gameplay. Preserve unknown information; paired new-loss flags are metadata, never permission to inspect winning gameplay.

Use `bot:analysis-slices` to synchronize bounded publication batches (`maxSlices: 1`). Never reslice a live claim. The coordinator checkpoints generated per-match findings and completes the slice after all its loss owners finish. Inspect the owning CLI schema for exact fields. Use metadata status for progress and audit source/report bytes and coverage before trusting resumed analysis. Reuse only completed identity/hash-matching findings with provenance; verify exactly-once coverage.

After required coverage completes, reconcile `loss-analysis-draft.md` into the [evaluation report](loss-analysis-template.md). Global consolidation waits for Evaluate and Decide completion. Preserve claims and uncovered losses on interruption under Incident policy and Artifact lifecycle. Use native publication receipts after writer closure; standalone producers use `publish-text-match.ts` to verify records and publish receipts.

## Per-match findings format

```markdown
# Match loss analysis

Job: <packet job ID>
Packet: <packet SHA-256>

- G1 | 0-decision-42 | avoidable | Wrong destruction target | Prefer opposing backrow
- G3 | - | unclear | No supported decisive error | Review similar losses
```

Generated reports have one row per target loss, fields separated by `|` with no pipes inside fields. Classifications: `avoidable`, `unavoidable`, `unclear`. An avoidable finding requires a decision ID present in that game's target record; use `-` when unavailable. The queue validates bindings, loss membership, decision IDs and complete unique coverage; findings remain Markdown. Regression diagnosis and isolated repair follow the skill’s Source selection and replay gate; observed associations are not causal proof.

## First-pass submission

Each entry uses `schemaVersion: 1`, `format: "loss-markdown-v1"`, `job`, `packetSha256`, primary `findings` (one row per loss), and required `reasons`. Every reason supplies `game`, stable kebab-case `id`, `decision`, complete ordered `offered`/`chosen` choice-ID arrays, `reason`, `solution`. Include primary avoidable and every supported secondary hypothesis, or `reasons: []`; one critical decision per game/reason. Separate activation/target-selection reasons; reconcile synonymous IDs across slices before the global threshold. They remain hypotheses until replay; each threshold counts distinct games while primary coverage counts a loss once.

The tool generates primary Markdown plus `- R G1 | reason-id | decision-id | ["offered-id"] | ["chosen-id"] | Reason | Solution | supported` under `Reasons: complete`, validating actual offered/chosen IDs. Escape pipes in JSON choice IDs as `\u007c`; prose is single-line without pipes. Use tool-generated per-match files in evaluation `analyses/`; return their paths and slice coverage.

## Historical evidence

Keep retained version-1/2/3 packet claims and cursors unchanged as evidence. Current work uses a fresh readable cohort, never encoded-page review or acknowledgement.

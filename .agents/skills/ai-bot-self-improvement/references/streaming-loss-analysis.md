# Per-loss review

Current workflow: publish version-4 readable loss files with `bot:analysis-slices`, then prepare a fresh queue with `loss-review-queue.ts`. Each distinct subagent claims exactly one loss and reads its complete Markdown file. Queue remaining losses within declared runtime capacity. Submit one primary finding plus every supported secondary reason; exact choices are validated against authoritative evidence. Completion replaces page acknowledgements. Queue status supplies existing per-match reports once all losses in that match complete; the publication coordinator submits those through slice checkpoints. Slices group publication only and do not define analyst ownership. Full coverage requires every lost game; no clustering or sampling substitution.

Use the queue CLI `node scripts/bot-improvement/loss-review-queue.ts SESSION REQUEST.json`; inspect its `LossReviewAction` type for exact fields. Preserve old claims/cursors and create a new cohort when migrating encoded packets.

## Historical encoded slice protocol

The following protocol describes retained version-1/2/3 packets only. New work follows the readable per-loss workflow above.

Read before analyst dispatch; ownership follows the skill’s Autonomy.

## Dispatch and coverage

1. Verify finalized evidence for the selected slice. Filter completed target losses using machine outcome metadata. Global consolidation still requires Evaluate and Decide completion.
2. Partition the frozen schedule using the pinned policy (250-match slices by default), one owner per whole slice and explicitly bounded runtime slots. Repeat `sync` with `maxSlices: 1`; each range is discovered independently. A ready slice may dispatch before later matches finalize only when shared storage/resource gates permit. Convert/project outside the session lock and publish under that lock. Never reslice a live claim.
3. Pin evaluation, AI source/version, match range, packet identities and hashes. Supply only packets and explicitly allowlisted `jobs[].losses[].log` completed target-loss projections. Indexes grant no traversal permission; full two-actor/opponent-only or non-loss gameplay remains excluded. A no-loss slice reports zero reviewed and opens no gameplay.
4. For versions 2 and 3, read and acknowledge every ordered page under [performance-upgrades.md](performance-upgrades.md). For version 1, read every ordered `loss.review.pages` page or the entire allowlisted `loss.log` fallback. Pages preserve all events/decisions and labels/card identities, showing repeated non-decision state as changes since the same-kind prior event; hashes and event/decision counts bind them to the log. Record review duration/supplied bytes; pagination must not truncate coverage. Use visible information and preserve unknowns. Capture primary and all supported secondary reasons in this first pass using the submission contract below; keep singleton findings. Paired new-loss flags are metadata, never winning gameplay.
5. Reuse only identity/hash-matching findings; verify IDs and exactly-once coverage. After all selected slices finish, merge categories under the [loss report](loss-analysis-template.md) contract and label the coverage policy. Explicit earlyResearch may start hypotheses/temporary variants from reviewed evidence; no slice independently authorizes replay completion or promotion.
6. Apply inherited Incident policy and Artifact lifecycle; preserve slice ownership and uncovered losses for continuation.

## Tool protocol

Use [analysis-slices.ts](../../../../scripts/bot-improvement/analysis-slices.ts) through `npm run bot:analysis-slices -- SESSION REQUEST.json`:

- `{"action":"sync","binding":...,"maxSlices":1}` verifies bounded slice evidence and publishes at most one new slice, returning `preparationComplete`; continue while dispatching ready slices.
- `{"action":"claim","iteration":N,"role":"candidate","owner":"analyst-id"}` returns one whole slice; owner retries return the existing claim. Include `analysisId` on every cohort action and on its binding. Cost-balanced scheduling changes which pending unit is claimed, never an active owner.
- For each packet job not in `claim.completedJobs`, submit structured first-pass findings bound to job/packet hash; the tool generates per-match Markdown. Checkpoint small completed-match batches; findings survive release/reassignment. No-loss slices submit none.
- `{"action":"checkpoint","iteration":N,"role":"candidate","slice":"slice-0001","token":"...","findings":[...]}` validates/saves completed match subsets without releasing ownership. `complete` accepts remaining findings, or an empty list after all jobs checkpointed. Identical retries are safe; changed accepted reports are rejected. `release` requires slice ID, token and `terminated:true`; reassignment invalidates stale completions.
- Use metadata-only `status` for progress; run `audit` before trusting resumed completed analysis for rules. Audit verifies source/report/page bytes and coverage, not just cached summary.
- After all required selected slices complete, reconcile the tool's merged `loss-analysis-draft.md` into the final report before returning to candidate preparation.

The underlying [prepare-analyses.ts](../../../../scripts/bot-improvement/prepare-analyses.ts) schema/queue remains the match-level validation/archive interface; the slice layer exclusively owns dispatch. Do not mix its claims with independent per-match claims.

Use lossless logs and verified native receipts: frozen execution publishes after match closure; a standalone producer uses [publish-text-match.ts](../../../../scripts/bot-improvement/publish-text-match.ts) only after writer closure to verify records and publish its receipt.

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

## Versioned performance extension

For new compact packets, bounded slice discovery and explicit partial-policy semantics, follow [performance-upgrades.md](performance-upgrades.md). Its version-2/3 acknowledgement contract supersedes older page rendering instructions for those packets only. Existing claims and version-1 packets keep their original obligations. A ready slice does not grant permission to bypass the shared storage lease or claim that the whole evaluation finished.

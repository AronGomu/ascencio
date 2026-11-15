# Post-evaluation loss analysis

Read before analyst dispatch; ownership follows the skill’s Autonomy.

## Dispatch and coverage

1. After Decide, verify the Evaluate completion gate. Filter completed target losses using machine outcome metadata.
2. Partition the frozen schedule into disjoint consecutive 250-match slices (last may be smaller), with one owner per whole slice and queued runtime slots; never split/merge assignments. Setup’s `analysis-workers` is slice count. After the full evaluation barrier, repeat `sync` with `maxSlices: 1`, claiming/dispatching ready slices until `preparationComplete`. Convert/project outside the session lock; publish each bounded slice transaction under that lock.
3. Pin evaluation, AI source/version, match range, packet identities and hashes. Supply only packets and explicitly allowlisted `jobs[].losses[].log` completed target-loss projections. Indexes grant no traversal permission; full two-actor/opponent-only or non-loss gameplay remains excluded. A no-loss slice reports zero reviewed and opens no gameplay.
4. Read every ordered `loss.review.pages` page or the entire allowlisted `loss.log` fallback. Pages preserve all events/decisions and labels/card identities, showing repeated non-decision state as changes since the same-kind prior event; hashes and event/decision counts bind them to the log. Record review duration/supplied bytes; pagination must not truncate coverage. Use visible information and preserve unknowns. Capture primary and all supported secondary reasons in this first pass using the submission contract below; keep singleton findings. Paired new-loss flags are metadata, never winning gameplay.
5. Reuse only identity/hash-matching findings; verify IDs and exactly-once coverage. After all slices finish merge categories under the [loss report](loss-analysis-template.md) contract; no slice independently triggers edits.
6. Apply inherited Incident policy and Artifact lifecycle; preserve slice ownership and uncovered losses for continuation.

## Tool protocol

Use [analysis-slices.ts](../../../../scripts/bot-improvement/analysis-slices.ts) through `npm run bot:analysis-slices -- SESSION REQUEST.json`:

- `{"action":"sync","binding":...,"maxSlices":1}` verifies the full evaluation barrier and publishes at most one new slice, returning `preparationComplete`; continue while dispatching ready slices.
- `{"action":"claim","iteration":N,"role":"candidate","owner":"analyst-id"}` returns one whole slice; owner retries return the existing claim.
- For each packet job not in `claim.completedJobs`, submit structured first-pass findings bound to job/packet hash; the tool generates per-match Markdown. Checkpoint small completed-match batches; findings survive release/reassignment. No-loss slices submit none.
- `{"action":"checkpoint","iteration":N,"role":"candidate","slice":"slice-0001","token":"...","findings":[...]}` validates/saves completed match subsets without releasing ownership. `complete` accepts remaining findings, or an empty list after all jobs checkpointed. Identical retries are safe; changed accepted reports are rejected. `release` requires slice ID, token and `terminated:true`; reassignment invalidates stale completions.
- Use metadata-only `status` for progress; run `audit` before trusting resumed completed analysis for rules. Audit verifies source/report/page bytes and coverage, not just cached summary.
- After all slices complete, reconcile the tool's merged `loss-analysis-draft.md` into the final report before returning to candidate preparation.

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

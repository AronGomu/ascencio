# Post-evaluation loss analysis

Read before analyst dispatch. Analysts diagnose only; the orchestrator implements changes and owns execution.

## Dispatch and coverage

1. After Decide, verify every scheduled match finalized and every reservation settled. Filter completed target losses using machine outcome metadata; no analyst starts during evaluation.
2. Partition the frozen schedule in recorded order into disjoint consecutive 250-match slices (last may be smaller). Launch exactly one owner per whole slice in parallel: ten for 2,500 matches. Queue whole slices for runtime slot capacity; do not split/merge assignments. Setup's `analysis-workers` is the slice count.
3. Pin evaluation, AI source/version, match range, packet identities and hashes. Supply only each packet and its explicit allowlisted `jobs[].losses[].log` target-loss projections. Analysts never read full two-actor logs, opponent-only content, wins/draws/timeouts/failed/skipped gameplay or accepted-version wins. Match indexes are references only, not permission to traverse other games. A no-loss slice reports zero losses reviewed and opens no gameplay.
4. Analysts review every completed target loss using visible information, preserving unknowns. Write the per-match findings below under the evaluation's `analyses/`, with separate job/packet bindings per match, and return paths plus slice coverage. Keep singleton findings; eligibility is global. Analysts receive paired new-loss flags from metadata when relevant, never winning-game content.
5. Reuse only identity/hash-matching findings; verify IDs and exactly-once coverage. Wait for all slices, merge categories and compile the evaluation-bound [loss report](loss-analysis-template.md). Its global eligibility/ranking/replay-point contract governs; slice reports never independently trigger changes.
6. Apply the skill’s Incident policy on failure/stop and Artifact lifecycle to reports/logs. Preserve ownership and uncovered losses for explicit continuation without duplicate analysts; delivery alone permits no pruning.

## Tool protocol

Use [analysis-slices.ts](../../../../scripts/bot-improvement/analysis-slices.ts) through `npm run bot:analysis-slices -- SESSION REQUEST.json`:

- `{"action":"sync","binding":...}` verifies finalization, derives slices and publishes target-loss views/allowlists.
- `{"action":"claim","iteration":N,"role":"candidate","owner":"analyst-id"}` returns one whole slice; owner retries return the existing claim.
- For every `packet.jobs` entry, write the bound per-match report using only its allowlisted losses. A no-loss slice returns an empty report list.
- `{"action":"complete","iteration":N,"role":"candidate","slice":"slice-0001","token":"...","reports":[{"path":"...","sha256":"..."}]}` validates coverage and publishes findings/code-generated metadata. `release` requires slice ID, token and `terminated:true`; reassignment invalidates stale completions.
- After all slices complete, reconcile the tool's merged `loss-analysis-draft.md` into the final report before returning to candidate preparation.

The underlying [prepare-analyses.ts](../../../../scripts/bot-improvement/prepare-analyses.ts) schema/queue remains the match-level validation/archive interface; the slice layer exclusively owns dispatch. Do not mix its claims with independent per-match claims. 

Use authoritative lossless logs and verified native receipts. Frozen execution publishes receipts after match closure. A standalone producer uses [publish-text-match.ts](../../../../scripts/bot-improvement/publish-text-match.ts) only after writer closure to verify records and publish its receipt.

## Per-match findings format

```markdown
# Match loss analysis

Job: <packet job ID>
Packet: <packet SHA-256>

- G1 | 0-decision-42 | avoidable | Wrong destruction target | Prefer opposing backrow
- G3 | - | unclear | No supported decisive error | Review similar losses
```

Write one row per target loss, fields separated by `|` with no pipes inside fields. Classifications: `avoidable`, `unavoidable`, `unclear`. An avoidable finding requires a decision ID present in that game's target record; use `-` when unavailable. The queue rejects wrong bindings, winning-game findings, duplicates, invented decisions and incomplete coverage. Human/agent findings and final reports remain Markdown. Regression diagnosis and isolated repair follow the skill’s Source selection and replay gate; observed associations are not causal proof.

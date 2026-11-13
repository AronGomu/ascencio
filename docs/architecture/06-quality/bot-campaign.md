# Supervised improvement runs

Terms: improvement run = legacy `campaign`; iteration = `round`; accepted version = `incumbent`. Preserve existing command/config keys.

## Storage ownership

- `run.json`: global progress, limits/identity references and links to iterations/evaluations.
- `configuration.json`: pinned effective settings; shared defaults remain in `config/bot-campaign-policy.json`.
- `baseline/evaluations/*/evaluation.json`: canonical baseline receipts.
- `iterations/iteration-N/iteration.json`: iteration state or decision; evaluation data is referenced.
- `iterations/iteration-N/proposal.json`: canonical proposal receipt.
- `iterations/iteration-N/evaluations/*/evaluation.json`: candidate evaluation receipts.
- Evaluation evidence directories contain `manifest.json`, `summary.json`, `progress.json`, and linked match records.
- Each `matches/match-N/match.json` references `games/game-N/game.json`.
- Each game has shared `metadata.json`, separate actor machine records (`a.json`, `b.json`), and readable projections (`a.log`, `b.log`). Repeated deck configurations are shared within the evaluation.
- `index.md` files provide navigation without copying results or configuration. `versions/` owns immutable AI packages; references identify the versions being compared.

Machine records use compact JSON and `$ref` pointers. Logs and orchestrator documents use plain text/Markdown. XML is an in-memory compatibility/validation codec, not persisted match evidence. Old `.xml` logical paths resolve to linked `.json` documents for compatibility.

## Preparation and execution

Use the preparation repository’s `generate-improvement-run-setup.ts`; its help documents inputs and supported strategy packages. Always include frozen starting-AI self-play. Additional opponents stay fixed. Match count defaults to 50, with four games per match. Only the target AI changes.

```sh
npm run bot:campaign -- --config /absolute/campaign.json
npm run bot:campaign -- --config /absolute/campaign.json --resume
```

Initialization validates/freezes packages and stops before games. Resume advances one stage: diagnostics, proposal, comparison, decision, final ranking or export. The conversation orchestrator creates proposals directly; use `campaign-import --directory RUN --candidate STRATEGY --previous-executable PINNED_BINARY` rather than the legacy automatic proposal stage. Import validates and archives the candidate and stops before comparison.

Candidate and baseline share engine-seed schedule, starting sides and original decks. Reuse completed compatible batches. Promote only for strictly higher weighted win rate; ties/regressions retain the accepted version. Draws are nonwins. Weight opponent decks equally, then versions within each deck. No confidence-interval gate.

Limits apply together; failed/interrupted reservations remain consumed. Stop on cancellation, exhaustion or unhandled failure. Review pauses count toward wall time. One lock prevents competing writers. Resume verifies pinned inputs, commands, implementation and evidence.

## Migration and navigation

`migrate-run --directory RUN --previous-executable BINARY` verifies original identity and evidence, roundtrips converted documents, checks game hashes and baseline scores, removes converted XML and preserves the stage. An interrupted representation-only normalization can resume from an existing verified migration receipt, after rechecking every game and score. Credentials and agent runtime directories are excluded.

The preparation repository supplies `migrate-improvement-run.ts` and `generate-improvement-run-index.ts`. Navigation indexes live outside hashed evaluation-attempt directories. Keep old runs separate from the active run; migration does not start games.

## Orchestrator handoff and loss analysis

`campaign-report --directory RUN` refreshes `report.md` without advancing execution. The report links the shared policy and effective configuration; no policy copy or overrides section is generated.

After each persisted iteration decision, the orchestrator spawns a loss-analysis agent. It examines every relevant loss from actor-visible records and classifies avoidable/unavoidable/indeterminate. For avoidable losses, select one critical decision and group patterns. Emit one compact `loss-analysis.md`: coverage counts and up to five ranked patterns, each with affected-loss count, critical choice and proposed solution. Omit gain estimates, evidence-link lists and separate loss ledgers. No analysis is due before an iteration completes.

## Action-trace retention

After a persisted decision, the run pauses at `analysis`. The orchestrator receives and reads the subagent’s English `iterations/iteration-N/loss-analysis.md`, then calls the preparation repository’s `prune-improvement-iteration.ts`. The underlying command is `prune-iteration --directory RUN --iteration N --analysis-delivered`. It refuses unfinished iterations/evaluations and missing reports. Imported external evidence is never deleted.

Pruning removes per-game A/B `.log` and action-record `.json` files and redundant match-wide logs. It retains numeric game/match/evaluation results, metadata, pairing seeds, identities, sideboarding, decisions, AI versions and the delivered report. Perspective headers remain marked `actions-pruned`; attempts to read them as detailed reports fail explicitly.

`retention.json` journals expected file hashes and replacement metadata before deletion. A retry verifies remaining files, finishes the journal, rechecks unchanged scores and updates evaluation evidence hashes. The report digest and delivery acknowledgment are retained; completed pruning is idempotent. Completion releases the next diagnostics/ranking stage. Navigation shows pruned details without broken log links. No pruning is due before iteration 1 completes. Future agents analyze new losses and use delivered analyses for cached evaluations.

For an explicitly requested baseline cleanup, use `prune-baseline` after delivering `baseline/loss-analysis.md`. It preserves iteration progress and requires completed baseline evaluations.

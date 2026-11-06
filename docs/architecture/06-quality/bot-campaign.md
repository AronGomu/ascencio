# Multi-deck improvement campaigns

The Linux `bot:campaign` supervisor reuses the Rust evaluator, its real frozen engine bridge, shared generalist strategy factory, legality, four-game match lifecycle and XML evidence. The prerequisite change to ARO2-1 adds optional `<opponent_deck><path>…</path></opponent_deck>` to evaluation XML; omission keeps identical-deck mode. Manifests record both exact decks and hash them into run identity. Each actor sideboards its own multiset.

## Configuration and launch

Use Node 26+, Cargo, libxml2 and bubblewrap. The installed Codex CLI and existing authentication are needed for the supplied agent adapter. Authentication is mounted read-only and is never copied into campaign evidence. Remote CI is disabled; all validation is local.

A JSON config declares `evaluation` (existing evaluation XML, with production starting orders), `output`, `decks` (array of stable `id`, YDK `deck`, self-contained initial `strategy`, and scalar `config`), `agent`, `bug_agent`, `checks`, `recovery_checks`, `command_inputs`, `rounds`, `matches`, `max_games`, `max_wall_ms`, `max_bytes`, `agent_timeout_ms`, `evaluation_timeout_ms`, `check_timeout_ms`, `recovery_timeout_ms`, `max_retries`, and `max_fixes`. File paths resolve relative to the configuration. Command argument paths should be absolute. Declare transitive command dependencies in `command_inputs`.

`matches` defaults to 10; use 100 rounds for acceptance. A smoke run uses fewer rounds and is not acceptance. The match count, roster, strategies, rules, content and commands are fixed before launch. At least two decks and usable nonidentical packages are required. No generated seed schedule or parallel games are used.

```sh
npm run bot:campaign -- --config /absolute/path/campaign.json
npm run bot:campaign -- --config /absolute/path/campaign.json --resume
```

The standard improvement command is `["/absolute/node", "/absolute/scripts/bot-campaign/codex-agent.ts", "gpt-6.1-sol", "low"]`. Agent settings are configurable before launch. The bug command uses the same adapter with exactly `gpt-6.1-sol`, `high`. Required model unavailability causes an incomplete campaign; there is no silent substitution.

Use `scripts/bot-improvement/check-strategy.ts` with Node's `--experimental-vm-modules` flag as a trusted syntax/module check, plus task-specific checks as needed. Recovery checks must include the relevant evaluator and bot-contract regressions. The supervisor exposes `BOT_STRATEGY` and `BOT_CANDIDATE` to checks. User-defined commands are trusted configuration and must not be agent-authored.

## Packages and agents

One logical identity and persistent Codex session are created per deck. The session's request is a durable handoff: fixed deck, accepted package, previous proposals and outcomes, ranking references and a compact index into complete actor-relative reports. Subsequent rounds resume that session. Each proposal has an isolated writable directory; source files are read-only. The campaign archive is hidden and only that deck’s actor-relative reports, own package sources and session/handoff directory are exposed; opposing reports, privileged diagnostics and other sessions are inaccessible. The adapter has separate persistent session storage. A no-change response with a reason is valid.

A package contains `strategy.mjs` and scalar configuration. Campaign XML transports configuration as a JSON scalar envelope so numeric and boolean types survive the evaluator’s XML parser; native simulator callers pass the original typed configuration. `__campaign_package_json` is reserved for this transport. It exports `createStrategy(dependencies, configuration)`, optionally `selectCounts` and `sideboard(input, configuration)`. The trusted bridge supplies only card metadata, delegates to the shared bot and preserves shared selection, legality, response validation and bounded repetition. The same factory implements the simulator's `BotModule` contract. An accepted archived `bot.mjs` and its `package.json` configuration can be loaded through that contract; it is not automatically installed as a new UI opponent.

All package content hashes are global; identical source/configuration are deduplicated. Deck-specific lineage records first creation, parent, round, proposal, session, rationale and checks. Rejected packages remain eligible for later ranking when valid. Ranking membership never replaces the active incumbent.

An existing response file is not a finalized proposal. Failed, truncated, malformed or fabricated responses remain in their attempt directories and permit bounded replacement using the same logical agent/session. Once the supervisor validates the response and archives its package, it checkpoints that immutable proposal before trusted checks; resume finishes that proposal instead of requesting a second valid one.

## Rounds and statistics

Each round freezes its epoch and opponent pool. Incumbents run diagnostic gauntlets first. Each deck then returns at most one proposal. Candidate and incumbent each receive a fresh, equally sized gauntlet against the **intersection** of their eligible opponents. Identical packages are excluded; same-deck opponents must be strictly older than both versions. There is no separate permanent baseline benchmark.

Each four-game match is a cluster, preserving pre-side A/B starts followed by post-side A/B starts. Cluster score is wins divided by four; draws contribute zero wins and remain in the denominator. Aggregate weights are equal per opponent deck and then per version within the deck. The independent fresh-sample difference uses a two-sided Hoeffding 95% interval:

`radius = sqrt(log(40) / 2 * sum(weight² / candidate_matches + weight² / incumbent_matches))`.

Weights and counts are fixed before observing outcomes. This bound permits arbitrary dependence within a match and does not collapse at zero empirical variance. Empty, incomplete or mismatched conditions are invalid. Promote only when `candidate_score - incumbent_score - radius > 0`. Otherwise reject. No adaptive additional samples, minimum percentage-point target, or campaign-wide confidence claim is made.

Every ten completed rounds, at completion and after a shared fix, ranking re-evaluates **all valid archived versions**, including rejected ones, against the frozen current pool. Versions within each deck are ranked using their common eligible-opponent intersection. Up to three highest scores are retained, breaking exact ties by ascending content hash. Own-deck exclusions can remove all own versions from this common ranking support; exclusions and conditions are recorded explicitly. No incomparable raw rates compete.

An empty promotion intersection produces the durable outcome `unassessable_no_common_opponents`, with no score and no incumbent change. If a ranking refresh has no common eligible opponents for a deck, it records every considered version and exclusion, reports `unassessable_retained_previous_pool`, and retains that deck's previous pool with its provenance. It does not assign scores or claim a new ordering. Future refreshes reconsider the entire archive under the then-current pool. This predeclared policy permits cross-deck duplicate packages without identical-package matches or a permanently blocked round.

## Checkpoints, failures and evidence

The supervisor holds a campaign lock and schedules one evaluator child at a time. It reserves games atomically before starting a batch. Interrupted attempts are retained, consume budget, and have explicit superseding attempts. Completed batches are reused on resume. Final decisions, incumbent updates and round completion are one checkpoint transition, after evidence files and required rankings persist.

Evaluation failures quarantine the condition. A dedicated Sol 6.1 high agent diagnoses the retained evidence at a process boundary. Transient conditions receive bounded retries. Shared source patches are restricted to `scripts/bot-evaluation/recoverable-strategy.mjs`, a self-contained scoring policy bundled inside the untrusted bot VM. It receives only actor-relative inputs and choice scores. Host, legality, contracts, sideboarding validation and information filtering are outside the writable recovery surface. Bugs in those protected components cause an explicit incomplete campaign; recovery cannot weaken their boundaries. Frozen vendor, campaign rules and deck lists cannot be patched. The supervisor checks exact patch paths, applies the policy patch centrally, validates its isolated module, runs configured regression commands, and rolls back failed validation. Successful behavior changes increment the epoch, refresh rankings and rerun active-round comparisons under the new identity. Earlier scores are never combined with the new epoch.

Cancellation (`CANCEL` in the output or SIGINT), wall/storage/game budget exhaustion, unresolved bugs and exhausted retries produce status `incomplete` and a retained checkpoint. Remove a cancellation marker before resuming. On resume, resource ceilings (`max_games`, `max_wall_ms`, `max_bytes`, `max_retries`, `max_fixes`) may only increase; each extension is retained and consumed resources are never reset. Any other configuration or source identity mismatch is rejected rather than silently continuing a different experiment. No evidence is deleted to meet storage limits.

Interrupted bug diagnosis is distinct from an explicit unresolved conclusion. Each bug retains its logical session, per-attempt artifacts and bounded attempt count. Pending diagnosis resumes or receives a replacement attempt before any further evaluation reservation. Explicit unresolved conclusions stop the campaign; failed or interrupted diagnosis may retry within `max_retries + 1` total attempts per bug. Interrupted patch transactions roll back before diagnosis resumes.

`configuration.json`, immutable `versions/`, per-attempt `evaluations/` XML and logs, `proposals/`, persistent `agents/`, `recovery/`, round records and ranking records retain the evidence. `report.md` links final packages and comparable decisions, labels pools and epochs, and reports resource use. A changing-pool score is never presented as a fixed-benchmark learning curve. Zero promotions is a valid operational outcome; only 100 completed rounds with final decisions and ranking satisfy acceptance.

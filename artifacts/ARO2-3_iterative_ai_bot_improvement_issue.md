# Iteratively improve all AI bots through an autonomous multi-deck campaign

## Goal

Build a reusable orchestrator that improves deck-specific AI bot scripts through repeated real-engine evaluation, evidence-driven code changes, and objective promotion decisions.

The orchestrator accepts a configurable roster of decks and completes an initial **100-round campaign**, with one long-lived improvement agent dedicated to each deck.

The purpose is to validate the autonomous improvement system and measure each bot’s individual progress. There is no required number of successful improvements, competitive-strength target, or guarantee that every round improves a bot.

Once launched, the campaign runs without human approval prompts. Preserve every bot version and its evaluation evidence.

## Dependencies and ownership

### ARO2-1 — Evaluation runner and evidence

Reuse ARO2-1’s real-engine execution, shared bot contracts, watchdogs, four-game match lifecycle, sideboarding integration, and XML evidence.

ARO2-1 currently specifies identical input decks for both players. Extend the existing runner to allow each player to receive an independently declared fixed deck, while preserving its same-deck mode.

Do not introduce another duel runner or incompatible evidence format.

### ARO2-2 — Generalist baseline

Reuse ARO2-2’s policy extension points, legal-response handling, permitted observations, operational safeguards, and runtime integration.

ARO2-2’s required 60% win rate against random play is not an acceptance threshold for this campaign.

### ARO2-11 and deck-specific tickets

Inspect ARO2-11’s bounded mirror-match improvement loop before implementation. Reuse or extract applicable capabilities rather than duplicating them.

ARO2-3 owns:

- Multi-deck campaign orchestration.
- Dedicated agent lifecycle.
- Immutable version archive.
- Historical opponent selection and ranking.
- Promotion decisions.
- Autonomous recovery.
- Human-facing campaign report.

Record prerequisite changes assigned to earlier tickets explicitly.

## Campaign configuration

Before launch, retain a configuration declaring:

- Deck roster, stable identifiers, exact Main/Extra/Side Deck contents, and initial bot packages.
- Rules, pinned content, shared runtime revision, and bot configurations.
- Improvement rounds: **100 for acceptance**.
- Matches per opponent version: **default 10**.
- Historical opponent limit: **up to three versions per deck**.
- Ranking refresh interval: **every ten completed rounds**, also at completion and after shared behavior-changing fixes.
- Scoring, ranking, tie-breaking, and statistical procedures.
- Agent settings, watchdogs, timeouts, retry limits, storage limits, and campaign resource budget.

The match count is configurable before launch and fixed throughout the campaign. Do not add matches adaptively when results are inconclusive.

Support a variable-sized roster rather than hard-coding eight decks. Validate before launch that the roster and available versions provide usable comparisons.

## Bot packages and allowed changes

Each deck has one accepted **incumbent bot package**, containing play strategy, sideboarding strategy, and configuration.

Play and sideboarding may use separate modules, but form one versioned package promoted or rejected together.

Improvement agents may modify only their deck-specific strategic behavior. They must not:

- Change the fixed input deck list.
- Duplicate or bypass shared legality, response validation, or safeguards.
- Change evaluation, scoring, opponent selection, or promotion rules.
- Read concealed opponent information or privileged engine state at runtime.
- Change the frozen engine, loader resolution, or vendor manifest.

Legal sideboarding may redistribute cards within the declared deck through the shared contract. It cannot introduce cards or optimize the input deck list.

Accepted packages must remain usable by the actual duel simulator.

## Dedicated improvement agents

Create one fresh agent per deck at campaign start and keep it long-lived across rounds.

Each agent receives:

- Its fixed deck definition and accepted package.
- Complete reports for evaluations involving its deck.
- Promotion and ranking outcomes.
- Previous proposals and rejected attempts.
- A compact evidence index linking to specific games and decisions.

Other agents’ private conversations are not required.

Each round, each agent returns at most one proposal containing:

- The proposed package.
- Diagnosis and intended improvement.
- Supporting game and decision references.
- Description of play and sideboarding changes.
- Targeted tests and results.

An explicit **no-change** response is valid with an explanation.

Continue subsequent improvements from the accepted incumbent, retaining lessons from rejected proposals.

Persist handoffs sufficient to recover a lost session or exhausted context. Replacement sessions retain the same logical deck-agent identity and history; do not routinely replace agents every round.

## Round lifecycle

A completed round includes:

1. Freeze the environment and historical opponent pool.
2. Evaluate accepted incumbents against eligible opponents.
3. Resolve evaluation failures at the phase boundary and rerun invalidated comparisons.
4. Distribute valid evidence to deck agents.
5. Collect proposals or explicit no-change responses.
6. Evaluate proposals and incumbents in fresh, equal-sized promotion batches against the same frozen pool.
7. Resolve failures and rerun invalidated comparisons before promotion.
8. Promote qualifying proposals; reject regressions and inconclusive results.
9. Perform any scheduled ranking refresh for subsequent rounds.
10. Persist the completed round and recovery checkpoint.

Do not change opponent membership during a round. Finishing earlier must not give an agent a different evaluation pool.

Complete **100 rounds**, including evaluation and resolution of the final proposals. Untested changes generated after the final gauntlet do not count as completion.

## Match execution

Preserve ARO2-1’s four-game format:

| Game | Deck configuration | Starting player |
| --- | --- | --- |
| 1 | Original, pre-side | A |
| 2 | Original, pre-side | B |
| 3 | Post-side | A |
| 4 | Post-side | B |

Each bot uses its own declared deck and sideboarding strategy.

Execute **one game at a time across the entire campaign**. No parallel match scheduling or Worker pool.

Improvement agents may work concurrently after reports are ready. Isolate proposals so agents cannot overwrite one another’s work.

Use production shuffle/random behavior. Retain starting-order evidence and existing diagnostic facilities without requiring deterministic seed schedules.

## Historical opponent pool

For each opponent deck, retain up to its **three strongest measured historical versions**.

“Strongest” means highest-scoring under the declared common ranking protocol—not most recent or highest raw win rate earned under unrelated conditions.

Rules:

- Archive every version regardless of pool membership.
- Use fewer than three opponents when fewer eligible versions exist.
- Include strictly older versions of the evaluated bot’s own deck.
- Never schedule a package against its identical version.
- Skip own-deck comparisons when no eligible older version exists.
- Do not manufacture distinct identifiers for identical packages.
- Derive match counts from the roster and eligible versions.

Initial versions remain archived but are not permanent benchmark opponents. Do not schedule separate frozen-baseline evaluation.

### Ranking refreshes

Refresh rankings every ten completed rounds, at campaign completion, and after shared behavior-changing fixes.

At each refresh:

- Reconsider every valid archived version, including rejected proposals.
- Evaluate challengers against the current frozen top-three pool only.
- Use the configured match count and common scoring protocol.
- Apply consistent identical-version and own-deck eligibility exclusions.
- Compare rankings using common eligible opponent conditions; do not rank incomparable raw scores directly.
- Select up to three versions separately for each deck.
- Record scores, exclusions, tie-breaking, conditions, and ranking establishment point.

Ranking work grows with the archive and must be included in resource accounting.

Pool membership does not replace the incumbent. Previously rejected versions must pass the promotion rule before returning to active use.

## Scoring and promotion

### Primary score

For each opponent-version comparison:

**Game win rate = wins / all completed games.**

Draws remain in the denominator and are not wins.

Aggregate with equal weight per eligible opponent deck, then equal weight per eligible version within that deck.

Report pre-side and post-side results separately. Use combined four-game results for promotion.

Failures are not ordinary losses or draws. Do not silently omit them to establish a valid comparison.

### Promotion

For each proposal:

- Evaluate proposal and incumbent in fresh batches.
- Use the same frozen opponents, equal match counts, rules, content, and runtime revision.
- Apply the same eligibility exclusions to both.
- Do not compare a proposal’s current score with an incumbent score from another round or pool.

Promote only a positive improvement supported by a predeclared **per-comparison 95% confidence procedure**.

Before launch, specify and test the method, including treatment of four-game match grouping, opponent strata, draws, and insufficient or degenerate data. Agents cannot choose or modify it.

This does not require a five-percentage-point gain or establish campaign-wide 95% confidence across all promotions.

| Outcome | Action |
| --- | --- |
| Supported improvement | Promote the complete package |
| Regression | Reject; retain incumbent |
| Inconclusive | Reject; retain incumbent |
| Invalid or incomplete evidence | Resolve before deciding |

Do not increase match counts to obtain a preferred result.

## Autonomous bug handling and recovery

No human approval is required after launch.

For each distinct diagnosed bug, spawn a dedicated **Sol 6.1 high** bug-fixing agent. Record its execution identity. Do not silently substitute another model or setting if unavailable.

Deduplicate symptoms of the same root cause.

Apply fixes only at evaluation phase boundaries, never underneath running games.

On failure:

- Record complete evidence.
- Quarantine the affected matchup or failing condition.
- Continue unrelated work only when safe.
- Enter recovery immediately for campaign-blocking failures.
- Integrate shared fixes centrally.
- Run targeted regression validation.
- Rerun invalidated comparisons before using their results.

A shared behavior-changing fix starts a new **evaluation epoch**. Preserve earlier evidence, but do not combine pre-fix and post-fix scores as equivalent. Refresh rankings and rerun affected comparisons before continuing.

Frozen engine assets remain outside permitted fixes.

Enforce declared watchdogs, timeouts, retries, storage limits, and budgets. Exhaustion produces an explicit, resumable **incomplete** campaign—not approval prompts, infinite retries, or false completion.

## Archive and evidence

Store every package immutably with:

- Content hash and stable version identifier.
- Deck identifier and parent version.
- Play/sideboarding source and configuration.
- Creating round and agent/session references.
- Rationale and supporting evidence.
- Targeted test results.
- Promotion decision and statistical evidence.
- Runtime/content revisions and evaluation epoch.

Retain rejected proposals, failures, superseded rankings, fixes, and all match evidence.

Checkpoint scheduling and completed work atomically. Resume without silently omitting or double-counting evaluations. Preserve interrupted attempts and explicitly superseding reruns.

Do not silently delete evidence to satisfy storage limits.

## Human-facing campaign report

ARO2-1 retains responsibility for machine-readable evidence. ARO2-3 adds a human-facing report derived from it.

Include:

- How autonomous improvement operated.
- Configuration and completion status.
- Per-deck incumbent and proposal timelines.
- Attempted, accepted, rejected, and abandoned changes.
- Comparable candidate-versus-incumbent results, uncertainty, and decisions.
- Pre-side and post-side performance.
- Opponent-pool changes and ranking refreshes.
- Fixes, evaluation epochs, failures, and recovery.
- Match/game counts and resource costs.
- Final accepted packages and evidence references.
- Limitations of conclusions.

Do not present scores against changing pools as a fixed-benchmark progression. Label pool and epoch changes clearly.

Zero accepted improvements is a valid outcome: orchestration may succeed without demonstrating strategic improvement.

## Validation

Follow the repository’s targeted-test workflow. Cover:

- Configurable rosters, cross-deck execution, and preserved same-deck mode.
- Four-game matches, sideboarding, and sequential scheduling.
- Pool freezing, eligibility, identical-version exclusions, and first-round behavior.
- Ranking refreshes, archive reconsideration, comparable conditions, and tie-breaking.
- Weighted scoring, draws, confidence decisions, and inconclusive results.
- Rejected proposals preserving incumbents.
- Legality and concealed-information boundaries.
- Immutable archives, checkpoints, interruption, and resume.
- Agent recovery, timeouts, budgets, and bug deduplication.
- Evaluation epochs and invalidated-evidence reruns.
- Report traceability and actual simulator integration.

Establish operational defaults through a small smoke test before the acceptance campaign. Smoke tests and partial campaigns do not replace the 100-round run.

## Acceptance criteria

1. A reusable orchestrator accepts a configurable roster and reuses the existing real-engine evaluator.
2. Independently declared fixed decks work without breaking same-deck evaluation.
3. One long-lived logical agent per deck improves play and sideboarding from evidence.
4. Historical pools follow the declared top-three, refresh, freezing, and eligibility rules.
5. Promotion uses fair comparisons and the tested per-comparison 95% confidence procedure.
6. Regressions, inconclusive proposals, and no-change outcomes preserve incumbents and remain archived.
7. Bug handling, epochs, limits, and resumable recovery operate without approval prompts.
8. Every version and required evidence remain retained and traceable.
9. A **100-round real-engine campaign** completes, including final proposal decisions and ranking refresh.
10. Final accepted packages work in the actual duel simulator.
11. The human report explains outcomes and limitations without unsupported strength claims.
12. Targeted tests cover orchestration, scoring, boundaries, failures, recovery, and integration.

## Out of scope

- Deck construction or input deck-list optimization.
- Frozen engine or vendor changes.
- A separate duel runner, simulation-only policy, or new evaluation UI.
- External bot integration or permanent baseline benchmark scheduling.
- Parallel game execution.
- Guaranteed improvement, minimum promotion counts, or competitive-strength claims.
- Changes unrelated to campaign correctness or deck-specific strategy.

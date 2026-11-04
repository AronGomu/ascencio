Work on Linear issue ARO2-2:

Suggested branch name: neverismine/aro2-2-build-baseline-general-ai-bot

<issue identifier="ARO2-2">
<title>Build Baseline General AI Bot</title>
<description>
# <issue id="27dd9651-d611-4fd7-9174-81b019616548" label="ARO2-2" href="https://linear.app/arongomu/issue/ARO2-2/build-baseline-general-ai-bot" /> — Build Baseline General AI Bot

Team: aron

Project: Ascencio

Label: Improvement

Depends on: <issue id="4e54ebc6-193a-452a-b67f-29126c28a0cf" label="ARO2-1" href="https://linear.app/arongomu/issue/ARO2-1/aro2-1-sequential-headless-mirror-match-evaluation-and-bot-improvement" /> — Build a system where AI play legal matches against each other and extract match reports.

## Goal

Build one rough, deck-independent generalist AI bot. It is the reusable starting point for future deck-specific bots, not a competitive or fully optimized Yu-Gi-Oh! AI.

The bot must be slightly better than random play. A win rate of **at least 60% against the random bot is required for acceptance**. There is no additional competitive win-rate target or requirement to optimize it against strong opponents.

## Dependency on <issue id="4e54ebc6-193a-452a-b67f-29126c28a0cf" label="ARO2-1" href="https://linear.app/arongomu/issue/ARO2-1/aro2-1-sequential-headless-mirror-match-evaluation-and-bot-improvement" />

<issue id="27dd9651-d611-4fd7-9174-81b019616548" label="ARO2-2" href="https://linear.app/arongomu/issue/ARO2-2/build-baseline-general-ai-bot" /> depends on <issue id="4e54ebc6-193a-452a-b67f-29126c28a0cf" label="ARO2-1" href="https://linear.app/arongomu/issue/ARO2-1/aro2-1-sequential-headless-mirror-match-evaluation-and-bot-improvement" /> for legal bot-versus-bot execution and match-report evidence. Use that system to validate the baseline; do not create a separate evaluation runner for this issue.

Agree on the shared bot input, decision, configuration, and explanation contracts with <issue id="4e54ebc6-193a-452a-b67f-29126c28a0cf" label="ARO2-1" href="https://linear.app/arongomu/issue/ARO2-1/aro2-1-sequential-headless-mirror-match-evaluation-and-bot-improvement" /> before building the policy. Acceptance of <issue id="27dd9651-d611-4fd7-9174-81b019616548" label="ARO2-2" href="https://linear.app/arongomu/issue/ARO2-2/build-baseline-general-ai-bot" /> requires a working <issue id="4e54ebc6-193a-452a-b67f-29126c28a0cf" label="ARO2-1" href="https://linear.app/arongomu/issue/ARO2-1/aro2-1-sequential-headless-mirror-match-evaluation-and-bot-improvement" /> evaluator.

## What to build

### Generalist bot

* Choose only actions and responses permitted by the authoritative duel engine.
* Use simple, inexpensive, deck-independent priorities rather than random play alone.
* Handle every supported prompt, including mandatory selections, optional effects, targeting, attacks, phase progression, ordering, and constrained selections.
* Consume only the acting player's permitted observations. Do not inspect concealed opponent cards or privileged engine state.
* Keep the baseline independent of specific card IDs, deck lists, or archetypes. Deck-specific behavior belongs in later specializations.
* Provide understandable, machine-readable decision reasons suitable for the <issue id="4e54ebc6-193a-452a-b67f-29126c28a0cf" label="ARO2-1" href="https://linear.app/arongomu/issue/ARO2-1/aro2-1-sequential-headless-mirror-match-evaluation-and-bot-improvement" /> reports.
* Expose a clear way for later deck-specific bots to adjust or replace strategic decisions without duplicating prompt legality, response handling, or operational safeguards.
* Take inspiration from existing game AI approaches where useful, while keeping this baseline small and understandable.

### Random comparator

Build a comparator that literally uses randomness to choose its actions throughout a duel.

* For a single-choice prompt, choose randomly among the offered legal choices, without strategic scoring or action priorities.
* Randomize selections, selection counts where optional, ordering, allocations, targets, and other decisions whenever multiple legal responses exist.
* Enforce mandatory cards, selection bounds, required totals, allocation capacities, and other response constraints. These checks preserve legality; they must not introduce strategic preferences.
* Do not reuse the generalist or basic bot's strategic preferences, such as favoring summons, declining optional effects, choosing strong attackers, or preferring particular targets.
* When only one legal response exists, return it.
* Any controlled randomness used in tests must remain a test or diagnostic facility, not a fixed production shuffle schedule.

### Reuse and integration

The same generalist bot implementation must be usable by the <issue id="4e54ebc6-193a-452a-b67f-29126c28a0cf" label="ARO2-1" href="https://linear.app/arongomu/issue/ARO2-1/aro2-1-sequential-headless-mirror-match-evaluation-and-bot-improvement" /> evaluator and the actual duel simulator. Do not build a bot that exists only inside a test or a separate simulation implementation.

This means the duel runtime can instantiate and use the policy through the shared bot contract. It does **not** require a new bot-selection screen or other new UI for this issue.

## Validation

Use the <issue id="4e54ebc6-193a-452a-b67f-29126c28a0cf" label="ARO2-1" href="https://linear.app/arongomu/issue/ARO2-1/aro2-1-sequential-headless-mirror-match-evaluation-and-bot-improvement" /> evaluator and its reports to compare the generalist bot with the random comparator.

* Give both bots independent copies of the same declared input deck so deck strength does not determine the comparison.
* Use a declared batch configuration and balance the starting player between the bots.
* Record the deck, rules, bot revisions/configurations, game counts, wins, losses, draws, and failures in the evaluator's evidence.
* Calculate the generalist's win rate as its wins divided by all completed comparison games. Draws remain in the denominator and are not wins.
* Require a win rate of at least 60% for the declared acceptance batch.
* Do not silently omit crashes, hangs, invalid responses, unsupported prompts, or safety-limit breaches. A batch containing such failures cannot establish acceptance until they are resolved and validation is rerun.
* Treat this result as evidence for the declared comparison setup, not proof of competitive strength or equivalent performance with every possible deck.

The acceptance deck and batch size must be explicit in the <issue id="4e54ebc6-193a-452a-b67f-29126c28a0cf" label="ARO2-1" href="https://linear.app/arongomu/issue/ARO2-1/aro2-1-sequential-headless-mirror-match-evaluation-and-bot-improvement" /> run configuration and retained with the result; the 60% threshold must not be presented without that context.

## Acceptance criteria

1. One deck-independent generalist bot implements the shared bot contract and completes legal real-engine duels through <issue id="4e54ebc6-193a-452a-b67f-29126c28a0cf" label="ARO2-1" href="https://linear.app/arongomu/issue/ARO2-1/aro2-1-sequential-headless-mirror-match-evaluation-and-bot-improvement" />.
2. The same policy can be used by the actual duel simulator without a separate implementation.
3. Supported prompt families have legal responses, and the bot never reads concealed opponent information.
4. Later deck-specific bots have a documented extension point for strategic behavior without copying the shared legality and execution machinery.
5. A random comparator uses randomness for every decision with multiple legal responses, without strategic preferences.
6. The generalist achieves **at least 60% wins** against that comparator in the declared, starting-player-balanced acceptance batch, with the same input deck for both bots.
7. <issue id="4e54ebc6-193a-452a-b67f-29126c28a0cf" label="ARO2-1" href="https://linear.app/arongomu/issue/ARO2-1/aro2-1-sequential-headless-mirror-match-evaluation-and-bot-improvement" /> reports retain the comparison configuration, explicit result denominator, decision evidence, and any failures. The accepted batch has no unresolved execution or legality failures.
8. Targeted policy, constrained-selection, visibility-boundary, and runtime-integration tests cover the implementation. Follow the repository's targeted-test workflow; the full suite is not required by this issue.

## Out of scope

* Optimizing individual archetypes, card-specific combos, or particular deck lists.
* Deck construction or deck-list optimization.
* Competitive-strength claims or a win-rate target beyond the required random-baseline comparison.
* Building another match runner, report format, or evaluation UI instead of using <issue id="4e54ebc6-193a-452a-b67f-29126c28a0cf" label="ARO2-1" href="https://linear.app/arongomu/issue/ARO2-1/aro2-1-sequential-headless-mirror-match-evaluation-and-bot-improvement" />.
* Changing the authoritative duel engine or its frozen vendor assets.
</description>
<team name="aron"/>
<label>Improvement</label>
<project name="Ascencio"/>
<issue-relations>
<blocking><issue-ref identifier="ARO2-1" title="ARO2-1 — Sequential headless mirror-match evaluation and bot improvement reports"/></blocking>
<blocked-by>
<issue-ref identifier="ARO2-10" title="Build and optimize Goat Control through bounded mirror matches"/>
<issue-ref identifier="ARO2-8" title="Build and optimize Zombie Recruiter through bounded mirror matches"/>
<issue-ref identifier="ARO2-9" title="Build and optimize Tribute Control through bounded mirror matches"/>
<issue-ref identifier="ARO2-11" title="Build Warrior Toolbox and the bounded mirror-match improvement loop"/>
<issue-ref identifier="ARO2-4" title="Build and optimize Ben Kei OTK through bounded mirror matches"/>
<issue-ref identifier="ARO2-6" title="Build and optimize Gardna Burn through bounded mirror matches"/>
<issue-ref identifier="ARO2-3" title="Iteratively improve all AI Bots"/>
<issue-ref identifier="ARO2-7" title="Build and optimize Gravekeeper through bounded mirror matches"/>
</blocked-by>
</issue-relations>
</issue>

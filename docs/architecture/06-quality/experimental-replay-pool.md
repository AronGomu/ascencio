# Experimental replay worker pool

`bot:replays:experimental` distributes explicit loss-reason replay cases across a bounded set of worker slots. It is a test version: production reason orchestration still uses the existing single-case replay interface unless explicitly switched by the caller. Evaluation concurrency recommendations are not reused.

## Inputs and commands

The orchestrator first identifies the isolated variant and critical decision for every associated loss. The runner cannot infer critical decisions or loss causality from prose. Prepare one JSON request for all reasons to be tested together; paths resolve relative to that request:

```json
{
  "schemaVersion": 1,
  "reasons": [
    {
      "id": "preserve-removal",
      "strategy": "variants/preserve-removal/scoring.ts",
      "pairing": "session/evaluations/baseline/execution.json",
      "cases": [
        {
          "id": "loss-001",
          "game": "session/evaluations/baseline/matches/match-0001/native/games/game-1",
          "actor": "a",
          "decision": "0-decision-17"
        }
      ]
    }
  ]
}
```

Each reason supplies exactly one `strategy` or `bot`. Each case supplies a completed native-v2 game directory, losing actor and recorded critical decision; a case can override its reason's `pairing` file. IDs must be unique safe names. A lost game/actor can appear only once within a reason; it may appear under different reasons to compare independent variants. Modern authoritative game logs are required; the original single-case tool retains legacy-format support.

```sh
npm run bot:replays:experimental -- --request REQUEST.json --out RUN/replay-experiment --workers 2 --batch-size 1
npm run bot:replays:benchmark -- --request REQUEST.json --out RUN/replay-benchmark --worker-counts 1,2,4 --repeats 2
```

Use a new output directory. When source logs belong to a budgeted run, output must remain inside that same storage scope. Do not launch separate pools for each reason: collect their cases into one request. The pool excludes concurrent evaluation storage leases and takes one allowance for the combined work.

## Scheduling and isolation

Discovery validates all requested losses and decision IDs before launching games, then freezes each reason's variant with its transitive imports. Input logs, paired jobs and compiled variants are hash-pinned and checked before and after each case.

Workers claim small batches from a shared queue. Equal numbers of cases do not imply equal runtime; small batches let faster workers take more work instead of waiting behind a slow fixed partition. Default batch size is one.

One worker slot runs one replay CLI process at a time. Each case retains the existing original-policy control followed by a modified continuation. Both branches use strict prefix verification, recorded seeds and sideboarding. The replacement starts with fresh bot state at takeover, while original policies are warmed through the prefix. A process group owns the CLI and its engine children, enabling bounded cancellation.

A case reuses one engine host for its control and alternative branches. Every game still creates a new duel and fresh original bot instances; takeover creates a fresh replacement instance. Engine/content caches stay within that case. Cases remain separate CLI processes; there is no cross-case host reuse or control-result cache. A branch starts only after the preceding branch reaches balanced cleanup. Malformed protocol, host failure, timeout or owner termination fences that host from reuse.

`control.log` and `alternative.log` retain their complete typed protocol frames. Branch stderr files are snapshots of the shared case stream; `host-stderr.log` retains its bounded final contents after the host exits. The case does not finish or publish a pool completion receipt until the host is reaped. `result.json` and `attempts.json` retain their existing decision and attempt semantics.

## Resource accounting and failures

The source run's game-count allowance is not consumed: replay attempts are counted separately as controls and alternatives. The pool obeys its own wall deadline and any earlier source-run deadline. Defaults are 30 minutes for a pool and 630 seconds per complete case, with each existing branch retaining its original timeout capped at five minutes. `--max-wall-ms`, `--case-timeout-ms` and `--max-bytes` permit explicit test limits.

One parent storage lease bounds all worker output. Each worker gets an equal independent writer allowance, including full staging copies, with 16 MB reserved for coordinator artifacts. Fresh case processes reconcile only their worker's existing files once, then update counters locally. The coordinator reconciles that worker after the child exits. Writes outside a validated scope retain the normal shared quota gate. Parent Node/Rust writers count the lease instead of also counting the worker files; the total run cap remains authoritative. There is no cross-worker global scan for every replay log write.

An individual timeout is recorded as ignored, does not become a successful conversion, and permits remaining cases to run. Prefix mismatches, changed inputs and other failures stop admission and cancel active cases. Output exhaustion, owner-stop markers, SIGINT/SIGTERM or the wall deadline also stop admission. Owned process groups receive termination, with a kill fallback; all admitted work settles before the pool releases its lease. Partial outputs are retained.

The pool uses new output directories and does not implement resume or automatic retries. A hard coordinator crash can leave its quota lease held; verify that owned replay processes have stopped before operator recovery. Do not clear a live worker's lease. Normal failure and cancellation release the lease after shutdown.

## Evidence and interpretation

`execution.json` pins the case list. `progress.json` records worker assignments, statuses and times. `result.json` aggregates per-reason counts, branch attempts and raw conversions. Each case lives under `payload/workers/worker-NNNN/REASON/CASE/` and keeps both branch logs, frozen modules, machine results, diagnostics and a hashed completion receipt. Variants are stored under `payload/variants/`.

The benchmark compares outcomes, turns and selected critical choices across worker counts. It includes discovery, freezing, both continuations and durable evidence in elapsed time. Trials use fresh outputs and alternate count order when repetitions exceed one. Small unchanged-policy controls are useful correctness/performance fixtures, but do not establish an optimal production worker count or validate an improvement.

Conversion counts are raw observations. The orchestrator must still enforce reason eligibility, distinct-loss coverage, intended choice changes, the required number/percentage of wins and the full candidate evaluation. This command never edits an AI, promotes a rule or changes session acceptance state.

## Independent worker calibration

```sh
npm run bot:replays:calibrate -- --request REQUEST.json --out RUN/replay-calibration --repeats 2 --batch-size 1
```

This runs separately from `bot:matches:calibrate`. Both test every integer worker count from 2 through Node's available logical CPU count (respecting CPU affinity), without a 64-worker calibration ceiling. `--worker-counts 2,4` optionally narrows either sweep. Replay calibration requires at least one full batch of supplied independent replay cases per worker at the largest stage; match calibration similarly requires one full match batch per worker. Each repetition uses the same workload, alternating ascending and descending stage order.

The replay `benchmark.json` records measurements, stage medians and `workers`: the smallest count within 3% of the fastest median elapsed time. Gameplay fingerprints must match across every stage. The command reports a workload-specific recommendation; match calibration retains its separate saved recommendation. During improvement-run preparation, the [shared improvement policy](parallel-bot-session.md#replay-calibration-during-preparation) requires the orchestrator to apply one retry then exclusion to failed calibration stages, save the completed replay recommendation separately in `.cache/replay-workers.json`, and pin it for later replay jobs. More CPU stages and repetitions take proportionally longer.

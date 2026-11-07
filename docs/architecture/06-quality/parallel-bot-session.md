# Frozen parallel evaluation setup

ARO2-19 introduces `npm run bot:setup -- setup-request.json` (Node 26+). Run from the repository root. Setup validates and archives inputs; it does not play games or invoke agents. The existing `bot:evaluate` / `bot:improve` XML commands remain sequential; `bot:matches` consumes this session format.

The bundled reference includes its associated evaluation sidecar. After normal content staging and bot build, this single command needs no file edits:

```sh
npm run bot:setup -- --target assets/ai-bots/reference --seed experiment-1 --session .tmp/bot-session-1 --max-iterations 10
```

Repeat `--opponent BOT_FOLDER` for supplied opponents. Optional flags are `--reuse FIXTURE_DIRECTORY`, `--match-workers N`, `--analysis-workers N`, `--max-games N`, `--max-wall-ms N`, and `--owner-stop`. Flag paths are relative to the current directory; the alternative JSON request below resolves paths relative to the request file.

Each named bot folder owns an `evaluation.json` sidecar. This adds evaluation settings without changing the application `bot.json` package format. For example, alongside `assets/ai-bots/reference/bot.json`:

```json
{
  "schemaVersion": 1,
  "deck": "../../freeplay/decks/player.ydk",
  "content": "../../../tauri/resources/readable-content",
  "banlist": "../../freeplay/limits.json",
  "profile": "mr5",
  "policy": "generalist",
  "configuration": {}
}
```

`content` must name an existing compiled content root containing `card-library/critical.json` and `duel-core/critical.json`; supply the actual output of your content preparation. The example uses the current native staging root from `content:stage:native`. Decks use existing YDK parsing and the evaluator's section/alias/copy legality rules. Banlists accept current Freeplay `[{ "cardCode": 123, "deckLimit": 1 }]` data or the Rust evaluator’s `{ "defaultLimit": 3, "limits": {} }` format; archives retain the original bytes and normalized evaluator rules. Target and opponents must resolve identical content, banlist and profile. A package requires its existing `ai/` source and `dist/` WASM, a supported policy and validated bounded executable exports. Setup validates its `create` response with the existing preemptible WASM transport and actual card/configuration inputs; this executes no decisions or matches. Native executables are intentionally not selected by setup.

For a TypeScript evaluation bot, replace `policy` with `module`: either `builtin:basic`, `builtin:generalist`, `builtin:random`, or a folder-relative source module exposing the existing bot contract. Setup bundles dependencies, validates the factory and archives both the executable bundle and source inputs. An optional `strategy` names an import-free module exporting `createStrategy`, as produced by `prepare-strategy.ts`. Package source, executable and configuration are archived; no matches read live bot paths. For built-ins, retain the manifest’s `module` tag when selecting the factory, but load `bot.mjs` from the accepted/opponent archive as `Artifact.source`; never rebundle the live built-in module.

The request file uses paths relative to itself:

```json
{
  "target": "assets/ai-bots/reference",
  "opponents": [],
  "setupSeed": "experiment-2026-11-07-1",
  "session": ".tmp/bot-session-1",
  "stop": { "maxIterations": 10, "maxGames": 22000, "maxWallMs": 3600000 },
  "matchWorkers": 6,
  "analysisWorkers": 3
}
```

At least one positive stopping limit is required; `{ "ownerStop": true }` requests owner-controlled stopping. Worker limits default to six and three and must be integers from 1 to 64. They are requested bounds, not measured throughput. Setup seed is mandatory. Add `reuse` with an existing frozen directory to reuse it explicitly. A fresh setup whose deterministic destination already exists fails; reuse never regenerates seeds. Changed bot/deck/configuration/content/engine/profile/seed yields an explicit mismatch. Limits and session destination may change on reuse.

Stdout ends with one JSON object containing `session`, `config`, `fixture`, `identity`, `matches: 500`, and `games: 2000`. Consume the final line when calling through npm. `evaluation.json.fixtures` records the bot-relative durable fixture path and identity. The fixture store is `<target>/evaluation/fixtures/<identity>/`, independent of `.tmp` sessions.

## Artifacts and identities

`session-contract.ts` is the versioned TypeScript contract. JSON hashes are SHA-256 of the exact `JSON.stringify` representation produced by setup; file hashes cover exact bytes. The frozen manifest's identity excludes its own `identity` field. Hashes detect corruption and drift, not malicious rewriting of the manifest and its hash together.

```text
<target>/evaluation/fixtures/<identity>/
  manifest.json                  # Protocol, identities, 500-match schedule
  versions/initial/              # Initial target executable, sources, deck, config
  opponents/opponent-N/          # Frozen supplied opponent inputs
  content/<package>/critical.json
  engine/                        # Verified vendored engine and version manifest
  banlist.json
<session>/
  config.json                    # Absolute fixture/accepted references, slots, limits
  state.json                     # Ready, iteration 0, accepted identity, empty progress
  iterations/                    # Later jobs own iteration evidence
  versions/                      # Later jobs own candidates and accepted snapshots
  matches/                       # Available for baseline evidence
  analyses/                      # Available for baseline analyses
```

Bot identities include executable/source, deck and scalar configuration hashes. Content snapshots include compiler/package versions; engine files are verified against the frozen vendor manifest before archiving. `inputsIdentity` binds bots, content, engine, banlist and profile. `frozen-setup.ts` exports `verifyFrozen(root)` to verify the manifest hash, archived file hashes and deterministic schedule. Treat these archives as read-only; verify again before each evaluation.

Setup acquires exclusive target/session locks, validates before writing final destinations, stages new directories and the configuration reference, then commits the reference and publishes the session directory by rename. Only a published session is ready. Ordinary failures remove new artifacts and restore the previous reference. Existing fixture/session directories are never overwritten. A process/power loss may leave staging directories or locks: inspect those, preserve published fixtures, and remove only abandoned locks/staging files before retrying. A durable reference may survive a crash before session publication; explicit reuse recovers it without changing seeds. This is a process transaction, not a cross-filesystem crash-atomic database.

## Consumer integration (ARO2-18 and ARO2-20–25)

- The runner reads `config.json`, verifies `fixture.identity`, and consumes the manifest schedule without regenerating it. Slots follow supplied opponent order, followed by `self`; round-robin allocation gives deterministic remainders. Self-play alone receives 500 matches; one supplied opponent receives 250 and self receives 250.
- Iteration preparation binds `self` once to an archived accepted version. Save that identity beside candidate/control identities in the iteration, keeping the shared manifest unchanged. Both evaluations use the same accepted self snapshot. The original target's deck and policy configuration remain frozen; only heuristic code may change.
- Games follow the Rust evaluator's four-game protocol: A starts games 1/3, B starts 2/4, sideboard once after game 2 using both actual pre-side histories. Decks must preserve section sizes and their combined multiset. Failed sideboarding fails the match; do not invent a deck or silently recover.
- Orders/seeds are in actor A/B coordinates. Map them into engine seat coordinates when B starts. `orders` stores exact main/extra orders for games 1/2; opening hands are the first five main cards. For games 3/4, apply exported `deckOrder(actualValidatedDeck, shuffleSeed)` to each player's actual post-side deck. This freezes the random transformation without predicting legal sideboard exchanges. Preserve each permutation's actual resulting deck hash as evaluation evidence.
- Pass all four decimal u64 `engineSeed` values even in programmed-order mode. Pass actor-specific u32 `botSeeds` to each fresh per-game bot, and `sideboardSeeds` to fresh sideboarding instances. Subsequent randomness advances those seeded streams normally; avoid clock/ambient random sources. The current host's programmed-order production seed and hardcoded experiment seed must be replaced by these fixture values in ARO2-18. For built-in Random, create `next = randomWords(String(botSeed))` once per instance and inject `() => next() / 2**32` through `createRandomBotModule`; it accepts no configuration keys. External TS modules must expose a seed through their scalar configuration or injected factory source rather than ambient `Math.random`; randomness validation belongs to candidate validation. Setup's stored streams alone do not make the current host replayable.
- Analysis jobs, aggregation and decisions should reference fixture identity, iteration, match `id`, game `number` and event references. Match completion/progress is mutable session/iteration data, never an edit to the frozen schedule. Promotion updates `state.accepted` only after validating evidence and archiving candidate bytes. Resume checks identities before continuing and retains completed evidence and stop budgets. No setup invocation starts any of these jobs.

Targeted setup coverage is in `test/tooling/bot-session-setup.test.ts`; use the `ascencio-tests` workflow. Real-engine replay verification belongs to the fixture-aware runner integration, since setup executes no matches.

## Execute frozen matches (ARO2-18)

```sh
npm run bot:matches -- --session .tmp/bot-session-1 --out generated/bot-runs/baseline --workers auto
npm run bot:matches -- --session .tmp/bot-session-1 --out generated/bot-runs/baseline --workers auto --resume
npm run bot:matches:benchmark -- --session .tmp/bot-session-1 --out generated/bot-tuning/run-1
```

The Node entry point verifies archived files and the 500-match manifest, prepares a JSON job, then invokes the existing Rust evaluator's `frozen` command. Rust owns the bounded pool and the existing `execution::play` / `execution::sideboard` real-core path. Each worker owns one reusable Node engine host; only independent matches overlap. The legacy XML commands retain their sequential behavior and schema. Internal `.job.json` files are prepared inputs; invoke the public npm entry point to verify archives before execution.

A setup session's `versions/initial` is the default target and accepted self snapshot. The runner does not require candidate-validation or iteration-preparation output. Later consumers pass `--candidate SNAPSHOT.json` and `--self SNAPSHOT.json` explicitly. Both use the exported `RunnerSnapshot` contract:

```json
{
  "schemaVersion": 1,
  "path": "./archived-version",
  "bot": { "identity": "...", "kind": "module", "module": "builtin:basic", "configuration": {}, "deck": { "main": [], "extra": [], "side": [] }, "files": { "bot.mjs": "..." } }
}
```

`bot` is a complete `FrozenBot`, not the abbreviated values above. Paths resolve relative to the override file. File hashes and bot identity are verified; deck, scalar configuration, kind, policy and module tag must match the frozen target. Override executable/source bytes may differ. Module bundles load verbatim; package WASM loads from the archived manifest, using the existing preemptible transport. Both self and candidate identities enter the execution identity. Candidate validation and promotion remain separate workflows. A stored `strategy.mjs` is source evidence; execution uses the archived executable, so candidate preparation must build the strategy into that executable.

The host consumes all engine seeds even with programmed orders, maps actor orders/seeds to starter seats, creates fresh bots per game and sideboarding, and derives post-side orders from the actual legally exchanged decks. Builtin Random gets the specified deterministic stream; package `create` receives the fixture u32 seed. Deterministic external modules remain responsible for exposing randomness through their factory/configuration as described above; arbitrary external ambient randomness cannot be validated by this runner. Actual initial orders and deck-configuration hashes are in the perspective XML, and `replay.json` records each game's canonical evidence and configuration hashes for comparison.

`--workers auto|N` is clamped by pending matches, setup's `limits.matchWorkers`, and usable CPUs. Cheap Linux physical-core topology is preferred, respecting affinity and cgroup v2 quota; other platforms fall back to available process parallelism. Auto uses `generated/bot-evaluation-machine.json` only for the same CPU/topology/OS/Node identity, otherwise falls back to one and requests retuning. Set up with `--match-workers 8` to permit every benchmark stage. Analysis workers remain independent.

Execution limits default to 60 s/game, 1 s/decision, 5 s/sideboarding, 200 turns and 20,000 decisions. `--limits LIMITS.json` supplies all five positive integer fields of `MatchExecutionLimits`; limits enter execution identity and remain identical across tuning stages. Session game/wall budgets apply per evaluation. `--max-games N` / `--max-wall-ms N` are explicit per-evaluation budget overrides, useful when a session's improvement-loop budget does not cover a standalone baseline/benchmark. A match reserves four games durably before dispatch; interrupted attempts retain that reservation on resume, conservatively preserving the cap. Wall accounting includes prior invocations, excluding time between invocations. Iteration limits belong to the iteration orchestrator. SIGINT/SIGTERM stop dispatch and terminate active game hosts at the existing deadline boundary; hard process death may require recovery of stale locks. The runner does not relax decision deadlines under contention.

```text
<out>.job.json                 # Verified prepared job, workers excluded from identity
<out>/execution.json           # Job + application/executable identity for resume
<out>/progress.json            # Sorted finalized IDs, reservation and wall accounting
<out>/matches/<match-id>/
  manifest.xml                 # Match input/runtime identity
  fixture.json                 # Exact slot, seeds, decks, archived executable references
  matches/<match-id>/           # Existing match.xml, player-a.xml, player-b.xml
  bugs/                        # Existing privileged diagnostics, isolated per match
  done.json                    # Commit marker hashing all match evidence files
<out>/attempts/                # Interrupted partial attempts retained before retry
<out>/summary.xml              # Existing aggregate metrics format
<out>/replay.json               # Canonical game hashes in deterministic ID order
<out>/result.json               # Actual counts, wall time, peak tree RSS, failures
```

A coordinator alone writes aggregate progress. Workers persist their own XML using existing XSD validation, file fsync, atomic rename and directory fsync. Completion is independent of numeric order; resume scans commit markers rather than a sequential watermark, verifies every file and canonical game hash, and schedules only unfinalized matches. Failed finalized matches remain evidence and yield exit code 2. Interrupted attempts are preserved and retried, without reusing partial mutable duel state. Corrupt committed evidence fails resume. A complete resume validates evidence without rewriting timing/results. Exclusive `.prepare-lock` and `runner.lock` directories prevent competing writers. After process/power loss, inspect ownership before removing abandoned locks or preparation temporary files.

The benchmark builds once, then executes stages 1, 2, 4, 6, 8 sequentially, with two full repetitions by default (`--repeats N`, minimum two). Every repetition uses all 500 matches / 2,000 games and normal evidence writing; there is no substitute simulator or unmeasured game warmup. Smaller machines record skipped stages. End-to-end command timing includes archive verification/preparation, cold hosts, all required evidence/summary/progress persistence and shutdown. Resume verification is outside that execution timing and checks every completed match. A stage is reliable only with exact totals, no failures/skips, valid evidence and canonical replay hashes matching the first repetition. `benchmark.json` preserves each run, speedups against one and the previous stage, memory and actual failure/timeout totals. Choose the smallest reliable stage within the larger of 3% or observed relative repetition spread of the fastest median; save a recommendation only when a reliable stage exists.

Linux peak memory is the sum of evaluator-process and descendant RSS sampled every 100 ms, including Node and WASM workers (threads share their process RSS). Shared pages may be counted in multiple processes, and sub-100-ms peaks can be missed. This is process-tree RSS, not allocator usage or a single-host sample; unavailable `/proc` measurements are zero and should not be interpreted as a measured peak on another OS.

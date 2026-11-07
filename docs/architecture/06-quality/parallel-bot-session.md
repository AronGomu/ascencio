# Frozen parallel evaluation setup

ARO2-19 introduces `npm run bot:setup -- setup-request.json` (Node 26+). Run from the repository root. Setup validates and archives inputs; it does not play games or invoke agents. The existing `bot:evaluate` / `bot:improve` XML commands remain sequential and do not yet consume this session format.

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

## Candidate validation (ARO2-21)

Run `npm run bot:validate -- validation-request.json` from the repository root (Node 26+). This standalone step takes no iteration or scheduling dependency. Paths resolve relative to the request file:

```json
{
  "schemaVersion": 1,
  "fixture": { "path": "target/evaluation/fixtures/<identity>", "identity": "<fixture identity>" },
  "accepted": { "path": "target/evaluation/fixtures/<identity>/versions/initial", "bot": "<full FrozenBot descriptor from manifest.target or a previous valid result>" },
  "candidate": "candidate-archive",
  "output": "validation-attempt-1"
}
```

`accepted.bot` is an object, represented above by a placeholder for readability. Pin it once when preparing an iteration. Copy the complete accepted archive to `candidate`, then edit only `strategy.mjs` for `builtin:generalist`, or `ai/src/generalist.rs` for the reference Rust generalist package. The TS strategy may be added to an initial built-in archive; generate its initial contents with `node scripts/bot-improvement/prepare-strategy.ts candidate-archive/strategy.mjs`. Candidate archives contain the `FrozenBot.files` payload tree and an optional root `frozen-bot.json` descriptor, without notes, Cargo targets, symlinks or new runtime/deck/configuration files. The descriptor is reserved metadata, never an entry in `FrozenBot.files`. When present in either input archive, its identity and full contents must match the pinned `accepted.bot`; the candidate descriptor continues to describe its accepted base while heuristic edits are pending. Descriptor corruption or a self-consistent replacement with different metadata/file hashes fails as an input error. Initial setup archives without descriptors remain supported. Other policies and arbitrary module/package layouts fail explicitly until they have a reviewed strategy boundary.

The validator verifies the frozen fixture and pinned accepted archive, captures submitted bytes, checks a second read for concurrent edits, and runs checks on that captured copy. Later edits to the live candidate do not affect validation. `submitted/` retains exact input bytes even when compilation fails; `candidate/` holds the compiled payload and a newly generated `frozen-bot.json` matching `result.candidate.bot`. The descriptor stays outside source/payload hashes and build/check inputs. Existing output directories are never overwritten. Keep failures and retry with a fresh output path. Output must be disjoint from all input trees and its parent must exist. Preflight/request errors print to stderr with exit 1; after output reservation, failures also produce structured evidence.

Stdout ends with `CandidateValidationResult` JSON (also `output/result.json`). Exit 0 means `status: "valid"`; exit 1 means invalid. `reasons[].category` distinguishes `scope`, `build`, `check`, and corrupt/inconsistent `input`. Valid results expose `candidate: { path, bot }`, where `bot` is a complete `FrozenBot` with source and compiled file hashes. `snapshotIdentity` hashes the exact submitted file map, including any descriptor retained as evidence; `sourceIdentity` hashes source and frozen non-executable inputs; `executableIdentity` hashes the generated executable file map. The result binds `fixtureIdentity` and `acceptedIdentity`. A consumer must reverify candidate file hashes before evaluation. No session state, accepted archive, fixture or bot-owned configuration is promoted or rewritten. For a prepared iteration, pass its `fixture`, `accepted`, and `candidate.path` directly into the validation request. After evaluation and acceptance, publish the complete validated `candidate.path` archive (including its generated descriptor) before updating `state.accepted` with the published path and `candidate.bot.identity`; the next preparation consumes it directly.

TypeScript compilation uses esbuild, the existing `check-strategy.ts` VM export check (with `BOT_STRATEGY_CONTENT` enabling a bounded factory check using frozen card metadata), and a wrapper around the fixture's archived generalist executable. Rust uses the existing locked release WASM compilation recipe, Cargo library tests, bounded WASM export/memory validation and the setup transport's `create` check with frozen cards/configuration. Command status, argv and bounded stdout/stderr are retained in JSON logs; each subprocess has a two-minute deadline. Source/executable identities remain separate after compilation. Checks do not play games or rank candidates.

The enforced boundary fixes decks, configuration, engine, response selection, projection and legality code. Import/ambient-API guards reject direct external-code and randomness escapes. These checks are deterministic structural validation, not a proof of arbitrary program semantics: reviewers still assess heuristic intent, information use and seed discipline; match correctness belongs to runner evaluation. No caller-supplied shell checks or editable allowlist expand the boundary.

The Rust success test requires the `wasm32-unknown-unknown` standard library and skips explicitly when absent; Rust failure-evidence coverage still runs.

Related local coverage: `test/tooling/bot-candidate-validation.test.ts`, `test/tooling/bot-candidate-session.test.ts` (actual setup → preparation → validation → promotion → next preparation, plus forged descriptor rejection) and `test/tooling/bot-session-setup.test.ts` via `ascencio-tests`.

## Iteration preparation

ARO2-20 adds `npm run bot:prepare-iteration -- --session SESSION --iteration N --runner-identity RUNNER_VERSION [--baseline RECEIPT]` (Node 26+). Paths are relative to the current directory. `N` is an explicit positive integer chosen by the orchestrator; reuse it to resume, increment it after a decision. Preparation does not advance state, stop budgets, or accepted references and executes no agents, validation or matches.

`iteration-contract.ts` extends the frozen schema without changing `FrozenSetup`. The command's final stdout line is JSON: `manifest` is its absolute path; the remaining fields are the manifest itself. It publishes `iterations/iteration-NNNN/manifest.json`, an `accepted/` snapshot, and a writable `candidate/` copy. IDs are unique within a session; the session path disambiguates sessions. Both control and self reference the same accepted snapshot. Supplied opponent slots and fixture identities come from the verified frozen manifest, never live setup paths. Candidate `basedOn` records its initial identity; `identity: null` explicitly requires ARO2-21 validation after editing. Preparation cannot claim a validated executable identity for future code. Validation publishes the new identity in its separate result; keep the preparation manifest's candidate binding unchanged.

The initial accepted reference resolves to the fixture target. Later `state.accepted` references must point to an archive containing `frozen-bot.json` with the existing `FrozenBot` structure and matching hashed files. Deck, kind, module/policy selector and scalar configuration must remain equal to the initial target. Preparation checks archived bytes and identity, but candidate validation remains responsible for heuristic-only changes and executable behavior. Promotion must publish an archive before updating `state.accepted`.

`comparisonIdentity` hashes fixture identity, control identity, ordered opponent slot/identity pairs (including self), and the explicit runner identity. Fixture identity already includes engine, content, rules, protocol, schedule, seeds and deck orders. The runner identity must change whenever executable runner semantics change. Candidate identity and iteration number are excluded: another candidate can reuse the same control evidence against identical comparison inputs. Changing the accepted bot also changes self and requires a new baseline.

Optional `--baseline` points to a `BaselineReceipt` produced after the runner has completed all four games of all 500 matches:

```json
{
  "schemaVersion": 1,
  "comparisonIdentity": "<iteration comparisonIdentity>",
  "status": "complete",
  "completedMatches": ["match-0001", "...all 500 unique IDs..."],
  "matches": {
    "match-0001": {
      "path": "matches/match-0001.json",
      "sha256": "<exact evidence bytes SHA-256>"
    }
  }
}
```

`matches` must contain exactly the fixture's 500 IDs. Each match must reference a distinct evidence path. Evidence paths are receipt-relative; absolute and parent traversal paths are rejected. This receipt is a completion attestation by the runner; preparation verifies coverage and byte integrity, not game semantics or acceptance quality. It introduces no runner command or implementation. ARO2-18 may adapt its evidence output to this receipt. Candidate validation consumes the prepared workspace and bindings as described above.

`baseline.action` is `reuse` only for a complete, intact receipt with the exact comparison identity. Otherwise it is `refresh`, with `missing`, `identity-mismatch`, `incomplete`, or `corrupt` as the reason. `plan.control` is correspondingly `reuse-baseline` or `evaluate`; `plan.candidate` is always `validate-then-evaluate`. Each evaluation has 500 matches / 2000 games. Rerun preparation after producing a receipt to refresh the returned plan.

A repeated invocation verifies fixed bindings and snapshot hashes, preserves candidate edits and existing evidence, and atomically replaces only the manifest's baseline decision and plan. Changed accepted or runner identities at an existing iteration number fail explicitly; choose the next number. Corrupt snapshots and conflicting destinations fail without overwriting evidence. A session-local exclusive `.iteration-preparation.lock` protects concurrent preparation; promotion must not run concurrently. New directories publish by staging and rename. Ordinary errors clean their lock and staging output, allowing retry. After a process/power loss, inspect and remove only abandoned locks/staging directories, then rerun the same number; published iterations remain authoritative. No partial destination is repaired silently.

Targeted coverage: `test/tooling/bot-iteration-preparation.test.ts` and the existing setup contract tests.

## Stop, resume and factual report (ARO2-25)

`npm run bot:session -- SESSION REQUEST.json` (Node 26+) reads a JSON request and prints one JSON result. The request file is cwd-relative; evidence references inside it are session-relative `{ "path": "...", "sha256": "..." }` pairs. `session-control-contract.ts` defines the actions and outputs' persisted source, `control.json`. Setup's schema-1 config/state and the frozen/iteration manifests remain unchanged. Control owns accounting and stop reasons; promotion owns `state.accepted`. Reports read the current accepted reference without promoting it. The extension lives alongside `session-contract.ts`; it changes neither `FrozenSetup` nor `IterationManifest`.

```json
{ "action": "plan" }
```

`plan` verifies frozen and accepted bytes, persists elapsed time/stopping reason, and returns `mayStart`, `iteration`, `accepted`, `completedGames`, `reservedGames`, `elapsedMs`, `running`, `cancel`, `remainingMatches`, `completedMatches`, `iterations` and `records`. `remainingMatches` lists uncompleted, unreserved IDs per role; control reuse still follows the iteration manifest's baseline plan. A stopped plan admits no new work. Every caller must inspect the returned stop reason and reservation. Exhausted budgets return a stopped plan; temporarily reserved capacity returns `reservation: null` without cancelling running work. Semantic validation, analysis, statistics and promotion remain ARO2-21–24 responsibilities.

### Orchestrator transitions

- Send `{ "action": "start", "iteration": 1 }` before preparation/execution. Admission charges one attempted iteration, including failed attempts. Numbers are consecutive. Retrying an active/interrupted iteration preserves its number and budget. Settled complete/failed iterations cannot restart.
- Send `{ "action": "stop", "reason": "interrupted" }` on orchestrator interruption. Owner requests use `reason: "owner-stop"`, or write `SESSION/OWNER_STOP`. Marker bytes identify that request. Stop polling returns running attempts in `cancel`; stop dispatching new jobs, ask the runner to cancel/settle, and retain its evidence.
- Send `{ "action": "continue" }` only for an explicit continuation. Owner stops additionally require the exact `ownerStopToken` returned by plan. Continuation requires all running attempts settled; it preserves accepted identity, iteration history, actual games and elapsed time. An acknowledged marker stays acknowledged until its bytes change. Use a new marker token for a new request. Exhausted limits remain exhausted.
- Send `finish` with `iteration`, `status` (`complete`, `failed`, `interrupted`) and an evidence reference after settlement. Complete describes the orchestrator checkpoint; it does not attest that 500 matches, validation, analysis or acceptance succeeded. Interrupted iterations can resume; complete/failed ones are terminal. Repeating an identical terminal update is harmless; conflicting updates fail.
- Send `record` with `iteration`, `kind` (`proposal`, `decision`, `comparison`) and an evidence reference to index an upstream artifact. One immutable reference per kind/iteration prevents duplicate decisions. The producing ticket owns that artifact's schema and meaning. Missing artifacts remain unavailable; control generates no judgment or comparison. Publish any validated candidate identity, comparison data and acceptance outcome through the producing ticket's artifact, then index that artifact here.

### Minimum runner interface for ARO2-18

Before launching **each match attempt**, call `reserve` with `iteration`, `role` (`control` or `candidate`), fixture match `match`, the validated `executableIdentity`, and the manifest's `runnerIdentity`. Launch only when `mayStart` and `reservation.launch` are true, using `reservation.attempt`. A null reservation means wait for capacity or stop according to the plan. Bind executable bytes through runner/validation checks; accounting does not validate a candidate. The same executable identity must serve the entire role/evaluation. Control identity must match the prepared manifest; runner identity and fixture binding must match too. Requested match concurrency is bounded by setup's `matchWorkers`.

Reservation holds four games against `maxGames`, atomically under the session lock. A repeated request returns the existing running or completed match with `reservation.launch: false`, without another reservation or launch authorization. The dispatcher retains attempt ownership. After a dispatcher crash, do not assume a running attempt is dead: establish subprocess termination, collect its checkpoint, and settle it before retrying. This interface coordinates admission/accounting; it does not provide subprocess ownership or kill processes.

The runner polls `plan` while working and stops launching games on cancellation/deadline. At process settlement, call `settle` with `iteration`, `role`, `match`, returned `attempt` number, `status` (`complete`, `failed`, `interrupted`) and `games: [{ "number": 1, "evidence": { "path": "...", "sha256": "..." } }]`. Each distinct completed game in that attempt needs an intact evidence reference; complete requires numbers 1–4. Interrupted/failed attempts may contain 0–4 completed games. Delivery is idempotent; changed settlements fail. Settlements remain permitted after stopping. Release unused reservations only after the runner confirms termination. Never settle guessed counts after a crash. Runner-local durable per-game checkpoints are required to recover actual counts; until recovered, the reservation remains outstanding and the report shows incomplete accounting.

An interrupted/failed match may retry under the same fixture ID with a new attempt number after settlement. A retry reserves four games and replays the whole match so sideboarding remains sequential. Previously played games remain charged; games replayed in another attempt also count toward actual resource use. Completed matches are unique per iteration/role and never rerun. Reused baseline games are not charged again. `maxGames` bounds recorded actual games plus outstanding reservations, not fabricated full evaluations. A resource limit reached mid-iteration preserves that partial scope.

`maxWallMs` charges elapsed wall time while an iteration is active, including time between polls and process downtime until interruption is recorded. Stopped idle time is excluded; cancellation latency remains charged until running attempts settle. This conservative clock cannot reset a consumed budget on restart; a backward clock does not reduce consumed time. Runner polling/cancellation bounds enforcement latency; this command itself cannot forcibly terminate running engines. Poll regularly and use subprocess deadlines. No hard real-time cancellation claim is made.

### Shared writes and recovery

`withSessionLock` in `session-lock.ts` acquires `SESSION/.session-state.lock`. Preparation, control and **promotion/state writers must use this same lock**, for short read/modify/publish transactions only. Preparation retains its older preparation lock too. Promotion must wait until the iteration is finished before changing the accepted reference; unfinished iterations remain bound to their starting accepted identity. Control writes only `control.json` and `report.json`, by staging/rename, preserving setup state and other producers' evidence. It never updates a decision or accepted identity itself. Configured stop limits are pinned at first control use; later changes fail rather than extending budgets. Start accounting before any execution: existing unaccounted progress fails and needs explicit migration, never zero initialization.

After a process/power loss, inspect stale locks and staging files and remove only abandoned ones after confirming all writers are gone. Published control data stays authoritative; retry identical requests. A running reservation survives process loss and cannot be resumed until its owner is reconciled as above. Filesystem renames are process transactions, not a power-loss database guarantee.

### Factual report

Send `{ "action": "report" }` to atomically write `SESSION/report.json`; stdout additionally includes `report`, its absolute path. It contains accepted version, fixture, configured limits, iteration statuses, attempts, completed games, outstanding reservations, unique completed match references, stopping reason, artifact references and integrity checks. `recorded` includes exact source text for intact proposal/decision/comparison artifacts and null for unavailable/damaged ones. These are quoted source records labeled as producer attestations; their statistical or strategic correctness is not inferred. Completed-game counts cover settled attempts only; running reservations explicitly indicate unreconciled work. Iteration accepted references preserve version history. With no records, the arrays are empty; no win rate, uncertainty, acceptance or completed evaluation is invented. Keep agent commentary in a separate artifact. Copy the resulting factual report to a requested report destination only after it exists.

Related tests: `test/tooling/bot-session-control.test.ts`, iteration preparation and setup tests.

## Match analysis jobs (ARO2-22)

`npm run bot:analyses -- SESSION REQUEST.json` takes cwd-relative session/request paths and prints one JSON result. Errors print to stderr with exit 1. `analysis-contract.ts` extends the existing contracts without changing frozen setup, iteration, validation or control schemas. This command never invokes models, evaluates matches, aggregates reports or decides acceptance.

Start with a sync request:

```json
{
  "action": "sync",
  "binding": {
    "iteration": 1,
    "role": "candidate",
    "root": "iterations/iteration-0001/candidate-run",
    "execution": { "path": "iterations/iteration-0001/candidate-run.job.json", "sha256": "<exact bytes hash>" },
    "proposal": { "path": "iterations/iteration-0001/proposal.json", "sha256": "<exact bytes hash>" }
  }
}
```

All evidence references are session-relative exact-byte SHA-256 pairs. Symlinks, absolute paths and parent traversal are rejected. `root` is an existing frozen runner output directory. `execution` pins its actual preparation job: schema 1, `identity`, `fixtureIdentity`, `candidateIdentity`, `selfIdentity`, and `matches[]` containing the frozen `match` and A/B `identities`. The full 500-match schedule must equal the frozen fixture, and opponent/self identities must equal the iteration bindings. Control jobs additionally match the prepared control identity. The orchestrator must supply the validated candidate's execution job; this consumer does not repeat candidate compilation or attest its heuristic validity. `proposal` retains the candidate heuristic change and rationale; a control job can reference a description of the unchanged control.

The `frozen-xml-v1` adapter follows the ARO2-18 worktree's actual `frozen_evidence.rs` format: `root/matches/<match-id>/done.json` pins `manifest.xml`, `matches/<match-id>/match.xml`, both `player-a.xml`/`player-b.xml` timelines, and any additional evidence files. The nested match directory is intentional. `fixture.json` is runner preparation: early smoke markers omit it, while newer markers hash it too. Both layouts are supported; when preparing packets its contents must equal the pinned execution job item, and its exact bytes are retained as a reference. No invented per-event JSON log or runner command is required. ARO2-18's final integration must retain this adapter format or explicitly version/update it. Parent integration review remains required.

Missing markers/files, malformed or changing bytes, missing completed-game timelines, mismatched identities and unlisted evidence files are reported in `unavailable` and excluded from new jobs. The adapter requires terminal records for games 1–4 and sideboarding, plus both player reports. A completion marker may finalize a failed match: retain its `failed`/`skipped` statuses, partial failure timelines and diagnostic files explicitly. Skipped games have no game evidence hash or invented events; failed games retain their hash. A match with no completion marker remains unavailable even when its XML is parseable. It checks file integrity and cross-document bindings, not the engine's internal game-evidence hash algorithm. Full semantic evidence validation remains the runner's responsibility. It reads hashes twice before publication; finalized producer files must thereafter remain immutable. Damage to already queued evidence appears in `integrity`, never as a successful completion.

Each immutable packet at `iterations/iteration-NNNN/analyses/<role>/packets/<match>.json` contains fixture/runner/execution/candidate/opponent identities, proposal and complete log references, game IDs/statuses/hashes, and actual timeline references `{ "game": 1, "perspective": "a", "sequence": 17 }`. Sequence values come from the player's existing XML `timeline/entry/sequence`, scoped by game and perspective; they need not be contiguous. One logical ID `<iteration>/<role>/<match>` survives retries. Baseline/control and candidate executions are distinct evaluations, even when fixture match IDs coincide.

`queue.json` in that directory retains all discovered logical jobs. At most `2 * analysisWorkers` jobs are pending or claimed; remaining finalized jobs wait in the durable backlog. At most `analysisWorkers` claims can run. Large XML discovery happens outside the shared state lock; publication and all queue transitions use `withSessionLock`, atomic staging/rename and immutable packet/report paths. No command rewrites accepted state, execution accounting, or another producer's evidence.

Dispatch and completion requests use the same entry point:

```json
{ "action": "claim", "iteration": 1, "role": "candidate", "owner": "analyst-dispatch-unique-1" }
```

A non-null `claim` returns the packet reference, attempt, owner and random claim token. Launch only after that durable claim returns. A repeated owner request returns its outstanding claim, recovering lost stdout without dispatching a second job. Use a distinct stable owner for each dispatch. Capacity exhaustion returns `claim: null`. Claims never expire automatically: after a crash, reconcile analyst termination first, then send `{ "action": "release", "iteration": 1, "role": "candidate", "job": "1/candidate/match-0001", "token": "<claim token>", "terminated": true }`. Reclaiming keeps the logical job and increments its attempt; old tokens cannot complete it. Until reconciliation, the claim remains outstanding and consumes capacity.

An analyst writes a JSON report, then the orchestrator supplies its hash with `{ "action": "complete", "iteration": 1, "role": "candidate", "job": "1/candidate/match-0001", "token": "<claim token>", "report": { "path": "reports/analyst-1.json", "sha256": "<exact bytes hash>" } }`. The required report shape is:

```json
{
  "schemaVersion": 1,
  "job": "1/candidate/match-0001",
  "packetSha256": "<claimed packet hash>",
  "sections": {
    "activation": { "text": "Observed activation or uncertainty", "evidence": [{ "game": 1, "perspective": "a", "sequence": 17 }] },
    "changedDecisions": { "text": "Counterfactual unavailable", "evidence": [], "unavailable": "No counterfactual trace was recorded" },
    "impact": { "text": "Observed impact and causal uncertainty", "assessment": "uncertain", "evidence": [{ "game": 1, "perspective": "a", "sequence": 17 }] },
    "consequentialPlays": { "text": "Factual consequential plays", "evidence": [{ "game": 1, "perspective": "b", "sequence": 18 }] }
  }
}
```

The example sequences are illustrative; reports must cite tuples from their packet. All four sections require nonempty text and an evidence array. An empty array requires a nonempty `unavailable` explanation. Impact assessment is `positive`, `negative` or `uncertain`. Every supplied tuple must resolve to an actual pinned timeline entry. The validator checks association, sections and reference resolution; it cannot prove factual accuracy, causal effect, or that consequential-play prose avoids strategic judgments. Those remain agent review criteria.

Valid reports are copied into immutable `reports/<match>-attempt-N.json` before queue completion is published. Repeating identical sync/completion requests is safe; conflicting bindings, packets and completed reports fail without replacing evidence. A crash between artifact publication and queue save leaves a reusable orphan artifact: rerun the identical request. After confirming all writers have terminated, inspect/remove only abandoned `.session-state.lock` and staging files as described above; never reset published queue state or claims to recover a lock.

Every response includes `ready`, `outstanding`, `missing`, `reports`, `expected`, `finalized`, `completed`, `complete`, and `integrity`; sync also lists unavailable matches. `ready` contains pending jobs, while `outstanding` includes waiting, pending and claimed jobs. `missing` separately lists fixture matches with no finalized job. `{ "action": "status", "iteration": 1, "role": "candidate" }` verifies stored packets, source bytes and reports. `complete` requires all 500 expected matches to have reports and no integrity failures. A stored completed count is accompanied by integrity failures if later damage occurs; it is not an assertion of report correctness.

Targeted lightweight coverage: `test/tooling/bot-match-analysis.test.ts` exercises bounded dispatch, deduplication, partial files, invalid reports, source damage, orphan publication and claim fencing. The adapter was also exercised read-only against ARO2-18's real finalized four-game smoke evidence (both player timelines); no analysis model was invoked.

## Execute frozen matches (ARO2-18)

```sh
npm run bot:matches -- --session .tmp/bot-session-1 --out .tmp/bot-session-1/evaluations/baseline --workers auto
npm run bot:matches -- --session .tmp/bot-session-1 --out .tmp/bot-session-1/evaluations/baseline --workers auto --resume
npm run bot:matches:benchmark -- --session .tmp/bot-session-1 --out .tmp/bot-session-1/benchmarks/run-1
```

The Node entry point verifies archived files and the 500-match manifest, prepares a JSON job, then invokes the existing Rust evaluator's `frozen` command. Rust owns the bounded pool and the existing `execution::play` / `execution::sideboard` real-core path. Each worker owns one reusable Node engine host; only independent matches overlap. The legacy XML commands retain their sequential behavior and schema. Internal `.job.json` files are prepared inputs; invoke the public npm entry point to verify archives before execution.

The runner prepares the initial iteration through `prepareIteration` when needed, using setup’s accepted snapshot. Existing prepared iterations are consumed through `--iteration N`; `--role control|candidate` binds admission and accounting. It does not require candidate-validation output for an initial accepted baseline. Later consumers pass `--candidate SNAPSHOT.json` and `--self SNAPSHOT.json` explicitly. Both use the exported `RunnerSnapshot` contract:

```json
{
  "schemaVersion": 1,
  "path": "./archived-version",
  "bot": { "identity": "...", "kind": "module", "module": "builtin:basic", "configuration": {}, "deck": { "main": [], "extra": [], "side": [] }, "files": { "bot.mjs": "..." } }
}
```

`bot` is a complete `FrozenBot`, not the abbreviated values above. Paths resolve relative to the override file. File hashes and bot identity are verified; deck, scalar configuration, kind, policy and module tag must match the frozen target. Override executable/source bytes may differ. Module bundles load verbatim; package WASM loads from the archived manifest, using the existing preemptible transport. Both self and candidate identities enter the execution identity. Candidate validation and promotion remain separate workflows. A stored `strategy.mjs` is source evidence; execution uses the archived executable, so candidate preparation must build the strategy into that executable.

The host consumes all engine seeds even with programmed orders, maps actor orders/seeds to starter seats, creates fresh bots per game and sideboarding, and derives post-side orders from the actual legally exchanged decks. Builtin Random gets the specified deterministic stream; package `create` receives the fixture u32 seed. External modules declaring a numeric `configuration.seed` receive the fixture u32 in a fresh configuration copy; other frozen configuration stays unchanged. Deterministic external modules remain responsible for exposing randomness through their factory/configuration as described above; arbitrary external ambient randomness cannot be validated by this runner. Actual initial orders and deck-configuration hashes are in the perspective XML, and `replay.json` records each game's canonical evidence and configuration hashes for comparison.

`--workers auto|N` is clamped by pending matches, setup's `limits.matchWorkers`, and usable CPUs. Cheap Linux physical-core topology is preferred, respecting affinity and cgroup v2 quota; other platforms fall back to available process parallelism. Auto uses `$XDG_STATE_HOME/ascencio/bot-evaluation-machine.json` (default `~/.local/state/ascencio/`) only for the same CPU/topology/OS/Node identity, otherwise falls back to one and requests retuning. Set up with `--match-workers 8` to permit every benchmark stage. Analysis workers remain independent.

Execution limits default to 60 s/game, 1 s/decision, 5 s/sideboarding, 200 turns and 20,000 decisions. `--limits LIMITS.json` supplies all five positive integer fields of `MatchExecutionLimits`; limits enter execution identity and remain identical across tuning stages. Session game/wall budgets remain authoritative across evaluations and retries. `--max-games N` / `--max-wall-ms N` are additional per-evaluation caps; they never extend the shared session budget. A match reserves four games durably before dispatch; interrupted attempts retain that reservation on resume, conservatively preserving the cap. Wall accounting includes prior invocations, excluding time between invocations. Iteration limits belong to the iteration orchestrator. SIGINT/SIGTERM stop dispatch and terminate active game hosts at the existing deadline boundary; hard process death may require recovery of stale locks. The runner does not relax decision deadlines under contention.

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

The benchmark builds once, then executes stages 1, 2, 4, 6, 8 sequentially, with one repetition and the first 24 frozen matches / 96 games by default (`--matches N`, 1–500; `--repeats N`, minimum one). Production `bot:matches` still defaults to all 500 matches / 2,000 games. Every repetition uses the same selected fixture prefix and normal evidence writing; there is no substitute simulator or unmeasured game warmup. Smaller machines record skipped stages. End-to-end command timing includes archive verification/preparation, cold hosts, all required evidence/summary/progress persistence and shutdown. Resume verification is outside that execution timing and checks every completed match. A stage is reliable only with exact totals, no failures/skips, valid evidence and canonical replay hashes matching the first repetition. `benchmark.json` preserves each run, speedups against one and the previous stage, memory and actual failure/timeout totals. Choose the smallest reliable stage within the larger of 3% or observed relative repetition spread of the fastest median; save a recommendation only when a reliable stage exists.

Linux peak memory is the sum of evaluator-process and descendant RSS sampled every 100 ms, including Node and WASM workers (threads share their process RSS). Shared pages may be counted in multiple processes, and sub-100-ms peaks can be missed. This is process-tree RSS, not allocator usage or a single-host sample; unavailable `/proc` measurements are zero and should not be interpreted as a measured peak on another OS.


### Shared accounting integration

`bot:matches` uses PR80’s `controlSession` admission interface through a persistent `runner-control-host.ts` bridge. Before each dispatch it reserves a four-game attempt; it settles only persisted completed game references after the worker’s handles/hosts have been released for that attempt. Poll `plan` every second while executing; `OWNER_STOP`, wall/game budgets and explicit interrupts stop admission and cancel active hosts. Every settlement remains permitted after stopping. The Rust coordinator serializes admission and aggregate writes. All shared session mutations use `.session-state.lock`; short collisions retry up to ten seconds. A separate `.match-dispatch-<iteration>-<role>.lock` owns the dispatcher for that role, without holding the shared transaction lock during execution.

Output must be inside the session so control evidence references are relative and intact. Cancelled partial match evidence moves to a stable attempt archive before settlement, preserving references across retries. A complete control evaluation emits `baseline-receipt.json` with the prepared comparison identity and hashed match commit markers. The runner leaves iteration `finish` to the orchestrator, which must settle it before promotion changes accepted identity. Benchmark repetitions call `finish` themselves and use isolated accounting sessions starting at iteration 1, preventing growing ledger size from biasing later stages; fixture identity, executable bytes, seeds and actual game hashes remain identical. The default five stages execute 480 completed games across five isolated run ledgers. Each starts with the same configured stopping limits and empty progress. The source session supplies frozen bindings and accepted identity; its `OWNER_STOP` is forwarded to the active run. Source gameplay accounting is retained unchanged.

After abrupt dispatcher loss, confirm its old dispatcher is gone and recover abandoned dispatcher/output locks before `--resume`. `owners.json` records Linux process start identities; resume terminates surviving hosts only when their saved identity still matches, before reconciling checkpoints. A running reservation is reconciled only from a validated persisted checkpoint; unverifiable or missing checkpoints keep accounting outstanding for explicit recovery. Complete output is integrity-checked and reused without another reservation. Owner-stop continuation still requires PR80’s explicit token acknowledgement. The discarded pre-integration performance run is retained separately and does not supply a measured recommendation.


### Match timing and subset measurements

`--matches 24` selects the same first 24 immutable fixtures at every concurrency; it never regenerates or edits the full 500-match schedule. A subset cannot publish a full baseline receipt. `latency.json` records each worker's elapsed match latency from before host initialization through four games, sideboarding, canonical validation and durable XML; admission queue time and final timing/commit-marker metadata are excluded. `averageCompletedMatchLatencyMs` averages only completed matches. `amortizedWallMsPerCompletedMatch` divides total wall time by completed matches; the benchmark replaces that value with its wider command boundary including preparation, shutdown and accounting finish. These are different measures under concurrency. One 24-match run per stage is a short local tuning sample; it does not establish full-scale throughput or a repeated-run noise estimate.

SIGINT/SIGTERM on the benchmark supervisor immediately signal active evaluation/build children and prevent new child launches. The supervisor then preserves the interrupted result and settles accounting. Source `OWNER_STOP` remains supported. The owner explicitly replaced the original full-size performance comparisons with this 24-match measurement; earlier full and interrupted baseline evidence is retained separately.

## Candidate/control aggregation (ARO2-23)

Run `npm run bot:aggregate -- aggregation-request.json` with Node 26+. Aggregation reads existing evidence without executing matches, agents, or promotion. Request-file-relative `session` and `output` name the session and a fresh result directory whose parent already exists. Evidence references inside the request are session-relative and SHA-256 pinned:

```json
{
  "schemaVersion": 1,
  "session": ".tmp/bot-session-1",
  "iteration": 1,
  "candidateIdentity": "<validated candidate.bot.identity>",
  "control": {
    "root": "iterations/iteration-0001/control-run",
    "execution": {
      "path": "iterations/iteration-0001/control-run.job.json",
      "sha256": "<hash>"
    },
    "receipt": {
      "path": "iterations/iteration-0001/control-run/baseline-receipt.json",
      "sha256": "<hash>"
    }
  },
  "candidate": {
    "root": "iterations/iteration-0001/candidate-run",
    "execution": {
      "path": "iterations/iteration-0001/candidate-run.job.json",
      "sha256": "<hash>"
    },
    "analyses": {
      "path": "iterations/iteration-0001/analyses/candidate/queue.json",
      "sha256": "<hash>"
    }
  },
  "output": ".tmp/bot-session-1/iterations/iteration-0001/aggregate-1"
}
```

`aggregation-contract.ts` extends the contracts without altering `FrozenSetup`, `IterationManifest`, or the existing `comparisonIdentity` calculation. `candidateIdentity` is explicitly pinned to the validator's output; aggregation does not certify heuristic validation. Both runner preparations must bind the prepared runner version, accepted self, identical fixtures, decks, opponent identities, execution limits and budgets. Control may come from an earlier iteration with that same comparison identity. Candidate must bind this iteration. Runner preparation identities are recalculated using the ARO2-18 fields, and the control identity must equal the prepared accepted identity. A supplied control receipt must cover the exact schedule and address each runner `done.json`. Receipts are optional so interrupted control runs can still be measured; baseline reuse still requires the complete receipt checked by iteration preparation.

The shared `analysis-evidence.ts` reader, `analysis-contract.ts` types and `analysis-report.ts` validator are reused from ARO2-22 (`origin/aro2-22-match-analysis`); this change does not introduce its scheduler or agents. The reader consumes the actual ARO2-18 `frozen_evidence.rs` layout: `<root>/matches/<match>/done.json`, `fixture.json`, `manifest.xml`, and nested `matches/<match>/{match,player-a,player-b}.xml`. Its optional `outcomes` check adds neutral winner/draw and perspective outcome consistency without changing the existing packet game shape. Completion markers pin exact file bytes and the preparation item. Missing or corrupt finalized matches are unavailable with explicit reasons, rather than silently disappearing. Failed/skipped games and sideboarding failures remain separate counts. Aggregate output records both execution identities and hashes of its named inputs. Numeric results follow sorted match IDs, independently of match completion order.

`analyses` is optional on either arm and uses the actual ARO2-22 queue format. Aggregation rechecks queue identity/coverage, each completed packet against finalized evidence, report hashes, required sections and event addresses. It records complete, pending and invalid report counts without interpreting report text. Absent queues are `not-requested`, never implicitly complete. `evaluationComplete` requires every scheduled match to have four completed games in both arms. `synthesisReady` additionally requires all candidate reports and every requested control report; an omitted control queue is allowed. Missing or invalid candidate reports cannot yield synthesis readiness. Reused control evidence can omit analysis or use a queue prepared for the current iteration.

`output/result.json` contains `overall`, ordered `perOpponent`, paired included/excluded match IDs, denominators, completeness, unavailable reasons and the method. `output/summary.txt` renders factual counts and estimates. Stdout ends with JSON paths and completeness. Exit 0 means all evaluation evidence and any requested reports are complete; exit 2 means structured partial results were written; exit 1 means incompatible inputs, corrupt pinned request/receipt, or publication failure. With no candidate analysis queue, exit 0 may still have `synthesisReady: false`. Existing destinations are preserved; rerun with a new output path after recovery. No timestamps or randomness affect results.

Descriptive game win rates divide target wins by all completed games; draws contribute zero wins and half a point to a separately reported score rate. They may include completed games from partial matches. Match win rates divide match wins (more target than opponent wins) by four-completed-game matches; equal wins are ties. Failed, skipped and unavailable games never become losses. Paired estimates include only match IDs with four completed games in both arms, with each match contributing its four-game mean. The estimate is the mean candidate-minus-control difference. Standard error is the sample standard deviation of those paired match means divided by `sqrt(n)`; the approximate 95% normal interval is `mean ± 1.96 SE`, untruncated. Below two paired matches, SE/interval are null; with none, the estimate is null. This respects within-match clustering and reports selection due to incomplete pairs explicitly. It assumes independent match clusters; small samples and dependence across matches limit the approximation. Overall results weight slots by their frozen scheduled match counts, not equally by opponent. Self is separately identified. No significance labels, heuristic recommendations or acceptance decisions are generated.

Related local coverage is `test/tooling/bot-session-aggregation.test.ts` through `ascencio-tests`. The optional `ARO2_AGGREGATION_RUNNER_SAMPLE` JSON file supplies `{ "session", "relative", "expected" }` directly to the shared finalized reader for read-only validation against retained real-runner evidence; `expected` contains match/execution/fixture/candidate/opponent identities and the actual preparation `item`. This smoke test executes no engine or Cargo build. Synthetic failure/recovery coverage alone does not establish a completed 500-match candidate/control run or end-to-end analysis integration.

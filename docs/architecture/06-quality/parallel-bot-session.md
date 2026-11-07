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

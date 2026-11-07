# ARO2-14 implementation status

This is an **incomplete experiment implementation**, not ticket acceptance or a
production runtime recommendation. The shared Rust core, saved reference workload,
replay, and live evaluator paths exist. Application integration remains outstanding.

## Implemented

- Unchanged TypeScript Basic/Generalist policies remain the reference and usable.
- `assets/ai-bots/reference/ai/` is one Rust crate implementing Basic, Generalist,
  and Random, compiled as both a native executable/library and a portable WASM
  module. Stable sorting, per-phase attempts, Basic loop detection, exact/at-least
  sum DP insertion order, tribute allocation, and counter allocation are preserved.
- Random control uses xorshift32 (13, 17, 5), unsigned 32-bit state, zero seed
  normalized to one, and draw divided by 2^32. Fisher–Yates draws are consumed in
  the same order as the unchanged TypeScript Random policy with injected RNG.
- `bot.json` declares identity, package version, contract version and relative
  source/WASM paths. The `ai/Cargo.toml` entry can later become a workspace without
  changing the JSON protocol. No native community plugin distribution is added.
- The evaluator accepts `experiment:native:basic`, `experiment:native:generalist`,
  `experiment:wasm:basic`, `experiment:wasm:generalist` and corresponding Random
  identifiers. The existing `builtin:*` path remains available. Its optional
  current-critical-snapshot loader does not modify the supplied content root.
- The shared Rust core has no engine handle, filesystem, network, or clock imports.
  It receives only the host's actor-relative observation, offered choices and
  immutable public card definitions. WASM imports are empty; linear memory is
  capped at 512 MiB. Inputs are limited to 64 MiB (sideboard histories are large),
  and decision choices to 4,096. These are **not execution-time limits**.
- A narrow projection regression fix handles an equipped token disappearing from
  the spell/trap zone. See the reference README for exact seed and deviation.

## Reproduce

Install Node >=26, Cargo/Rust with `wasm32-unknown-unknown`, and `npm ci`. The retained
build used Rust/Cargo 1.99.1; `dist/build.json` records exact toolchain and binary
hashes. This machine's default system Rust lacks the WASM target; an isolated
rustup toolchain was used, without changing user shell configuration.

```sh
node scripts/bot-experiment/build.ts
node scripts/bot-experiment/replay.ts native
node scripts/bot-experiment/replay.ts wasm
node scripts/bot-experiment/live.ts native /path/to/generated/readable-content-v1
node scripts/bot-experiment/live.ts wasm /path/to/generated/readable-content-v1
node scripts/bot-experiment/benchmark.ts 3
npm run test:context
npm test -- --tests test/tooling/bot-experiment.test.ts test/unit/duel-state-projector.test.ts test/unit/opponent-policy.test.ts test/unit/generalist-bot.test.ts test/unit/bot-contract.test.ts test/unit/bot-cancellation.test.ts
npm run vendor:verify
```

Replay and benchmarks use only the saved 40 games. Recorded-input replay (C2)
requires exact action-ID and sideboarding-exchange equality, retaining state
across decisions and resetting between games/matches. Its first divergence is
saved with game ID, decision offset, full input, expected and actual response.

The live commands are **C3 smoke checks**, separate from replay and timing. They
execute the same five seeded four-game matches per bot (20 games each), with the
real frozen engine, loading each bot, progressing state and performing real
sideboarding from the two actual live pre-side histories. The resulting live
decks feed the post-side games. Completion requires all 40 games, 20 sideboard
responses, and zero crashes, illegal decisions or unexpected fallbacks. The host
validates every response and rejects engine RETRY. The smoke verifier does not
compare action IDs, observations, outcomes or elapsed times against the saved
baseline. Its JSON evidence lists each completed game and runtime-failure counts.
No new seeds or additional decks are generated. Passing demonstrates these flows,
not exhaustive strategy coverage.

The current smoke commands exercise native Rust and WASM through the **Node
evaluator host only**. Browser WASM and native Tauri complete flows remain required
and unimplemented; C3 is therefore partial. No replay result substitutes for
those environment-specific smoke runs. Timing remains C9, and live smoke output
contains no performance score. Unexpected bot errors abort the experiment; no
fallback can count as success.

## Package and environment boundaries

Bundled source root: `assets/ai-bots/`. Each package contains `bot.json`, `ai/`, and
`dist/ai.wasm`; `build.ts` recreates the executable from the source and lockfile.
The native executable is a local build output under `ai/target/release/`.

The requested native installed-package directory is
`<Ascencio app-data>/ai-bots/`. **Loading, adding/removing/updating packages from
that directory is not implemented.** There is no package-manager UI or wizard.
No author should expect placing a folder there to affect this build of the game.
The evaluator loads a fresh Rust instance per game, pinning its executable for
that game. App-level package snapshotting between duels remains unimplemented.

WASM is exercised under Node. Browser delivery is not wired into Vite or the game;
a future implementation must serve bundled/explicitly hosted package bytes over
same-origin URLs, not assume browser access to arbitrary native directories.
Tauri development, packaged Tauri and browser gameplay still use the existing
TypeScript bot path. No UI changes or native plugin loading were made.

## Criterion inventory

All owners below are **ARO2-14 implementation**, except reviewer/integration work
owned by the parent. These statuses concern evidence, not permission to merge.

| Criterion | Status | Evidence / remaining required input |
| --- | --- | --- |
| C1 baseline | Verified with documented base deviation | `typescript-baseline.jsonl.gz`, `README.md`; 40 games retained before Rust implementation, plus prerequisite equipped-token projection fix. |
| C2 parity | Verified for saved scenarios | `native-parity.json`, `wasm-parity.json`: full recorded actions and sideboarding, lifecycle resets, zero unexpected fallbacks. No exhaustive strategy claim. |
| C3 live smoke | Partial | `native-live.json`, `wasm-live.json`: complete 40-game flows on each evaluator target with actual sideboarding, zero crashes/illegal decisions/fallbacks. Browser WASM and native Tauri complete-flow smoke remain missing. No action-ID equality or timing gate. |
| C4 runtimes | Partial | Shared Rust core and evaluator paths exist; browser dev, native dev, packaged app paths need implementation and validation. |
| C5 transport/isolation | Partial | Node native subprocess/WASM memory transports, permitted observations and frozen vendor; actual Worker-to-Tauri transport and enforceable execution limits missing. |
| C6 packages | Partial | Bundled manifest/source/WASM layout exists; installed package discovery, validation, browser delivery and app-level version pinning missing. |
| C7 recovery | Outstanding | Need traps/timeouts/invalid-decision fallback, development warnings/traces, silent production recovery, and forced-failure tests at app boundary. Evaluator currently fails closed. |
| C8 selection | Outstanding | Need independent Freeplay AI selection and Story per-deck requirements with actionable post-startup menu errors that block affected duels. |
| C9 performance | Partial | `evaluator-performance.json` measures identical saved decision workloads with variability; actual browser/Tauri transports, comparable cold startup/memory and complete duel throughput are missing. |
| C10 delivery | Partial | Commands, limitations, reference and measurements supplied. Parent owns fresh exact-head three-reviewer rounds and merge-gate establishment. No review or integration readiness claimed. |

The existing controller calls opponent policy synchronously inside the authoritative
engine advance loop. Completing C4/C5/C7 requires a deliberate asynchronous bot
boundary (or equivalent preemptible isolation) while preserving prompt ownership,
restore/dispose behavior and command serialization. Merely adding a WASM call
inside that loop cannot enforce a timeout. This work has not been hidden behind
a synchronous placeholder or counted as completed.

Remote CI was not run and is not a gate. No reviewers, PR, merge, ticket close,
or external messages were initiated by the implementation child.

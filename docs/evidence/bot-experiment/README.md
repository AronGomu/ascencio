# ARO2-14 reference workload

The immutable `typescript-baseline.jsonl.gz` contains five four-game matches each
for Basic and Generalist, against the fixed `builtin:basic` opponent, using only
`test/fixtures/decks/pre-gx-2005/pre-gx-2005-goat-control.ydk`. Each game alternates
policy seats; engine player 0 starts. Seeds are `[14000 + match*4 + game, 271828,
314159, 161803]`, repeated across the two policy runs. Rules are MR5.

SHA-256: `28b40b97976cd4986e016ff419488715ddf32129971f4fb951486bf56e8658d8`.
Capture completed before any Rust bot code was written. Bot sources and frozen
vendor are unchanged from `2e9489fb33b4d60cd4c9a541154362059c8f4bb7`.

One prerequisite projection correction was necessary: a Sheep Token equipped in
a spell/trap zone can disappear there. The base projector threw on seed 14003,
turn 16, card 73915052, MOVE from controller 1/location 8/sequence 3 to location
0. This is covered by the equipped-token regression in
`test/unit/duel-state-projector.test.ts`. No strategy or engine behavior changed.
Two preliminary captures failed on that error; a subsequent completed run hit
Node's maximum JSON string length while saving. The retained capture repeats
those same seeds using streaming JSON Lines. It is the sole reference artifact;
future iterations must replay it, not replace it or generate new match seeds.

Records are metadata, ready (bundled source and transitive source files), game
(request plus all host messages), and sideboarding (full request and response).
Every `captured_decision` carries the full permitted observation, prompt including
legal choices, configuration, selected IDs, and explicit empty random draws.
Basic and Generalist consume no randomness. Engine seeds, initial orders, deck
contents and digest, complete immutable card definitions, critical snapshot
SHA-256 digests/manifests, engine version and source revision are retained.

Instances reset per game and for sideboarding, matching the existing evaluator;
state persists across decisions within each game. Both pre-side games feed the
sideboard hook. No cross-match learned memory exists. The capture records both
seats, including the fixed opponent, to support complete live replay comparison.

With Node >=26 and installed dependencies, initial acquisition was:

```sh
node scripts/bot-experiment/capture.ts /path/to/generated/readable-content-v1
```

The command refuses to overwrite the saved artifact. Content roots are read-only;
no machine-specific path is needed when replaying the saved decisions. Detailed
capture I/O is not a bot performance measurement.

## Application transports and live smoke

See [package and runtime documentation](../../feature/rust-bot-experiment.md).
The release harness uses the same `loadBot`, nested WASM Worker, main-thread host
bridge and Tauri native commands as the application, plus the frozen real engine.
It deliberately supplies the saved seeds and one deck instead of using production
random engine seeds. It checks all 40 completions and 20 actual sideboard responses;
zero crashes, illegal responses and unexpected fallbacks are required. It does not
compare live action IDs. The initial application build is separately validated.

```sh
# Terminal 1: fixed, read-only critical inputs from your acquired content
node scripts/bot-experiment/serve-smoke.ts /path/to/generated/readable-content-v1
# Browser: http://127.0.0.1:4214/?runtime=wasm
# The server writes .tmp/wasm-runtime-smoke.json after all 40 games.

# Build a release Tauri host pointed at the instrumentation page (no remote CI).
node scripts/bot-experiment/stage.ts
TAURI_CONFIG='{"build":{"devUrl":"http://127.0.0.1:4214/?runtime=native"}}' \
  cargo build --release --features native-acceptance --manifest-path tauri/Cargo.toml
node scripts/bot-experiment/run-native.ts smoke wasm native
```

`run-native.ts` launches the actual Tauri webview with isolated app data, selects
one runtime at a time through `.tmp/bot-harness-config.json`, and retains outputs
under `.tmp/native-results/`. Native dev and packaged builds use the same host
commands. The CLI stops on failed results rather than treating fallback as success.

For separate measurements, use `run-native.ts benchmark` and
`run-native.ts throughput`. For browser runs, write
`{"mode":"benchmark","runtime":null}` (or `throughput`, `failures`, `smoke`, `memory`) to
`.tmp/bot-harness-config.json`, then reload the browser URL with `runtime=typescript`
or `runtime=wasm`. Run measured targets sequentially. Benchmark replays all saved
inputs: one warmup and three measured passes, then seeded Random overhead control
on the first saved game's inputs. Throughput executes the same seeded complete
flows with identical evidence handling; it is a separate result from C3 smoke.
`failures` executes real trapping and infinite-loop WASM fixtures to verify
preemption, outside the correctness workload.

Evaluator throughput uses:

```sh
node scripts/bot-experiment/live.ts typescript /path/to/critical-root --throughput
node scripts/bot-experiment/live.ts wasm /path/to/critical-root --throughput
node scripts/bot-experiment/live.ts native /path/to/critical-root --throughput
```

These run one bounded 40-game pass per target. The repeatable decision benchmark
reuses saved fixtures instead of expanding the game campaign. Timings exclude
fixture parsing and final evidence writes; evaluator command timings include its
normal streamed host evidence consistently on every path. Browser/desktop live
harness timings include in-memory permitted history collection consistently.

For a packaged-protocol instrumentation build, use the same fixture server and:

```sh
TAURI_CONFIG='{"build":{"frontendDist":"../.tmp/bot-smoke-web"}}' \
  cargo build --release --features tauri/custom-protocol,native-acceptance --manifest-path tauri/Cargo.toml
node scripts/bot-experiment/run-native.ts smoke wasm native
```

This bot-only build requires an absent/empty local game-content staging directory,
or correctly staged content matching the tracked trust anchor. Never remove shared
content or weaken its trust anchor. The retained packaged harness runs used an
empty checkout-owned game-content directory and explicit fixture-server content;
they do not establish full packaged application startup. See environment-blockers.md.

The `memory` mode enables cross-origin isolation and attempts
`performance.measureUserAgentSpecificMemory()` after the same 100 decisions.
A returned SecurityError is a failed measurement, even when the harness completes.
Native process-tree sampling is performed by run-native.ts after ten seconds;
process-memory.ts also accepts a PID and output path for a manual sample.

See validation.json for exact related validation commands, outcomes and retained
failure descriptions. Run with Node 26+, a Rust toolchain with wasm32-unknown-unknown,
and no remote CI. The test runner is intentionally limited to related files.

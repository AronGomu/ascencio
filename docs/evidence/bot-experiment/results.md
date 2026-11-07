# ARO2-14 measured runtime results

Keep TypeScript as the default for these workloads. The equivalent Rust bots are
slower in this experiment, and transport/copying costs dominate their computation.
The portable path is useful for Rust-authored packages; these measurements provide
no performance reason to switch the built-in policies to it or to native Rust.
This is a measured recommendation for the saved scenarios, not a language-wide claim.

Recorded-input parity matches 22,158 decisions and 20 sideboard responses on both
Rust targets. Separate live smoke completes 40 games per supported Rust path,
including browser WASM, Tauri WASM/native, packaged-protocol bot harness and Node
evaluator, with no runtime failures. Every run reuses the same five seeded
four-game matches per bot and one deck. C3 does not require live action equality.

## Actual release transports

All values below come from the production bot boundaries inside an optimized
instrumentation frontend. Browser uses Chromium 152/Electron 44; Tauri uses the
system WebKit webview. Compare within an environment. Native Rust includes the
actual Worker→main thread→Tauri IPC→child process round trip. WASM includes its
actual nested Worker transport, structured clones and linear-memory JSON copies.
TypeScript runs directly in the duel Worker, as it does in the application.

| Environment/path | Mean compute µs | Mean round trip µs | p95 round trip µs | First instance ms | Mean later instance ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| Browser TypeScript | 5.51 | 6.41 | 100 | 0.10 | 0.01 |
| Browser Rust/WASM | 10.39 | 296.90 | 400 | 86.70 | 75.29 |
| Tauri TypeScript | 4.12 | 4.44 | 0 | 0.00 | 0.01 |
| Tauri Rust/WASM | 11.12 | 328.97 | 1000 | 85.00 | 78.39 |
| Tauri native Rust | 6.51 | 494.34 | 1000 | 89.00 | 78.19 |

One complete saved-workload warmup precedes three measured passes (66,474 measured
decisions per path). Inputs are parsed before timing; reference checks and final
report I/O are outside the decision interval on every path. Instance creation
resets each game and is measured separately. Sideboard work is covered by smoke
and full-flow throughput, not mixed into the warmed decision samples. Raw JSON
reports retain min/max, standard deviation, median, p95 and per-pass variability.

Native compute uses Rust Instant nanoseconds; browser/WebKit compute uses
performance.now around execute, excluding prepare/serialize. WebKit's observed
1 ms quantization and Chromium's 0.1 ms quantization make single short decisions
imprecise (including zero samples). Means aggregate the whole saved workload;
do not interpret a zero first TypeScript instance as zero actual cost. First
instance includes package loading, Worker/process creation, compilation and card
initialization after the common content load. Later instances include fresh
per-game creation. OS/file/code caches were not forcibly flushed; these are
first-instance versus warm-session measurements, not claimed disk-cold startup.

Each actual-runtime report also includes Random as a lightweight control: the
first saved game's 599 decision inputs, xorshift32 seed 1, one warmup and three
passes. No extra engine games are generated for that control. Basic/Generalist
consume no random draws; Random consumes the specified reproducible stream.

## Memory and measurement limits

Tauri process-tree RSS snapshots use Linux /proc while each target is running.
They include the app, webview, network helper and bot processes; shared resident
pages may be counted twice. Native child RSS and WASM linear memory are separate
scopes, not directly comparable allocation metrics. Browser WASM linear memory
was 51,904,512 bytes per instance for the recorded workload.

Comparable browser-wide memory is **not available**: the isolated browser's
measureUserAgentSpecificMemory API throws SecurityError. The exact failed results
are retained; main-page heap was not substituted for Worker heap. This is an
outstanding C9 measurement, not a successful acceptance result. Full application
startup is also blocked by staged content/trust-anchor mismatch; the successful
packaged-protocol bot harness does not erase that C4 limitation. See
[environment evidence](environment-blockers.md).

## Evaluator comparison

The retained Node evaluator decision benchmark uses the same saved workload,
release Rust and minified TypeScript, one warmup and three repetitions:

| Path | Mean compute µs | Mean JSON/host round trip µs |
| --- | ---: | ---: |
| TypeScript | 2.72 | 57.34 |
| Rust/WASM | 5.96 | 137.47 |
| Native Rust | 4.73 | 118.71 |

These Node timings are not substituted for Tauri or browser latency. The older
Node cold samples have unequal construction scopes and are retained only as
diagnostics; use the actual-runtime instance measurements above for comparison.
The machine is AMD Ryzen 7 7700 (16 logical CPUs), Linux x64, 32,673,456,128 bytes
RAM; Node 26.12.0, Rust/Cargo 1.99.1, Vite 8 production minification and Cargo
release builds. Exact toolchain/binary provenance is in evaluator-performance.json
and assets/ai-bots/reference/dist/build.json. No benchmark targets ran concurrently.

## Complete-flow throughput

Separate from C3, one complete 40-game pass per target measures real engine work,
bot loading, state progression and actual sideboarding. No new deck or seed is
introduced. Native/browser harnesses collect the same in-memory histories;
evaluator command timings include the same full host event/evidence streaming.
Final result writes and baseline decoding are excluded. One pass is deliberately
bounded; different seeded games are not claimed to be repeated identical timing
samples. Detailed per-game/aggregate records accompany the summary below.

| Environment/path | Games per second |
| --- | ---: |
| browser / typescript | 6.92 |
| browser / wasm | 2.05 |
| tauri / typescript | 8.53 |
| tauri / wasm | 1.94 |
| tauri / native | 1.52 |
| evaluator / typescript | 3.61 |
| evaluator / wasm | 1.97 |
| evaluator / native | 1.97 |

Native RSS samples (whole process tree, not exclusive/peak memory):

| Tauri path | RSS MiB |
| --- | ---: |
| typescript | 1446.7 |
| wasm | 1464.6 |
| native | 1598.2 |

Reproducible commands are in README.md; implementation-status.md maps every criterion to evidence and owner. Local validation includes targeted runtime, loader, lifecycle, selection and snapshot tests, native failure tests, type/Svelte checks, lint, formatting, release frontend verification and unchanged vendor verification. No remote CI was run. Two pre-existing Story media assertions and the two environment limitations are explicitly retained in environment-blockers.md.

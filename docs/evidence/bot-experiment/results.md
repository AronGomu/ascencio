# ARO2-14 measured runtime results

Keep TypeScript as the default for these saved workloads. Rust remains useful for
portable Rust-authored packages, but these results provide no performance reason
to switch the built-in policies. Transport/copying dominates Rust round-trip cost.
This is a measured scenario-specific recommendation, not a language-wide claim.

Both Rust targets match 22,158 recorded decisions and 20 sideboard exchanges.
Separate real-engine smoke completes 40 games (five four-game matches per Basic
and Generalist) and 20 real sideboard responses on each supported Rust route,
without crashes, illegal decisions or unexpected recovery. No live action-ID
comparison is required. Actual client/runtime integration tests additionally cover
load, player response, asynchronous bot progression, injected engine failure,
pinned restore and disposal with both isolated Rust transports. The fake-engine
fault-injection tests and the real-engine complete flows are distinct evidence;
the latter alone is not claimed as 40 UI-driven application matches.

## Release transport latency

Browser measurements use isolated headless Chromium 153; Tauri uses the system
WebKit webview and an optimized packaged-protocol instrumentation frontend. Native
round trips include Worker → main → Tauri → child process. Browser/Tauri WASM uses
the actual nested Worker transport. TypeScript runs directly in the duel Worker.
Compare paths within one environment.

| Path | Mean compute µs | Mean round trip µs | p95 round trip µs | First instance ms | Mean later instance ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| Browser TypeScript | 2.45 | 2.96 | 0.00 | 0.10 | 0.01 |
| Browser Rust/WASM | 10.02 | 276.25 | 400.00 | 85.50 | 71.14 |
| Tauri TypeScript | 3.67 | 4.08 | 0.00 | 0.00 | 0.01 |
| Tauri Rust/WASM | 10.26 | 332.21 | 1000.00 | 83.00 | 78.12 |
| Tauri native Rust | 6.42 | 489.38 | 1000.00 | 86.00 | 78.00 |

One full saved-workload warmup precedes three measured passes (66,474 decisions
per path). Input parsing, reference checks and final report writes are outside
the timed interval. Raw JSON includes min/max, p50/p95, standard deviation and
per-pass durations. Instance creation/reset is measured separately across games.
First-instance samples include normal OS/compiler caches: they are not forced
disk-cold results. WebKit's millisecond and Chromium's 0.1 ms timer quantization
produce zero medians/p95 for tiny computations; aggregate means are not individual
microsecond-resolution samples. No measured targets ran concurrently.

The seeded xorshift32 Random control replays the first saved game's 599 inputs,
one warmup and three measured passes. It does not generate additional games:

| Path | Random mean compute µs | Random mean round trip µs |
| --- | ---: | ---: |
| browser-typescript | 0.67 | 1.34 |
| browser-wasm | 3.95 | 257.65 |
| tauri-typescript | 1.11 | 1.67 |
| tauri-wasm | 3.34 | 275.46 |
| tauri-native | 1.58 | 477.46 |

## Evaluator

The evaluator WASM transport is now a preemptible Node Worker thread, with
structured cloning plus linear-memory JSON copying. Native uses bounded child
stdin/stdout JSON. The release/minified TypeScript control uses same-process JSON
loopback. All three measure the same request boundary, excluding host evidence
I/O and the fallback guard; complete-flow throughput below includes those costs.
The old synchronous-WASM evaluator timings are superseded.

| Path | Mean compute µs | Mean request round trip µs |
| --- | ---: | ---: |
| typescript | 2.82 | 56.69 |
| wasm | 7.52 | 272.01 |
| native | 4.45 | 126.33 |

Evaluator timing uses performance.now and Rust Instant, one warmup and three
passes. Constructor samples retain unequal scopes (TS includes esbuild, native
starts a process without a create handshake, WASM starts/compiles a Worker), so
no comparative cold-start claim uses those samples. Actual-runtime instance
measurements above include package loading/create and are reported separately.

## Complete-flow throughput

One separate 40-game pass per target includes real engine work, bot loading,
state progression and actual sideboarding. Each environment handles histories and
evidence identically across runtimes. Fixture decoding and final result writes
are excluded; evaluator streaming/report transport is included. This is bounded
throughput evidence, separate from C3 correctness and repeated-input timing.

| Environment/path | Games/second |
| --- | ---: |
| browser / typescript | 10.16 |
| browser / wasm | 2.32 |
| tauri / typescript | 8.52 |
| tauri / wasm | 1.94 |
| tauri / native | 1.51 |
| evaluator / typescript | 3.78 |
| evaluator / wasm | 1.37 |
| evaluator / native | 1.85 |

## Memory

Comparable browser-wide memory uses a fresh Chromium process/profile per target,
identical flags, and three Linux process-tree VmRSS snapshots one second apart
after 100 identical saved decisions, retaining the bot and workload. RSS includes
shared pages per process, browser/renderer/utilities and Workers. These are whole
process snapshots, not exclusive allocations, GC-normalized samples or peak use.
The rejected Electron memory API is no longer the only measurement method.

| Browser path | Mean RSS MiB | Sample range MiB |
| --- | ---: | ---: |
| typescript | 1594.5 | 1542.2–1620.7 |
| wasm | 1701.9 | 1649.1–1728.4 |

Tauri process-tree RSS is sampled ten seconds into each benchmark, using the same
method but a different observation point from browser memory. Do not compare the
two tables as equivalent allocation measurements.

| Tauri path | RSS MiB |
| --- | ---: |
| typescript | 1321.3 |
| wasm | 1308.5 |
| native | 1260.9 |

WASM committed linear memory is 51,904,512 bytes per reference instance. Native
child RSS is approximately 79 MB; raw per-instance samples are retained. These
subsystem metrics are not directly comparable to whole-browser/Node RSS.

Machine: AMD Ryzen 7 7700, 16 logical CPUs, Linux x64, 32,673,456,128 bytes RAM.
Toolchains: Node 26.12.0, Rust/Cargo 1.99.1, Vite 8 production minification and
Cargo release builds. Build/binary provenance is retained in dist/build.json and
phase3-provenance.json. Reproducible commands are in README.md; criterion owners,
inputs and evidence are in implementation-status.md. No remote CI was run.

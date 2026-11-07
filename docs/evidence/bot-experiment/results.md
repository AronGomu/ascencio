# ARO2-14 measured evaluator results

The saved Basic and Generalist scenarios match on both Rust targets. Each target
matches **22,158 decision responses and 20 sideboard responses over 40 games**,
and separately completes the corresponding 40 live real-engine smoke games with
actual sideboarding and no crashes, illegal decisions or unexpected fallbacks.
Live smoke does not require action-ID equality; that belongs only to recorded-input
parity. Browser WASM and native Tauri smoke remain outstanding under C3.
This demonstrates parity for these scenarios only. The immutable reference and
its acquisition caveats are documented in `README.md`.

The optimized evaluator experiment measured a slowdown, not a speedup. These are
**Linux Node evaluator transports**, not browser or Tauri measurements.

| Path | Mean computation per decision | Mean full round trip | p95 round trip | Mean time for 22,158 decision round trips |
| --- | ---: | ---: | ---: | ---: |
| TypeScript, minified esbuild bundle / JSON loopback | 2.72 µs | 57.34 µs | 64.56 µs | 1.271 s |
| Rust/WASM, Node linear-memory JSON transport | 5.96 µs | 137.47 µs | 131.91 µs | 3.046 s |
| Native Rust, Node subprocess JSON transport | 4.73 µs | 118.71 µs | 133.53 µs | 2.630 s |

One full saved-workload warmup and three measured repetitions were used. Every
measured response was checked against the reference. Fixture decompression,
parsing, parity assertions and evidence file I/O are outside the timed decision
section for every path. Sideboarding and instance creation are outside these
warmed decision totals. Each game resets the bot, preserving the reference
lifecycle. The WASM p95 is below its mean because a few larger outliers skew the
mean; raw statistics include maxima and standard deviation.

Computation accounts for roughly 4–5% of mean round-trip latency here; JSON,
copying and host transport dominate. Rust also computes more slowly in this
implementation: it operates on dynamic JSON values. These results do not imply
that all Rust implementations are slower, or that native Tauri IPC would have
the same costs as a Node subprocess.

`evaluator-performance.json` records CPU/OS/memory, Node and exact Rust build
versions and executable hashes, repetitions, timing methods, percentiles and
variability. It includes diagnostic startup and memory samples with explicit
limitations: TypeScript startup includes bundling, native construction excludes
a ready handshake, and memory scopes differ (Node RSS, WASM linear memory,
native child RSS). Those samples are **not a fair comparative cold-start or
memory result**. The current memory sampler requires Linux `/proc`.

The `*-live.json` reports list completed games and zero runtime failures; they
contain no timing gate and are not duel-throughput benchmarks. Actual browser and
Worker-to-Tauri round trips, comparable cold startup/memory, and complete duel/
evaluator throughput remain outstanding. Keep TypeScript as the existing
application runtime while completing those measurements; no replacement runtime
is recommended from this incomplete experiment.

Validation: six targeted files passed (133 tests total), TypeScript compilation
passed, focused ESLint and Prettier checks passed, and frozen vendor verification
passed for all 21 files. See `implementation-status.md` for every remaining
criterion, owner, input, and reference. No remote CI or reviewer round was run.

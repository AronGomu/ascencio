# Testing Architecture

> Status: accepted

## Mandatory order

The programmed real-WASM headless integration suite remains prerequisite for visual work. It covers every supported action/prompt family and reaches `MSG_WIN` using the two preset decks. DOM-field changes start with failing projection/interaction/component fixtures and must preserve this gate.

## Test layers

- **Pure unit:** binary readers, message fixtures, response bytes, contracts, fixed-slot projection invariants, physical-zone/board mappings, interaction spec/session/navigation reducers, deck/dependency resolution, opponent decisions, and presentation mappings.
- **Worker integration:** vendored real-WASM load, synchronous callbacks, fixed-seed traces, complete duels, and handle cleanup.
- **Asset/compatibility:** hashes/counts/coverage, required globals, script indexes, protocol constant classification, and active-deck dependencies.
- **Component/browser:** role/name/state field controls, pointer/keyboard equivalence, focus return, explicit confirmation, production static bundle at a non-root base, Worker/WASM paths, one-response prompts, nonblocking image/back fallback, result/restart, diagnostic download, loading/completion refresh, forced Worker timeout, responsive overflow/touch targets, reduced motion, resource disposal, performance/resource budgets, and hidden-message inspection. **Product browser gate:** full flow on Chromium (PWA-capable engine family). Firefox/WebKit startup smoke is optional hygiene, not field acceptance.

## Regression and update rules

- Reproduce each bug with the smallest fixture or deterministic transcript before fixing it.
- Keep fixtures human-readable; never update traces merely to silence a failing test.
- Any engine/data update creates a new snapshot and runs all layers.
- Typecheck, lint, format, unit/component/real-WASM tests, asset verification, independently verified production packaging, reproducible-build comparison, and the browser matrix are release gates.
- Validation runs locally only under the policy in `AGENTS.md`. GitHub Actions is disabled; preserve local traces/reports when a compatibility or browser check fails. Remote CI never gates commits, merges or completion.
- DF-16 records machine-readable Chromium parity/perf/resource evidence in `.tmp/test/e2e-global/results/df-16-results.json` and the acceptance baseline in `docs/architecture/05-presentation/duel-field-performance-baseline.md`.

## Smoke checks, focused tests and performance

A smoke check exercises a small complete flow to catch integration failures: for example, load a bot and finish a duel. Focused tests check a specific rule or edge case in detail. A smoke run complements these tests; it does not establish exhaustive correctness or rare-failure rates. Performance measurements answer how fast a workload runs, not whether its decisions are correct.

For the parallel TypeScript/Rust bot experiment, the initial smoke baseline is five seeded four-game Goat Control matches per Basic and Generalist. Record the TypeScript decisions once and replay identical inputs/randomness against Rust for action parity, then run the same matches live for integration. Repeated fixture timing is separate from correctness and does not require generating more matches.

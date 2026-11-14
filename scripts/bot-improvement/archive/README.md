# Legacy match runner archive

Future runs use `npm run bot:matches` (`session-typescript/v1`). This directory retains the previous supervisor and tuning scripts for explicit legacy execution and comparisons. It is not the default improvement workflow.

- `npm run bot:matches:legacy -- --session SESSION --out OUTPUT --workers N` selects the archived session adapter.
- `npm run bot:matches:legacy:benchmark -- ...` benchmarks the archived implementation.
- The native command is `frozen-legacy`; source is `tools/bot-evaluation/src/archive/frozen_pool.rs`.

Prepared jobs, receipts and game evidence from old runs remain readable. Resume requires the pinned input/runtime identities; source changes do not constitute a migration. Never change an iteration's runner identity to bypass a mismatch. Legacy worker recommendations remain separate from batch calibration.

The previous Rust batch backend remains available through `npm run bot:matches:rust` (session) and `npm run bot:batch:rust` (standalone), with `bot:matches:rust:calibrate` for its own cache. Keep pinned `session-batch/v1` iterations on that backend. Future default runs and calibration use TypeScript.

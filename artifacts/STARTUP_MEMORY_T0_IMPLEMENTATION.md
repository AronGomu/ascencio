# T0 implementation evidence

Status: code-ready for the T0 contract/telemetry sub-slice; complete T0 release/device acceptance remains pending.

## Assumptions

“Start implementation” authorizes the first independently verifiable T0 slice. Runtime remains the SQLite/native JSON migration baseline. Existing worktree edits/deletions belong to the owner and are preserved. No commits, publication, engine changes, content conversion, or save migration in this slice.

Current menu readiness is recorded as `baseline-ready`, never ADR-104 `ready`. Native tracing is opt-in with `ASCENCIO_IO_TRACE=1`; bounded snapshots contain labels/categories/timings, never command payloads, search terms, save contents, or absolute user paths. SQLite connection opens and query durations are logical evidence, not a count of SQLite VFS/OS reads. Real release/device acceptance must supplement them.

## Work and checks

- [x] A1. Capture failing contract tests before implementation. Verify: Node 26.7.0 Vitest run fails because `src/storage/diagnostics/io-trace.ts` does not exist.
- [x] A2. Define complete READY prerequisites, phases, I/O categories and a bounded no-read assertion. Verify: `vitest run tests/unit/storage/startup-io-trace.test.ts`.
- [x] A3. Trace production native registry/user file reads, package opens, hashing, SQL query time and frontend storage commands; distinguish media and engine inputs. Verify: focused Rust and native adapter tests, native/TypeScript wire-contract parity.
- [x] A4. Mark current menu readiness without claiming full preload. Verify: bootstrap tests and zero additional telemetry IPC when tracing disabled.
- [x] A5. Validate affected repository boundaries and native/frontend builds. Verify: `npm run typecheck`, focused lint/format, focused unit/integration tests, `npm run test:native:rust`, `npm run build` using Node >=26.
- [x] A6. Document reproducible disposable-data baseline procedure and native evidence limits. Verify: runnable commands, retained evidence and honest pending desktop/mobile timings/budgets.
- [x] A7. Update the graph after changes. Verify: `graphify . --update` or record exact tooling failure.

## Acceptance still required for T0 exit

Actual Tauri release cold/warm launch, Freeplay, New Game, Continue, Deck Editor, first duel and return/reentry timings; transport/serialization/projection/engine/media breakdown; physical mobile reference; resident/peak memory; calibrated startup/memory budgets. The Node metadata experiment and browser bridge do not satisfy these gates. Proposed route/search targets remain unchanged.

## Validation evidence

A1. Node 26.7.0: `npm run test:unit` passed 2,977 tests across 258 files plus 9 separately executed performance tests. `npm run test:integration` passed 58 tests across 21 files. Final focused rerun passed 95 tests across eight files, including new bootstrap/metadata/schema checks. Final capture-race/bootstrap/CLI rerun passed nine tests across three files.

A2. `cargo test --manifest-path src-tauri/Cargo.toml` passed 20 tests. The explicit isolated native writer trace test passed with `ASCENCIO_IO_TRACE=1` and `--ignored --test-threads=1`; it confirms the current compare read of a real temporary user file.

A3. `npm run typecheck` passed with four existing Svelte warnings. `npm run build` passed frozen-vendor verification and native webview resource/domain guards (`wasmBytes: 0`). Focused lint passed.

A4. `graphify . --update` could not perform semantic extraction without an API backend. `graphify . --update --code-only` succeeded. Final code-only update skipped 210 existing changed non-code files and one allegedly sensitive file, `tokens.css`; five existing Story Svelte files had partial AST extraction. No API key was requested.

## Reference information, not a measured release baseline

Desktop available: AMD Ryzen 7 7700, x86_64, Linux `7.1.9-arch1-2`. Staged release has duel-core 1.1.0 (1,011,712 bytes), card-library 1.1.0 (2,652,917,760 bytes), freeplay 1.1.0 (49,152 bytes), chapter-01 1.1.0 (196,608 bytes). Physical mobile reference and launch/route/memory measurements remain pending. No calibrated startup/memory budget is claimed.

The durable manual checklist is already deleted in the owner worktree; its deletion was preserved. This slice's native acceptance steps are in `artifacts/STARTUP_MEMORY_T0_MANUAL_TESTS.md`.

A5. Capture export now rejects concurrent command activity with `IO_TRACE_CAPTURE_CHANGED`, preventing a save from hiding its native reread between frontend/native snapshots. The focused regression passed. CLI captures require `schemaVersion: 1` and matching native/frontend sessions.

A6. No commits or pushes. Test-created `startup-io-gate-*` scratch directories were removed by their fixture cleanup. Removed own temporary `.tmp/startup-memory-t0-build.log` after recording successful final build output.

A7. Final code passes TypeScript compilation, focused ESLint/Prettier, and `npm run build`; native build guards report shell 113,165 bytes, Worker 139,496 bytes, Battle 293,024 bytes, Deck Editor 175,092 bytes, Story 178,663 bytes, and `wasmBytes: 0`. `git diff --check` passes; no feedback or frozen-vendor diff. Component, physical-device, packaged Tauri release, full headless/content verification and reproducible-build gates were not run for this telemetry sub-slice.

# Native trace warning fix

## Plan and success criteria

- [x] W1. Confirm the three operation variants and byte-reading helper are used only by historical Rust tests. Verify: graph query and focused source/caller inspection; `native_storage` and matching `lib.rs` callers are `cfg(test)`.
- [x] W2. Compile these items only under the same test configuration as their consumers, preserving the diagnostic wire names. Verify: development and native-acceptance checks pass with warnings denied, standard Rust tests pass (34 passed, 2 ignored), and seven wire/I/O regression tests pass.
- [x] W3. Verify normal development, native-acceptance and release builds without the reported warnings. Verify: warnings-denied development/native-acceptance checks and optimized release-library build all exit 0. Logs preserved byte-for-byte under `native-trace-warning-validation/`; exact scratch removal paths appear in its cleanup receipt.

## Assumptions

- A1. The pasted output contains warnings rather than a runtime error. Address the two reported Rust dead-code warnings; no unrelated Svelte warnings or runtime behavior change is requested.
- A2. Historical SQLite regression coverage stays available under `cfg(test)`. Production must not regain SQLite code or I/O for the sake of making tracing symbols appear used.
- A3. Preserve the running owner application, unrelated local deletions and story references. No launch, commit or remote push is requested by this fix.

## Additional check finding

- F1. Applying `RUSTFLAGS='-D warnings'` to the entire historical test harness fails with 44 existing unused-code errors from retired native SQLite/package handlers. This stricter-than-standard test command is outside the requested normal app warnings; no broad suppression or historical-module removal was added. Standard Rust tests pass. Development and native-acceptance app checks pass with the same warnings-denied setting.

## Evidence

- E1. Before fix: `RUSTFLAGS='-D warnings' cargo check --manifest-path src-tauri/Cargo.toml` exits 101 with both reported dead-code warnings promoted to errors. After fix: the same command exits 0, without warnings. Log: `native-trace-warnings-red.log` versus `native-trace-warnings-green-dev.log`.
- E2. Acceptance configuration: `RUSTFLAGS='-D warnings' cargo check --manifest-path src-tauri/Cargo.toml --features native-acceptance`, exit 0. Log: `native-trace-warnings-green-acceptance.log`.
- E3. Optimized production library: `cargo rustc --manifest-path src-tauri/Cargo.toml --release --features tauri/custom-protocol --lib -- -D warnings`, exit 0. Log: `native-trace-warnings-green-release.log`. This compiles the application library without rebuilding/relaunching the standalone executable.
- E4. Standard `cargo test --manifest-path src-tauri/Cargo.toml`: 34 passed, 2 ignored; seven Vitest wire/I/O regressions pass. Scoped Prettier, ESLint, rustfmt and source diff whitespace checks pass. Logs: `native-trace-warnings-rust-tests-normal.log`, `native-trace-warnings-wire.log`, `native-trace-warnings-style.log`.
- E5. Changes are limited to test-configuration attributes on three enum variants and the byte-reading helper, plus ignoring Rust attributes when the existing wire-vocabulary test extracts variant names. Current runtime operation serialization remains unchanged; historical vocabulary stays covered.
- E6. Structural code graph refreshed and reclustered: 14,241 nodes, 548 communities. Existing partial extraction warning covers 116 Svelte files; document semantic extraction was not refreshed. No external graph storage or source edits were required.
- E7. Inspector explanation verified against installed Tauri 2.12.0 (`WebviewBuilder::devtools`, enabled by default in debug) and [official debugging documentation](https://v2.tauri.app/develop/debug/). Project window configuration does not disable devtools; `native:desktop:dev` invokes `tauri dev`, and the normal build-and-start command creates a release build.

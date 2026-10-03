# Startup loading messages

The native application mounts `StartupRoot` immediately. One preparation card stays visible while its heading changes; Main Menu opens only after critical content, user state, domain inputs, screen modules and the duel Worker are ready. Optional illustrations, audio and video are accessed when their screens need them rather than all being decoded during startup.

## Current sequence

Counter values below are examples, not a percentage of the whole startup. A heading can pass too quickly to notice. Installation and source-copy headings are conditional.

| ID | Current heading | Work represented |
| --- | --- | --- |
| L1 | `Preparing application…` | Initial bundled screen; startup diagnostics are read. |
| L2 | `Verifying installed content…` | Request the native loader's selected trusted content generation. |
| L3 | `installation (0/7)…` | If that generation is absent, install authenticated bundled critical snapshots and engine resources atomically. |
| L4 | `source and media copy (0/1)…` | Attempt readable-source and optional-media installation once per generation; preserve existing files. Its checkpoint completes only after the copy attempt returns. |
| L5 | `verification (0/4)…` | Read, digest-check and parse each selected critical JSON snapshot. |
| L6 | `engine preparation (0/2)…` | Read and verify the frozen engine WASM and vendor manifest. Worker initialization follows later. |
| L7 | `user state (0/1)…` | Acquire the user-data writer and initialize current JSON saves/preferences in memory. |
| L8 | `mod composition (0/3)…` | In modded mode, load/validate, compose, then activate enabled mods and explicit additions/overrides. |
| L9 | `domain projections (0/1)…` | Build the resident content catalog and mappings for optional media. |
| L10 | `Preparing gameplay and screens…` | Prepare Freeplay and every active chapter, deck search indexes, screen modules and the duel Worker; check readiness before opening Main Menu. |
| L11 | `Restoring bundled content…` | Restore eligible bundled critical files, then start a fresh preparation cycle. |
| L12 | `Application could not start` | A startup error blocks Main Menu and presents diagnostics and applicable recovery actions. |

While preparation runs, the supporting text is `Preparing your content and saves. Gameplay opens when preparation is complete.` On failure, it is replaced by an error title and actual message, followed by Restore, Open Log, Copy Error and Close. All structured diagnostics remain in the scoped log and copied error. Restore is disabled for unrelated save/mod errors.

The formatter currently turns technical phase IDs into headings by replacing hyphens with spaces and appending the counter and ellipsis. This explains the lowercase headings and the distinction between `Verifying installed content…` and `verification (0/4)…`: the first is the request heading; the second is native progress.

The bar shows `Startup progress` and one overall percentage. Phase counters in headings describe local completed checkpoints; the bar maps them into fixed ranges: initial preparation 0–5%, installation 5–15%, source/media copy 15–25%, verification 25–45%, engine verification 45–55%, user state 55–60%, mods 60–70%, projections 70–75%, gameplay preparation 75–100%. Inactive conditional phases are skipped. The percentage never decreases within an attempt and is capped at 99% until admission succeeds. Restore starts a fresh attempt. This is a completed-work estimate, not a time prediction; atomic operations can pause the bar. Gameplay preparation includes screen imports, catalogs, chapter inputs, search indexes, the duel Worker and the final readiness check. No Cancel button appears during loading; closing the native window still releases ownership safely.

## Reviewing wording in context

For a copy review, use a standalone preview that recreates the startup card with the current CSS, tokens and fonts. Select a state manually so it remains visible, edit its heading/supporting text, and compare desktop and mobile widths. Use simulated counters and diagnostics; avoid altering real content or saves to force a state.

- W1. Review each heading and the shared supporting text together, including longer lines at narrow widths.
- W2. Download proposed wording before closing or reloading the preview; drafts are held in that page's memory.
- W3. Apply approved wording in `StartupRoot.svelte`. For progress labels, introduce explicit player-facing labels in its progress callback while preserving the technical phase identifiers emitted by storage and Rust.
- W4. After application copy changes, run the relevant startup component tests and inspect the native startup screen. A simulated preview does not verify native loading behavior or physical mobile devices.

## Sources

- S1. [`StartupRoot.svelte`](../src/shell/startup/StartupRoot.svelte): initial/request/final headings, progress formatting, shared supporting text and recovery controls.
- S2. [`native_startup.rs`](../src-tauri/src/native_startup.rs): installation, optional source/media copy, snapshot verification and engine-resource progress.
- S3. [`prepared-storage.ts`](../src/storage/native/prepared-storage.ts): user state, enabled mod composition and resident catalog preparation.
- S4. [`prepare-application-inputs.ts`](../src/shell/application/prepare-application-inputs.ts): prepared Freeplay/chapter inputs, screen imports and duel Worker initialization.
- S5. [`application-bootstrap.ts`](../src/shell/application/application-bootstrap.ts): readiness requirements. [ADR-104](ADR/104_ADR_startup_memory_content_and_mod_overrides.md) owns the startup memory contract.

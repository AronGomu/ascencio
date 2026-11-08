# ADR-106: TypeScript AI bot strategies

Status: accepted 2026-11-07.

## Decision

Implement and maintain AI bot strategies in TypeScript in self-contained `assets/ai-bots/<bot>/ai/` projects. This is the supported strategy authoring and application execution path for Basic, Generalist, Random, and future specialists such as GOAT Control.

Retire Rust AI strategy development and its WASM/native package execution in the application. Do not add Rust strategy ports, expose Rust runtime choices, or require Cargo compilation or bot WASM staging for application builds. Retained Rust bot sources under `docs/archive/rust-bot-experiment/`, transports, fixtures, and measurements serve historical experiment reproduction only.

Each bot owns `bot.json`, `settings.json`, its TypeScript `ai/` project, recommended `decks/`, and declared resources. The manifest resolves package-relative paths; `bot:build` emits a self-contained `dist/ai.mjs`. Shared contracts, legal-response machinery and compatibility exports remain in `src/battle/worker/bot/`. See [the package contract](../../assets/ai-bots/README.md).

The Rust Tauri host, Rust evaluation scheduler, and frozen `ocgcore-wasm` rules engine retain their existing responsibilities. This decision concerns bot strategy implementation.

## Context and rationale

The [retained runtime experiment](../evidence/bot-experiment/results.md) found no performance gain from Rust for the existing strategies. Both Rust targets reproduced 22,158 recorded decisions and 20 sideboard exchanges, so the port did not establish stronger play either. Serialization, copying, and transport overhead outweighed any reason to move these policies out of the duel Worker.

On the saved Tauri workload, mean decision round trips were 4.08 microseconds for TypeScript, 332.21 for Rust/WASM, and 489.38 for native Rust. The separate complete-flow run achieved 8.52 games per second with TypeScript, 1.94 with Rust/WASM, and 1.51 with native Rust. These are workload-specific measurements with the timing limitations described in the evidence; they do not establish a general ranking of languages.

TypeScript is also easier to edit in this repository. Strategies share the application's typed bot contracts, legal-choice machinery, observations, and test tools. Contributors can change a strategy and run its checks without maintaining a second Rust implementation, compiling native and WASM targets, or staging executables. Keeping one strategy implementation reduces duplicated logic and makes strategy experiments easier to inspect and iterate.

## Consequences

- Freeplay offers built-in TypeScript policies. Retired external Rust AI requirements fail with an explicit dependency error rather than being treated as supported packages.
- Native application builds do not compile or bundle Rust AI executables; browser development does not publish Rust bot packages.
- Future GOAT Control work extends the TypeScript strategy seam. This ADR does not claim that a dedicated GOAT Control policy already exists.
- Strategy changes retain actor-permitted observations, engine-provided legal choices, decision validation, and the existing duel Worker boundary. TypeScript does not take over authoritative game rules.
- Historical reproduction tooling may remain, but must not become the default implementation or a build prerequisite.

## Reconsideration

A runtime change requires a superseding ADR and reproducible evidence of a material benefit on representative complete duels, including transport, startup, correctness, and maintenance costs. A faster isolated calculation or an assumption that Rust should be faster is insufficient.

## Related records

[Retired experiment](../feature/rust-bot-experiment.md) describes the former package contract. [ADR-103](103_ADR_tauri_only_runtime_and_asset_ui.md) and [ADR-105](105_ADR_browser_development_and_shared_content_transport.md) continue to govern application platforms and content transport.

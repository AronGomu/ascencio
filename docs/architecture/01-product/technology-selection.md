# Technology Selection

> Status: accepted

## Selected stack

- **TypeScript (strict):** orchestration, contracts, protocol, projected state, tooling, and opponent policy.
- **Vite:** development server, Worker/WASM assets, and static production build.
- **Svelte:** application shell plus semantic DOM duel field, prompts, inspector, logs, errors, and results.
- **CSS and SVG:** typed-coordinate field placement plus pointer-transparent, non-authoritative feedback. Phaser remains only as migration-era implementation until the DOM parity gate removes it.
- **Project Ignis `ygopro-core` through vendored `ocgcore-wasm@0.1.2`:** rules engine.
- **Dedicated Web Worker:** synchronous WASM isolation and duel ownership.
- **IndexedDB via `idb` and Cache Storage:** snapshot metadata/preferences/debug runs and image cache.
- **Vitest and Playwright:** unit/real-WASM integration and production browser tests.
- **ESLint and Prettier:** static quality and formatting.

Node.js 24+ runs repository tooling and the existing asset pipeline.

## Rationale

`ocgcore` already implements rules and Lua effects. TypeScript has direct browser APIs and an existing `ocgcore-wasm` ecosystem. Svelte suits the bounded card/zone field plus text/control-heavy UI; native DOM semantics/focus/testing outweigh canvas sprite throughput for current no-spectacle scope. The synchronous WASM build in a Worker avoids JSPI compatibility requirements.

## Rejected or deferred

- **Full EDOPro browser port:** unnecessary desktop-client surface and dependencies.
- **Odin native wrapper:** weaker browser/WASM/UI ecosystem for this MVP.
- **Rust wrapper:** duplicates bindings without solving browser presentation.
- **JSPI asynchronous core:** deferred until browser support justifies it.
- **Second SQLite WASM runtime:** unnecessary while build-time CDB conversion is sufficient.
- **Interactive Phaser/canvas duel field:** superseded by [`../05-presentation/duel-field-rendering.md`](../05-presentation/duel-field-rendering.md); retain only until measured DOM parity permits removal.
- **Synchronized canvas plus DOM controls:** rejected because it duplicates geometry, focus, z-order, and disposal.

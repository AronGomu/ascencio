# Technology Selection

> Status: accepted

## Selected stack

- **TypeScript (strict):** orchestration, contracts, protocol, projected state, tooling, and opponent policy.
- **Vite:** development server, Worker/WASM assets, and static production build.
- **Svelte:** application shell plus semantic DOM duel field, prompts, inspector, logs, errors, and results.
- **CSS and SVG:** typed-coordinate field placement plus pointer-transparent, non-authoritative feedback.
- **Project Ignis `ygopro-core` through vendored `ocgcore-wasm@0.1.2`:** rules engine.
- T1. **Separate dedicated Workers:** synchronous OCG WASM duel authority plus SQLite/OPFS package/user-data ownership.
- T2. **SQLite WASM + OPFS:** immutable package registry/queries and isolated mutable `user-data.sqlite`.
- T3. **IndexedDB via `idb` + Cache Storage:** app-update approval, bounded diagnostics, and app shell/precache only.
- **Vitest and Playwright:** unit/real-WASM integration and production browser tests.
- **ESLint and Prettier:** static quality and formatting.

Node.js 24+ runs repository tooling, `node:sqlite` package producer/verification, and retained acquisition pipeline.

## Rationale

`ocgcore` already implements rules and Lua effects. TypeScript has direct browser APIs and an existing `ocgcore-wasm` ecosystem. Svelte suits the bounded card/zone field plus text/control-heavy UI; native DOM semantics/focus/testing outweigh canvas sprite throughput for current no-spectacle scope. The synchronous WASM build in a Worker avoids JSPI compatibility requirements.

## Rejected or deferred

- **Full EDOPro browser port:** unnecessary desktop-client surface and dependencies.
- **Odin native wrapper:** weaker browser/WASM/UI ecosystem for this MVP.
- **Rust wrapper:** duplicates bindings without solving browser presentation.
- **JSPI asynchronous core:** deferred until browser support justifies it.
- R1. **Direct browser CDB/runtime shards:** superseded by validated immutable SQLite packages and fixed Worker queries.
- **Interactive Phaser/canvas duel field:** superseded by [`../05-presentation/duel-field-rendering.md`](../05-presentation/duel-field-rendering.md) and removed after measured DOM parity.
- **Synchronized canvas plus DOM controls:** rejected because it duplicates geometry, focus, z-order, and disposal.

# Runtime Topology

> Status: implemented

Svelte owns public UI and lifecycle. Two dedicated Workers have separate authority.

## Main thread owns

- M1. Shell routing, lifecycle UI, app-update consent, mode readiness, semantic adapter composition.
- M2. Svelte field/editor/story presentation and latest immutable public duel state.
- M3. Typed SQLite and Duel Worker clients; main thread imports neither engine nor SQLite DB handles.
- M4. Media URL leases and visible warning state; presentation never determines legality.

## SQLite Worker owns

- S1. Lifetime exclusive Web Lock, OPFS SAH pool, package registry, immutable package handles, mutable `user-data.sqlite`.
- S2. Fixed validated RPC for import/verify/remove/cleanup, content queries, user writes, backup export/inspect/restore.
- S3. Package generation/session leases, chunked hashing/import, typed media warnings, atomic registry/user transactions.
- S4. No arbitrary SQL or package executable JS crosses RPC boundary.

## Duel Worker owns

- D1. Vendored synchronous OCG WASM module and duel handles.
- D2. Raw core messages, response indexes, processing loop, card/script in-memory maps, synchronous callbacks.
- D3. Prompt conversion, response encoding, state projection, opponent policy, seed/responses/diagnostic trace.
- D4. Rules authority remains Project Ignis core; SQLite Worker supplies validated semantic inputs before duel starts.

## Build and isolation evidence

- B1. `src/storage/sqlite-worker.ts` and `src/battle/worker/duel.worker-browser.ts` are distinct module Worker entries.
- B2. `vite.config.ts` includes exact SQLite executable in app/precache while OCG WASM arrives only through imported `duel-core`.
- B3. `scripts/verify-browser-build.ts` rejects content/media/package/extra-WASM leakage and Node-only engine resolution.
- B4. `scripts/lib/vite-content-deny.ts` rejects private content roots through direct, aliased, encoded, and Vite `@fs` paths.
- B5. Node/unit/build evidence is code-ready only; owner manual Chromium checklist covers OPFS/offline/second-tab behavior.

## Boundaries

- R1. Structured-clone domain data only; raw OCG protocol never reaches UI.
- R2. Imported SQLite is untrusted data opened through exact schemas and fixed read-only queries.
- R3. One active app tab owns SQLite; one live duel owns Duel Worker session.
- R4. Hidden opponent identities remain concealed from UI, accessibility, art requests, screenshots, and routine diagnostics.
- R5. Worker failures surface typed errors; no silent fallback to legacy content/storage exists.

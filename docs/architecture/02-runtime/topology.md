# Runtime Topology

> Status: implemented

Svelte owns the public field, prompt controls, and application lifecycle. Worker engine authority remains unchanged.

## Main thread owns

- Svelte application lifecycle, semantic field controls, card details, logs, loading/errors, and results.
- Latest immutable public duel snapshot, one current human prompt, and prompt-keyed interaction session.
- DOM/CSS/SVG presentation lifecycle and active-duel image lease/cache coordination.
- Typed Worker client only; it never imports the engine.

## Dedicated Worker owns

- Vendored synchronous WASM module and duel handles.
- Raw core messages, response indexes, and process loop.
- Card/script in-memory maps and synchronous callbacks.
- Prompt conversion, response encoding, state projection, and opponent policy.
- Seed, ordered responses, and diagnostic trace.

## Isolation evidence

- `src/battle/worker/duel.worker-node.ts` is the Node-only production entry and derives its trusted project root from `import.meta.url`.
- `tests/integration/node-worker-thread.test.ts` loads the real vendored WASM in `node:worker_threads` and drives initialize, start, prompt, surrender, graceful disposal, and forced termination solely through `postMessage`.
- `src/battle/worker/duel.worker-browser.ts` is a dedicated production Worker entry. Vite packages only the reviewed synchronous core path and verified active runtime closure; browser modules cannot import `*-node.ts` files.
- Production build verification rejects Node markers, disabled engine fallbacks, unmanifested runtime/image files, digest drift, missing licenses, and bundle-budget regressions.

## Boundaries

- Communication uses structured-clone-safe domain commands and events.
- Raw protocol values never cross to Svelte/presentation components.
- Offline snapshots may retain opponent hidden identities with explicit visibility metadata; presentation, accessibility, image loading, screenshots, and routine diagnostics must conceal them.
- DOM field communicates through typed store callbacks, never directly with the Worker.
- Logical field geometry and interaction specs are pure main-thread mappings from immutable domain data.
- A runaway or unresponsive engine is bounded by terminating/replacing the Worker.

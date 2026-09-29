# Browser Platform

> Status: accepted

## Delivery target

Ship static app-only browser application. Bundle resolves Svelte chunks, Duel/SQLite Workers, exact SQLite executable WASM, fonts, and icon under root/non-root base URLs without development filesystem assumptions. OCG WASM and game media arrive only through manually imported packages, never app URLs/precache.

## Browser support

**Product target:** current desktop **Chromium-based** browsers with **installable PWA** support (Chrome, Edge, Chromium equivalents). Field acceptance and renderer-removal gates run on Playwright Chromium.

Firefox and Safari/WebKit are **not** product acceptance targets for the DOM field. Existing startup smokes may remain optional CI hygiene and must not block field tickets.

Field delivery is desktop-first, then responsive composition. Mobile-first polish remains outside MVP, but a 375px viewport must keep semantic controls usable, targets at least 44px, and any wide-field scrolling contained.

## WASM constraints

Use single-threaded synchronous OCG WASM inside dedicated Duel Worker. Separate SQLite Worker uses OPFS SAH pool and lifetime Web Lock; current implementation requires no `SharedArrayBuffer`, COOP/COEP, WebAssembly JSPI, or stack switching.

## Resilience checks

Verify asset-free first boot, import/reload/offline use, second-tab ownership, backup restore, missing-media fallback, both Worker failure paths, keyboard-only prompt completion, hidden-information safety, and pinned Chromium performance/resource budgets. Node/unit/build evidence does not replace owner Chromium storage/durability checklist.

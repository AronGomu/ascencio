# Browser Platform

> Status: accepted

## Delivery target

Ship a static browser application. The production bundle must resolve Worker, WASM, and snapshot assets under both root and non-root base URLs without development filesystem assumptions.

## Browser support

**Product target:** current desktop **Chromium-based** browsers with **installable PWA** support (Chrome, Edge, Chromium equivalents). Field acceptance and renderer-removal gates run on Playwright Chromium.

Firefox and Safari/WebKit are **not** product acceptance targets for the DOM field. Existing startup smokes may remain optional CI hygiene and must not block field tickets.

Field delivery is desktop-first, then responsive composition. Mobile-first polish remains outside MVP, but a 375px viewport must keep semantic controls usable, targets at least 44px, and any wide-field scrolling contained.

## WASM constraints

Use the single-threaded synchronous WASM build inside a dedicated Worker. The MVP does not require `SharedArrayBuffer`, cross-origin isolation, or WebAssembly JSPI/stack switching.

## Resilience checks

Verify refresh during loading and after completion, missing-image fallback, Worker timeout/termination, keyboard-only prompt completion, hidden-information safety through main-thread message inspection, and pinned Chromium performance/resource budgets.

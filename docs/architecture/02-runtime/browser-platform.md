# Browser Platform

> Status: accepted

## Delivery target

Ship a static browser application. The production bundle must resolve Worker, WASM, and snapshot assets under both root and non-root base URLs without development filesystem assumptions.

## Browser support

Target current desktop Chrome, Firefox, and Safari. Current automation runs the complete browser flow in Chromium; Firefox and WebKit run production startup smoke only. DF-16 adds explicit Firefox/WebKit privacy and missing/slow-image smoke coverage as migration acceptance targets. Field delivery is desktop-first, then responsive composition. Mobile-first polish remains outside MVP, but a 375px viewport must keep semantic controls usable, targets at least 44px, and any wide-field scrolling contained.

## WASM constraints

Use the single-threaded synchronous WASM build inside a dedicated Worker. The MVP does not require `SharedArrayBuffer`, cross-origin isolation, or WebAssembly JSPI/stack switching.

## Resilience checks

Verify refresh during loading and after completion, missing-image fallback, Worker timeout/termination, keyboard-only prompt completion, and hidden-information safety through main-thread message inspection.

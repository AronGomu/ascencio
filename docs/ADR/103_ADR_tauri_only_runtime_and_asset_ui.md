# ADR-103: Tauri-only runtime and installed asset presentation

Status: accepted, implemented 2026-10-01.

## Decision

The product runs through Tauri on desktop and mobile. Its Svelte webview and dedicated OCG Worker remain the presentation and rules boundaries. Browser deployment, PWA installation, service-worker updates, OPFS, browser SQLite WASM, browser storage RPC, localStorage saves and IndexedDB diagnostics are retired. Normal DOM, Blob, File and Worker APIs remain necessary inside Tauri webviews.

`src/main.ts` requires Tauri and checks bundled content before mounting. `openLocalStorage()` exposes only `src/storage/native/storage-client.ts`; unavailable native IPC fails closed. Mutable data remains in atomic native `user-data.json`. Existing legacy stores are left untouched. Native content packages still use the existing Rust SQLite reader; this change does not implement the separately requested future filesystem-media migration.

The native set query projects only `id`, `name`, `releaseYear` and `cards`. Asset storage metadata stays behind the media reader. Shared story validation remains necessary for imported content; it is independent of browser deployment.

Freeplay passes its installed image source into the shared deck-selection screen. Mounted tiles lease their cover image, and both seat lists lease full card images on hover or keyboard focus. Replacing a request, leaving a preview and unmounting cancel pending reads and release leases, including late results. Missing cropped art falls back to full installed art. Neither behavior preloads images for the entire card catalog.

Stacked desktop layouts constrain the seat panel height so the deck grid remains visible at the supported 820 × 600 minimum window size. Mobile retains its separate compact layout.

The default field camera is flat. Geometry uses the same zero tilt as CSS, so zones and both hands remain inside the field in WebKit. Engine legality, concealed opponent identities and field keyboard controls remain authoritative and unchanged by camera placement.

## Build and verification

Tauri packages `generated/build/app/` and verified content resources. `scripts/verify-native-build.ts` rejects browser SQLite executables/workers, PWA artifacts and raw content in the webview artifact while preserving domain size budgets. `npm run build:reproducible` uses native build mode.

Native development uses `http://127.0.0.1:4204/`, with `TAURI_DEV_HOST` available for mobile development. Vite ignores generated reports, resources and Rust build output so producing these files does not reload an active game.

`npm run test:native:rust` verifies native storage, JSON persistence, content validation and module graph behavior. `npm run test:native:webview` runs Chapter 1, Freeplay cover/hover images and duel-field checks in Chromium desktop, WebKit desktop, WebKit mobile and an 820 × 600 WebKit window. It reads staged packages from `src-tauri/resources/game-content/` (override with `NATIVE_TEST_CONTENT_DIR`) through a test-only IPC bridge and uses disposable saves. Rust query tests cover the native payload independently. Webview emulation does not establish acceptance on physical Android/iOS devices.

Verification on 2026-10-01 passed the four webview scenarios, nine Rust tests, focused UI/storage/field tests, type checking, native artifact verification and reproducible builds. Chapter 1 also opened in the actual Linux Tauri app with disposable saves; native Freeplay displayed deck covers, a full card preview, zones and both hands. The broad legacy test suite still contains failures in retired content fixtures and story repository/overwrite expectations; a green full-suite result is not claimed.

The asset architecture and original defect evidence are preserved in [the dedicated HTML audit](../assets/game-asset-loading-audit.html). ADR-099 and the browser portions of ADR-100/101 are historical. ADR-102 still owns module composition and save-based prerequisites.

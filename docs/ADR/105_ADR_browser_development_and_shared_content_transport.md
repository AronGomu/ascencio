# ADR-105: Browser development and shared content transport

Status: implemented 2026-10-12; native webview and physical mobile acceptance pending for the new protocol.

## Decision

The product remains a Tauri application. A browser development mode supports AI agents that drive player flows using a fixed set of supplied content. Freeplay and Chapter 1 use the existing Svelte screens, catalogs, story state, and dedicated Worker engine.

| Environment         | Launch                               | Content host                          | User data                           |
| ------------------- | ------------------------------------ | ------------------------------------- | ----------------------------------- |
| Browser development | `npm run browser:dev`                | Vite serves verified staged resources | Separate localStorage JSON document |
| Tauri development   | `npm run native:desktop:dev`         | Native `game-content` protocol        | Atomic native `user-data.json`      |
| Packaged Tauri      | `npm start` or the installed release | Native `game-content` protocol        | Atomic native `user-data.json`      |

Browser development covers gameplay and navigation with supplied content. Content installation, repair, cleanup, and arbitrary mods remain native features. The main menu disables **Content** in browser mode. Browser coverage does not establish native filesystem, live media replacement, packaging, or device behavior.

## One JavaScript content reader

`src/storage/transport/game-content-reader.ts` uses `fetch` for base critical metadata, engine bytes, optional media, and native media revisions. Both hosts expose `/game-content/<session>/...` resources. JavaScript obtains the native protocol origin through Tauri's `convertFileSrc`; the browser uses its development server origin. Application queries, media leases, and Worker preparation share the same implementations.

`load-game-content.ts` checks exact response sizes and SHA-256 digests, parses critical snapshots, validates package identities and dependencies, and retains executable buffers. Each duel receives its own copy of the frozen WASM bytes. Critical content performs no I/O after startup readiness.

Native `native_startup_load` retains installation verification and returns the session descriptor. The protocol reads the verified session buffers and existing scoped media mappings. Saves, maintenance, and mod acquisition retain native control IPC. Native mod composition remains the existing JavaScript implementation.

The native protocol accepts only GET and HEAD. It rejects missing or closed sessions and undeclared resources. CORS reflects an allowed native origin or the effective debug development origin. A `null` origin requires the calling native window's verified URL. Scoped filesystem checks remain responsible for media access.

## Fixed browser content

The Vite plugin serves the supplied card library, engine pack, Freeplay pack, and Chapter 1 pack from `src-tauri/resources/readable-content`. It verifies the stage against the tracked critical release before serving it. Only declared metadata, engine, and media routes are exposed. Raw resource directories remain blocked by the Vite filesystem fence.

The npm preflight reuses a verified stage. If the stage is missing or stale, it runs the existing content preparation command. A fresh clone still needs `npm ci` and `npm run setup` to acquire source assets. This mode does not download or repin content on demand.

`__BROWSER_DEVELOPMENT__` is true only for Vite's `browser-dev` serve mode. Packaged frontend builds exclude the browser adapter and retain the app-only resource boundary. The native artifact verifier rejects the browser save key if it enters the production artifact.

Browser development disables Svelte component hot replacement. Source edits reload the page and prepare a fresh session. Replacing the root component in place otherwise disposes the cached gameplay session while the replacement still holds it. Explicit saves survive the reload.

## Isolated development saves

Browser mode uses the existing JSON user-data schema and memory-authoritative store. Its key is `ascencio:browser-development:user-data:v1`. Web Locks serialize compare-and-swap writes across tabs. Conflicting writes fail instead of replacing newer progress. Saves survive reloads and remain separate from native data and retired browser stores.

**Reset browser saves** closes the current session, clears that development key, and starts a new session. Storage failures remain visible. The reset action does not touch native files. A localhost browser with Web Locks and localStorage is required.

## Relationship to earlier decisions

This ADR adds a development-only exception to ADR-103's browser retirement and ADR-104's native user persistence. It replaces the base-content byte transport with a shared resource reader. ADR-104 still owns content trust, startup lifetimes, mod overrides, native persistence, and live media. Frozen engine and domain boundaries remain unchanged.

## Evidence and remaining acceptance

TypeScript and Svelte checks, targeted ESLint, the production frontend build and artifact checks, and Rust `cargo check` pass. Manual browser use reaches the main menu, starts a real Freeplay duel, advances an opponent turn, and presents an engine response prompt. A manual story save survives reload and restores Beat 2 through **Load**.

No automated test suites ran for this implementation. Existing native browser fixtures were adapted to the new resource transport. Actual Tauri development and packaged webviews, other desktop platforms, physical mobile devices, complete chapter progression, and failure/recovery flows still need acceptance for this change.

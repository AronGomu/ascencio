# Native content staging

> Status: startup JSON runtime implemented and desktop release webview exercised; physical mobile acceptance pending.
> Architecture: [ADR-104](../ADR/104_ADR_startup_memory_content_and_mod_overrides.md).

The release recipe is `content/packages.json`. Developer conversion exports readable sources and live media to ignored `generated/readable-content-v1/<package-id>/`. The deterministic compiler writes each `critical.json` and source map. `content:release:pin` validates those inputs and writes the tracked `content/critical-release.json`. That tracked manifest is the native executable’s trust anchor; staged metadata must match it exactly.

```sh
npm run content:compile:json -- --help
npm run content:verify:sqlite-json-parity
npm run content:release:pin
npm run content:stage:native
npm run content:stage:verify-native
npm run native:desktop:build
```

`content:stage:native` stages atomically under ignored `src-tauri/resources/readable-content/`. Required JSON and frozen engine buffers must match the pinned byte lengths and SHA-256 digests. Optional media is separate from critical signatures. Tauri bundles these resources; the webview artifact contains application code only. No vendored engine bytes or loader resolution change.

Startup mounts the diagnostic surface immediately. Blocking native workers install a missing complete trusted generation, verify critical bytes once, load user data once, and transfer metadata plus executable buffers in two logical batches. Frontend preparation builds indexes, composes enabled mods and prepares the Worker before publishing ready. Ordinary navigation, saves and Worker restart consume retained memory. Optional images/audio/video use scoped live media reads.

First installation also copies readable source and optional media for discoverable authoring. Normal launches do not enumerate source directories or disabled mods. Critical edits activate only through a new startup cycle; rebuilding a trusted base requires developer compilation and a new pinned application release. The explicit repair action replaces only application-owned critical files from verified bundled resources and retains the prior generation for inspection.

Installed content supports exact digest-pinned JSON snapshot imports, optional chapter selection/removal and verification in explicit maintenance. Core modules remain required so repair routes stay available. Restart preparation activates the next selection. Cleanup retains trusted generations and never deletes saves, authored sources or live media. User-authored changes use [mods and overrides](startup-memory-content.md), including a declared-file JSON bundle for mobile.

User data remains atomic native `user-data.json` with an exclusive cached writer, ordered revisions and retryable exact-byte commits. External edits should occur while the app is closed. Legacy stores remain untouched and unread. [ADR-101](../ADR/101_ADR_json_user_data_storage.md) records the save contract and its ADR-104 amendment.

The desktop development webview uses `http://127.0.0.1:4204/`; `TAURI_DEV_HOST` overrides the host for mobile development. Generated reports and staging output are excluded from source watching and lint discovery.

On Linux with the NVIDIA kernel driver loaded, the native entry point defaults `WEBKIT_DISABLE_DMABUF_RENDERER` to `1` before creating GTK/WebKit. This avoids the grey window, GBM buffer failures, and Wayland `Error 71` described in [Tauri's Linux graphics guidance](https://v2.tauri.app/develop/debug/linux-graphics/). An explicit environment value takes precedence; other graphics drivers retain their default renderer. Wayland remains enabled. The workaround also applies to packaged desktop launches, without shell configuration.

Preview build staging cleanup with `npm run content:stage:cleanup -- --target src-tauri/resources`; add `--delete` to remove only the marked readable stage. The script refuses source and generated-input directories and never touches installed app-data. Run `content:stage:native` and `content:stage:verify-native` to restage.

Run `npm run check:headless`, `npm run check:frontend-and-browser`, `npm run test:native:rust` and source parity before release. Browser webview fixtures do not replace physical Android/iOS installation, offline media and durability acceptance. Desktop native read traces can be independently checked with `node scripts/verify-startup-io.ts <trace.json>`.

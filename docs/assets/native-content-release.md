# Native content staging

> Status: native storage code implemented; complete release build and device acceptance pending.
> Architecture: [ADR-100](../ADR/100_ADR_tauri_native_sqlite_storage.md). Target: [Tauri migration specification](../TAURI_MIGRATION_SPECIFICATION.md).

The Tauri release recipe is `content/packages.json`. Ignored SQLite outputs belong at `generated/content-packages/<package-id>-<version>.sqlite`. After all required files exist and pass full package verification, `native:manifest` writes the tracked `content/native-release.json` with IDs, versions, sizes and SHA-256 digests. Keep the manifest in Git with the recipe and the data sources in `content/duel-core/` and `content/freeplay/`; keep SQLite files and source images outside Git.

`npm run native:dev` stages the default release before starting the shell. Both development and release builds install Duel Core, Card Library, Free Play and Chapter 01 on first launch; no manual import is needed. Startup refuses missing or invalid bundled defaults instead of opening with empty content. A valid existing installed set remains unchanged.

The desktop development webview uses `http://127.0.0.1:4204/`. `TAURI_DEV_HOST` overrides the host for mobile development. Generated test reports and native build resources do not trigger Vite reloads.

```sh
npm run content:export -- --spec content/packages.json
npm run native:manifest
npm run native:prepare
npm run native:verify-staged
npm run native:build
```

`native:prepare` refuses missing packages and any byte mismatch with the tracked manifest. It stages verified files under ignored `src-tauri/resources/game-content/`. Tauri bundles that directory as resources. At startup Rust copies those packages into the platform app-data directory under `game-content/`, checks each copy, and writes `active.json` last. The native storage adapter queries these SQLite files directly. It keeps a valid installed set across app updates. Native user data is a separate `user-data.json` in the app-data directory, written through a temporary file and rename. JSON backup/restore uses the shared user-data store; legacy SQLite saves are untouched. See [ADR-101](../ADR/101_ADR_json_user_data_storage.md).

Installed content shows the installed path and an **Open content folder** action on desktop. Its package file input is the in-app picker for manual replacement on mobile. Import stages and checks selected files before changing the active set; a failed import leaves the prior manifest active. A package with the same ID and version but different bytes is rejected. The optional cleanup control removes old, inactive package files; it never touches `user-data.json`.

Preview staging cleanup with `npm run native:clean-content -- --target src-tauri/resources`; add `--delete` to remove that target's `game-content` directory. The command requires the stage marker and refuses repository source or generated-input directories. Re-run `native:prepare` and `native:verify-staged` after cleanup to restore bundled content. This script does not touch saves or source assets.

The desktop and mobile offline gameplay, package size and update acceptance in the migration specification remain to be run against real packages and devices.

The product runtime is Tauri-only (ADR-103); the frontend lives in `generated/build/app/`. `npm run build` verifies that artifact without browser SQLite or service-worker payloads. Run `npm run test:native:webview` after staging to check installed Chapter 1, deck illustrations, hover previews and both hands in desktop/mobile webview engines; run `npm run test:native:rust` in an environment with the platform Tauri build dependencies. Physical mobile installation and offline acceptance remain pending.

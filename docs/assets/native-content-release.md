# Native content staging

> Status: native storage code implemented; complete release build and device acceptance pending.
> Architecture: [ADR-100](../ADR/100_ADR_tauri_native_sqlite_storage.md). Target: [Tauri migration specification](../TAURI_MIGRATION_SPECIFICATION.md).

The Tauri release recipe is `content/packages.json`. Ignored SQLite outputs belong at `generated/content-packages/<package-id>/<version>.sqlite`. After all required files exist and pass full package verification, `native:manifest` writes the tracked `content/native-release.json` with IDs, versions, sizes and SHA-256 digests. Keep the manifest in Git with the recipe; keep SQLite files and source images outside Git.

`npm run native:dev` starts the native shell without release packages. In that case the Content & updates screen reports the missing packages, and Free Play and Story stay locked until a complete set is imported. The empty-content allowance applies only to Rust debug builds; native release builds still require verified bundled packages.

```sh
npm run content:export -- --spec content/packages.json
npm run native:manifest
npm run native:prepare
npm run native:verify-staged
npm run native:build
```

`native:prepare` refuses missing packages and any byte mismatch with the tracked manifest. It stages verified files under ignored `src-tauri/resources/game-content/`. Tauri bundles that directory as resources. At startup Rust copies those packages into the platform app-data directory under `game-content/`, checks each copy, and writes `active.json` last. The native storage adapter queries these SQLite files directly. It keeps a valid installed set across app updates. Native user data is a separate `user-data.sqlite` in the app-data directory.

Content & updates shows the installed path and an **Open content folder** action on desktop. Its package file input is the in-app picker for manual replacement on mobile. Import stages and checks selected files before changing the active set; a failed import leaves the prior manifest active. A package with the same ID and version but different bytes is rejected. The optional cleanup control removes old, inactive package files; it never touches `user-data.sqlite`.

Preview staging cleanup with `npm run native:clean-content -- --target src-tauri/resources`; add `--delete` to remove that target's `game-content` directory. The command requires the stage marker and refuses repository source or generated-input directories. Re-run `native:prepare` and `native:verify-staged` after cleanup to restore bundled content. This script does not touch saves or source assets.

The current checkout has no `assets/content/` inputs or exported packages. `npm run native:manifest` fails at `generated/content-packages/duel-core/1.0.0.sqlite`, as intended. Local legacy assets map the card library and engine but do not contain a complete ready-to-export Free Play and chapter source tree. Restore or reconstruct that approved snapshot before generating a release manifest. The desktop and mobile offline gameplay, package size and update acceptance in the migration specification remain to be run against real packages and devices.

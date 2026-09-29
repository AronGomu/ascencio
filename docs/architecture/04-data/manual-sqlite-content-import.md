# Manual SQLite Content Import

> Status: implemented; owner manual Chromium acceptance pending
> Scope: offline content, user-data, package lifecycle, app/content build boundary
> Decision: [ADR-099](../../ADR/099_ADR_completed_manual_sqlite_cutover.md)

## Current model

App ships no game-content package. User obtains immutable `.sqlite` files outside app, opens **Content & updates**, then selects files locally. App never fetches package bytes from configured links. Null links in `assets/app/download-links.json` show download unavailable without disabling file picker.

Package chain:

```text
duel-core → card-library → freeplay → chapter-01 → chapter-02 → …
```

- P1. `duel-core`: frozen OCG WASM/manifest plus engine config/strings. Loader, protocol, and opponent-policy JS stay compiled app code.
- P2. `card-library`: global cards/text/scripts/sets/search indexes plus available optional card/set media.
- P3. `freeplay`: standalone presets, opponents, limits, ruleset, defaults.
- P4. `chapter-NN`: chapter story/config/decks/opponents/limits/media; references global card IDs.
- P5. `user-data.sqlite`: mutable decks, metadata/autosaves, Story, preferences, read log. It is not a package.

Free Play and Deck Builder require first three packages. New Game additionally requires `chapter-01`. Readiness is package-based, never save-based.

## Local producer

Current commands:

```sh
npm run content:export -- --spec content/packages.json
npm run content:verify -- --file generated/content-packages/duel-core/1.0.0.sqlite
npm run assets:restructure -- --plan
npm run assets:restructure -- --apply generated/content-packages/asset-move-plan.json
```

Every command supports `--help`. `content:export` reads package-owned `assets/content/<package-id>/` roots plus frozen vendor input and writes immutable releases under `generated/content-packages/<package-id>/<version>.sqlite`. Full-recipe export validates dependency/reference closure. `content:verify` validates one file's exact schema, rows, SQLite integrity/local foreign keys, script and asset hashes, and full-file identity; it does not infer active stack validity from sibling files.

Re-export with identical inputs is a no-op. Existing same package ID/version with different identity fails. Source completeness, rights, external links, and upload remain owner gates; fixture success does not prove public-release readiness.

## Import and activation

`src/storage/create-storage-client.ts` creates dedicated `src/storage/sqlite-worker.ts`. Worker owns OPFS SQLite runtime under lifetime Web Lock `ascencio-sqlite-owner-v1`; second tab receives `APP_ALREADY_OPEN`.

Import flow:

1. I1. Main thread requests persistence/capacity estimate; unavailable estimate warns rather than inventing capacity.
2. I2. Worker streams selected files to operation-owned staging names, hashes bytes, parses manifests, validates exact schemas/rows/assets and dependency closure.
3. I3. Entire multi-file selection validates before one registry generation compare-and-swap exposes new mappings.
4. I4. Failure, quota exhaustion, or precommit cancellation preserves prior active stack and user DB. Postcommit cancellation reports committed result.
5. I5. Startup reconciles owned temporary files without deleting any registry-referenced file, even when its private key ends in `.partial`.

Active package files open read-only. Queries are fixed, parameterized RPC operations; UI sends no SQL. Startup checks registry/manifests/dependencies/file presence. Explicit verification performs full package/hash checks. Optional absent media returns placeholder plus typed warning; corrupt present bytes fail verification.

## Updates, removal, and cleanup

- U1. Byte-identical same ID/version import is no-op. Different bytes at same ID/version fail `PACKAGE_IDENTITY_CONFLICT`; package identity conflict is not upgrade.
- U2. Explicit new version or valid downgrade may activate only when full retained dependency closure remains valid.
- U3. Installed dependants block removal. No save scan occurs.
- U4. Logical removal commits registry first. Byte deletion failure returns successful removal with cleanup pending; explicit cleanup retries only unreferenced owned files.
- U5. Active domain session blocks package mutation. App-update approval is separate.

## User-data isolation and backups

`user-data.sqlite` uses structural domain validators and revision compare-and-swap writes. Package operations never read or write it. Browser backup export emits standalone `user-data.sqlite`; inspection validates size, schema, integrity, namespaces, and payload structure without content lookup. Confirmed restore atomically replaces user records only and leaves package registry unchanged.

Legacy browser stores remain untouched and unread. No migration, deletion, fallback, save repair, content selector, or save-continuity gate exists. Structurally valid obsolete refs survive backup/restore. Continue may fail after content change; New Game must still initialize from active packages without reading saved slots.

Operational app-update approval and Battle diagnostics may retain IndexedDB. They are not gameplay user-data or imported-content authority.

## App-only build

`vite.config.ts` uses `publicDir:false`. Explicit `assets/app/` imports provide icon/link metadata. Build emits app code/fonts/licenses plus exact pinned SQLite executable JS/WASM. Service Worker precaches shell and SQLite runtime only.

`scripts/lib/vite-content-deny.ts` blocks direct and aliased Vite/`@fs` access to `assets/content/**` and `generated/content-packages/**`. `scripts/verify-browser-build.ts` rejects package DBs, ZIPs, OCG WASM, card/chapter media, raw content, and extra WASM in `dist/` or precache. App build requires no acquired roots and triggers no source acquisition.

## Acceptance boundary

Automated unit/component/integration/build gates establish code readiness, schemas, dependency logic, caller retirement, and output boundaries. They do not prove Chromium OPFS durability, actual browser download completion, quota/crash outcomes, second-tab recovery, offline gameplay, or backup file survival. Owner runs unchecked durable manual checklist named by root `AGENTS.md`.

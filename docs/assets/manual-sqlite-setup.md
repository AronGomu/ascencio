# Manual SQLite package setup gates

> Status: code-ready; owner Chromium/public-release acceptance pending
> Scope: local producer/app setup plus owner-owned release facts. Never store credentials here or in `assets/app/download-links.json`.
> Decision: [ADR-099](../ADR/099_ADR_completed_manual_sqlite_cutover.md)

## Local setup

1. L1. Install Node.js 24+ dependencies from lockfile: `npm ci`.
2. L2. Inspect supported producer/verification syntax: `npm run content:export -- --help`; `npm run content:verify -- --help`.
3. L3. Inspect package-root move syntax: `npm run assets:restructure -- --help`.
4. L4. Keep producer inputs under `assets/content/<package-id>/`; keep app icon/link metadata under `assets/app/`; never move frozen `vendor/ocgcore-wasm/0.1.2/`.
5. L5. Build app independently with `npm run build`; this must not acquire or package content.

Do not run export/acquisition solely to inspect syntax. Export writes immutable output and requires deliberate version/source inputs.

## Current commands

```sh
npm run content:export -- --spec content/packages.json
npm run content:verify -- --file generated/content-packages/duel-core-1.0.0.sqlite
npm run assets:restructure -- --plan
npm run assets:restructure -- --apply generated/content-packages/asset-move-plan.json
```

`content:export` validates full selected recipe/dependency/reference closure and emits directly named raw SQLite files plus `generated/content-packages/content-packages.zip`. The app accepts that single ZIP or one to four raw files. `content:verify` validates one raw file only; it does not infer active stack validity. Existing differing output under same package ID/version fails immutable identity conflict and must not be overwritten or described as upgrade.

Retained `assets:migrate`, `assets:promote`, and `assets:profiles:sync` are pure local source scanners/copy/profile tools. They do not publish, host, upload, download player packages, or determine browser activation.

## Code-ready state

| ID  | State          | Evidence anchor                                                                                                                          |
| --- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | implemented    | Producer/verifier scripts and exact package schema under `scripts/lib/sqlite-content/` + `src/storage/schema/`                           |
| C2  | implemented    | Manual import/OPFS Worker/user DB under `src/storage/`                                                                                   |
| C3  | implemented    | App-only Vite/precache/source-deny boundary under `vite.config.ts`, `scripts/lib/vite-app-assets.ts`, `scripts/lib/vite-content-deny.ts` |
| C4  | implemented    | Lifecycle UI and null-link behavior under `src/shell/application/manual-content-controller.ts`, `assets/app/download-links.json`         |
| C5  | pending manual | Owner runs unchecked durable manual checklist named by root `AGENTS.md`; automated tests do not prove Chromium OPFS/download durability  |

## Owner/public-release gates

| ID  | Status  | Required owner fact/action                                                                                                                             |
| --- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| O1  | pending | Prove complete global card metadata/text/scripts/set sources; Chapter 1 subset is not substitute.                                                      |
| O2  | pending | Approve redistribution rights for duel-core, card-library data/scripts/text, optional media, and chapter media.                                        |
| O3  | pending | Supply owner-approved external HTTPS package URLs or deliberately keep each URL null. Current tracked values are all null.                             |
| O4  | pending | Export final immutable package versions, retain receipts including optional-media omissions/exclusions, upload manually, then record exact identities. |
| O5  | pending | Run owner Chromium checklist for asset-free boot, import/offline gameplay/editor/New Game, failures, backup/restore, second tab, and app update.       |

Null URL means **Download unavailable** only. It never blocks local file selection. App never fetches package link bytes.

## Source/identity policy

- P1. Unknown global set date remains null; known date remains validated integer.
- P2. Printing identity preserves source rarity/source rarity code, including empty source code; presentation tier may be lossy only with receipt warning.
- P3. Only set memberships lacking normalized catalog definition may be excluded; receipt lists exact excluded identity/reason; raw sources remain preserved.
- P4. Missing optional media is legal and reported. Missing required scripts/config/story/deck/default/reference fails export.
- P5. Same package ID/version with changed bytes is `PACKAGE_IDENTITY_CONFLICT`. Create deliberate new version; never replace immutable release in place.

## Security boundary

- S1. Package hashes detect corruption/identity, not publisher authenticity; package signatures remain out of scope.
- S2. Local producer/restructure assumes trusted config and cooperative writer on stable Linux/Node filesystem. Same-user malicious mutation, plugins, other filesystems, and TOCTOU attacks are outside accepted boundary.
- S3. Keep public deployment private until rights, completeness, links, upload identity, and owner acceptance are recorded.

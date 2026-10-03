---
date: 2026-07-12
title: YGO Story Duel Simulator - Asset Import Pipeline
tags:
  - implementation
  - assets
  - babelcdb
  - cardscripts
  - images
status: implemented
---

# YGO Story Duel Simulator - Asset Import Pipeline

## Purpose

Acquire and verify producer inputs under package-owned roots while keeping generated third-party data out of Git. This pipeline does not build, publish, serve, or activate browser content.

The resumable command remains `scripts/download-mvp-assets.ts`. It orchestrates pinned engine acquisition diagnostics, catalog/script/string import, card-image downloads, and integrity verifiers. Current routing comes from `scripts/lib/asset-roots.ts:PACKAGE_ASSET_SOURCES`; frozen `vendor/ocgcore-wasm/0.1.2/` remains authoritative and is copied only by package producer.

[Manual SQLite setup](manual-sqlite-setup.md) owns package export/verification. [Profiles and copy-only migration](asset-profiles.md) are retained local source tools only. [ADR-099](../ADR/099_ADR_completed_manual_sqlite_cutover.md) retires hosted/ZIP/progressive player delivery.

## Sources

| Asset                              | Source                                                                                  |
| ---------------------------------- | --------------------------------------------------------------------------------------- |
| Duel engine and TypeScript adapter | Pinned npm package `ocgcore-wasm@0.1.2`, including `lib/ocgcore.sync.wasm`              |
| Standard-format metadata/text      | `ProjectIgnis/BabelCDB` → `cards.cdb`, `release-*.cdb`, and non-Rush `prerelease-*.cdb` |
| Official and prerelease effects    | `ProjectIgnis/CardScripts` → `official/c<ID>.lua` and `pre-release/c<ID>.lua`           |
| Global/procedure scripts           | Root Lua files from `ProjectIgnis/CardScripts`                                          |
| English system strings             | `ProjectIgnis/Distribution` → `config/strings.conf`                                     |
| Card image locations               | YGOPRODeck image URL convention, recorded as a provider manifest                        |

Each Git source is fetched into `.cache/upstream`, checked out at a concrete commit, and recorded in the generated manifest. Generation happens outside the live output directory, is independently verified, and keeps a recoverable previous directory during publication.

## Import flow

```text
download and integrity-check pinned ocgcore-wasm package
→ safely extract and verify ocgcore.sync.wasm + adapter files
→ sync canonical repositories
→ read and merge standard cards.cdb + release/prerelease CDBs
→ validate unique IDs and datas/texts one-to-one coverage
→ normalize ocgcore card data
→ generate 64 deterministic card shards
→ generate 64 deterministic text shards
→ read every official c<ID>.lua
→ generate 256 deterministic script-content shards
→ package root global/procedure Lua scripts
→ parse Project Ignis strings.conf
→ generate 64 image-manifest shards
→ hash every generated artifact
→ write manifest.json
→ independently verify the staging snapshot
→ write verified package inputs under assets/content/**, content/duel-core/strings/** and generated/content-inputs/**
```

## Card normalization

The importer converts BabelCDB's packed fields into the shape expected by the future `ocgcore-wasm` adapter:

- `id` → `code`;
- packed `setcode` → `setcodes[]`;
- packed level → level and Pendulum scales;
- Link monster `def` → `linkMarker` while preserving the raw defense value;
- 64-bit race and setcode fields are read through SQLite string casts to avoid JavaScript precision loss;
- card text `str1` through `str16` is preserved for effect choices.

## Sharding

Card and image shard:

```text
card ID modulo 64
```

Official script shard:

```text
script card ID modulo 256
```

This gives deterministic lookup without loading the complete catalog or all Lua source into Worker memory. The full generated snapshot remains available locally; only active-duel shards need to be fetched and expanded.

## Image policy and local archive

The catalog importer generates a complete ID-based provider manifest:

```text
https://images.ygoprodeck.com/images/cards/<ID>.jpg
https://images.ygoprodeck.com/images/cards_cropped/<ID>.jpg
```

`npm run assets:cards:download-full` downloads full-card JPEGs; `npm run assets:cards:download-cropped` downloads text-free artwork crops into sibling resumable archives:

```text
assets/content/card-library/images/full/<ID>.jpg
assets/content/card-library/images/cropped/<ID>.jpg
```

For browser-build work that only needs bundled preset decks, `npm run assets:cards:download-cropped-reviewed-pool` acquires their cropped art without downloading the complete catalog.

The downloader respects YGOPRODeck's documented 20-request/second ceiling, validates JPEG signatures, retries transient failures, skips valid existing files, and records unavailable IDs in `download-report.json`.

The initial completed archive contains 14,579 valid full-card images (about 2.37 GB). YGOPRODeck returned HTTP 404 for 215 IDs, mostly simulator-specific, alternate, legacy or prerelease records. Those IDs are explicitly recorded and require a placeholder or a second approved provider.

Current package path:

1. I1. Producer includes available media BLOBs in immutable `card-library` package and reports omissions.
2. I2. Browser imports package locally; no YGOPRODeck or package-host fetch occurs.
3. I3. SQLite Worker returns requested image bytes on demand through bounded URL leases.
4. I4. Hidden cards use card back without identity-revealing reads.
5. I5. Missing optional media renders deterministic placeholder plus visible warning.

The images and generated data remain ignored by Git because committing approximately 2.4 GB of third-party artwork would make the source repository impractical and does not resolve redistribution rights.

## Commands

From the repository root, one command downloads, generates and verifies every external MVP asset in the required order:

```bash
npm run assets:bootstrap
```

It is resumable: Git caches are reused and valid existing JPEGs are signature-checked and skipped. A failed network run can be continued by running the same command again. Cross-process locks reject overlapping acquisition runs, and `generated/mvp-assets-status.json` is only marked `ready` after both archives pass verification; consumers must not use a snapshot marked `in-progress` or `failed`.

Executable launchers are also included and set their own working directory, so they can be launched from anywhere:

```powershell
# Windows Command Prompt or PowerShell
.\download-mvp-assets.cmd
```

```bash
# macOS/Linux
./download-mvp-assets.sh
```

No npm package installation is required for acquisition itself; the launchers use Node.js 26's native TypeScript execution and Node built-ins. Requirements are Node.js 26+, Git, network access, and roughly 2.5 GB of free disk space.

To regenerate and verify entirely from already-downloaded Git and image caches without network access:

```bash
npm run assets:bootstrap -- --offline
```

Useful image overrides:

```bash
npm run assets:bootstrap -- --concurrency 8 --requests-per-second 12
npm run assets:bootstrap -- --force-images
```

The lower-level commands remain available for diagnosis or partial maintenance:

```bash
npm run assets:engine:acquire
npm run assets:engine:verify-acquired
npm run assets:upstream:sync
npm run assets:verify-all
npm run assets:cards:download-full
npm run assets:cards:download-cropped
npm run assets:cards:download-cropped-reviewed-pool
npm run assets:cards:verify-full
npm test
npm run typecheck
```

Pin alternate refs or commits:

```bash
node scripts/sync-assets.ts \
  --babel-ref <commit-or-ref> \
  --scripts-ref <commit-or-ref> \
  --distribution-ref <commit-or-ref>
```

## Source and operational layout

```text
assets/
├── app/                        # app icon + optional external download-link metadata
└── content/
    ├── card-library/           # global data/scripts/images/sets inputs
    └── chapter-01/             # story/decks/opponents/limits/media
content/
├── duel-core/                 # tracked strings/config; frozen vendor remains separate
└── freeplay/                  # tracked decks/opponents/limits/config
generated/
├── acquisition/               # acquired non-authoritative engine + reports
├── content-inputs/             # derived data/runtime manifests
└── content-packages/           # immutable SQLite release output; never app-served
.cache/upstream/                # acquisition caches
```

Downloaded card-library and chapter source families remain ignored by Git. Duel-core configuration/strings and Free Play data are tracked under `content/`. Operational reports are diagnostics, not app assets or activation receipts. Public package export/upload still requires complete sources, explicit redistribution approval, immutable identity, owner links, and manual acceptance; no automatic publishing exists.

## Integrity guarantees

`npm run assets:engine:verify-acquired` checks the pinned package identity, every extracted file's size and SHA-256, required adapter files, and the WebAssembly magic header. Package acquisition also verifies npm's pinned SHA-512 integrity value before extraction.

`npm run assets:verify-all` checks:

- every generated file's byte length and SHA-256;
- the external `manifest.sha256` digest and rejection of unmanifested files;
- manifest schema and shard counts;
- declared and actual record counts;
- unique card/text/image IDs;
- exact card-to-text and card-to-image-manifest coverage;
- official script filename validity and uniqueness;
- presence of `constant.lua` and `utility.lua`;
- image URL/card-ID consistency;
- that image redistribution has not been marked approved accidentally.

Every image check above re-hashes files against a manifest generated from those same files, so bytes substituted upstream would verify clean, and `generated/` is ignored by Git, so no reviewer diff would show them either. `image-content-lock.json` at the repository root closes that loop. It is the only image digest under version control and covers the shipped surface alone: the byte length and SHA-256 of every full card plus cropped illustration the preset decks use (120 each today), and every shop set image (50 today). `npm run frontend:verify` compares both packaged card-image forms against it and `npm run assets:sets:verify-images` compares the set archive; either fails on a difference — including art shipped without a pin.

YGOPRODeck publishes no digest of its own, so the lock is seeded from the first fetch: it proves the bytes have not changed since they were pinned, not that they are genuine. Regenerating it after an intended upstream art refresh is a separate, explicit command, never a side effect of downloading or verifying, because a lock rewritten by the run it guards would prove nothing:

```bash
npm run assets:images:pin
```

Entries and keys are ordered by content alone, so the resulting diff shows the art whose bytes moved and nothing else.

## Retired delivery generations

Hosted dev/player ZIP/object bundles are retired. [`asset-delivery-bundles.md`](asset-delivery-bundles.md) remains historical rationale only. Current output is immutable SQLite via `legacy:content:export-sqlite`; app never consumes acquisition roots directly.

## First successful snapshot

The initial verified run produced:

- pinned and verified `ocgcore-wasm@0.1.2`, including `ocgcore.sync.wasm` and its JavaScript/TypeScript adapter;
- 14,794 standard-format card records, including current release/prerelease additions;
- 14,794 text records;
- 13,399 official card scripts;
- 125 prerelease card scripts;
- 25 global/procedure scripts;
- 835 system strings;
- 33 victory strings;
- 134 counter strings;
- 756 set-name strings;
- 14,794 image-manifest records;
- 14,579 downloaded and verified full-card JPEGs;
- 215 provider-missing image IDs recorded explicitly;
- approximately 45 MB of generated uncompressed data/script artifacts;
- approximately 2.37 GB of locally archived card images.

These values are observations, not hard-coded expected counts; future upstream snapshots may change them. Rush Duel, Skill, Goat-only and unofficial anime/manga databases/scripts are intentionally excluded from the initial Master Rule duel-client catalog.

# ADR-099: Completed manual SQLite content and user-data cutover

> Status: accepted; implemented
> Decided: 2026-09-24
> Owners: storage / shell / content producer / asset tooling / release
> Implements: ADR-095, ADR-096, ADR-097, ADR-098
> Supersedes for current runtime: ADR-075–078, ADR-080–086, ADR-088, ADR-092–094 where they specify hosted, progressive, ZIP, Cache Storage/IndexedDB content, chapter-owned catalogs, or save-compatible content selection
> Preserves: ADR-079 explicit app-update approval; ADR-087 source corrections; ADR-089–091 semantic domain boundaries; frozen `vendor/ocgcore-wasm/0.1.2/`

## Context

C1. Product no longer needs browser-managed R2/S3, progressive object, ZIP, release-selector, or save-migration delivery. Users obtain immutable package files outside app, then select them locally.

C2. App code, immutable game content, mutable user data, app-update state, and duel diagnostics have different lifecycle and trust requirements. Treating them as one snapshot or one persistence layer made updates depend on content hosting and old-save continuity.

## Decision

D1. Current content format is immutable SQLite packages: `duel-core`, `card-library`, `freeplay`, then sequential `chapter-NN`. Developer producer reads `content/packages.json` plus package-owned `assets/content/<package-id>/`, writes `generated/content-packages/<package-id>/<version>.sqlite`, and refuses changed bytes under the same package ID/version. `scripts/export-content-packages.ts` validates selected dependency/reference closure; `scripts/verify-content-package.ts` validates one file only.

D2. Browser imports user-selected files through `src/storage/create-storage-client.ts` into OPFS managed by `src/storage/sqlite-worker.ts`. One lifetime Web Lock allows one active app tab. `content-registry.sqlite` selects one active package version per ID by generation; staged files become visible only through registry commit. Package queries are fixed, parameterized, read-only operations. No app code fetches package bytes, generates a release selector, extracts ZIPs, or uses Cache Storage/IndexedDB as content authority.

D3. Mutable decks, deck metadata/autosaves, Story records, preferences, and Story read log live in isolated `user-data.sqlite`. Backup export/inspection/confirmed restore affect that DB only. Package import, update, verify, removal, and cleanup never read or rewrite user records. Legacy stores remain untouched and unread; there is no migration. Existing saves may become semantically obsolete after package replacement. New Game depends on active packages, not saved-slot validity.

D4. App build is content-free. `vite.config.ts` sets `publicDir:false`, imports only explicit `assets/app/` files, emits and precaches pinned SQLite executable JS/WASM, and denies `assets/content/**` plus `generated/content-packages/**` through `scripts/lib/vite-content-deny.ts`. `scripts/verify-browser-build.ts` rejects package DBs, OCG WASM, card/chapter media, archives, raw content, or extra WASM in `dist/`. OCG WASM remains immutable duel-core package data; duel loader/protocol/AI application code remains compiled app code.

D5. Content updates are local imports. Byte-identical same-version content is a no-op; same package ID/version with different file identity fails `PACKAGE_IDENTITY_CONFLICT`, not an upgrade. Dependencies block removal. Optional absent media remains playable with warning/placeholder behavior. App updates remain a separate explicit service-worker approval flow in `src/shell/application/app-update-controller.ts`; its approval/diagnostic IndexedDB use does not become content or user-data authority.

D6. Retained `assets:migrate`, `assets:promote`, `assets:profiles:sync`, acquisition, and verification commands are local source-management tools only. They do not publish, host, download player packages, or determine browser activation. `scripts/lib/asset-roots.ts:ASSET_SOURCES` is a legacy copy/profile map; `PACKAGE_ASSET_SOURCES` is current package input routing. Source originals and frozen vendor bytes are never cleanup targets.

## Build and release state

B1. Automated checks establish code-ready app/content separation and local schema/runtime behavior. They do not establish Chromium OPFS durability, completed browser downloads, real multi-file quota/crash behavior, or manual gameplay acceptance.

B2. `assets/app/download-links.json` contains null URLs. Complete source availability, redistribution rights, owner upload locations, and public hosting approval remain owner-owned release gates. Null links never disable local file selection.

B3. Public package authenticity is not cryptographically signed. Hashes detect corruption and immutable identity; they do not authenticate publisher. Keep deployment private until distribution rights and package source completeness are approved.

## Security boundary

S1. Supported operational boundary is trusted app code/config on stable local Chromium/Vite and trusted local Linux/Node producer filesystems. Package files are untrusted data and receive bounded schema, path, row, integrity, dependency, and hash validation before activation.

S2. Local restructuring receipts prevent accidental clobber under one cooperative writer; they are not protection from malicious same-user filesystem mutation or time-of-check/time-of-use attacks. Future plugins, arbitrary SQL, hostile producer extensions, other platforms/filesystems, multi-tab storage, or signed distribution require a new threat model and acceptance evidence.

## Consequences

C1. App can boot asset-free and update independently from content. Free Play/Deck Builder need core/library/freeplay; Story New Game additionally needs chapter01.

C2. Manual transfer and owner-run Chromium verification replace hosted delivery automation. Package changes can strand old saves by design; backups preserve bytes, not playability.

C3. Historical ADR bodies remain useful provenance. Their explicit supersession headers plus this record determine current behavior; old commands and paths are not current setup instructions.

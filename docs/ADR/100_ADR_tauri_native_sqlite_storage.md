# ADR-100: Tauri native SQLite storage and bundled content

> Status: implemented in code; release acceptance pending
> Date: 2026-09-29
> Scope: Tauri desktop and mobile targets
> Browser behavior: ADR-099 remains in force

## Context

ADR-099 completed a browser runtime that imports immutable SQLite packages into OPFS and stores user data in a separate SQLite database. The Tauri migration specification requires a fresh native install to contain the complete Free Play and Chapter 1 content set, with manual replacement and no network dependency.

## Decision

1. The native build uses the same Svelte shell and the same dedicated duel Worker. `src/storage/create-storage-client.ts` selects a native storage adapter under Tauri and keeps the ADR-099 OPFS Worker in the browser. The native adapter exposes the existing `LocalStorageClient` contract.
2. `content/packages.json` remains the package recipe. `scripts/native-content-release.ts` verifies every required exported package and writes `content/native-release.json` with package ID, version, size and SHA-256. The Tauri build refuses missing or mismatched packages. SQLite files live in ignored build resources; the tracked manifest is the audit anchor.
3. Rust seeds bundled resources into the platform app-data directory under `game-content/`. `active.json` selects the installed package versions and generation. A valid installed set survives later app updates. The native package reader opens active SQLite files read-only and uses fixed, parameterized queries; it does not copy the content into OPFS.
4. Manual import stages selected SQLite files in the content directory, validates file identity, SQLite integrity, schema objects, dependencies and embedded asset hashes, then writes the active manifest last. Same ID/version with different bytes fails. Session leases block import, removal and cleanup during a duel. Required bundled packages cannot be removed from the active set.
5. Native saves, decks and preferences live in `user-data.sqlite` beside `game-content/`, outside it. User writes use revision checks and SQLite transactions. Backup export, inspection and confirmed restore affect only this user database. Browser legacy stores remain untouched.
6. Desktop Content & updates opens the installed content directory. The in-app file input invokes the platform file picker for manual replacements on mobile. `scripts/clean-native-content.ts` removes only a marked staging target's copied `game-content/` folder after an explicit `--delete`.

## Release gate

This repository currently lacks `assets/content/` source inputs and exported `generated/content-packages/*.sqlite`. `native:manifest` fails at the missing `duel-core` package, so the complete bundled release cannot yet be built or launched. Desktop offline gameplay and Android/iOS install, import, package-size and duel acceptance remain unverified. This ADR records the implemented code path, not a completed release.

## Consequences

The native bundle is deliberately large because the required card media is offline at first launch. Actual package sizes and each target's distributor limits must be measured from a restored content snapshot. The browser remains content-free under ADR-099; its build and OPFS behavior are unchanged.

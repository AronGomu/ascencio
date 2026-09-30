# Tauri migration specification

> Status: target specification; implementation and platform acceptance pending.
> Source: owner request of 2026-09-29. This document describes the requested migration, not the current browser runtime.

## Goal

Run the existing Svelte game as an offline Tauri application on desktop and mobile. A fresh installation must contain the game assets needed to open Free Play from the main menu and to play the Visual Novel, including its duel handoffs. Players must not have to download or import a card database before starting either flow.

## Required behavior

1. The desktop and mobile builds launch into the existing application shell. The duel engine remains authoritative in its Worker; the migration must not change card rules or reveal hidden identities.
2. A freshly installed build includes the complete verified content set required for Free Play and the available Visual Novel chapters: duel core, global card library and media, Free Play data, and chapter content. The release process reports missing required content and refuses an incomplete build. Optional media omissions remain explicit and use the existing placeholder behavior.
3. Free Play is reachable from the main menu and from the Visual Novel. Both routes can select decks, start a duel, and return to their correct origin without a manual content-install step.
4. Installed game content lives in a documented, writable, user-accessible location separate from saves, decks, and preferences. On desktop the app exposes an **Open content folder** action and documents the path. On mobile the app provides an in-app import or replacement action using the platform's file picker, since direct folder access is platform-dependent.
5. Bundled assets seed the installed content location. Manual replacements are verified before activation; a failed or partial update leaves the last valid content usable. A later app update does not silently overwrite a valid manual replacement. Immutable package IDs, versions, dependency checks, and hashes remain meaningful; different bytes cannot silently replace the same package ID/version.
6. A repository script removes copied game-content assets from a specified local build or installation staging location. It defaults to a preview, requires an explicit target for deletion, and affects only that target's game-content directory. It must not delete source assets, generated release inputs, saves, decks, preferences, or the frozen vendor directory. The script verifies that a rebuilt package restores a complete first-launch content set.

## Asset storage and release tracking

The full card-image archive and generated game packages stay outside Git. Git records the package recipe and a compact release manifest with package versions, file sizes, and SHA-256 digests. Each build is tied to one verified manifest, so the included assets can be reproduced and audited.

For the owner's personal backup, use a private folder in their Google Drive account. The [Google Drive backup procedure](assets/google-drive-backup.md) saves dated snapshots of the restorable repository, including Git history and ignored game assets, and verifies each uploaded archive. The build reads the restored local snapshot. The installed app needs no Drive connection or credentials. A backup copy does not itself grant permission to redistribute the assets in a release; the asset-rights review remains a separate release gate.

The current local checkout has approximately 4.4 GB under `assets/`, including roughly 2.3 GB of full card images and 2.1 GB of cropped images. Those local directories are ignored by Git. Release tooling must measure the actual selected snapshot rather than assume these sizes are fixed.

A free personal Google account currently provides up to 15 GB shared by Drive, Gmail, and Photos. This snapshot fits only if that account has at least the required free space; retained snapshots and other account data also count toward the quota. Avoid a mirroring command that can delete the only remote copy when local files are removed.

## Migration boundary

[ADR-099](ADR/099_ADR_completed_manual_sqlite_cutover.md) documents the **current** browser behavior: content-free builds and user-selected SQLite imports into OPFS. The Tauri target changes that delivery and storage boundary. Implementation must update the owning architecture decisions and release checks when the native path is built; this specification does not claim that work is complete.

The existing package producer and integrity checks should remain the source for release content. Native storage must preserve the separation between immutable game packages and mutable user data. The frozen `vendor/ocgcore-wasm/0.1.2/` rule remains in force.

## Acceptance evidence

- Build and launch desktop and mobile targets with a fresh install and no network access; verify that Free Play and the Visual Novel can start and complete a duel using bundled content.
- Verify main-menu and Visual Novel Free Play entry and return paths on each supported platform.
- Show the installed content location or import action, replace a package manually, restart, and verify the selected version and its integrity. Inject a corrupt or interrupted replacement and confirm that the prior valid version still works.
- Run the cleanup script against a staged build, confirm only staged content is removed, then rebuild and verify that the bundled content returns. Confirm user data and source assets are unchanged.
- Record build size and packaging limits for every target. If a mobile distributor cannot accept the complete asset set in one install package, resolve the packaging route without weakening the fresh-install offline requirement.

## Open release choices

- Which desktop operating systems and mobile stores or distribution channels are required for the first release.
- Which chapters and optional media count as the complete initial content set, subject to source availability and distribution rights.

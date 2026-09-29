# Immutable Content Packages and Active Stack

> Status: implemented
> Decision: [ADR-099](../../ADR/099_ADR_completed_manual_sqlite_cutover.md)

## Immutable unit

Each released SQLite file is immutable under `(package_id, version, sha256)`. Package manifest declares schema, type, version, dependencies, and creation time. Same ID/version with different bytes is identity conflict, not update.

Package roles remain separate:

- P1. `duel-core`: frozen engine bytes/config/strings.
- P2. `card-library`: global cards/text/scripts/sets/search/media.
- P3. `freeplay`: standalone decks/opponents/limits/config.
- P4. `chapter-NN`: chapter data/media with sequential dependencies.

## Generation and activation

Developer export writes `generated/content-packages/<package-id>/<version>.sqlite`; outputs never enter app build. Browser stages selected files privately, validates full candidate closure, then changes `content-registry.sqlite` mappings in one generation compare-and-swap transaction. Registry mapping—not filename rename or cross-DB transaction—defines visibility.

App boot performs bounded stack checks. Import and explicit Verify perform full integrity/hash/reference validation. Active mode session pins generation and blocks lifecycle mutation until release.

## Separation from app and user data

App build identity derives app source/config and explicit `assets/app/` bytes, never package DBs or acquired media. Service Worker update approval remains separate from content import.

`user-data.sqlite` has no package generation binding. Content replacement may make saved semantic refs obsolete; no compatibility selector, historical rollback, or save rewrite occurs. Backup preserves user bytes independently.

Acquisition details remain in [`../../assets/asset-import-pipeline.md`](../../assets/asset-import-pipeline.md); package setup/release gates remain in [`../../assets/manual-sqlite-setup.md`](../../assets/manual-sqlite-setup.md).

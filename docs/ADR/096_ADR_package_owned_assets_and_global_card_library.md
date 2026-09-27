# ADR-096: Package-owned assets; global card library

> Status: accepted; implemented
> Implementation consolidated by [ADR-099](099_ADR_completed_manual_sqlite_cutover.md). Baseline statements below remain decision-time history.
> Decided: 2026-09-24
> Owners: asset tooling / cards / decks / story / shell
> Amends: ADR-081 D1–D6; ADR-086 D1–D3,D5; ADR-091 D4 (mode readiness)
> Relates: ADR-043 (global catalog), ADR-089 (canonical Cards), ADR-095 (manual package delivery)
> Baseline: `3dbc1ce937ad83865a08622ef1b7070117539718` — source roots follow UI domains; Free Play takes defaults from first installed chapter.

## Context

C1. `scripts/lib/asset-roots.ts` maps shared/domain source folders; `src/shell/application/selected-gameplay.ts:15-44` derives deck/opponent/defaults from chapter union, including `chapters[0]`. This prevents standalone Free Play despite available engine/global card data.

C2. Chapter-owned copies of card metadata/art enlarge packages and split authority. Manual DB files need clear content ownership independent of UI directory ownership.

## Decision

D1. `assets/app/` owns bundled shell media and app download-link metadata. `assets/content/<package-id>/` owns package input bytes and package-specific authoring. `generated/content-packages/<package-id>/<version>.sqlite` holds immutable producer output, never app public assets/precache. Release recipes/governance metadata may remain outside asset roots; they are not duplicate authoritative content. Narrative canon remains under `docs/story/`.

D2. Ownership follows DB identity: `duel-core` contains frozen engine WASM/manifest and global engine strings/config; `card-library` contains complete global card definitions/text/scripts/set data/search indexes and available full/cropped/set art; `freeplay` contains default banlist/presets/opponents/config; `chapter-NN` contains narrative/progression/map/media/decks/opponents/config and card-limit deltas. Application loader/protocol/AI JS stays compiled, not replaceable downloaded JS.

D3. Frozen `vendor/ocgcore-wasm/0.1.2/` remains byte-identical, unmoved, authoritative. Producer copies verified engine bytes into duel-core; non-authoritative acquired engine is tooling input only. Asset restructuring uses exact inventory, hash-verified non-clobbering moves and recoverable ownership receipts, never blanket deletion.

D4. Free Play and Deck Builder require duel-core + card-library + freeplay, no chapter or Story save. New Game additionally requires chapter01. Chapter N requires every earlier chapter; packages never reference later chapter. Existing story collection ownership still constrains use; global catalog visibility is not ownership grant.

D5. Chapters reference global card IDs, never copy card stats/scripts/text/art. `chapter_card_limits(card_code,deck_limit)` permits 0/1/2; no row means3 independently of Freeplay banlist. Initial era restrictions become explicit forbidden rows for excluded global IDs; no ChapterCardPool or search hiding. Chapter-selected sets configure shop/grants, not global catalog truncation.

D6. Owner-approved global source policy: unknown `releaseYear` remains null, known year is integer1..9999; focused storage `GlobalSet` DTO does not widen dated chapter `StorySet`. `set_cards` identity is `(set_id, card_code, printing_code, source_rarity, source_rarity_code)`, preserving distinct source rarity variants and empty source rarity codes. Existing rarity normalization supplies presentation tiers only; export receipt reports every lossy source label while retaining original fields.

D7. Missing normalized catalog definitions are the sole membership-completeness exception: exclude those memberships from playable packages, report every excluded set/card/printing identifier and reason in `ExportReceipt.excludedSetMemberships`, preserve raw source bytes. Retain every catalog card and global set; do not apply chapter-specific corrections globally or fabricate definitions/dates. `src/storage/contracts/package-build.ts` defines exclusion/warning receipt fields; `src/storage/schema/sql.ts` pins exact DDL. Prior-schema generated fixtures remain immutable evidence, never overwritten or relabeled as a new release.

## Consequences

C1. Large, near-immutable card-library package enables standalone Free Play/Deck Builder. Chapter packages shrink; catalog changes can require coordinated compatible dependency updates.

C2. Root changes touch acquisition, authoring path references, generators, tests, Vite deny rules and build gates. App build must succeed without acquired package sources. SQLite runtime WASM is app executable exception, not permission to precache game WASM/media.

C3. Complete metadata/scripts are required; optional art absence remains visible and does not block gameplay. Source completeness and redistribution rights are separate from fixture/test success.

## Alternatives rejected

A1. Four UI-domain asset roots: do not match package ownership.

A2. Broad runtime package plus chapter-filtered global catalog: conflates engine/cards/freeplay and keeps chapters prerequisite for unrelated modes.

A3. Chapter-owned duplicated card data: unnecessary bytes and competing authority.

A4. Chapter-specific hidden search pool: not needed for ban/limit differences; explicit limits retain global catalog access.

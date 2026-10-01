# Moddable sets and shop content

## Assumptions

Approved scope is the staged migration described in the comparison: readable per-entity sets, boosters, shops and economy policies with explicit compile-time mod composition, feeding current immutable SQLite packages. The application-wide ADR-104 startup-memory, loose-mod discovery and live-media cutover remains separate. This stage must have one content authority, not a second permanent runtime architecture.

Acquired full card/set content stays ignored. Conversion from verified existing packages supplies readable sources without historical provider evidence. Authored policies, tooling, fixtures and instructions are tracked. Preserve existing IDs, saves, base prices, draws and eligibility. Existing owner changes remain untouched; reviewed changes commit locally on main.

## Success criteria

A mod author can edit or explicitly override a set, booster, shop offer or economy policy using readable JSON, compile a new package version, and observe matching purchase, sale and pack-opening behavior. Invalid references, ambiguous overrides and invalid numerical policies fail before activation. Base content remains semantically equivalent and existing booster inventories remain usable.

## Execution

- [x] A1. Review source layout, contracts, migration and identity design with Astra High. verify: reviewed design keeps existing set tables, carries validated commerce through package config/StoryRelease, retains base booster IDs, uses separate IDs for new products, and persists variable pack boundaries. Explicit compile-time override composition precedes immutable package export.
- [x] A2. Implement readable entities, bounded validation, deterministic composition and conversion. verify: focused tests demonstrate base parity, additions, explicit overrides, conflict/reference rejection and export independent of authoring evidence.
- [x] A3. Carry validated policies through native packages into Story purchase/sale/draw/reveal behavior. verify: tests change prices and pack sizes through content and reject invalid commands without changing saves.
- [x] A4. Document author workflow, examples and manual acceptance. verify: documented commands run against a small fixture; manual checks remain unchecked until exercised.
- [x] A5. Independently review implementation and repair evidenced failures. verify: Node 26 headless checks passed with `VITEST_MAX_WORKERS=2` (108 legacy, 2,973 unit including performance, 57 integration tests); component suite passed 1,406 tests; Rust passed 17 tests with `CARGO_BUILD_JOBS=2`; build budgets and reproducibility passed (83 files); Chromium native-webview regression passed.
- [x] A6. Commit accepted exact paths to main and report evidence and remaining platform limits. verify: implementation committed as `cedd8cbc` on main; all 11 owner-file fingerprints unchanged; acquired assets and frozen vendor excluded from staging. Removed 19 agent scratch files, `.tmp/moddable-shop-review/` and redundant `generated/shop-content-canonical/`; retained canonical inputs and prepared packages.

## Out of scope

No full ADR-104 runtime cutover, save-store migration, vendor engine change, visual redesign, remote publication, or edits to owner feedback and pending architecture documents. Physical-device acceptance and the known unavailable WebKit library cannot be claimed from unit tests.

## Implementation evidence

A2–A4: Node 26 focused compiler/export/runtime/UI tests pass, including the executable small-pack example, normal CLI diagnostics, addon installation and mixed-pack save/reveal behavior. Real 1.1.0 packages exported and release pins updated; SQL comparison preserves every prior content row and media hash, with only commerce/shop references added. Manual checks M1–M4 remain unchecked.

Independent review confirmed core configuration, schema and executable/media payloads unchanged; the new core container uses SQLite 3.53.4 instead of 3.51.2. The browser component check advanced a three-card pack to five cards and checked desktop/mobile viewport overflow. This does not substitute for physical-device acceptance.

A preliminary broad unit run exited 137; final validation limited Vitest to two workers. The first headless run reported a failed unchanged path-test process; its isolated rerun and the complete headless retry passed. WebKit was not rerun because the previously confirmed `libavif.so.16` launch dependency remains unavailable. Graphify code relationships refreshed; its known Svelte parser limitation remains distinct from the successful TypeScript/Svelte checks. No new audit or fix cycle follows this completed task.

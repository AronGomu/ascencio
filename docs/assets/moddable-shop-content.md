# Readable sets, boosters, shops and economy policies

This stage compiles readable JSON into the existing immutable native SQLite packages. Gameplay reads their validated commerce configuration. Explicit overrides run at build time; the app does not discover loose mod folders. ADR-104 startup-memory loading, loose runtime mods and live-media replacement remain separate work.

## Sources and provisioning

| ID | Source | Ownership |
| --- | --- | --- |
| S1 | `assets/content/card-library/sets/<id>.json` | Ignored acquired set metadata and printing membership |
| S2 | `assets/content/card-library/boosters/<id>.json` | Ignored generated base products; IDs equal existing set IDs |
| S3 | `content/commerce/economies/base.json` | Tracked authored resale, singles and pack-eligibility policy |
| S4 | `content/commerce/shops/chapter-01.json` | Tracked authored product offers and prices |
| S5 | `content/commerce/chapters/chapter-01.json` | Tracked chapter shop reference and exact allowed card pool |
| S6 | `content/commerce/sources.json` | Source directories, source compatibility version and explicit mod files |

Full acquired content stays outside Git. A clean checkout still needs the documented acquired catalog, scripts, media and prepared packages. The checked-in conversion descriptor pins the accepted pre-commerce packages; conversion verifies their byte sizes and SHA-256 before reading them, opens SQLite read-only, and writes only a new destination:

```sh
node scripts/convert-shop-content.ts content/commerce/conversion-release.json generated/shop-content-import
```

The destination must not exist. Its `sets/` and `boosters/` directories are the acquired canonical inputs. Place those directories under `assets/content/card-library/` for initial provisioning. The emitted `economies/`, `shops/` and `chapters/` are migration comparison output; tracked authored policy files already own those inputs. Do not replace authored changes with generated defaults.

Conversion retains 1,036 set IDs, 44,298 printings and the exact 1,627-card chapter pool, including the one allowed card outside the selected sets. It does not infer IDs from titles or collapse printing variants. Old provider evidence is no longer needed for ordinary package export or image verification. Historical acquisition commands (`assets:images`, `assets:sets`, `assets:lock`, `generate:shop-sets`) retain their historical provenance inputs; this change does not provision or rewrite those archives.

## Entity contracts

Each entity lives in `<id>.json`; filename and ID must agree. IDs use ASCII letters, digits, `_` and `-`, at most 128 characters. Unknown fields fail validation. A set explicitly carries its name, nullable release year/image path, and printing rows with card code, printing code, normalized rarity and original rarity strings. Every printing must reference the package card catalog.

An economy supplies all seven `sellPrices`, a positive integer `singlesMultiplier`, and `maxPackResale`. A booster supplies `name`, `setId`, `replacement: "with"`, and ordered slots. Each slot has `count`, a list of `{rarity, weight}`, and `fallback: "all"`. Weights apply to each eligible card, not to a rarity tier as a whole. Empty tier pools fall back to uniform selection over the entire set. Only draws with replacement are supported; other duplicate/fallback vocabulary is rejected. Total pack size is 1–100 cards; weights are positive integers up to 1,000,000.

A shop references an economy, sets `singles`, and lists unique product offers with `priceDp`, `enabled` and `requiresProgress`. Requirements reuse campaign facts/chapter completion contracts. Prices may be zero; monetary inputs are bounded integers. Purchase totals, inventory increments and resale balances must remain safe integers. A chapter references its shop, and every offered product's set must be in that chapter's selected sets. Dependencies, entity collisions and references are checked before activation in TypeScript and Rust.

Base behavior stays 100 DP per pack, eight common draws plus one non-common draw, with replacement and whole-set fallback. Resale is 1/2/5/20/50/50/50 DP; singles cost four times their printing-tier resale. Pack eligibility uses expected resale at most 21 DP, valuing each card at its highest normalized base rarity across all chapter-selected sets, including sets whose packs cannot be bought.

## Explicit mods and package builds

`content/commerce/examples/small-packs.json` is an inactive example. It adds a five-card product sharing the existing Legend of Blue Eyes set, explicitly changes that original product to three cards, and replaces chapter offers with prices 12 and 25 DP. Adding its path to the source manifest's `mods` array enables it for the next build. Existing unopened packs retain their product identity; changing that product's definition deliberately changes future openings.

A mod declares `id`, `apiVersion: 1`, the exact `baseVersion`, dependencies, additions and overrides. The package recipe's `sourceVersion` must match the source manifest and mod compatibility version. An override names `kind`, `targetId`, replacement fields and the IDs of earlier mods it supersedes. Arrays replace whole arrays. Identity fields cannot change. Overlapping writes require both a declared dependency and an explicit `overrides` entry; unknown targets, cycles, collisions and unsupported fields reject the entire candidate. Inputs remain unchanged on failure. Do not edit `baseVersion` merely to bypass incompatibility; it identifies the recipe's source contract, independently from output package versions.

Any card-library or card-pack recipe can specify `sourceManifest` and `sourceVersion`. The same compiler accepts references supplied by declared package dependencies while emitting only entities owned by that package. An unrelated installed library cannot satisfy a reference. Runtime composition is additive; overriding installed entities requires compiling a replacement package, not publishing a conflicting add-on.

After changing sources, bump affected immutable package versions and dependency requirements in the recipe before exporting:

```sh
npm run content:export -- --spec content/packages.json
npm run native:manifest
npm run native:prepare
```

Review export results before repinning or staging. Existing package bytes are never overwritten with different content under the same identity. Compiler failures report a structured code, phase, source file, JSON pointer and related sources through the normal export CLI. Prepared package installation still owns atomic activation; it never modifies saves.

The reproducible small-fixture exercise needs no acquired source/provider JSON:

```sh
npx vitest run tests/unit/commerce/source-export.test.ts tests/unit/commerce/content.test.ts tests/unit/commerce/runtime.test.ts
```

It exports and installs a base package plus a shop-only add-on referencing its parent, tests explicit conflicts and invalid sources, and exercises purchases, sale pricing, draws and saved grouping. The fixture directories are disposable and automatically removed.

## Save and presentation compatibility

Unopened inventory keys are product IDs. Base IDs remain exactly the existing set IDs. Two products sharing a set keep separate quantities and reuse the set's illustration. Owned installed products can be opened after their offer is removed; missing products or missing sets retain their unopened quantity.

Opened cards retain their original flat array plus optional saved `openedPackSizes`. New mixed openings persist exact boundaries; old saves without the field retain nine-card grouping. Current mod definitions never reinterpret saved results. Reloading and advancing a three-card/five-card opening reveals the original groups. All cards are credited atomically at opening, before presentation. Opening work is bounded to 1,000 packs and 100,000 cards per operation; the existing scrollable grid wraps larger packs.

The 1.1.0 release also rebuilds the unchanged duel-core payload with Node 26's SQLite 3.53.4, replacing a SQLite 3.51.2 container. Engine bytes, vendor manifest, assets, config and schema are unchanged; only package version/date and container encoding change. Accepted 1.0.0 packages remain intact.

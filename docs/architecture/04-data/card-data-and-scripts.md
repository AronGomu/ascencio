# Card Data, Strings, and Scripts

> Status: implemented for manual SQLite packages
> Decision: [ADR-099](../../ADR/099_ADR_completed_manual_sqlite_cutover.md)

## Producer sources

- S1. Standard-format Project Ignis BabelCDB catalog, including release and non-Rush prerelease additions.
- S2. Compatible official/prerelease Project Ignis CardScripts plus required global/procedure scripts.
- S3. Project Ignis system strings and card text/options.
- S4. Package-owned authored inputs under `assets/content/`; frozen OCG bytes remain under `vendor/ocgcore-wasm/0.1.2/`.
- S5. Rush Duel, Skill, Goat-only, and unofficial anime/manga catalogs remain excluded formats.

`content:export` creates global card rows/text/scripts/sets/search indexes in `card-library`; `duel-core` carries frozen engine bytes/config/strings. Chapters reference global card IDs and retain chapter limits/config rather than duplicate global card data.

## Completeness and source fidelity

All normalized catalog cards, sets, scripts, globals, and valid printing variants remain global. Unknown global set years stay null. Printing identity preserves source rarity and source rarity code, including empty source code. Chapter-only corrections never mutate global source policy.

Only memberships whose normalized card definition is missing may be excluded. Export receipts identify every excluded set/card/printing and every inventory-only required-card script declaration. Missing required authored script/config/story/deck refs fail export; missing optional media is reported.

## Runtime loading

Before duel creation:

1. R1. Shell acquires package session and semantic Battle inputs from active stack.
2. R2. Runtime validates decks against global Cards plus selected mode/chapter limits.
3. R3. Required aliases, card records, strings, and Lua scripts preload into synchronous maps.
4. R4. Dedicated Duel Worker initializes frozen OCG engine from `duel-core` package bytes.
5. R5. Missing required engine/input fails affected mode with exact typed storage/runtime error.

SQLite never runs inside synchronous core callbacks. Loader/protocol/opponent-policy application JS remains compiled code; imported DB cannot replace executable JS.

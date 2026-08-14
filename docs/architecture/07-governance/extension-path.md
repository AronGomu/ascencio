# Extension Path

> Status: experience prototypes implemented; production integration not started

The preset duel release gate is complete. Story/deck work follows the approved [`card-game-vn-handoff`](../../card-game-vn-handoff/00-index.md) and its [`phased implementation plan`](../../card-game-vn-handoff/08-phased-implementation-plan.md). Prototype code validates UX only; it does not define production persistence or cross-domain integration.

## Normative sequence

Phase numbering matches [`08-phased-implementation-plan.md`](../../card-game-vn-handoff/08-phased-implementation-plan.md) exactly:

0. Contract and ownership scaffolding; no runtime behavior change.
1. Self-contained battle facade around completed duel.
2. Validated content schemas and bundled prologue pack.
3. Pure campaign reducer and deterministic narrative runtime.
4. Typed Svelte shell, narrative UI, and map UI.
5. Saves, ContentManager, AssetResolver, and PWA shell.
6. End-to-end prologue acceptance.
7. Unrestricted local deck library/editor with YDK import/export.
8. Progressive chapter/media downloads.

Later optional narrative/audio/localization/product extensions remain outside numbered plan until their owning decisions are approved.

## Preserved constraints

Every extension must preserve:

- dedicated Worker authority over WASM, raw protocol, scripts, response indexes, duel handles, and opponent policy;
- typed clone-safe privacy-filtered main-thread state;
- Svelte ownership of all interactive UI and semantic DOM presentation;
- atomic duel snapshot versioning and current cache rollback;
- deterministic real-WASM compatibility coverage;
- bounded diagnostics, cleanup, and Worker replacement;
- current private-only distribution gate;
- permanently pinned `vendor/ocgcore-wasm/0.1.2` engine files.

No extension may directly import duel Worker internals into campaign/narrative/deck/map code, serialize live battle state, treat technical battle failure as campaign loss, or modify vendored OCG Core.

Current MVP scope remains correctly documented as direct-to-duel. Handoff docs describe target architecture; prototype routes remain isolated until production integration lands.

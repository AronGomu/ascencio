# ADR-091: Shell alone composes Content into semantic ports

> Status: accepted; implemented
> Decided: 2026-09-13
> Owners: shell application / content / cards / story / battle
> Amends: ADR-085 D1–D2,D4–D5; ADR-077 D3; ADR-078 D2
> Implemented: `5a3ba36f5f165d3a4db24574e1bdaaf46ac551f6` (T7 Battle runtime port) and `c9466f69ef3d4f550ee70d986a2d7f36b4c924b1` (T8 Shell semantic composition/validation).
> Baseline: `010401956d0cd59d8e6dda91bd367040f5de669e` — inspected pre-implementation source.

## Context

At baseline 010401956d, installer code is already integrated but Story, Battle, Deck Editor, Decks import root Content. Content gameplay verifier imports Decks masks/ruleset. Passing ContentSetRef into Worker makes storage verification a domain responsibility. Source: src/content/install/verify-gameplay.ts; src/battle/worker/create-browser-runtime.ts; src/battle/duel/contracts/duel-command.ts.

## Decision

D1. Root Content implements structural manifests, immutable downloads, local integrity/presence, cache/file reads. Only `src/shell/application/` and `src/shell/adapters/` import its public entry. Svelte screens receive Shell ViewModels/actions; no Content imports in screens or domains.

D2. Consumers own semantic ports: Cards image acquisition, Story release/media/save migration, Battle clone-safe runtime input. Shell-owned adapters translate low-level Content records. Domains receive no manifests, Content receipts, Blob, cache keys, raw content paths, generic AssetReader.

D3. Shell invokes pure Cards/Decks/Story/Battle semantic validators before mount/activation. Content validates mechanics only; Shell never implements card quantity, deck placement, chapter continuity, engine rules.

D4. One Shell readiness gate precedes domain mount. Required injected input failure throws through explicit async/error dispatch to Shell root containment, returning Main Menu; optional media yields null plus warning/placeholders. Domains do not repeat install/manifest gates. Unsupported deliberate route/devtools bypass gains no recovery system.

D5. Battle Worker receives serializable runtime data and WASM ArrayBuffer, never function ports. Worker alone initializes frozen engine and enforces duel legality/allowed pool. Structural IPC validation and ABI checks are not duplicate install verification. Engine binary, loader resolution, vendor manifest remain frozen.

## Consequences

C1. Content transport can change without changing business contracts.

C2. Shell adapters become explicit integration surface; chunk budgets and preload memory need measured acceptance. Root Svelte boundary alone cannot catch arbitrary rejected promises, so async failures require explicit dispatch.

## Alternatives rejected

A1. Global AssetReader: leaks storage vocabulary and arbitrary reads.

A2. Content-aware per-domain loaders: coupling renamed, not removed.

A3. Shell owns semantic rules: orchestration becomes business god module.

A4. Worker receives injected functions: functions cannot be structured-cloned.

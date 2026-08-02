# Architecture

> Status: accepted and current
> Last consolidated: 2026-07-31
> Scope: browser-based offline duel MVP plus implemented semantic DOM duel field

This is the canonical architecture entry point. Detailed decisions are intentionally atomic and grouped by concern so humans and AI can load only the context needed for a task.

## Navigation protocol

1. Read root [`context.md`](../../context.md) for stack, repository shape, and file-design conventions.
2. Read this file for system-wide invariants and the decision map.
3. Open only the detailed decision files relevant to the task.
4. Read [`../DUEL_FIELD_DOM_IMPLEMENTATION_PLAN.md`](../DUEL_FIELD_DOM_IMPLEMENTATION_PLAN.md) for current field work. [`../MVP_TECHNICAL_IMPLEMENTATION_PLAN.md`](../MVP_TECHNICAL_IMPLEMENTATION_PLAN.md) remains completed baseline history.
5. Treat [`../archive/`](../archive/) as historical context only; it cannot override current architecture.

## Decision map

| When changing…                                                           | Read                                                                                                                                                                 |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MVP scope or product boundaries                                          | [`01-product/scope.md`](01-product/scope.md)                                                                                                                         |
| Language, framework, build, or rejected alternatives                     | [`01-product/technology-selection.md`](01-product/technology-selection.md)                                                                                           |
| Main-thread/Worker/module ownership                                      | [`02-runtime/topology.md`](02-runtime/topology.md)                                                                                                                   |
| Browser support, static hosting, or WASM platform requirements           | [`02-runtime/browser-platform.md`](02-runtime/browser-platform.md)                                                                                                   |
| Commands, events, prompts, or serialization                              | [`02-runtime/worker-contract.md`](02-runtime/worker-contract.md)                                                                                                     |
| Duel startup, processing, restart, or disposal                           | [`02-runtime/duel-lifecycle.md`](02-runtime/duel-lifecycle.md)                                                                                                       |
| WASM loading, callbacks, or engine versions                              | [`03-engine/ocgcore-adapter.md`](03-engine/ocgcore-adapter.md)                                                                                                       |
| Core messages, response encoding, or public state                        | [`03-engine/protocol-and-state.md`](03-engine/protocol-and-state.md)                                                                                                 |
| Computer-player behavior                                                 | [`03-engine/opponent-policy.md`](03-engine/opponent-policy.md)                                                                                                       |
| Snapshot manifests, revisions, or activation                             | [`04-data/asset-snapshots.md`](04-data/asset-snapshots.md)                                                                                                           |
| Card metadata, strings, or Lua scripts                                   | [`04-data/card-data-and-scripts.md`](04-data/card-data-and-scripts.md)                                                                                               |
| Card art, preload, fallback, or caching                                  | [`04-data/card-images.md`](04-data/card-images.md)                                                                                                                   |
| IndexedDB, Cache Storage, or local persistence                           | [`04-data/browser-storage.md`](04-data/browser-storage.md)                                                                                                           |
| Field renderer choice or canvas policy                                   | [`../ADR/001_ADR_semantic_dom_duel_field_rendering.md`](../ADR/001_ADR_semantic_dom_duel_field_rendering.md)                                                         |
| Field projection, physical zones, interaction, DOM composition, or focus | [`05-presentation/duel-field-architecture.md`](05-presentation/duel-field-architecture.md) ([HTML view](../duel-field-architecture.html))                            |
| Field visual/rule/a11y validation references                             | [`05-presentation/duel-field-validation-references.md`](05-presentation/duel-field-validation-references.md) ([HTML view](../duel-field-validation-references.html)) |
| Unit, integration, compatibility, or browser tests                       | [`06-quality/testing.md`](06-quality/testing.md)                                                                                                                     |
| Errors, traces, or reproducibility                                       | [`06-quality/diagnostics.md`](06-quality/diagnostics.md)                                                                                                             |
| Trust boundaries or untrusted input                                      | [`07-governance/security.md`](07-governance/security.md)                                                                                                             |
| Licensing, card-art distribution, or deployment                          | [`07-governance/licensing-and-distribution.md`](07-governance/licensing-and-distribution.md)                                                                         |
| Post-MVP systems                                                         | [`07-governance/extension-path.md`](07-governance/extension-path.md)                                                                                                 |

## System at a glance

Current implemented topology:

```text
Browser main thread
├── Svelte application, semantic DOM duel field, and typed duel store
├── CSS/SVG non-authoritative field feedback
└── typed Worker client
    ↕ structured-clone domain commands/events
Dedicated Duel Worker
├── session controller and public-state projector
├── protocol parser/response encoder
├── deterministic preset-deck opponent
├── preloaded card/script maps
└── vendored ocgcore.sync.wasm
    └── Project Ignis CardScripts
```

## System-wide invariants

- `ocgcore` alone decides legality, effects, and duel results.
- Only the dedicated Worker owns WASM, raw protocol data, scripts, and duel handles.
- The main thread receives clone-safe domain messages and immutable state with explicit presentation visibility. Offline hidden identities may remain in memory but must not be plainly rendered, announced, requested as card art, or included in routine diagnostics.
- Svelte owns all interactive application/field UI; presentation state never determines legality.
- CSS/SVG feedback is non-authoritative. Future canvas may be pointer-transparent decoration only after separate measured decision.
- Core callbacks are synchronous and read only preloaded memory.
- Core, catalog, scripts, strings, and image metadata form one pinned, verified snapshot; browser activation occurs only after runtime and active-image receipts match.
- Production duels shuffle normally; deterministic inputs are restricted to tests and diagnostics.
- Every duel can be reproduced from revision metadata, seed, and ordered responses.
- Headless real-WASM coverage must remain green; production packaging and **Chromium (PWA-capable)** browser gates are required for the release candidate. Firefox/WebKit smoke is optional hygiene, not DOM-field acceptance.

## Decision maintenance

- Update the smallest owning decision file; do not duplicate rules across multiple detail files.
- Update this map when adding, moving, or replacing a decision file.
- A cross-cutting change must update every affected decision in one change.
- Superseded decisions move to `docs/archive/`; current files must not contain competing alternatives.
- Keep decisions concise, explicit, and searchable with stable terminology from this index.

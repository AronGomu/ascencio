# Project Context

## Purpose and status

YGO Story Duel Simulator is a browser-first, offline Yu-Gi-Oh! duel client. The MVP launches directly into one human-versus-computer duel using bundled preset decks. Project Ignis `ygopro-core` is the sole authority for rules, legal actions, effects, and results.

The private browser MVP baseline is complete. Accepted next architecture replaces the implemented Phaser field with a semantic Svelte DOM field; migration under `docs/DUEL_FIELD_DOM_IMPLEMENTATION_PLAN.md` (DF-00–DF-13 done; DF-14+). Product browser = Chromium PWA family. **No manual testing gates until DF-17 complete** — automated Chromium evidence only.

## Documentation routing

- Start with [`docs/README.md`](docs/README.md) for all documentation.
- Use [`docs/architecture/architecture.md`](docs/architecture/architecture.md) as the canonical architecture map and granular task-context router.
- Use [`docs/DUEL_FIELD_DOM_IMPLEMENTATION_PLAN.md`](docs/DUEL_FIELD_DOM_IMPLEMENTATION_PLAN.md) for current field implementation order and acceptance gates.
- Use [`docs/MVP_TECHNICAL_IMPLEMENTATION_PLAN.md`](docs/MVP_TECHNICAL_IMPLEMENTATION_PLAN.md) as completed MVP/Phaser baseline history.
- Use [`docs/assets/asset-import-pipeline.md`](docs/assets/asset-import-pipeline.md) for the implemented asset pipeline.
- `docs/archive/` is historical only and must not override current decisions.

## Technical stack

| Area | Technology | Role |
|---|---|---|
| Language | TypeScript (strict), Node.js 24+ | Application, contracts, tooling, tests, and opponent policy |
| Build | Vite | Dev server, Worker/WASM handling, and static build |
| UI | Svelte | Application layout, semantic DOM field, prompts, logs, errors, and results |
| Duel field | Svelte DOM + CSS/SVG target; Phaser migration baseline | Native controls, typed physical layout, highlights, and non-authoritative feedback |
| Rules | Vendored `ocgcore-wasm@0.1.2` / Project Ignis `ygopro-core` | Authoritative duel engine |
| Isolation | Dedicated Web Worker | Sole owner of WASM, protocol, scripts, handles, and state projection |
| Data | BabelCDB, CardScripts, Project Ignis strings | Versioned card/effect/protocol snapshot |
| Persistence | IndexedDB via `idb`; Cache Storage | Metadata/preferences/debug runs; image cache |
| Tests | Node test runner, Vitest, Testing Library, Playwright | Unit, component, integration, and browser coverage |
| Quality | TypeScript, ESLint, Prettier, CI | Types, lint, format, compatibility, assets, and build gates |

## Core architecture rules

- The main thread never imports or calls the engine.
- Raw core messages/indexes remain in the Worker; the UI receives clone-safe typed domain data.
- Opponent hidden information is removed before crossing the Worker boundary.
- Svelte owns all interactive application/field UI; presentation state never determines legality.
- Canvas may be future pointer-transparent decoration only after separate measured ADR.
- Synchronous core callbacks use preloaded memory and perform no async I/O.
- Engine and Project Ignis assets are pinned and activated as one verified snapshot.
- Production duels shuffle normally; deterministic inputs are test/diagnostic-only.

## File design policy

Prefer small, cohesive, independently navigable files.

- Default to one public interface/type union, component, store, adapter/service, or parser/encoder concern per file.
- Split a unit when it has an independent name, responsibility, test surface, reuse potential, or reason to change.
- Keep tiny private helpers/types beside their sole consumer when separation would obscure rather than clarify behavior.
- Do not split files merely to reduce line count or create pass-through modules.
- Avoid broad “utils”, “types”, and catch-all component files; use domain-specific names and folders.
- Keep imports directional across the architecture boundaries documented above.
- When both choices remain sensible, prefer the additional focused file.

## Project tree

```text
.
├── context.md                         # Fast project and documentation entry point
├── docs/
│   ├── README.md                      # Documentation index
│   ├── DUEL_FIELD_DOM_IMPLEMENTATION_PLAN.md
│   ├── MVP_TECHNICAL_IMPLEMENTATION_PLAN.md  # Completed baseline
│   ├── architecture/
│   │   ├── architecture.md            # Canonical decision map
│   │   └── <numbered concern folders>/
│   ├── assets/                        # Asset-pipeline documentation
│   └── archive/                       # Superseded historical context
├── package.json
├── tsconfig.json
├── index.html                         # Browser entry document
├── vite.config.ts                     # Vite/Svelte/Worker build config
├── src/
│   ├── main.ts
│   ├── app/                           # Svelte shell, atomic components, stores
│   ├── duel/                          # Atomic contracts, presentation types, presets
│   ├── field/                         # Phaser baseline → typed DOM-field model migration
│   ├── worker/                        # Worker entry, engine, protocol, projection, opponent, assets
│   ├── storage/                       # IndexedDB and Cache Storage adapters
│   └── styles/
├── scripts/                           # Asset acquisition/verification tools
│   └── lib/                           # Focused pipeline modules
├── tests/                             # Unit/component/integration fixtures/tests
├── e2e/                               # Playwright production-browser tests
├── vendor/ocgcore-wasm/0.1.2/         # Checked-in verified engine
├── public/                            # Browser-served runtime assets
├── generated/                         # Ignored generated snapshot/images
└── .cache/                            # Ignored upstream downloads/temp data
```

Generated assets, caches, and `node_modules/` are not source and remain ignored. Story systems, deck editing, progression, and multiplayer are outside the MVP.

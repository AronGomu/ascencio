# Ascencio

Revisit the different era of Yu-Gi-Oh! through the Story of Ascencio !

This is a Fan Game project with the gola of recreating old YGO solo game experience akin to YGO Spirit Troubadour, Spirit Caller, Tag Forces.

Play through a mostly linear Story, open cards, build decks and beat your opponents.

You start at the DUEL MONSTER era and you will eventually progress up to modern ERA yugioh (that's the goal at least) !

This game will be release in chapters, each chapter corresponding to a new story arc and new era of YGO !

Current Road Map :
DUEL MONSTER => GX => Synchros => XYZ => PENDULUM => LINKS

This roadmap may be redefined as the Story is refined.

## Who is this for ?

This experience is tailored for experienced Yu‑Gi‑Oh! players and newcomers.
Unlike modern Yu‑Gi‑Oh games, this experience is built knowing that modern Yu‑Gi‑Oh can be extremely complicated.
That's why I start at the basis of the game in the Duel Monsters era.
Discover new mechanics and new archetypes progressively, so you are never overloaded with information.

## Online ?

There is no online mode ! This is an experience tailored for solo play experience.

## Thanks to [find names]

This project is a Tauri native application for Windows, macOS and Linux.
If you encounter any performance issue, do not hesitate to send feedback.
I want to design an experience that can be accessed by everyone.

Deep thanks to Project Ignis, ygopro-core, and ocgcore-wasm, which allowed me to start with a very solid base.

## AI

This project was made only thanks to AI.
The entire codebase and most of the assets used for this game are AI-generated.

## Copyright

Copyright does not exist; it's a scam and pure evil.
Everything everything built and released in this project is fully open source and accessible to anyone to do anything with it.

## Included asset pipeline

The existing tooling acquires and verifies:

- the pinned synchronous `ocgcore-wasm@0.1.2` package;
- the current standard-format BabelCDB card catalog and text;
- official, prerelease, and global Project Ignis CardScripts;
- Project Ignis English system strings;
- full-card JPEGs available from the configured image provider;
- manifests, hashes, coverage reports, and readiness status.

Generated data, downloaded images, caches, and `node_modules/` are intentionally excluded from Git.

## Requirements

- [Node.js](https://nodejs.org/) 26 or newer
- [Git](https://git-scm.com/)
- npm, included with Node.js
- Network access for the initial asset download
- Stable Rust and the native prerequisites for your operating system
- At least 35 GB of free disk space for assets, conversion and native builds

## Setup

```bash
git -c core.longpaths=true clone -c core.longpaths=true -c core.autocrlf=false https://github.com/aronGomu/ascencio.git
cd ascencio
npm ci
npm run setup
npm run build
npm test
npm start
```

See [desktop setup](docs/desktop-setup.md) for platform prerequisites, offline recovery and headless validation. Setup and build open no windows. `npm start -- --headless --debug` builds without launching the GUI. Downloads reuse existing Git caches and valid images.

## Public asset delivery setup

- A1. Developer downloads need **no publisher credentials**. Current acquisition remains `assets:bootstrap`; the single anonymous `assets:download` command is planned, not implemented by the setup slice.
- A2. `npm run assets:setup -- --help` explains read-only preflight. After owner supplies public config, `npm run assets:setup -- --check` validates syntax and reports pending publisher prerequisites without requiring credentials. Optional `--remote --origin <exact-origin>` performs read-only public/S3 probes; repeat `--origin` for actual dev/prod origins. Never provisions or publishes.
- A3. [Owner setup](docs/assets/asset-delivery-setup.md) frontloads R2/account/domain/CORS/budget/rights/device prerequisites and explicit empty-index bootstrap. Public originals and unreleased bytes require explicit eligibility approval; public availability does not establish rights.
- A4. Dev metadata truth means matching archive membership and bytes, **not** exhaustive upstream availability or gameplay readiness. Existing `content:setup:verify` remains separate. [Root inventory](docs/assets/asset-root-inventory.md) records the pre-migration mapping; no assets moved in this slice.

## Quick asset launchers

### Windows

```powershell
.\download-mvp-assets.cmd
```

### macOS and Linux

```bash
./download-mvp-assets.sh
```

Both launchers accept the same options as `npm run assets:bootstrap` and can be launched from outside the repository because they set their own working directory.

## npm commands

Use Node 26 or newer. [Complete command reference](docs/development-commands.md) describes every command and the coverage of the aggregate checks.

| ID  | Command                                                                           | Description                                                                                                                                                     |
| --- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | `npm run native:build-and-start:linux`                                            | Build the standalone desktop application and launch it on Linux. No development server required.                                                                |
| C2  | `npm run native:desktop:dev`                                                      | Launch the native desktop application with its development server.                                                                                              |
| C3  | `npm run native:desktop:build`                                                    | Prepare content, build the frontend, then build/package the native desktop application.                                                                         |
| C4  | `npm run frontend:dev`                                                            | Start Vite only; ordinary browser navigation does not provide native IPC.                                                                                       |
| C5  | `npm run frontend:build`                                                          | Verify frozen vendor files, bundle application code to `generated/build/app/`, and check frontend boundaries/budgets.                                           |
| C6  | `npm run frontend:preview`                                                        | Serve built frontend files for inspection and browser fixtures; does not launch Tauri.                                                                          |
| C7  | `npm run assets:bootstrap`                                                        | Acquire/verify the pinned engine, upstream source data and card images; generate/verify the source manifest. Set artwork and JSON release staging are separate. |
| C8  | `npm run assets:upstream:sync -- --offline`                                       | Regenerate source data from existing Git caches without fetching.                                                                                               |
| C9  | `npm run content:convert:sqlite-to-json -- <input.sqlite> <new-source-directory>` | Convert verified historical content into readable sources and media.                                                                                            |
| C10 | `npm run content:compile:json -- <source-directory> <output-directory>`           | Compile readable sources into critical snapshots and source maps.                                                                                               |
| C11 | `npm run content:release:pin`                                                     | Review and pin the tracked critical-release manifest.                                                                                                           |
| C12 | `npm run content:stage:native`                                                    | Check pinned inputs and atomically stage native content resources.                                                                                              |
| C13 | `npm run content:stage:verify-native`                                             | Verify staged content and frozen engine buffers.                                                                                                                |
| C14 | `npm run mods:bundle -- <mod-directory> <new-bundle.json>`                        | Create a declared-file JSON mod import bundle.                                                                                                                  |
| C15 | `npm test`                                                                        | Run tooling, unit/performance, component and integration suites; excludes browser and Rust tests.                                                               |
| C16 | `npm run test:browser:native-bridge`                                              | Run Playwright browser/native-IPC fixtures, not the desktop executable.                                                                                         |
| C17 | `npm run test:native:rust`                                                        | Run native Rust tests.                                                                                                                                          |
| C18 | `npm run check`                                                                   | Run headless quality/assets plus component, frontend-build and browser gates; excludes Rust, JSON parity and actual native/physical acceptance.                 |
| C19 | `npm run content:verify:sqlite-json-parity`                                       | Compare historical SQLite queries with JSON snapshots and check deterministic compilation.                                                                      |
| C20 | `npm run legacy:assets:inventory -- --check`                                      | Check retained legacy source/profile ownership without mutation.                                                                                                |

To display the unified downloader help:

```bash
npm run assets:bootstrap -- --help
```

Root/profile migration details: [`docs/assets/asset-profiles.md`](docs/assets/asset-profiles.md). Legacy acquisition is explicit; scan/promotion never refresh upstream inputs.

## Unified asset command options

```bash
npm run assets:bootstrap -- [options]
```

| Option                          | Description                                                                       |
| ------------------------------- | --------------------------------------------------------------------------------- |
| `--offline`                     | Regenerate and verify using existing Git and image caches without network access. |
| `--force-images`                | Redownload images even when a valid cached JPEG exists.                           |
| `--concurrency <count>`         | Set simultaneous image workers; default is `18`.                                  |
| `--requests-per-second <count>` | Set the image request rate; default is `18`, maximum is `20`.                     |
| `-h`, `--help`                  | Print command usage.                                                              |

Examples:

```bash
npm run assets:bootstrap -- --offline
npm run assets:bootstrap -- --concurrency 8 --requests-per-second 12
npm run assets:bootstrap -- --force-images
```

The Windows and Unix launchers accept the same arguments:

```powershell
.\download-mvp-assets.cmd --offline
.\download-mvp-assets.cmd --concurrency 8 --requests-per-second 12
```

```bash
./download-mvp-assets.sh --offline
./download-mvp-assets.sh --concurrency 8 --requests-per-second 12
```

## Lower-level command lines

Use these commands for diagnosis, custom output directories, pinned source revisions, or partial maintenance. Prefer `npm run assets:bootstrap` for normal setup.

### Engine acquisition

```bash
node scripts/sync-engine.ts
node scripts/sync-engine.ts --offline
node scripts/verify-engine.ts
```

### Catalog, scripts, strings, and image manifests

```bash
node scripts/sync-assets.ts [options]
```

| Option                     |                      Default | Description                                              |
| -------------------------- | ---------------------------: | -------------------------------------------------------- |
| `--offline`                |                     disabled | Use existing source repositories without fetching.       |
| `--cache-dir <directory>`  |            `.cache/upstream` | Set the Git source cache directory inside the project.   |
| `--output <directory>`     | `assets/shared/data/current` | Set the generated snapshot output directory.             |
| `--babel-ref <ref>`        |                     `master` | Pin a BabelCDB branch, tag, or commit.                   |
| `--scripts-ref <ref>`      |                     `master` | Pin a CardScripts branch, tag, or commit.                |
| `--distribution-ref <ref>` |                     `master` | Pin a Project Ignis Distribution branch, tag, or commit. |

Example:

```bash
node scripts/sync-assets.ts \
  --babel-ref <commit-or-ref> \
  --scripts-ref <commit-or-ref> \
  --distribution-ref <commit-or-ref>
```

Verify the default or a custom generated snapshot:

```bash
node scripts/verify-assets.ts
node scripts/verify-assets.ts --output <directory>
```

### Card-image archive

```bash
node scripts/download-images.ts [options]
```

| Option                          |                      Default | Description                                                         |
| ------------------------------- | ---------------------------: | ------------------------------------------------------------------- |
| `--assets <directory>`          | `assets/shared/data/current` | Set the source image-manifest snapshot.                             |
| `--output <directory>`          |  `assets/shared/card-images` | Set the local image archive directory.                              |
| `--concurrency <count>`         |                         `18` | Set simultaneous download workers.                                  |
| `--requests-per-second <count>` |                         `18` | Set request rate; cannot exceed `20`.                               |
| `--limit <count>`               |                  all records | Process only the first number of image records, useful for testing. |
| `--force`                       |                     disabled | Redownload valid cached images.                                     |

Examples:

```bash
node scripts/download-images.ts --limit 20
node scripts/download-images.ts --concurrency 8 --requests-per-second 12
node scripts/download-images.ts --force
node scripts/verify-images.ts
```

## Asset sources and operational output

```text
assets/
├── battle/engine/current/       # Explicit legacy acquisition; vendor stays authoritative
├── deck-editor/
├── story/
└── shared/
    ├── data/current/           # Catalog, scripts, strings, image metadata
    ├── runtime/current/
    ├── card-images/{full,cropped}/
    ├── card-back.jpg
    ├── set-images/
    └── fonts/
asset-profiles/                 # Tracked ownership rules + nightly selection
generated/                     # Status, download reports, delivery receipts/outputs
```

A successful unified run writes `status: "ready"` to `generated/mvp-assets-status.json`. Do not consume a snapshot marked `in-progress` or `failed`.

## Worker diagnostics

The Worker IPC boundary emits structured warning/error/completion objects to the browser Worker console (or the Node console in a headless host). A caller can inject a debug logger for receive/dispatch traces. Grep/filter the stable `duel.worker.*` event prefix:

- `duel.worker.command.*` — receive, rejection, failure, completion, or intentional skip at `src/battle/worker/duel.worker.ts`;
- `duel.worker.event.*` — event dispatch and posting failures at `src/battle/worker/duel.worker.ts`;
- `duel.worker.detached` — attachment teardown at `src/battle/worker/duel.worker.ts`;
- `duel.worker.node.*` — Node Worker bootstrap, message-deserialization, and thread-boundary failures;
- `duel.worker.logging.failed` — injected logger failure fallback at `src/battle/worker/diagnostics/worker-log.ts`.

Per-duel bounded traces record revisions, process/message ordering, public events, opaque responses, opponent reasons, terminal state, and the production seed. Error/result surfaces can download a schema-versioned JSON diagnostic. These files are explicitly marked `contains-production-seed`; treat them as sensitive and share them only with an authorized debugger.

## Documentation

- [`AGENTS.md`](AGENTS.md) — concise project context and target architecture
- [`docs/DUEL_FIELD_DOM_IMPLEMENTATION_PLAN.md`](docs/DUEL_FIELD_DOM_IMPLEMENTATION_PLAN.md) — current TDD ticket/dependency plan
- [`docs/MVP_TECHNICAL_IMPLEMENTATION_PLAN.md`](docs/MVP_TECHNICAL_IMPLEMENTATION_PLAN.md) — completed MVP/Phaser baseline plan
- [`docs/assets/asset-import-pipeline.md`](docs/assets/asset-import-pipeline.md) — asset sources, transformations, integrity guarantees, and observed counts
- [`docs/README.md`](docs/README.md) — documentation index
- [`docs/architecture/architecture.md`](docs/architecture/architecture.md) — canonical architecture map and granular decisions
- [`docs/archive/`](docs/archive/) — superseded technical research and decisions

## Production build and static hosting

```bash
npm run frontend:build
npm run frontend:preview -- --host 127.0.0.1
```

Deploy the contents of `dist/` as immutable static files. For a subpath, set Vite's base while building (for example `BASE_PATH=/duel/ npm run frontend:build` on POSIX or `$env:BASE_PATH='/duel/'; npm run frontend:build` in PowerShell). The Worker, WASM, runtime closure, card images, and licenses are emitted beneath that base. `npm run frontend:verify` rejects missing/extra artifacts, hash drift, Node-only imports, disabled engine fallbacks, missing third-party licenses, and size-budget regressions. `npm run frontend:bundle` deliberately uses Vite's `private` mode; an ordinary production-mode build refuses to package artwork while redistribution remains unapproved and every private artifact includes `PRIVATE_DEPLOYMENT_ONLY.txt`.

Keep the deployment private. The generated active-image manifest records `redistributionApproved: false`, and the documented BabelCDB, Project Ignis, artwork, trademark, AGPL source-availability, and other content obligations still require an authorized distribution review.

## Updating the pinned snapshot

1. Update upstream inputs on an isolated branch with `npm run assets:upstream:sync` (or `assets:upstream:sync -- --offline`).
2. Refresh/verify images with `npm run assets:cards:download-full` and `npm run assets:cards:verify-full`.
3. Run `npm run content:source-manifest:generate` and `npm run content:source-manifest:verify`.
4. Review revision, count, protocol, trace, and active-dependency changes.
5. Run `npm run check`; activate/publish only if every gate passes. Keep the previous snapshot available for rollback.

## Contribution

Feel free to open PR requests for this project, or to fork and create your own versions.
For now, I accept all kinds of contributions.

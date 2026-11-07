```text
ascencio/
├── AGENTS.md                         # Project navigation: locate information by topic below
├── README.md                         # Project overview, installation and entry commands
├── package.json                      # npm commands, dependencies and required Node version
├── package-lock.json                 # Pinned JavaScript dependency resolution
├── .node-version                     # Development Node version
├── .gitignore                        # Generated, acquired and machine-local exclusions
├── .graphifyignore                   # Knowledge-graph extraction exclusions
│
├── config/                          # Movable build, language, quality and source-pin configuration
│   ├── README.md                    # Config entry points and root-file discovery conventions
│   ├── vite.config.ts               # Frontend build, server and Worker handling
│   ├── tsconfig.json                # TypeScript compiler settings
│   ├── eslint.config.js             # Code checks and domain import boundaries
│   ├── prettier.config.js           # Formatting settings
│   ├── assets-source-lock.json      # Upstream asset revisions and integrity pins
│   └── image-content-lock.json      # Reviewed image-content pins
│
├── .agents/skills/                   # Project-local agent workflows
│   ├── ai-bot-self-improvement/
│   │   └── SKILL.md                  # Bot improvement orchestration and result reporting
│   ├── ai-bot-parallel-improvement/
│   │   └── SKILL.md                  # Frozen setup and parallel improvement orchestration
│   ├── ascencio-tests/
│   │   └── SKILL.md                  # Select and run related tests locally
│   └── impeccable/
│       └── SKILL.md                  # Frontend design, critique and refinement
│
├── .github/                         # Repository and GitHub agent integration
│   ├── agents/                      # Agent role definitions
│   ├── hooks/                       # Agent hook configuration
│   ├── skills/                      # GitHub-facing skill integration
│   └── disabled-workflows/          # Archived remote workflows; local-only policy in project guide
│
├── docs/                             # Durable documentation and decision history
│   ├── README.md                     # Full documentation index
│   ├── project-guide.md              # Operating rules, local-only validation, boundaries, task management
│   ├── PRODUCT.md                    # Product intent, priorities and brand commitments
│   ├── DESIGN.md                     # Visual design direction and presentation conventions
│   ├── desktop-setup.md              # Install, start, browser preview and native/headless launch
│   ├── development-commands.md        # Current npm commands and validation scopes
│   ├── startup-loading-messages.md    # Startup stages, progress messages and diagnostics
│   ├── architecture/
│   │   ├── architecture.md           # Canonical architecture map and topic router
│   │   ├── 01-product/               # Product and technology context
│   │   ├── 02-runtime/               # Application lifecycle and runtime structure
│   │   ├── 03-engine/                # Duel engine integration, protocol and execution
│   │   ├── 04-data/                  # Data, saves, assets and historical transport
│   │   ├── 05-presentation/          # UI and rendering architecture
│   │   ├── 06-quality/
│   │   │   ├── testing.md            # Test strategy and verification routes
│   │   │   ├── diagnostics.md        # Errors, traces and reproducibility
│   │   │   ├── bot-improvement-loop.md # Bounded real-engine bot improvement loop
│   │   │   └── parallel-bot-session.md # Setup, iterations, analysis jobs and session accounting
│   │   └── 07-governance/            # Trust, security, distribution and extension constraints
│   ├── ADR/                          # Recorded architecture decisions
│   │   ├── 022_ADR_three_ui_modular_monolith_and_worktree_boundaries.md
│   │   │                             # Domain ownership and public import boundaries
│   │   ├── 045_ADR_single_branch_trunk_development.md
│   │   │                             # Branch and integration model
│   │   ├── 103_ADR_tauri_only_runtime_and_asset_ui.md
│   │   │                             # Production native platform and asset UI boundaries
│   │   ├── 104_ADR_startup_memory_content_and_mod_overrides.md
│   │   │                             # Current JSON snapshots, memory, mods and saves
│   │   └── 105_ADR_browser_development_and_shared_content_transport.md
│   │                                 # Browser development exception and shared transport
│   ├── story/
│   │   ├── README.md                 # Narrative canon index
│   │   ├── scenario/                 # Philosophy, premise and world rules
│   │   ├── chapters/                 # Chapter definitions and progression
│   │   ├── characters/               # Character definitions
│   │   ├── themes/                   # Narrative themes
│   │   └── open-questions.md          # Unresolved story decisions
│   ├── assets/
│   │   ├── startup-memory-content.md # Current content authoring, startup and mod contracts
│   │   ├── native-content-release.md # Compile, stage and verify native content
│   │   ├── content-modules.md        # Package composition and module dependencies
│   │   ├── asset-import-pipeline.md  # Source acquisition, transformations and integrity
│   │   └── asset-profiles.md         # Current asset layout and profile-tool retirement
│   ├── developer-guide/              # Developer walkthroughs and HTML guides
│   ├── feature/                      # Feature-specific design rationale, including rust-bot-experiment.md
│   ├── evidence/                     # Retained verification evidence
│   └── archive/                      # Superseded documentation and historical context
│
├── src/                              # TypeScript/Svelte application and Worker code
│   ├── index.html                    # Main application document
│   ├── main.ts                       # Frontend bootstrap
│   ├── acceptance-main.ts            # Visual acceptance harness bootstrap
│   ├── shell/                        # Application composition and navigation
│   │   ├── index.ts                  # Public shell contract
│   │   ├── AppShell.svelte           # Application frame
│   │   ├── routes.ts                 # Screen routes
│   │   ├── stage-layout.ts           # Viewport stage and responsive layout
│   │   ├── startup/                  # Startup flow and readiness UI
│   │   ├── screens/                  # Main menu and shell-owned screens
│   │   ├── application/              # Application actions and orchestration
│   │   ├── handoff/                  # Cross-domain transitions
│   │   ├── native/                   # Native shell integration
│   │   └── settings/                 # Application settings UI
│   ├── battle/                       # Duel Simulator domain
│   │   ├── index.ts                  # Public battle contract
│   │   ├── BattleFacade.svelte       # Shell-facing duel composition
│   │   ├── app/                      # Duel screens, prompts, components and stores
│   │   ├── duel/                     # Duel contracts and start/preset validation
│   │   ├── field/                    # Semantic DOM field, layout and interactions
│   │   ├── ports/                    # External dependencies consumed by battle
│   │   ├── storage/                  # Battle diagnostics and persistence adapters
│   │   └── worker/                   # Authoritative engine ownership and duel execution
│   │       ├── DuelWorkerRuntime.ts  # Worker command and lifecycle coordination
│   │       ├── HeadlessDuelController.ts # Programmatic real-engine duels
│   │       ├── engine/               # Engine bridge, constants and handles
│   │       ├── protocol/             # Raw engine message parsing and response encoding
│   │       ├── projection/           # Clone-safe views and hidden-information filtering
│   │       ├── assets/               # Runtime manifests, card data and scripts
│   │       ├── opponent/             # Opponent-facing observations and policy integration
│   │       ├── diagnostics/          # Worker errors and diagnostic records
│   │       ├── bot-runtime/           # Preemptible WASM/native transports, pinning and validated recovery
│   │       └── bot/
│   │           ├── bot-contract.ts   # Bot inputs, decisions, settings and sideboarding interface
│   │           ├── generalist-bot.ts # Shared selection and bot execution machinery
│   │           ├── generalist-strategy.ts # Baseline action-scoring strategy
│   │           ├── basic-bot.ts      # Basic shared policy
│   │           ├── random-bot.ts     # Random-choice policy
│   │           └── sideboard.ts      # Shared sideboarding transactions and validation
│   ├── deck-editor/                  # Deck editing UI and application logic; index.ts is public
│   ├── deck-select/                  # Shared presentational deck-selection screen
│   ├── decks/                        # Deck models, validation, editing and repositories
│   │   ├── index.ts                  # Shared deck entry
│   │   ├── contracts/                # Focused deck contracts
│   │   ├── repository/               # Deck persistence interfaces and implementations
│   │   ├── editing/                  # Deck editing operations
│   │   └── validation/               # Deck validation rules
│   ├── cards/                        # Immutable card definitions, classification and image ports
│   ├── story/                        # Visual Novel domain; index.ts is public
│   │   ├── README.md                 # Story runtime developer orientation
│   │   ├── content/                  # Runtime story definitions derived from narrative canon
│   │   ├── playback/                 # Story playback
│   │   ├── screens/                  # Story screens
│   │   ├── shop/                     # Story shop and commerce UI
│   │   ├── handoff/                  # Story-to-duel transitions
│   │   └── saves/                    # Story save contracts and state
│   ├── modules/                      # Pure shared module and progression contracts
│   ├── shared-svelte-ui/             # Domain-independent presentational components
│   ├── storage/                      # Content transport and user-state persistence
│   │   ├── contracts/                # Shared storage and content contracts
│   │   ├── native/                   # Tauri commands and prepared native storage
│   │   ├── browser-dev/              # Isolated fixed-content browser development adapters
│   │   ├── transport/                # Shared native/browser resource transport
│   │   ├── snapshot/                 # Startup snapshot handling
│   │   ├── json/                     # JSON user-state storage
│   │   └── mods/                     # Mod contracts and composition
│   └── styles/                       # Global styles, brand tokens and bundled fonts
│
├── tauri/                        # Rust native host and application packaging
│   ├── Cargo.toml                    # Native Rust dependencies and build features
│   ├── tauri.conf.json               # Window, frontend build and native resources
│   ├── capabilities/                 # Native permissions
│   ├── build.rs                      # Trusted release embedding and resource inventory
│   └── src/
│       ├── main.rs                   # Desktop executable entry
│       ├── lib.rs                    # Tauri setup, protocols and command registration
│       ├── native_startup.rs         # Verified startup snapshots and memory readiness
│       ├── native_startup/           # Startup maintenance, resources and acceptance support
│       ├── native_bots.rs            # Installed packages and bounded native bot subprocesses
│       ├── native_user_data.rs       # Atomic JSON user-data writer
│       ├── native_mods.rs            # Enabled mod state and activation
│       ├── native_mod_import.rs      # Mod selection and import
│       ├── native_diagnostics.rs     # Native diagnostics and log access
│       └── scoped_files.rs           # Scoped native filesystem access
│
├── assets/                           # Authored configuration and acquired package inputs
│   ├── README.md                     # Content-input orientation and historical setup evidence
│   ├── packages.json                 # Package definitions, dependencies and source roots
│   ├── critical-release.json         # Trusted startup snapshot and engine pins
│   ├── native-release.json           # Native release declaration
│   ├── distribution-evidence.json    # Distribution approval evidence
│   ├── setup-evidence.json           # Setup and acceptance evidence
│   ├── ai-bots/                      # Versioned Rust AI sources, manifests and portable executables
│   ├── app/                          # Tracked fonts, application icon and download-link settings
│   ├── duel-core/                    # Engine configuration and strings
│   ├── freeplay/                     # Freeplay decks, opponents, settings and card limits
│   ├── bootstrap-inputs/             # Tracked source inputs for initial content setup
│   ├── commerce/                     # Shop, set, booster and economy source declarations
│   ├── card-library/                 # Acquired card data, scripts and images; ignored by Git
│   └── chapter-01/                   # Acquired Chapter 1 package inputs and media; ignored by Git
│
├── scripts/                          # Development, acquisition, content and build commands
│   ├── setup-desktop.ts              # Fresh-clone setup
│   ├── start-desktop.ts              # Native build-and-launch orchestration
│   ├── download-mvp-assets.ts        # Asset acquisition entry
│   ├── download-mvp-assets.sh        # macOS/Linux download wrapper
│   ├── download-mvp-assets.cmd       # Windows download wrapper
│   ├── prepare-browser-content.ts   # Fixed-content browser development preparation
│   ├── readable-content.ts          # Readable JSON conversion and compilation
│   ├── readable-content-release.ts  # Content release pinning, staging and verification
│   ├── verify-native-build.ts        # Frontend build and payload boundaries
│   ├── bot-experiment/               # Saved baseline, parity, runtime smoke and timing commands
│   ├── bot-evaluation/               # Node host and schemas supporting the Rust evaluator
│   ├── bot-improvement/              # Frozen sessions, execution, analysis and iteration control
│   │   ├── session-contract.ts       # Frozen setup and candidate validation schema
│   │   ├── iteration-contract.ts     # Prepared bindings and baseline receipts
│   │   ├── session-control-contract.ts # Stop/resume and execution accounting
│   │   ├── prepare-iteration.ts      # Accepted snapshot, self binding and baseline reuse
│   │   ├── analysis-contract.ts      # Analysis packets, claims and report sections
│   │   ├── analysis-discovery.ts     # Frozen execution bindings and match packet preparation
│   │   ├── analysis-evidence.ts      # Finalized runner XML adapter and event references
│   │   ├── analysis-report.ts        # Structural report and reference validation
│   │   ├── prepare-analyses.ts       # Durable bounded analysis queue; no model invocation
│   │   ├── control-session.ts        # Admission, settlement, continuation and reports
│   │   └── session-lock.ts           # Shared session write lock
│   └── lib/
│       ├── asset-roots.ts            # Current acquisition and source-root mapping
│       ├── json-content/            # Readable sources and startup snapshot compilation
│       ├── sqlite-content/          # Retained developer conversion and package tooling
│       ├── asset-delivery/          # Retained copy-migration and file-safety helpers
│       └── vite-content-deny.ts     # Browser protection for private asset source files
│
├── tools/bot-evaluation/             # Separate Rust developer executable
│   ├── Cargo.toml                    # Evaluator dependencies and release settings
│   └── src/
│       ├── main.rs                   # Evaluate, compare, benchmark and improve commands
│       ├── frozen_pool.rs            # Frozen-session scheduling, budgets and resume
│       ├── frozen_match.rs           # Four-game execution through existing engine/evidence
│       ├── frozen_evidence.rs        # Completion markers, replay hashes and integrity
│       ├── runner.rs                 # Sequential real-engine match scheduling
│       ├── config.rs                 # Evaluator configuration
│       └── improvement/             # Bounded strategy improvement, persistence and statistics
│
├── test/                             # All application test sources and test tooling
│   ├── README.md                     # Test layout, selection and direct command examples
│   ├── unit/                        # Isolated logic and architecture checks
│   ├── component/                   # Svelte component tests
│   ├── integration/                 # Cross-module and real-engine tests
│   ├── tooling/                     # Node tooling and runner regressions
│   ├── release-gates/               # Explicit release-readiness checks
│   ├── e2e/
│   │   ├── README.md                # Browser suite coverage and collection rules
│   │   ├── application/             # Application browser scenarios
│   │   ├── acceptance/              # Visual acceptance scenarios
│   │   ├── native/                  # Native bridge and webview scenarios
│   │   └── resources/               # Resource lifetime and performance scenarios
│   ├── fixtures/                    # Sample decks, content, transcripts and fixture components
│   ├── helpers/                     # Shared fixture builders and test servers
│   ├── config/                      # Vitest and Playwright configurations
│   └── runner/
│       ├── run-tests.ts             # Targeted test runner
│       ├── test-context.ts          # Branch-change context and suggested tests
│       ├── verify-browser-collection.ts # Browser discovery without launching browsers
│       ├── lib/                     # Test selection, context and reporting helpers
│       └── native/                  # Native acceptance runners and injected fixtures
│
├── vendor/ocgcore-wasm/0.1.2/         # Frozen duel engine, loader and integrity manifest
├── generated/                       # Ignored build, acquisition and package output
├── .tmp/                            # Ignored temporary agent and tooling work
│   └── test/                        # Test logs, reports, coverage and browser artifacts
├── .cache/                          # Ignored upstream downloads and cache
└── node_modules/                    # Installed JavaScript dependencies; generated
```

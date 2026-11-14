# Repository map

Whenever files change, review this map and keep paths and responsibilities synchronized in the same change; directory entries cover their descendants.

```text
ascencio/
├── AGENTS.md                         # Compact agent topic router
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
│   │   └── SKILL.md                  # Bot improvement orchestration, run summaries and temporary log contracts
│   ├── ascencio-tests/
│   │   └── SKILL.md                  # Select and run related tests locally
│   └── impeccable/
│       └── SKILL.md                  # Frontend design, critique and refinement
│
├── .githooks/                       # Local Git checks; install via project guide
│   └── pre-commit                   # Existing lint/typecheck for staged code changes
│
├── .github/                         # Repository and GitHub agent integration
│   ├── agents/                      # Agent role definitions
│   ├── hooks/                       # Agent hook configuration
│   ├── skills/                      # GitHub-facing skill integration
│   └── disabled-workflows/          # Archived remote workflows; local-only policy in project guide
│
├── docs/                             # Durable documentation, repository map and decision history
│   ├── README.md                     # Full documentation index
│   ├── repository-map.md             # Detailed source ownership and paths
│   ├── repository-cleanup.md         # Manifest inspection, equivalence and archive deletion
│   ├── ticketing.md                 # Linear workspace, project and connection
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
│   │   │   ├── typescript-runner-performance-implementation-plan.md # Fresh-session execution plan for runner and workflow acceleration
│   │   │   ├── bot-improvement-performance-retrospective.html # Measured workflow costs and TypeScript-first optimization plan
│   │   │   ├── experimental-typescript-runner.md # Persistent Node engine runner comparison
│   │   │   ├── experimental-replay-pool.md # Explicit loss-reason queue, worker isolation and replay experiments
│   │   │   ├── independent-batch-runner.md # Default batch execution, session allowances and legacy archive
│   │   │   ├── testing.md            # Test strategy and verification routes
│   │   │   ├── diagnostics.md        # Errors, traces and reproducibility
│   │   │   ├── bot-improvement-loop.md # Bounded real-engine bot improvement loop
│   │   │   ├── decision-replay.md     # Verified game-prefix replay and AI takeover comparisons
│   │   │   └── parallel-bot-session.md # Setup, iterations, analysis jobs, accounting and paired aggregation
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
│   │   ├── 105_ADR_browser_development_and_shared_content_transport.md
│   │   │                             # Browser development exception and shared transport
│   │   └── 106_ADR_typescript_ai_bot_strategies.md
│   │                                 # TypeScript bot strategies; Rust AI retirement and rationale
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
│   │   └── bot-improvement/          # Raw iteration/source evidence, final performance report and comparison graph
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
│   │       ├── bot-runtime/           # TypeScript bot loading, validation and historical transport helpers
│   │       └── bot/
│   │           ├── bot-contract.ts   # Bot inputs, decisions, settings and sideboarding interface
│   │           ├── generalist-bot.ts # Generalist package compatibility entry and policy adapter
│   │           ├── strategy-bot.ts   # Policy-independent scoring and response execution
│   │           ├── strategy-contract.ts # Shared action scoring interfaces
│   │           ├── bot-as-opponent-policy.ts # Shared validated opponent adapter
│   │           ├── generalist-strategy.ts # Compatibility export for Generalist package scoring
│   │           ├── basic-bot.ts      # Basic package entry and shared opponent adapter
│   │           ├── random-bot.ts     # Compatibility export for Random package policy
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
│       ├── native_bots.rs            # Retired experimental native bot subprocess implementation
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
│   ├── ai-bots/                      # Self-contained manifest-driven TypeScript bot packages
│   │   ├── README.md                 # Package layout, authoring and distribution contract
│   │   ├── basic/                    # Basic manifest, ai project, settings and deck
│   │   ├── generalist/               # Generalist manifest, scoring project, settings and deck
│   │   ├── random/                   # Random manifest, ai project, settings and deck
│   │   └── goat-control/             # GOAT manifest, deck-specific scoring project, settings and deck
│   ├── app/                          # Tracked fonts, application icon and download-link settings
│   ├── duel-core/                    # Engine configuration and strings
│   ├── freeplay/                     # Freeplay decks, opponents, settings and card limits
│   ├── bootstrap-inputs/             # Tracked source inputs for initial content setup
│   ├── commerce/                     # Shop, set, booster and economy source declarations
│   ├── card-library/                 # Acquired card data, scripts and images; ignored by Git
│   └── chapter-01/                   # Acquired Chapter 1 package inputs and media; ignored by Git
│
├── scripts/                          # Development, acquisition, content, build and repository cleanup commands
│   ├── setup-desktop.ts              # Fresh-clone setup
│   ├── start-desktop.ts              # Native build-and-launch orchestration
│   ├── download-mvp-assets.ts        # Asset acquisition entry
│   ├── download-mvp-assets.sh        # macOS/Linux download wrapper
│   ├── download-mvp-assets.cmd       # Windows download wrapper
│   ├── prepare-browser-content.ts   # Fixed-content browser development preparation
│   ├── readable-content.ts          # Readable JSON conversion and compilation
│   ├── readable-content-release.ts  # Content release pinning, staging and verification
│   ├── verify-native-build.ts        # Frontend build and payload boundaries
│   ├── build-ai-bots.ts              # Manifest-driven TypeScript distribution bundles
│   ├── bot-experiment/               # Historical Rust experiment reproduction commands
│   ├── bot-evaluation/               # TypeScript bot host, verified decision replay and evaluator schemas
│   ├── bot-improvement/              # Frozen sessions, execution, analysis, aggregation and decisions
│   │   ├── run-matches.ts           # Default session batch runner CLI and public tooling exports
│   │   ├── session-batch-runner.ts  # Session admission, batch execution, settlement and baseline receipts
│   │   ├── batch-session-accounting.ts # Durable game allocations and worker-journal settlement
│   │   ├── benchmark-analysis-evidence.ts # Offline twelve-match publication/resume performance fixture
│   │   ├── benchmark-improvement-workflow.ts # Isolated evaluation, complete loss preparation/report ingestion and resume fixture
│   │   ├── batch-storage-lease.ts   # Shared session quota reservation for independent workers
│   │   ├── prepare-match-job.ts     # Verified frozen schedules, snapshots and engine job construction
│   │   ├── match-process.ts         # Subprocess lifecycle and shared match CLI options
│   │   ├── archive/                 # Legacy supervisor, benchmark and 2–8-worker calibration
│   │   ├── run-batch-matches.ts     # Standalone batch runner and shared prepared-job launcher
│   │   ├── run-typescript-native.ts  # Default TypeScript execution, session leases, journals and verified resume
│   │   ├── typescript-native-worker.ts # Persistent in-process WASM host and game/checkpoint records
│   │   ├── typescript-native-resume.ts # Bounded read-only completion verification pool before admission
│   │   ├── typescript-native-completion.ts # Shared read-only canonical completion and resume verification
│   │   ├── typescript-native-executor.ts # External deadlines, restart and per-game timeout continuation
│   │   ├── typescript-calibration.ts # Separate TypeScript runtime and machine recommendation identity
│   │   ├── typescript-benchmark.ts # Native-evidence TypeScript calibration measurement
│   │   ├── typescript-native-evidence.ts # Native v2 log encoder, canonical hashing and receipt validation
│   │   ├── run-typescript-matches.ts # Experimental persistent Node worker match pool
│   │   ├── typescript-match-worker.ts # In-process WASM engine, four games and sideboarding
│   │   ├── compare-native-runners.ts # Full actor timelines and sideboarding parity via replay rules
│   │   ├── benchmark-typescript-matches.ts # Rust versus integrated TypeScript gameplay and timings
│   │   ├── worker-calibration.ts      # Shared exhaustive CPU stages and median recommendation
│   │   ├── calibrate-batch-workers.ts # Independent TypeScript/Rust CPU calibration and recommendations
│   │   ├── compare-match-runners.ts # Short paired legacy/batch performance comparison
│   │   ├── batch-benchmark.ts       # Shared gameplay and completion verification for benchmarks
│   │   ├── run-replay-pool.ts        # Experimental bounded replay scheduling and case receipts
│   │   ├── replay-pool-contract.ts   # Reason variants, explicit critical decisions and result contracts
│   │   ├── prepare-replay-pool.ts    # Loss discovery, immutable variant bundles and input pins
│   │   ├── replay-work-queue.ts      # Dynamic batch assignment across replay worker slots
│   │   ├── replay-pool-process.ts    # Case process groups, deadlines and cancellation
│   │   ├── replay-host-process.ts    # Serialized replay branch host ownership, protocol bounds and shutdown
│   │   ├── replay-output-budget.ts  # Independent replay writer allowances under the shared quota
│   │   ├── benchmark-replay-pool.ts  # Independent replay CPU calibration and behavior comparisons
│   │   ├── replay-game-decision.ts   # Replay recorded choices and compare AI continuations
│   │   ├── prune-improvement-iteration.ts # Delete analysed action traces; retain results and receipts
│   │   ├── migrate-improvement-run.ts # Verified linked-evidence migration without replay
│   │   ├── generate-improvement-run-index.ts # Agent navigation from run to individual games
│   │   ├── generate-compact-match-logs.ts # Existing match evidence to actor-relative text logs
│   │   ├── update-improvement-history.ts # Atomic bot-local Markdown attempt and decision history
│   │   ├── generate-improvement-run-setup.ts # Frozen packages and generated improvement-run setup files
│   │   ├── session-contract.ts       # Frozen setup and candidate validation schema
│   │   ├── iteration-contract.ts     # Prepared bindings and baseline receipts
│   │   ├── session-control-contract.ts # Stop/resume and execution accounting
│   │   ├── output-storage.ts         # Shared output quota, protected headroom and atomic writes
│   │   ├── prepare-iteration.ts      # Accepted snapshot, self binding and baseline reuse
│   │   ├── analysis-output.ts        # Single-owner quota reservation and scoped packet/report writers
│   │   ├── analysis-contract.ts      # Analysis packets, claims and report sections
│   │   ├── analysis-discovery.ts     # Frozen execution bindings and match packet preparation
│   │   ├── analysis-evidence.ts      # Legacy evidence validation and finalized adapter selection
│   │   ├── analysis-text-evidence.ts # Verified game-log evidence and legacy record reader
│   │   ├── game-log.ts               # Lossless typed game logs, decoding and loss-only views
│   │   ├── analysis-slices.ts        # Durable 250-match analyst claims, loss filtering and reports
│   │   ├── publish-text-match.ts     # Publish verified native match completion for streaming analysis
│   │   ├── benchmark-behavior.ts     # Verified gameplay fingerprints for worker comparisons
│   │   ├── analysis-report.ts        # Markdown findings, generated reports and reference validation
│   │   ├── prepare-analyses.ts       # Durable bounded analysis queue; no model invocation
│   │   ├── control-session.ts        # Admission, settlement, continuation and reports
│   │   ├── decision-contract.ts      # Pinned orchestrator decision and outcome schema
│   │   ├── apply-decision.ts         # Recoverable archive and atomic accepted-state commit
│   │   ├── commit-bot-version.ts     # Journaled bot-version Git publication and crash recovery
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
│       ├── main.rs                   # Evaluate, independent batches, compare, benchmark and improve commands
│       ├── batch_runner.rs           # Independent persistent batch workers and durable reservations
│       ├── worker_storage.rs         # Independent incremental writer allowances and staging accounting
│       ├── archive/frozen_pool.rs    # Legacy per-match session supervisor
│       ├── frozen_match_support.rs   # Shared host initialization, identities and match metrics
│       ├── frozen_match.rs           # Four-game execution through existing engine/evidence
│       ├── frozen_evidence.rs        # Completion markers, replay hashes and integrity
│       ├── native_match_evidence.rs  # Authoritative game/match log writing and resume decoding
│       ├── log_codec.rs              # Lossless typed text record encoding and validation
│       ├── output_storage.rs         # Cross-process output quota and atomic publication
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

# Retired Rust bot experiment

[ADR-106](../ADR/106_ADR_typescript_ai_bot_strategies.md) records the accepted TypeScript strategy decision and its rationale.

Rust/WASM and native Rust bot strategy development is retired. The application uses the built-in TypeScript Basic, Generalist and Random policies. Freeplay no longer discovers external AI packages, and native builds no longer compile or bundle Rust AI executables. Installed Rust AI packages are no longer supported; content requiring one must select a built-in TypeScript policy.

The [measured results](../evidence/bot-experiment/results.md) found no performance reason to switch built-in policies to Rust. Rust reproduced the saved decisions but transport and copying increased costs. Retained experiment sources are historical evidence. Application loading, evaluation setup, evaluator hosts and candidate compilation reject Rust strategies; historical commands below may require the original experiment revision. The Rust native application host and evaluation scheduler have separate responsibilities and remain in use.

Strategy authoring lives in `assets/ai-bots/<bot>/ai/`; the Generalist package owns baseline action scoring. See [the package contract](../../assets/ai-bots/README.md). Retired reference sources are archived under `docs/archive/rust-bot-experiment/reference/`.

## Historical package and reproduction contract

The following describes the retired experiment only.

## Packages and authoring

Bundled packages live in `assets/ai-bots/<folder>/`. Desktop overrides live in
`<Ascencio app-data>/ai-bots/<folder>/`; on Linux the default is
`$XDG_DATA_HOME/com.ascencio.storyduel/ai-bots` (or
`~/.local/share/com.ascencio.storyduel/ai-bots`). Add, replace or remove folders
between duels. There is no import wizard or package-manager UI.

Each folder contains `bot.json`, its Rust project under `ai/`, and `dist/ai.wasm`.
The reference package uses `ai/Cargo.toml`; that entry may become a workspace
without changing the game-facing contract. The manifest declares `id`, semantic
`packageVersion`, `contractVersion: 1`, package-relative `source` and `wasm` paths,
and supported `policies`. Paths cannot escape the package. Installed identities
override bundled identities. A malformed package reports a loader error; built-in
TypeScript remains usable. Remove or repair the named package and retry.

Browser development serves only the fixed `assets/ai-bots/` collection through
`/bot-packages/index.json` and package-specific manifest/WASM routes. It never
reads the desktop app-data directory or arbitrary browser-local folders. Updating
browser-supported content means updating the server's fixed folders; deployments
of the experiment harness must serve that same explicit index and resources.
The native frontend contains no engine or bot WASM assets: native resource folders
supply the pinned bytes. Production browser deployment remains outside the
application's existing distribution policy.

The native reference executable is bundled by `scripts/bot-experiment/stage.ts`.
Only a reference package with the exact compiled-in WASM digest can use it; other
Rust-authored packages execute as WASM. This is not a native plugin platform.

## Contract, isolation and lifetime

The JSON contract accepts `create`, `decide` and `sideboard`. Creation receives
public card definitions, policy, configuration and a seed. Decisions receive only
actor-permitted observations and legal choices. No script, engine handle, private
opponent hand or authoritative state is passed to a bot. The shared crate targets
native and `wasm32-unknown-unknown`; `dist/build.json` records build provenance.

A duel pins manifest, digest and executable bytes once. Replacing files cannot
change an active duel. Restore recreates that pinned version and warms game-local
state while replayed recorded responses remain authoritative. Instances reset
between games, including the evaluator's existing per-game lifecycle, and between
matches. Sideboarding receives the two actual pre-side histories and applies
validated exchanges before the post-side games. There is no learned match memory.

WASM runs in a disposable nested Worker, with no imports and at most 512 MiB of
linear memory and one function table bounded to 65,536 entries. Returned action
arrays are bounded to 4,096 entries before decision validation. Native Rust runs in a dedicated child process, called through the
actual duel Worker → main thread → Tauri command → process round trip. Requests
are serialized; disposal cancels outstanding work before the engine handle closes.
Both execution paths have a 2-second decision deadline. WASM loading and host RPC
have a 15-second deadline. Inputs are bounded to 64 MiB, outputs to 1 MiB, package
executables to 4 MiB. Native Unix children additionally have a 768 MiB address-space
limit; other platforms retain request/output/time limits but lack that Unix limit.

A trap, timeout or invalid response closes the failed runtime and uses validated
built-in Basic decisions for the rest of the duel. Invalid sideboarding retains
the original deck. Development shows a warning and logs the pinned version,
stack and full permitted input. Production recovers without warning or trace.
The evaluator uses a preemptible Node Worker for WASM and a bounded native child,
with the same fallback validation and deadlines. Machine-readable fallback
telemetry is always emitted to the evaluator; development warnings remain separate.
Setup failures count immediately, including games without a bot decision.

Each unexpected recovery increments the correctness-failure counter; no experiment
may count such a game or replay as a pass. Explicit missing Story dependencies are
always visible, including production, and are not silent fallback cases.

## Story dependency declaration

A content deck can declare:

```json
"requiredAi": {
  "runtime": "wasm",
  "packageId": "ascencio.reference",
  "policy": "generalist"
}
```

After startup the menu reports missing required AI. Starting the affected Story
duel checks again and remains in the menu/briefing if the requirement is missing.
Other decks remain usable. Legacy decks without a declaration explicitly resolve
to built-in TypeScript Basic. Freeplay does not inherit this Story requirement.

## Build and run

Use Node 26+, npm dependencies, Cargo/Rust and the `wasm32-unknown-unknown` target.
The retained portable build used Rust 1.99.1. Standard native prerequisites remain
those in [desktop setup](../desktop-setup.md).

```sh
node scripts/bot-experiment/build.ts
node scripts/bot-experiment/stage.ts
npm run browser:dev
npm run native:desktop:dev
```

Native development and release before-build commands stage bot resources. The
existing installed application command remains `npm start`. See the evidence
README for release harness commands, replay, live smoke and performance runs.
The implementation is tested on Linux; macOS and Windows packaging are supported
by the existing Tauri resource mapping and executable suffix handling, but were
not physically tested in this experiment.

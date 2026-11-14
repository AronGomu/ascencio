# Integrated TypeScript migration tests

Persistent Node worker threads import the TypeScript engine host, own their WASM engine and frozen content, and claim independent seeded matches. Each match plays four games, alternates starters and supplies actor-relative pre-side histories for seeded sideboarding. Bots are instantiated per game, as in the Rust-supervised host. Engine and content loading are reused inside each worker. The Rust scheduler and host JSON pipe are absent from the TypeScript execution path.

## Full-evidence comparison

```sh
npm run bot:typescript:migration:test -- --session SESSION --out .tmp/full-comparison --workers 2 --matches 12 --max-wall-ms 180000
# Reverse order for another fresh comparison:
npm run bot:typescript:migration:test -- --session SESSION --out .tmp/full-comparison-reversed --workers 2 --matches 12 --max-wall-ms 180000 --native-first
```

The comparison builds the separate Rust executable, prepares fresh standalone accounting from the accepted snapshot, and plays the same fixed matches through both runners. Each backend has a fresh coordinator process; TypeScript worker memory is released before another backend starts. The report’s `comparison` field uses process wall time, including frozen preparation and startup. Compilation and post-run gameplay comparison are excluded from measured execution. Startup, game execution, durable writes, canonical evidence hashes and completion verification are included. This is a fixed-work comparison; `--max-wall-ms` bounds the TypeScript stage, not a requested sustained benchmark duration. Test matching worker counts, sufficient matches and both run orders under representative load.

TypeScript writes the native v2 `game.log` and `match.log` schema, including both actor timelines, starting orders, configurations, sideboarding and outcomes. Field-path dictionaries preserve the exact typed records. Canonical game hashes follow the existing version-one rules. An atomic hash-pinned `done.json` publishes a completed match. The existing gameplay fingerprint reader must agree with Rust, including all selected choices and configuration hashes. Complete actor initial states, timelines and sideboarding are additionally compared through the existing strict decision-replay rules: only permutations of consecutive state-free description hints are allowed; state changes and decisions remain ordered. Those harmless engine annotation permutations can produce different full hashes while preserving verified replay behavior. The benchmark additionally resumes both outputs and verifies that TypeScript reservations and completions are unchanged. Resume timing measures verification, not fresh simulation throughput. `comparison.json` is the handoff artifact.

## Standalone native runner

```sh
npm run bot:typescript:native -- --session SESSION --out .tmp/native-games --workers 2 --matches 12 --max-wall-ms 180000
npm run bot:typescript:native -- --session SESSION --out .tmp/native-games --workers 2 --matches 12 --max-wall-ms 180000 --resume
```

Outputs use a fresh root with an output budget and a `payload/` evaluation. Resume binds the prepared job, runtime source hashes, worker count and execution limits; altered inputs are rejected. Verified completed matches are retained. Every admitted match reserves four games in a durable worker journal before dispatch; interrupted attempts remain charged. Missing work needs another four-game reservation. Maximum games stops admission; original wall deadline, owner stop file (`--stop-file`) and SIGINT/SIGTERM interrupt owned workers. Game and decision timeouts finalize failed evidence and continue through a fresh engine; sideboard failure skips post-side games. Workers serialize and verify completed native evidence. The coordinator publishes each completion receipt only after verification, counts outcomes from the compact match index and waits for admitted writes before releasing its quota lease. Partial game logs are retained without a completion receipt and are not accepted as finalized evidence.

The parent storage lease and local staging accounting bound output. Data leaves coordinator headroom for journals/results, including on output exhaustion. Resume validates evidence and journals before storage admission; a clean inactive lease is recalculated against current usage, including replay outputs. An active crash lease retains its original recovery contract. A live owner blocks another dispatcher. Completed evidence must pass exact file inventory, byte hashes, match bindings and canonical game hashes before reuse. Analysis may publish a separately pinned derived `native/done.json`, as for Rust evidence.

Related tests run real native games, analysis loading, decision replay, completed resume without replay or new charges, altered evidence/journal rejection, game-budget admission, owner stop, original wall deadline, external game timeout and output exhaustion with a readable result under a 48 MB cap.

## Production integration

The native backend now powers future `bot:matches` sessions as `session-typescript/v1`. The shared session adapter reserves and settles game/storage allocations, preserves flat match paths and publishes baseline receipts. Existing Rust iterations retain `session-batch/v1` and use `bot:matches:rust`. Runtime identity, worker recommendation and source pinning are independent of Rust. See [persistent match runners](independent-batch-runner.md).

Each worker slot owns its engine. External game/decision deadlines terminate that worker; timeout evidence is finalized and the engine restarts for the next game. Non-timeout game failures skip remaining games; sideboard failures skip post-side games. Failed finalized attempts are verified on resume rather than retried. Global stop/output/wall limits interrupt admission and keep unfinished attempts charged.

## Earlier compact experiments

`bot:typescript:compact` writes compact gameplay summaries; `--evidence` additionally retains raw host frames. `bot:typescript:benchmark:diagnostic` includes both of those weaker formats plus the native stage. The normal `bot:typescript:benchmark` and `bot:batch:compare` commands select full native evidence only. Compact summaries and raw frames are not substitutes for native verified evidence. Their larger speedups include reduced persistence work.

The shared host CLI retains its original line protocol. Importing its command handler starts no stdin reader. The experimental worker uses a synchronous in-process frame sink, with one serialized command per host runtime.

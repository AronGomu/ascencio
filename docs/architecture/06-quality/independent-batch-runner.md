# Persistent match runners

Future improvement evaluations use `npm run bot:matches` and runner identity `session-typescript/v1`. The session adapter verifies preparation, reserves the shared game allowance and storage lease, runs persistent Node workers, and settles durable worker journals and native match receipts. The duel engine remains WASM; TypeScript owns scheduling, bots and evidence. No Rust executable is built or launched by the default path.

```sh
npm run bot:matches -- --session SESSION --out SESSION/evaluation --workers auto
npm run bot:matches:calibrate -- --session SESSION --out .tmp/ts-calibration
npm run bot:matches -- --session SESSION --out SESSION/evaluation --workers auto --resume
```

Worker calibration runs independently from `bot:replays:calibrate`. It tests every integer from 2 through the machine's available logical CPU count, defaults to two repeats, checks gameplay fingerprints and selects the smallest count within 3% of the fastest median. TypeScript results live in `.cache/typescript-native-workers.json`, pinned to runtime source hashes, machine, Node, fixture and batch size. Missing or stale settings trigger calibration before evaluation admission. No Rust measurements are reused. A schedule that can only run one worker uses one worker without a meaningless sweep. `--worker-counts` narrows explicit calibration stages; automatic full sweeps require enough matches for every stage. Calibration games use fresh standalone accounting.

Session output keeps the existing flat `matches/match-NNNN` paths. Native v2 logs contain complete actor timelines, configurations, sideboarding and canonical evidence hashes. Completion receipts, loss analysis, baseline reuse, aggregation and decision replay retain their contracts. A complete control schedule publishes the existing baseline receipt. Workers claim independent matches and keep their engine/content alive; `--batch-size` remains a calibration/binding parameter, while TypeScript reserves each match separately before launch.

External game and decision deadlines terminate the owned worker. A game timeout produces failed game evidence and a bug checkpoint, restarts the engine, and continues remaining games without replaying the timed-out game. Non-timeout game failures skip the remaining match games; sideboard failure skips post-side games. Completed failed attempts retain receipts so resume does not accidentally retry them. Interrupted attempts remain charged; missing work requires another reservation within the original allocation. Stop markers and wall/output limits halt admission and leave verified completed evidence resumable. The coordinator drains writes before releasing its shared allowance. See the [native runner contract](experimental-typescript-runner.md).

## Standalone runs and comparisons

```sh
npm run bot:batch -- --session SOURCE_SESSION --out .tmp/ts-evaluation --workers 4 --matches 50 --max-wall-ms 600000
npm run bot:typescript:migration:test -- --session SOURCE_SESSION --out .tmp/comparison --workers 8 --matches 50 --max-wall-ms 600000 --native-first
```

Fifty matches equal 200 games per backend. The comparison uses the same frozen schedule and workers, excludes compilation, includes startup and durable native evidence work, verifies full timelines through the existing replay rules, and checks resume without extra game charges. Reverse execution order and repeat for sustained recommendations; a single comparison is not calibration.

## Archived backends and existing runs

`session-batch/v1` is the archived Rust batch identity. Existing iterations remain pinned and must use `npm run bot:matches:rust`; a TypeScript invocation rejects switching their identity. `bot:batch:rust` runs the independent Rust backend; `bot:matches:rust:calibrate` uses `.cache/batch-runner-workers.json`. The older supervisor remains under `scripts/bot-improvement/archive/` and `bot:matches:legacy`. Archived Rust and legacy commands can still build the separate developer executable. Running processes are not reconfigured by this default change.

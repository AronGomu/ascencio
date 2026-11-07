# Frozen match runner: ARO2-18 local evidence

Measured code: `894114bb45486510d0bcc86e4e590e659a3e4555`. Includes merged PR80 accounting/locking contracts.

The owner explicitly replaced the requested full-size performance comparison with **24 identical frozen matches / 96 games at each of 1, 2, 4, 6 and 8 workers**, one run per stage. Production still supports the complete 500-match / 2,000-game schedule. No full-size run was restarted after the override.

## Results

Each stage completed 24 matches / 96 games: 120 matches / 480 games total, no failures, timeouts, skipped or duplicate games. All persisted XML/evidence files passed resume verification. All five canonical replay identities agree, and every selected game agrees with the corresponding prefix of the earlier full 500-match baseline. All 120 admission attempts settled with no reservations outstanding.

| Workers | Command wall (s) | Mean completed-match latency (s) | Amortized wall / completed match (s) | Speedup vs 1 | Peak tree RSS (GiB) |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 | 56.037 | 1.947 | 2.335 | 1.00× | 1.20 |
| 2 | 31.330 | 2.115 | 1.305 | 1.79× | 1.80 |
| 4 | 20.149 | 2.491 | 0.840 | 2.78× | 3.19 |
| 6 | 17.230 | 2.970 | 0.718 | 3.25× | 4.56 |
| 8 | 23.417 | 4.929 | 0.976 | 2.39× | 5.68 |

**Six workers is the measured recommendation**, 3.25× the one-worker throughput on this sample. Eight was slower and used more memory. Auto resolves to six on the measured CPU/environment and clamps to current CPUs, pending matches and the session worker bound. This is a single small-sample comparison; the 3% preference band is a conservative floor, not an empirical repeated-run noise estimate.

Mean latency averages each completed worker's timer: before host initialization through four sequential games, sideboarding, canonical verification and durable XML. Admission queue, latency/commit-marker metadata and coordinator settlement are outside that timer. Amortized wall time divides the wider end-to-end command wall time by 24; it includes preparation, cold hosts, evidence, shutdown and accounting finish. Parallel work overlaps, so these values must not be equated. Persisted per-match timing samples were independently averaged and matched the reported means.

The previous full one-worker baseline completed 500 matches / 2,000 games in **1,168.378 s command wall**, or **2.337 s per completed match**. It did not record a separate worker match-latency timer; that value is unavailable. The interrupted second baseline completed 321 full matches plus two games of its next match (1,286 completed games), with one interruption failure and one skipped game. Its 786.486 s command wall divided by completed matches is 2.450 s/match and includes the partial attempt's work. Those full/partial runs remain preserved in `generated/bot-tuning/aro2-18-comparison`; they are context, not the concurrency speedup baseline.

## Conditions and inputs

Ryzen 7 7700, eight usable physical cores / sixteen logical CPUs, Linux x64, Node 26.12.0. Launch load averages: 0.79 / 2.59 / 3.21. The process snapshot found no heavy builds or tests. Parent coordinated deferral of other heavy agent work; no validation/build work overlapped the timed stages. Normal desktop/agent processes remained. Build was performed once before stages; no unmeasured game warmup. Each run started with a fresh accounting ledger and identical limits, archived bots, decks, seeds, fixture prefix and normal evidence writing.

Fixture identity: `2a017f39ef338473d2409ffa36a5e0e2e8716c3281f4c7143113faadceb4b5bd`. Reference Generalist WASM self-play with compiled production content and normal MR5 rules. The bundled player deck has two Raigeki against a one-copy limit; the benchmark used a separate legal copy replacing the excess Raigeki with a third Blue-Eyes White Dragon. Gameplay source inputs were not edited. The archive retains the exact legal deck and all input bytes. Decision/game/sideboard deadlines remained 1 s / 60 s / 5 s at every stage.

Memory is summed evaluator-process and descendant RSS sampled every 100 ms, including the accounting host, engine hosts and bot Workers. Shared pages may be counted in more than one process; sub-100-ms peaks can be missed. Values are observed process-tree peaks, not a single host or allocator estimate.

## Reproduction and retention

Actual measurement command (Node 26 PATH):

```sh
npm run bot:matches:benchmark -- --session generated/bot-tuning/aro2-18-final/session --out generated/bot-tuning/aro2-18-small/stages --matches 24 --repeats 1
```

`benchmark.json` and `conditions.json` retain exact values and boundaries. `replay.json.gz` stores all 96 canonical game hashes; `fixture-manifest.json.gz` stores the unchanged full schedule. `prior-runs.json` retains actual earlier full/partial totals. `archive.json` records the external raw archive path, size and SHA-256. The archive includes frozen inputs, all normal XML evidence, partial runs, logs, the measured source tar and evaluator binary. Extract its repository-relative paths into the original root to preserve absolute prepared-job references; a fresh evaluation can instead prepare from the archived frozen inputs. Existing committed evidence is never silently rewritten or relocated for resume.

The machine-local recommendation is `~/.local/state/ascencio/bot-evaluation-machine.json` (or `$XDG_STATE_HOME/ascencio/…`), outside the worktree. Its evidence summary is also copied beside the external archive so it survives worktree removal.

## Validation and scope

Related local checks passed: TypeScript, Svelte checks, ESLint, formatting, Rust evaluator/experiment tests, setup/iteration/session-control contracts, bot transport boundaries, worker runtime consumers, frozen replay across concurrency, reverse/out-of-order completion, corrupt/duplicate evidence rejection, cancellation/resume, abrupt-dispatcher recovery, game-budget admission and OWNER_STOP. The focused subset test confirms the production manifest remains 500 matches and supervisor SIGINT immediately cancels the active evaluator; it completed in 3.69 s. No full application suite, remote CI query, PR merge or PR watch was used.

Open performance criterion: full 500-match comparisons at all concurrency levels were intentionally waived by the owner's 24-match override. The recommendation is supported by the reported short workload, not a claim of full-scale statistical performance. Candidate validation, synthesis and promotion remain separate workflows; promotion must finish the ledger iteration before changing accepted identity.

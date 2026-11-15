# Explanation from reviewer 3 for refined bot improvement execution

## 1. Outcome and scope

Improve one required target AI against its frozen starting self and optional additional opponents, retaining only strictly better valid paired-game candidates. Deliver accepted source, checked results and compact version history; unchanged delivery is valid when no edit qualifies. Modify target AI only, preserving decks, engine, legality and information boundaries.

## 2. Process overview

Prepare frozen identities, budgets and separate calibrated execution pools; evaluate baseline, decide, and analyze all completed target losses. Select accepted-source additive fixes or regressing-source repairs, replay isolated edits, assemble passing edits and evaluate again. Every decision receives analysis, including the last; ceiling or no qualifying edit leads to delivery, while incidents can suspend any active stage. The stateless controller guides legal edges; owning project tools persist evidence and the orchestrator verifies semantic gates.

## 3. Execution matrix

| Step | Entry condition | Action and owner | Concurrency | Decision/completion criterion | Saved output | Next step |
|---|---|---|---|---|---|---|
| Prepare | Target resolved | Orchestrator discovers contracts, resolves defaults/overrides, sets up, archives initial source, validates and calibrates | Calibration separate from evaluation/analysis | Exact current runner, sources and both matching recommendations verified | Configuration, source commit, calibration measurements | Evaluate |
| Evaluate | Baseline or frozen assembly | Tools bind control/source/schedule, reuse verified evidence and execute missing work | Independent matches at measured optimum; four games and sideboarding sequential | All scheduled matches finalized, reservations settled, comparability/resources verified | Logs, paired coverage/results/difference | Decide |
| Decide | Completed evaluation | Orchestrator checks strict improvement; tools persist decision, candidate commit and history | Serial | Baseline establishes accepted reference without consuming decision; candidates accepted/rejected | Decision and archive | Analyze |
| Analyze | Evaluate barrier verified | Delegate diagnosis only, one owner per fixed consecutive 250-match slice; merge all findings | Queued slice workers; sync publishes at most one slice per call | Every target loss covered exactly once; source-bound report complete | Claims, checkpoints, per-match findings, merged report | Deliver at ceiling; otherwise Replay |
| Replay | Analysis complete and budget available | Orchestrator excludes unchanged failed attempts and implements isolated add/remove/update variants | Measured replay pool, resource bounded; no calibration overlap | All associated losses settle; each retained edit converts at least five and 5%, changing intended choice | Immutable variants, controls/takeovers and outcomes | Assemble if passing edits, else Deliver |
| Assemble | At least one passing edit | Combine passing edits from mode base, preserve semantics; revalidate materially changed isolated logic | Serial assembly | Validated/frozen target-only candidate; history includes rules/hash/base/references | Candidate and history | Evaluate |
| Deliver | Ceiling or no qualifying edit | Verify analyses/decisions, rank existing comparable results, export and check report | No fresh ranking games | Checked consolidation precedes eligible cleanup | Export/hash, report, compact history/state | Closed |
| Suspend/resume | Incident or authorized continuation | Stop owned work, settle/checkpoint/report; resume verified prior stage only with authorization/resources | Shutdown grace then owned-group termination | Evidence and budgets preserved; no implicit successful closure | Incomplete checkpoint/report | Prior stage or explicit incomplete closure |

## 4. Identities and invariants

| Item | Initial source/value | Allowed changes | Must remain fixed | Verification |
|---|---|---|---|---|
| Opponents and paired inputs | Setup, including original self | Accepted comparator moves after promotion | Opponent sources/order, schedules, starting deck orders/seeds/sides/rules/content | Source hashes, stable game/match IDs, integrity bindings |
| Source roles | Initial accepted source | Ordinary mode adds one fix; valid regression repairs remove/update one rule without additions | Analysis/replay/assembly source explicitly recorded; isolated variants do not accumulate earlier edits | Source hashes, unchanged replay control, preserved repair rules |
| Promotion | Accepted versus candidate | Strict higher equally weighted opponent game rate | Completed paired intersections, ignored exclusion on both sides, draws in denominator; every opponent needs a pair | Independent gate plus tool transaction/source validation |
| Evidence access | Typed lossless logs | In-memory reconstruction; target-loss projections for analysts | Positive allowlist; no opponent/full two-actor/non-loss gameplay browsing | Packet/page hashes, offered/chosen IDs, coverage audit |
| Archive identity | Stable bot and unique immutable run/version IDs | Candidate commits, including rejected; moving accepted ref independent of HEAD | Required trailers, existing history, immutable version IDs | Commit journal, full SHA/path/outcome/source hashes |

## 5. Limits and accounting

| Resource/stage | Default limit | Override rule | Accounting | Action at exhaustion |
|---|---|---|---|---|
| Decisions/evaluation | 50 decisions; 2500 total four-game matches per evaluation | Pin owner values; require at least one match per opponent | Baseline excluded from decisions; distribute floor plus ordered remainder; games planned = (1 + effective decisions) × matches × 4 | Analyze final decision then Deliver |
| Recovery | floor(10% planned evaluation games) | No automatic increase | Separate planned/recovery, count failed/interrupted reservations and executions; caches add zero | Ignore remaining interrupted games; continue eligible work |
| Wall/storage | 24h; 50 GB | Explicit effective limits; continuation preserves consumption/start | Downtime included; logical staging/log/evidence/import bytes; 16 MB protected control reserve inside cap | Suspend, block data writes; no analysis/ranking/export/cleanup |
| Stage timeouts | Evaluation 5h; preparation 10m; validation/replay branch 5m; shutdown 60s | Pin resolved branch values, cap by remaining wall time | Launch-to-exit includes replay prefix | Apply incident-specific outcome |
| Replay/calibration | No rule-replay quota | All associated losses required; diagnostics classified separately | All consume time/storage; controls/takeovers/diagnostics separate from evaluation | Suspend at applicable resource boundary |
| Calibration pools | Every worker count 2 through logical CPUs | No arbitrary worker fallback | Replay: two full successful repetitions, representative batches and matching outcomes; smallest within 3% fastest median | No qualifying count stops preparation |

## 6. Incidents and continuation

| Incident | Immediate action | Retry allowance | Evidence preserved | Resume condition |
|---|---|---|---|---|
| Individual game/replay timeout | Bug report, finalize ignored; safe jobs continue | Never retry case | Outcome/reason/accounting; replay timeout remains denominator nonconversion | Normal safe progression |
| Interrupted evaluation | Preserve verified completions, recover missing work | Automatic within recovery allocation/deadlines | Every attempt/reservation/timeout | Remaining resources |
| Calibration stage failure | Fresh directory, same pinned inputs | Once; second failure excludes count and remaining repetitions | Both attempts/exclusions and retry state | Other counts may continue |
| Unsupported package before admission | Adapt only build/validation tooling and run related checks | Fresh validation; no game charge | Failed validation | Stop if still invalid/protected boundaries fail |
| Integrity/input-prefix, initialization, sideboarding or other non-timeout validation failure | Stop; never ignore unsafe state | No generic retry | Full verified checkpoint and errors | Applicable explicit incident authorization; integrity stop remains binding |
| Resource exhaustion | Stop admission/owned work, persist quota marker and checkpoint | Explicit limit increase/continuation only | Resumable detail and original budgets | Verified checkpoint and remaining/increased effective limits |
| Owner pause/cancel or analyst execution failure | Stop admission/work, preserve ownership/uncovered losses | No automatic continuation | Claims, pending jobs and shutdown/accounting | Explicit instruction on same verified checkpoint |

## 7. Delivery and retention

| Artifact | Required contents | Destination | Retain until | Cleanup condition |
|---|---|---|---|---|
| Run/control state | Configuration, identities, decisions, accounting, checkpoints | Existing run.json and iteration.json paths | After closure | Keep compact durable state |
| Temporary execution evidence | Logs/indexes, findings/pages, replay traces, variants/packages, schedules/receipts/calibration records | Existing execution paths | All execution/validation/reuse/resume needs end; accepted detail additionally until replacement or closure | Designated pruning only; suspension and delivery alone do not permit removal |
| Version/history/export | Initial and every evaluated candidate commit, compact English attempt lines, SUPERSEDED replacements, accepted export/hash | Git, improvement-history.md, export path | After closure | No permanent source archive copies; unevaluated variants uncommitted |
| Checked run report | Identity/configuration/times/status, all versions and per-opponent/weighted outcomes, paired differences, rule aggregates, coverage, accounting/errors, accepted source/ranking/issues | Project location or artifacts | After closure | Consolidate first, then remove eligible temporary detail; summary-only runs cannot supply reusable cached evidence |

## 8. Ambiguities and interpretations

| ID | Instruction reference | Ambiguity | Chosen interpretation | Behavioral consequence | Clarification required? |
|---|---|---|---|---|---|
| A1 | Calibration measurement row | “at least one full independent batch per worker at largest stage” does not define whether each repetition independently satisfies that workload floor | Discover designated calibrator contract and require its complete repetitions to satisfy the floor | Do not shorten a repetition based on totals across repetitions | Only if owning contract does not resolve it |
| A2 | Source selection: ordinary mode | “Add one fix” could describe total next assembly or each isolated operation | Each isolated variant adds one fix; assembly combines all passing fixes as explicitly instructed | Multiple validated fixes may enter one candidate evaluation | No |

No execution was performed; this explanation is based solely on the complete refined skill package and the explanation template.

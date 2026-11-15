# Explanation from reviewer 3 for independent workflow understanding

## 1. Outcome and scope

Improve one required target AI against frozen starting-self and optional opponents, delivering accepted source, verified paired results and history. Only target AI changes; decks, engine, legality and hidden information remain protected. Success can honestly mean unchanged source when no edit qualifies. Owner limits and compatible checkpoints are optional inputs; only current `session-typescript/v1` is supported.

## 2. Process overview

Prepare freezes inputs and calibrates; Evaluate/Decide/Analyze runs baseline then candidate cycles. Replay tests isolated edits; Assemble combines passing edits before another evaluation. Ceiling or no qualifying edit leads to delivery; incidents may suspend. Orchestrator implements; delegated analysts diagnose only.

## 3. Execution matrix

| Step | Entry condition | Action and owner | Concurrency | Decision/completion criterion | Saved output | Next step |
|---|---|---|---|---|---|---|
| Prepare | Inputs/checkpoint resolved | Orchestrator setup, archive, validate, calibrate | Calibration separate from evaluation/analysis | Exact setup plus matching match/replay recommendations | Pinned config, sources, reports | Evaluate |
| Evaluate | Frozen baseline/candidate | Tools reuse compatible evidence or execute | Measured match pool; four games/sideboarding sequential | All scheduled matches finalized; reservations settled | Logs, paired difference, coverage | Decide |
| Decide | Verified results | Baseline accepted; otherwise strict improvement decision, archive/history | One transaction | Valid higher weighted rate promotes; otherwise retain | Outcome, SHA, checkpoint | Analyze |
| Analyze | Finalized evaluation | Slice owners review every target loss; orchestrator merges | Whole consecutive 250-match slices; queue runtime slots | Bound report complete, including rejected/final evaluation | Per-match findings, loss report | Ceiling→Deliver; otherwise Replay |
| Replay | Source mode selected | Orchestrator isolates variants; all associated losses replay | Measured replay pool | Every case settled; qualifying edits | Hashes, controls/takeovers, dispositions | Pass→Assemble; none→Deliver |
| Assemble | Passing edits | Combine preserving validated semantics; changed logic replays | No combined-rule gate | Validated frozen candidate/history | Candidate hash, rule attribution | Evaluate |
| Deliver | Normal completion | Rank existing comparable results, export/check report | No fresh games | Required analyses/decisions verified | Export/report | Closed |
| Suspended | Stop/resource incident | Shutdown owned work, settle/checkpoint/report | Grace then owned-group termination | Authorized verified continuation with resources | Pending coverage/budgets | Prior stage |

## 4. Identities and invariants

| Item | Initial source/value | Allowed changes | Must remain fixed | Verification |
|---|---|---|---|---|
| Comparison | Frozen schedule/config/implementations | Accepted comparator moves | Starting inputs, opponent order, seeds/sides/content | Hashes, IDs, paired intersections; each opponent represented |
| Source modes | Accepted source | Ordinary adds one fix; valid regression removes/updates one rule from regressing source | Repair preserves unedited rules; comparator accepted | Separate accepted/replay/base identities; baseline no removal |
| Scoring/rules | Games; draws zero wins | Ignore both paired sides | Equal opponent weighting; ≥5 distinct supported losses/reason | Replay converts ≥5 and ≥5% associated losses to wins with changed choice |
| Evidence | Typed lossless `.log` | In-memory reconstruction | Analysts only allowlisted target-loss projections | Packet hashes, exact decision IDs, unique complete coverage |

## 5. Limits and accounting

| Resource/stage | Default limit | Override rule | Accounting | Action at exhaustion |
|---|---|---|---|---|
| Decisions/evaluation | 50 decisions; 2,500 four-game matches/evaluation | Pin owner values | Baseline excluded; allocation quotient/remainder; planned=(1+decisions)×matches×4; recovery=floor(10%) | Analyze final; recovery exhausted→ignore interrupted remainder |
| Time/storage | 86,400,000 ms; 50,000,000,000 bytes | Explicit continuation; original start/budgets persist | Downtime included; logical/import bytes; protected 16,000,000-byte reserve | Suspend |
| Deadlines | Evaluation 18,000,000; preparation 600,000; validation/replay 300,000; shutdown 60,000 ms | Effective pinned values | Launch-to-exit, replay prefix included; remaining wall cap | Incident policy |
| Pools | Counts 2…logical CPUs | Matching recommendations only | Replay two full successful repetitions; smallest within 3% fastest median; diagnostics separate | No qualifying recommendation stops preparation |

## 6. Incidents and continuation

| Incident | Immediate action | Retry allowance | Evidence preserved | Resume condition |
|---|---|---|---|---|
| Individual timeout | Report/ignore; replay denominator retained | Never | Outcome/accounting | Safe jobs continue |
| Interrupted evaluation/calibration | Recover missing games / fresh measurement directory | 10% games / once per failed count | Attempts, reservations, measurements | Resources; second calibration failure excludes count |
| Integrity, initialization, sideboarding, validation | Stop | No generic retry; pre-admission format tooling adaptation only | Failure/prefix evidence | Protected boundaries restored |
| Exhaustion/owner stop/analyst failure | Stop admission; preserve uncovered work | No implicit increases | Verified checkpoint/claims | Explicit applicable authorization; no duplicate owners |

## 7. Delivery and retention

| Artifact | Required contents | Destination | Retain until | Cleanup condition |
|---|---|---|---|---|
| Compact record | Identities/results/rule counts/accounting/errors/export | Existing run state, checked report, English history, Git versions | Permanent after closure | No gameplay IDs/details in closure rule summary |
| Detailed evidence | Logs, reports, variants, receipts, schedules, bundles | Existing execution paths | All execution/validation/replay/reuse/resume needs end; accepted additionally replacement/closure | Designated pruning; owner retention wins; suspension forbids closure cleanup |
| Source/export | Initial/every evaluated candidate commits; accepted hash/export | Git/project artifacts | Retained | Unevaluated variants temporary; no permanent source copies; summary-only closure cannot supply caches |

## 8. Ambiguities and interpretations

| ID | Instruction reference | Ambiguity | Chosen interpretation | Behavioral consequence | Clarification required? |
|---|---|---|---|---|---|
| A1 | Controller and script | Dispatcher versus enforcement | Script validates names/transitions and prints policy/task only | No persisted state, semantic certification, game execution or authorization checks; caller/tools enforce gates | No |

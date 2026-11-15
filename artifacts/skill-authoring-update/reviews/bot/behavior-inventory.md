# Incoming behavior inventory and boundary walkthrough

| Source authority | Required behavior | Boundary expectation |
|---|---|---|
| Goal/Inputs | One supplied target; frozen starting self plus optional opponents; honest unchanged result | Ambiguous target/checkpoint clarified, defaults resolved |
| Constraints | Target AI only; pinned paired identities; game-scored equal opponent weighted paired intersection | Ties/regressions/unassessable retain accepted; known integrity failures stop |
| Controller/tools | Stateless task/transition dispatcher; owning tools persist; semantic gates verified by orchestrator | Legal edge alone never proves gate; stop overrides progression |
| Limits/defaults | 50 decisions, 2500 total matches, 24h, 50GB, protected 16MB; stated stage timeouts | Time/storage exhaustion suspends; recovery does not increase limits; final decision analyzed |
| Calibration | Separate matched optimum recommendations; counts 2..logical CPUs; replay two repetitions and 3% rule | Failed stage retries once; no qualifier stops; fewer than two CPUs has no fallback |
| Source selection | Ordinary adds on accepted; regression removes/updates on regressing source, no additions | Always analyze rejected evaluation before choosing next analysis source |
| Replay | Global >=5 losses; all associated cases; >=5 AND >=5% wins with intended choice changed | Unchanged/nonwinning no conversion; timeout remains denominator; interruption no generic retry |
| Version archive | Starting and every evaluated version committed by owning helper; stable IDs/trailers; unevaluated variants temporary | Review task itself does not execute this workflow or commit |
| Incident policy | Distinct individual timeout, interrupted eval, calibration, validation, resource and owner/analyst stops | No generic retry or unsafe ignored classification; preserve owned shutdown/checkpoint |
| Artifact lifecycle | Positive completed target-loss allowlists; exact typed logs and literal analysis formats | No wins/opponent/full-game browsing; no suspension closure cleanup; delivery alone no pruning |
| Prepare/Evaluate/Decide | Verify setup and separate calibration, finalize matches, persist decision before Analyze | Baseline not a candidate decision; strict promotion checked independently |
| Analyze/Replay/Assemble | Whole 250-match slices, exactly-once coverage; isolated variants then passing combination | No extra combined replay gate; changed isolated semantics re-gate |
| Deliver/Suspended | Check report/export/ranking before eligible cleanup; checkpoint incomplete resources | No fresh ranking games; explicit incomplete closure never called success |
| References | Defaults, findings schema, log encoding, loss report, minimal run summary, YAML invocation | Preserve all literal blocks and fields; code comments counted; script byte identity |

All five iterations audit the complete inventory, not only the edited sentence. No authorized behavior change or retirement in this task. Existing missing runner fragment and preserved canonical command path are execution limitations, not simplifications.

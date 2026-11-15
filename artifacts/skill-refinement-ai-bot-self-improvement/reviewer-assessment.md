# Step 3.4 — reviewer assessment

Read all three independent explanation reports against the intended process recorded in step 1 and the refined package. This assessment does not execute an improvement run.

## Findings and minimal corrections

| Topic | Reviewer interpretations | Action |
| --- | --- | --- |
| Replay choice changes | Reviewers 1 and 2 treat unchanged cases as non-conversions; reviewer 3 would conservatively require every case to change. | Clarify Workflow 4.4: a conversion requires the intended choice change and a win; unchanged/nonwinning cases do not automatically reject a rule. Preserve the five-win AND 5% thresholds and all-case denominator. |
| Replay settlement and failures | Reviewers distinguish ignored timeouts from execution/integrity failures, but identify wording that could conflate them. | Clarify in the same gate that recorded ignored timeouts settle without converting; execution/integrity failures retain the existing failure policy. |
| Ignored games versus incomplete evidence | Reviewers 1 and 3 explicitly interpret finalized ignored games as compatible with assessable paired intersections; all three otherwise recognize the no-pairs rule. | Clarify Evaluate 2.4: unresolved/mismatched evidence is unassessable; finalized ignored games alone do not invalidate valid completed pairs covering every opponent. |
| Ordinary mode after rejection | All three infer accepted-source matching analysis after tie/unassessable rejection; each flags the missing explicit branch. | State this in Workflow 4.2, while preserving required analysis of every evaluated candidate. |

These changes make the existing process explicit. The source skill already requires recording unchanged/failed outcomes, keeps timeouts in the conversion denominator, scores completed paired intersections and assigns ordinary improvement to accepted source and its analysis. No thresholds, default limits, output formats, commands or source ownership changed.

## Correctly understood essentials

All three explanations preserve frozen starting self-play versus moving accepted comparator, exact source archives, baseline versus persisted candidate decisions, strict equal-weight game scoring, separate calibrated match/replay execution, sequential games within matches, durable 250-match slices, loss-only analyst access, complete loss coverage, global eligibility, isolated replays, regression repair from regressing source, combined full evaluation, and suspension versus closure retention.

## Remaining observations

- Exact schemas, validation commands, match calibration repetitions/selection and ranking compatibility remain delegated to existing project contracts. Reviewers correctly avoid inventing them; no extra inline implementation was added.
- The empty calibration range on a one-CPU machine has no authorized fallback in the original. Reviewers stop rather than invent settings; unchanged.
- Calibration accounting stays separate from evaluation while sharing time/storage limits. Reviewers identify the implementation contract as the admission authority; no new budget was invented.
- Analyst failure continuation stays governed by its existing reference; automatic recovery remains specific to interrupted evaluations. All three distinguish these policies.
- Reviewer 3 interprets replay concurrency as resource-constrained. This follows the existing instruction to bound replay jobs by resources; it does not authorize substituting match settings or fabricating a new measured recommendation.
- Overlapping edits, preparation-stage scope and comparing versions with differing coverage remain matters for the linked implementation and recorded judgment. Reviewers preserve validation and full evaluation; no additional gate was introduced.
- All three identify no-validated-candidate delivery as a permitted early terminal outcome and resource exhaustion as incomplete suspension.

The first review exposed a real disagreement, so comprehension is not yet verified after correction. A fresh review round belongs to step 3.5 and has not been launched. No commit was made.

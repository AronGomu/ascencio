# Explanation from reviewer C for prospective refinement execution

## 1. Outcome and scope

Given a skill folder, I would produce a complete, readable sibling candidate preserving its intent, essential behavior, dependencies and output contracts. Optional priorities, destination, iteration count and review context govern execution. Success means completing the requested refinement iterations, resolving comprehension misunderstandings, performing applicable verification and delivering the candidate plus external evidence. The source remains read-only; promotion requires a later separate explicit instruction.

## 2. Process overview

I would establish the source baseline and explain its behavior before editing. Each iteration simplifies the candidate, audits preservation, verifies affected contracts and gathers three independent explanations. I compare these by behavior, repair misunderstandings minimally and repeat verification with fresh reviewers until the gate passes. Then I record the iteration and begin another simplification cycle, eventually reporting all results without installing or committing.

## 3. Execution matrix

| Step | Entry condition | Action and owner | Concurrency | Decision/completion criterion | Saved output | Next step |
|---|---|---|---|---|---|---|
| 1.1 | Input identified | Orchestrator reads full package, guidance and template | No dependency overlap | Required context understood | Source identity record | 1.2 |
| 1.2 | Context read | Inventory essentials, outcomes, boundaries and structure with source references | Independent inventory checks possible | Behavioral baseline established | Baseline inventory | 1.3 |
| 1.3 | Baseline established | Explain incoming skill through all template sections | Sequential | Complete explanation | External explanation | 2 |
| 2 | Baseline or preceding iteration available | Simplify candidate; audit deletions, references and boundary decisions | Preserve dependencies | Readability and essentials survive | Complete candidate, accounting | 3.1 |
| 3.1 | Candidate changed | Run relevant existing executable checks; verify affected references and literal contracts; fix failures | Independent checks possible | Applicable verification passes | Check evidence | 3.2 |
| 3.2–3.3 | Verification ready | Spawn three fresh reviewers with candidate and template only | Reviewers independent; parallel permitted | Three execution explanations returned | External reviews | 3.4 |
| 3.4 | Reviews available | Orchestrator compares source steps and normalized matrix items; minimally fixes behavioral misunderstandings | Comparison follows reviews | No misunderstanding remains | Findings and corrections | 3.1 if corrected; otherwise 4 |
| 4 | Iteration gate passed | Record counts and report findings, checks and links | Sequential | Requested iterations completed | Updated concise report | 2 or delivery |

## 4. Identities and invariants

| Item | Initial source/value | Allowed changes | Must remain fixed | Verification |
|---|---|---|---|---|
| Source | Requested package | None during refinement | Ownership and contents | Compare against baseline |
| Candidate | Unique sibling destination | Authorized simplification | Complete package; existing candidates preserved | Inventory and path checks |
| Behavior | Source inventory | Explicit owner-authorized changes only | Decisions, gates, thresholds, failure distinctions, deterministic outputs | Deletion mapping and boundary walkthroughs |
| Review knowledge | Candidate and template | Candidate changes between rounds | Original, prior explanations and findings withheld | Inspect reviewer inputs |
| Models | GPT-6.1 Sol, low | Explicit user settings | Honest actual-setting disclosure | Supported controls inspected |

## 5. Limits and accounting

| Resource/stage | Default limit | Override rule | Accounting | Action at exhaustion |
|---|---|---|---|---|
| Iterations | Five | Requested count; session instructions govern | Record every iteration | Deliver after final successful iteration |
| Reduction | Aspirational 25% | Preservation/readability take priority | Consistent baseline and candidate instruction characters | Keep searching for useful simplification; do not force reductions |
| Count scope | All agent-facing instructions/resources/configuration | Executable-only inputs and review artifacts excluded | Count relocated/generated instruction copies and code prose; physical size separately | Explain measured scope |
| Review repairs | No numeric cap specified | Owner stopping instructions apply | Preserve findings and checks | Continue until understood; disclose unfinished fresh review if stopped |

## 6. Incidents and continuation

| Incident | Immediate action | Retry allowance | Evidence preserved | Resume condition |
|---|---|---|---|---|
| Blocking intent conflict | Clarify | No invented quota | Conflicting requirements | Owner resolves essentials |
| Failed verification | Repair candidate | As needed | Failure and fix evidence | Checks pass |
| Reviewer disagreement | Separate presentation from behavior; repair actual misunderstanding | Fresh review loop | Explanations and comparison | Agreement on intended behavior |
| Delegation/settings unavailable | Report review pending and actual controls | No silent substitution | Limitation | Required review becomes possible |
| Owner stops after corrections | Disclose unreviewed corrections | Governed by owner | Latest candidate and pending gate | Authorized continuation |

## 7. Delivery and retention

| Artifact | Required contents | Destination | Retain until | Cleanup condition |
|---|---|---|---|---|
| Candidate | Complete refined package | Unique sibling `<skill-name>-REFINED/` variant | Review and delivery | No automatic removal specified |
| Explanations/reviews | Incoming explanation, fresh reports, comparisons | Outside candidate | Verification and delivery | Preserve evidence; no default cleanup |
| Concise report | Counts, scope, essentials, authorized changes, checks, findings, limitations and links | Outside candidate | Delivery | No automatic deletion specified |

## 8. Ambiguities and interpretations

| ID | Instruction reference | Ambiguity | Chosen interpretation | Behavioral consequence | Clarification required? |
|---|---|---|---|---|---|
| A1 | Step 4 | Comparison baseline per iteration unspecified | Record original and preceding candidate counts consistently | Both cumulative and iteration changes remain assessable | No |
| A2 | Automatic-review links | Mutual authoring/refinement references could imply recursion | Read dependencies; candidate edits belong to existing review | No recursive authoring review | No |
| A3 | Step 3.5 | “No misunderstanding” is qualitative | Require normalized behavioral agreement plus independent preservation audits | Agreement alone does not prove executable equivalence | No |

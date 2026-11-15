# Explanation from reviewer C for candidate comprehension

## 1. Outcome and scope

The result is a complete, readable sibling refinement package preserving the source skill’s intended behavior and specified outputs. The required input is the skill folder; optional inputs identify priorities, retained requirements, iteration count, destination and review context. Success requires completing the requested iterations, resolving comprehension disagreements, validating relevant changes and delivering evidence without modifying or promoting the source. This document describes execution only.

## 2. Process overview

The orchestrator first understands the entire package and inherited authoring guidance. It records a behavioral baseline and explains the incoming skill, then simplifies a separate candidate. Each simplification enters a verification and fresh-review loop; misunderstandings cause minimal corrections and another complete review round. A completed review loop finishes one outer iteration. Repeat simplification for the requested count, retaining evidence, then report delivery. Circular authoring/refinement links are reading dependencies, not recursive invocations.

## 3. Execution matrix

| Step | Entry condition | Action and owner | Concurrency | Decision/completion criterion | Saved output | Next step |
|---|---|---|---|---|---|---|
| 1.1 | Source identified | Orchestrator reads package, template and guidance | Independent reads possible | Required context understood | Source identities | 1.2 |
| 1.2 | Context available | Record outcome, decisions, essentials, failures and structure with references | None required | Essentials distinguished from presentation | Baseline inventory | 1.3 |
| 1.3 | Inventory established | Explain incoming process using template | Sequential | All template sections addressed | Incoming explanation | 2 |
| 2 | Baseline or prior iteration ready | Simplify candidate; audit deletions, references and boundary behavior | Independent audits possible | Readable preservation; reduction assessed | Candidate and counts | 3.1 |
| 3.1 | Candidate changed | Run relevant existing executable checks; fix failures | Independent checks possible | Applicable checks pass | Check evidence | 3.2 |
| 3.2–3.3 | Verification ready | Spawn three fresh Sol 6.1 low reviewers; supply only candidate and template | Three independent reviews | Three explanations returned | Reviewer documents | 3.4 |
| 3.4 | Reports available | Compare source steps and normalized matrix items; minimally fix behavioral disagreement | Orchestrator comparison | No misunderstanding remains | Comparison report | 3.1 if fixed; otherwise 4 |
| 4 | Review loop complete | Record iteration and repeat simplification or deliver | Sequential | Requested iteration count completed | Concise report and links | 2 or finish |

## 4. Identities and invariants

| Item | Initial source/value | Allowed changes | Must remain fixed | Verification |
|---|---|---|---|---|
| Source | Input folder | None during refinement | Entire authored package | Compare source identity/content |
| Candidate | Separate sibling | Wording, structure, unnecessary resources | Essentials, dependencies, literal outputs | Baseline mapping and checks |
| Reviewers | Fresh independent agents | Explicit user settings | Isolation from original and prior findings | Dispatch inputs |
| Defaults | `gpt-6.1-sol`, low | Explicit settings/task overrides | Honest actual-setting disclosure | Supported controls |
| Behavior | Recorded baseline | Owner-authorized changes only | Output contracts and authorization gates | Deletion audit and scenarios |

## 5. Limits and accounting

| Resource/stage | Default limit | Override rule | Accounting | Action at exhaustion |
|---|---|---|---|---|
| Outer iterations | Five | Requested count | Per-iteration results | Deliver after completion |
| Inner review loop | No numeric cap | Session instructions govern stops | Every review/correction round | Continue until understood; disclose stopped state |
| Reduction | Aspirational 25% | Preservation/readability prevail | All agent-facing instructions, references, configuration and copies | Continue useful simplification without forcing target |
| Exclusions | Executable-only material, inputs, review artifacts | Count instructional prose inside code | Physical package size separately | Report counted scope honestly |

## 6. Incidents and continuation

| Incident | Immediate action | Retry allowance | Evidence preserved | Resume condition |
|---|---|---|---|---|
| Check failure | Fix relevant defect | No invented quota | Failure and subsequent checks | Check passes |
| Behavioral disagreement | Locate decision boundary; correct minimally | Fresh rounds until resolved | Explanations and comparison | Review agreement |
| Existing destination | Choose unique sibling | As necessary | Existing candidate untouched | Safe destination selected |
| Blocking ambiguity | Ask narrowly | No arbitrary fallback | Conflicting requirements | Intent established |
| Delegation/settings unavailable | Report review pending and actual capability | When available | Completed work and limitations | Required controls available |
| Owner stop after correction | Disclose missing fresh review | Follow session instruction | Latest candidate and evidence | Authorized continuation |

## 7. Delivery and retention

| Artifact | Required contents | Destination | Retain until | Cleanup condition |
|---|---|---|---|---|
| Candidate | Complete usable skill package | Unique sibling `<skill-name>-REFINED/` | Delivery and later owner decisions | No automatic replacement/deletion authorized |
| Explanations/reviews | Incoming explanation and independent template reports | Outside candidate | Verification/resume needs satisfied | No routine cleanup specified |
| Concise report | Counts, comparisons, essentials, changes, checks, limitations and links | Outside candidate; summarized to user | Owner retention requirements | No automatic cleanup specified |

## 8. Ambiguities and interpretations

| ID | Instruction reference | Ambiguity | Chosen interpretation | Behavioral consequence | Clarification required? |
|---|---|---|---|---|---|
| A1 | Inputs; workflow 2 | Optional destination versus sibling output | Apply safe sibling constraint; preserve collisions | Never overwrite existing candidate | Only if requested destination conflicts |
| A2 | Workflow 3.5; guidelines 12 | Unbounded comprehension loop versus requested iterations | Inner corrections finish before counting outer iteration | Five iterations means five completed refinement cycles | No |
| A3 | Authoring automatic review | Mutual dependency could imply recursive reviews | Use candidate for circular refinement dependency; follow explicit review exemption | No nested authoring review for candidate edits | No |

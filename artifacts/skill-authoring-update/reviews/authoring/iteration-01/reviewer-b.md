# Explanation from reviewer B for authoring candidate comprehension

## 1. Outcome and scope

Create or revise an agent skill that communicates its observable goal, inputs, decisions, constraints, outputs and executable workflow. Start from the user's requested task and any existing skill package; infer routine details, requesting only indispensable missing information. Success includes a usable authored package, preserved useful existing obligations, explicit model defaults, and a separately delivered automatic refinement candidate with evidence. This explanation describes execution without performing authoring or review.

## 2. Process overview

Read the candidate's guidelines and supporting writing guidance, establish behavioral requirements, then adapt the annotated template to the actual task. Verify the authored result and complete one automatic refinement review per changed skill. That delegated review inventories the incoming package, explains it, simplifies a separate complete candidate, validates it, obtains fresh comprehension reviews, repairs misunderstandings and repeats for five iterations. Deliver both authored result and review evidence; promotion is a separate later decision.

## 3. Execution matrix

| Step | Entry condition | Action and owner | Concurrency | Decision/completion criterion | Saved output | Next step |
|---|---|---|---|---|---|---|
| A1 | Creation/update requested | Author reads ordered guidelines, writing guidance and skill mechanics | No required parallelism | Resolve priorities; identify scope and required behaviors before editing | Requirement inventory | A2 |
| A2 | Intent established | Author adapts template; writes concrete actions, gates and necessary resources | Independent work only | Remove placeholders/comments and irrelevant sections; preserve useful existing instructions | Authored package | A3 |
| A3 | Draft complete | Author checks goal, constraints, affected references/output contracts and relevant executable checks | Independent checks may coexist | Correct failures; related artifacts match final content | Validated source | R1 |
| R1 | Authoring task completed | Author spawns refinement child with source, separate destination, settings and review context | Child owns review | Supported delegation/settings available | Review invocation | R2 |
| R2 | Review starts | Child reads full package, inventories essentials and explains incoming behavior | Sequential before edits | Original references and baseline identified | Explanation/inventory outside package | R3 |
| R3 | Baseline ready | Child simplifies candidate and counts instructional scope | No source edits | Clear behavior-preserving candidate; checks pass | Candidate and measurements | R4 |
| R4 | Candidate verified | Three fresh reviewers explain candidate independently; child compares normalized items and fixes misunderstandings | Three isolated reviewers | No behavioral misunderstanding; repeat checks/review after correction | Reviews and findings | R5 |
| R5 | Iteration reviewed | Child records iteration, repeats simplification through requested count; author reports results | Iterations sequential | Five iterations completed or honest pending/limitation report | Concise report, links, counts | Delivery |

## 4. Identities and invariants

| Item | Initial source/value | Allowed changes | Must remain fixed | Verification |
|---|---|---|---|---|
| User scope | Request/existing skill | Explicit owner authorization | Unrelated work | Scope comparison |
| Behavioral baseline | Incoming package | Authorized changes recorded separately | Dependencies, gates, ownership, thresholds, permissions, failure distinctions, output contracts | Inventory, deletion audit, boundary walkthrough |
| Review source | Completed authored package | Later separate promotion instruction | Read-only during review | Source/candidate separation |
| Candidate | Complete unique sibling package | Review corrections | Existing candidates preserved | Destination and reference checks |
| Rule authority | Ordered guideline rows | User/higher instructions prevail | Earlier row wins ties; writing advice subordinate | Conflict analysis |
| Model | gpt-6.1-sol, low | User or documented task override | Honest actual-setting report | Supported delegation controls |

## 5. Limits and accounting

| Resource/stage | Default limit | Override rule | Accounting | Action at exhaustion |
|---|---|---|---|---|
| Review iterations | Five | Explicit session iteration instructions govern | Per-iteration character counts/findings/checks | Deliver completed review evidence |
| Comprehension review | Three fresh reviewers per round | Required configuration must be available | Isolated candidate-only explanations | Pending if delegation unavailable |
| Simplification | Aspirational 25% reduction | Readability and preservation dominate | All agent-facing references/configuration/generated copies; exclude executable-only material and review artifacts | Continue useful simplification without sacrificing behavior |
| Size reporting | Instructional and physical size separate | No relocation discounts | Freeze unchanged baseline; distinguish added rules | Report actual scope/limitations |

## 6. Incidents and continuation

| Incident | Immediate action | Retry allowance | Evidence preserved | Resume condition |
|---|---|---|---|---|
| Blocking intent conflict | Clarify | No invented quota | Conflicting authorities | Owner resolves essential decision |
| Check failure | Repair candidate and recheck | No fixed cap stated | Checks/findings | Relevant checks pass |
| Reviewer disagreement | Compare behavior rather than wording; smallest local correction | Loop until understood | All explanations outside candidate | Fresh review confirms correction |
| Missing model/delegation controls | Report unavailable settings and pending review | No silent substitution | Actual settings/status | Required execution becomes available |
| Owner stops after corrections | Report latest edits lack fresh review | Session instruction controls | Candidate and completed evidence | Authorized continuation |

## 7. Delivery and retention

| Artifact | Required contents | Destination | Retain until | Cleanup condition |
|---|---|---|---|---|
| Authored skill | Applicable template, explicit defaults, necessary resources | Requested source location | User-directed lifecycle | Review cannot overwrite it |
| Refined candidate | Complete package | Unique sibling `<skill-name>-REFINED/` | Available for separate promotion decision | No automatic installation/commit/promotion |
| Evidence/report | Explanations, findings, counts, checks, limitations and links | Outside candidate | Delivery and future verification/resume needs | No concrete deletion schedule specified |

## 8. Ambiguities and interpretations

| ID | Instruction reference | Ambiguity | Chosen interpretation | Behavioral consequence | Clarification required? |
|---|---|---|---|---|---|
| A1 | Automatic review; refine §3–4 | Five iterations versus review-until-understood loop | Five outer simplification iterations; each may require multiple review rounds | Count rounds separately from iterations | No |
| A2 | Template; guidelines 16/28 | Optional sections versus lifecycle-table advice | Omit inapplicable sections; include lifecycle detail when relevant | No artificial headings or invented retention deadlines | No |
| A3 | Refinement dependencies | Linked authoring skill loops back | Candidate supplies authoring authority for this comprehension task | Read dependency without recursive invocation or original comparison | No |

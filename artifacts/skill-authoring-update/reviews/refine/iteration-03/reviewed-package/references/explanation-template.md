# Explanation Document Template Structure

DO NOT REPEAT INFORMATION.

```md
# Explanation from {{agent}} for {{purpose}}

## 1. Outcome and scope

{{Write one short paragraph explaining the intended result, required inputs, scope boundaries and what constitutes successful completion.}}

## 2. Process overview

Write one short paragraph explaining the main sequence, loops and branches, and how the stages connect.

## 3. Execution matrix

| Step | Entry condition | Action and owner | Concurrency | Decision/completion criterion | Saved output | Next step |
|---|---|---|---|---|---|---|
| 1.1 | … | … | … | … | … | … |

## 4. Identities and invariants

| Item | Initial source/value | Allowed changes | Must remain fixed | Verification |
|---|---|---|---|---|
| … | … | … | … | … |

## 5. Limits and accounting

| Resource/stage | Default limit | Override rule | Accounting | Action at exhaustion |
|---|---|---|---|---|
| … | … | … | … | … |

## 6. Incidents and continuation

| Incident | Immediate action | Retry allowance | Evidence preserved | Resume condition |
|---|---|---|---|---|
| … | … | … | … | … |

## 7. Delivery and retention

| Artifact | Required contents | Destination | Retain until | Cleanup condition |
|---|---|---|---|---|
| … | … | … | … | … |

## 8. Ambiguities and interpretations

| ID | Instruction reference | Ambiguity | Chosen interpretation | Behavioral consequence | Clarification required? |
|---|---|---|---|---|---|
| A1 | … | … | … | … | … |

{{When no ambiguity is identified, state that explicitly instead of inventing a row.}}

{{Add paragraph keyed to ambiguity ID only when reasoning cannot be explained clearly in the matrix.}}
```

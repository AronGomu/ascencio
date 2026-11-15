---
name: how-to-make-skills
description: Write or revise agent skills using an annotated template for goals, inputs, constraints, outputs, and workflows.
---

# How to make skills

Use the template below when creating or revising a skill. Replace placeholders, remove authoring comments, and omit sections the task does not need. For revisions, preserve useful existing instructions and the user's requested scope.

```markdown
---
name: verb-object
description: Describe what the skill does and when it should be used.
---

<!-- Rules:
- Use a short, action-oriented name with lowercase letters and hyphens.
- Make the description precise enough to distinguish this skill from nearby tasks.
- Include exclusions only when they prevent likely confusion.
-->

# {{Skill title}}

## Goal

<!-- Rules:
- State the observable outcome.
- Describe what the user receives or what becomes true.
- Keep implementation steps in Workflow.
-->

{{Intended outcome.}}

## Inputs

<!-- Rules:
- Separate required inputs from optional inputs.
- State accepted formats when they matter.
- Give defaults for optional inputs when useful.
- Ask only for missing information that cannot be inferred safely.
-->

1. Required — {{Input and accepted format.}}
2. Optional — {{Input and default behavior.}}

## Entities

<!-- Rules:
- Define recurring domain terms, identifiers, and paths once.
- Use the same names throughout the workflow.
- Include only definitions that remove ambiguity.
-->

- `{{entity}}`: {{Meaning or derivation.}}
- `work_dir`: {{Location for intermediate artifacts.}}
- `output_dir`: {{Location for final deliverables.}}

## Constraints

<!-- Rules:
- State requirements that apply across the workflow.
- Distinguish hard requirements from preferences.
- Include task-specific limits and invariants.
- Keep each requirement in one authoritative place.
-->

- {{Required property or invariant.}}

## Autonomy

<!-- Rules:
- Explain which decisions the agent should make independently.
- Name concrete conditions requiring clarification or stopping.
- Preserve the scope and authorization of the user's request.
- Include retry limits only when repeated attempts have meaningful cost or risk.
-->

{{Proceed independently once ...}}
{{Ask or stop when ...}}

## Output

<!-- Rules:
- Name final deliverables and their destinations.
- Separate intermediate artifacts from final outputs.
- Explain naming rules when identifiers must be stable or unique.
- Use a directory tree only when it clarifies the result.
-->

~~~text
{{output_dir}}/
├── {{primary-deliverable}}
└── {{supporting-artifact}}
~~~

## Workflow

<!-- Rules:
- Order steps by dependency.
- Start each instruction with a concrete action.
- Specify decision criteria where judgment matters.
- Prescribe exact commands or parameters only when correctness requires them.
- Link substantial conditional procedures at the step that needs them.
- Keep validation close to the operation it checks.
-->

### 0 — Preflight

{{Validate required inputs and necessary prerequisites.}}
{{Resolve missing information before dependent work begins.}}

### 1 — {{First meaningful stage}}

{{Perform the action.}}
{{Choose among alternatives using these criteria.}}
{{Save the result needed by the next stage.}}

### 2 — {{Next meaningful stage}}

{{Transform or refine the previous result.}}
{{Preserve required source references or metadata.}}
{{Check the properties that this operation could break.}}

<!-- Add or remove stages to fit the actual task.

Supporting resources:
- references/: detailed instructions; say when each file must be read.
- scripts/: repeatable mechanical operations; document the relevant invocation.
- assets/: templates or other material used in the output.

Create only resources the workflow actually needs.
-->

### {{N}} — Verify and deliver

{{Check the final result against the goal and constraints.}}
{{Update related artifacts to match the final result.}}
{{Report deliverable locations and any unresolved limitations.}}
```

---
name: how-to-make-skills
description: Write or revise agent skills using an annotated template for goals, inputs, constraints, outputs, and workflows.
---

# How to make skills

Create or revise skills with the template below. Replace placeholders, remove authoring comments, and omit unnecessary sections. For revisions, preserve useful existing instructions and the user's requested scope.

## Authoring requirements

Read and follow all [skill rules guidelines](references/skill-rules-guidelines.md) before writing. The ordered strictness table governs conflicts between authoring rules; earlier rows win. Read the [writing guidance](../writing-for-agents/SKILL.md) as supporting advice subject to those priorities.

## Model defaults

Default model: `gpt-6.1-sol` (GPT-6.1 Sol). Default thinking level: `low`. Include an explicit Model defaults section in every skill created or updated. Honor explicit user settings and documented task-specific overrides. Apply delegated settings through supported controls; report unavailable settings or the unchanged model of an already-running session honestly.

## Automatic refinement review

After completing each skill creation or update, spawn a subagent to apply all of [refine-skill](../refine-skill/SKILL.md) to that skill for five iterations. Pass `review_context: automatic-authoring-review`, the source path, model/thinking settings and a separate candidate destination. The child may delegate the fresh comprehension reviewers required by refine-skill.

Keep the authored skill read-only throughout this review. NEVER replace, install, promote or commit over the authored skill as part of this process. Save the candidate separately; report its link, per-iteration character counts, findings, checks and remaining limitations to the user. Promotion requires a later separate explicit user instruction.

Run once per completed authoring task for each changed skill, including this skill and refine-skill. Candidate changes and supporting artifacts made within a refinement review are part of that same review and must not launch another review. Mutual links are dependencies to read, not recursive invocation. If required delegation/settings are unavailable, report the review as pending rather than claiming completion.

## Template

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

## Model defaults

Default model: `gpt-6.1-sol` (GPT-6.1 Sol). Default thinking level: `low`.
Honor explicit user settings; document any task-specific override.

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

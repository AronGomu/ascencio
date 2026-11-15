---
name: refine-skill
description: Simplify verbose skills while preserving intent, essential constraints and how-to-make-skills structure.
---

# Refine Skill

## Goal

Produce the shortest clear, readable skill that preserves intent and outcome; leave implementation to judgment.

## Model defaults

Default model: `gpt-6.1-sol` (GPT-6.1 Sol). Default thinking level: `low`. Honor explicit user settings and report unavailable controls honestly.

## Inputs

- Required: skill folder path.
- Optional: priorities or retained requirements; iterations (default: 5); candidate destination (a sibling folder); `review_context` (use `automatic-authoring-review` for authoring-triggered reviews).

## Constraints

Read and follow all of [how-to-make-skills](../how-to-make-skills/SKILL.md), including its ordered [guidelines](../how-to-make-skills/references/skill-rules-guidelines.md), model defaults and automatic-review boundaries. Preserve dependencies when merging steps. This refinement is already a review context: its candidate edits do not trigger recursive authoring reviews.

Keep the source skill read-only. NEVER replace, install, promote or commit over it during refinement. Preserve existing candidates; use a unique sibling destination when needed. 

All deterministic script and skill specified output must stay identical.

## Autonomy

Honor user priorities; decide independently.

Clarify only ambiguity or conflict blocking identification of intent or essentials.

## Output

Save the complete sibling `<skill-name>-REFINED/` package. 

Keep reviews and one concise report outside it.

Use `references/explanation-template.md` to generate **explanation document**.

## Workflow

You are orchestrator.

### 1 — Establish intent

1. Read the full package, supporting instructions and template. 

2. Record outcome, essentials and applicable structure with original references; distinguish essentials from incidental process.

3. Generate the current skill's explanation using the explanation template.

### 2 — Aggressively Simplify

Generate or update refined skill.

Prune repetition, inferable detail and unnecessary resources. 

Target 25% fewer characters while preserving intent and readability ; this is aspirational.

Count all agent-facing instructions and resources consistently, including added or relocated content. 

Exclude executable-only inputs and refinement artifacts; relocation is not reduction.

### 3 — Review and fix

1. Run relevant existing checks for executable changes. If issues, fix them and continue.

2. Spawn 3 fresh `sol 6.1 low` reviewer.

3. For each :
  Supply only the refined skill package and explanation template. Ask each reviewer to return an explanation of how it would execute the process using that template; withhold the original skill, prior explanations and orchestrator findings.

4. Compare all 3 explanation reports by source step and matrix item; distinguish presentation differences from behavioral disagreements. Apply the minimal changes to the refined skill needed to fix misunderstandings.

5. Loop back to step 3.1 until no misunderstanding left.
 
### 4 — Repeat and deliver

Record update skill characters comparison report with new iteration.

Repeat from step 2 until the requested iteration count is complete. Report each iteration’s counts, review findings, checks and candidate links to the user. Do not automatically commit or promote. A later separate explicit user instruction is required to replace the source.

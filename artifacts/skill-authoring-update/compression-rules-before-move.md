# Rules for compressing skill instructions

Owner-approved guidance from the AI bot improvement skill refinement, recorded 2026-11-15. Use this reference for future refinement work; it does not modify an installed skill or authorize changing a particular skill's behavior.

## Objective and boundaries

Produce concise, easily human-readable instructions that preserve the intended outcome and essential behavior. A reader should understand an action without chasing chains of references or decoding shorthand. Prefer removing duplicated information and unnecessary process over shortening individual words.

- Keep the original package unchanged; work in its complete sibling `<skill-name>-REFINED/` unless the owner requests another destination.
- Preserve dependencies, completion gates, source ownership, thresholds, authorization, failure distinctions and required output contracts. Change those only with explicit owner authorization.
- Preserve deterministic script outputs and specified output formats. Explanatory prose around an output example is editable; it is not automatically protected merely because it shares the file. Replacing an example itself requires authorization when output preservation could cover it.
- Follow the applicable skill structure, omitting unnecessary sections rather than filling them mechanically.
- Count all agent-facing instructions and resources consistently, including added or relocated content. Moving instructions to another file or external document is not reduction.
- Exclude executable-only source, inputs and refinement artifacts from the instruction metric. Count instructional prose embedded in code; do not hide policy in scripts to improve the number. Report full package size separately when useful.
- Treat a 25% reduction as aspirational. Readability and behavioral preservation take precedence; reaching the target is not a reason to stop finding real duplication.

## Approved approaches

### 1. Put mechanical work in an executable controller

Prefer an executable controller for stages, budgets, retries, source bindings, scoring and retention where those responsibilities can be implemented and verified. Keep the skill focused on decisions and actions the agent must perform.

Before removing an instruction, identify the enforcing implementation and verify the relevant behavior. A script name, a comment or a claimed guarantee is insufficient. Moving prose into code without enforcement does not solve the problem.

Preserve semantic checks that tools do not prove. Distinguish actual enforcement from task routing, advice and caller-supplied assertions. A stateless dispatcher does not certify evidence, persist run state or grant authorization.

### 2. Give the agent one stage-specific task at a time

Let the controller emit only the current stage's actions and required policy. Define entry conditions, permitted actions, completion evidence and the next stage.

This reduces loaded context. It reduces total characters only when shared instructions are genuinely deduplicated. Keep required shared policy reachable and explicit.

### 3. Use a readable state machine

Represent progression with a plain-language table: current stage, completed outcome and next stage. Include stop, suspension, resume and terminal paths. Match executable transitions to this table when a controller exists.

Transition success is not evidence that the stage's completion gate passed. Name who verifies the gate and where its evidence is recorded.

### 4. Target current supported behavior; retire legacy accommodation

Do not complicate a current workflow to fit older runners, schemas, ledgers or formats unless backward compatibility is an explicit requirement. For the refined bot-improvement workflow, the owner authorized retiring legacy support entirely.

When compatibility must remain, isolate it behind a clearly triggered branch. Merely moving compatibility prose improves reading load, not total character count; count the whole retained branch.

Do not delete unrelated legacy implementations merely because the new skill no longer supports them.

### 5. Use one source-selection matrix

When modes use different versions or inputs, define their proposal operation, analysis source, unchanged control, assembly base and comparison source in one table. Keep exceptional starting/baseline cases beside it.

Remove redundant prose when the table remains easy to understand; retain short explanations for complex cells. Preserve distinctions between sources even when their current values happen to match.

### 6. Use one incident-policy table

Define each incident's immediate action, retry allowance, accounting, evidence retention and continuation condition once. Workflow steps invoke that policy.

Specify precedence where incidents overlap. Keep ordinary timeouts, interrupted execution, calibration failures, integrity failures, resource exhaustion and owner cancellation distinct when their behavior differs.

### 7. Use one artifact-lifecycle table

For each artifact class, state required contents/location, active purpose, retention condition and cleanup condition. Consolidate overlapping retention paragraphs, keeping brief local reminders where they help readers act correctly.

Keep dependencies explicit: delivery, validation completion, replacement and closure are different events. Preserve evidence required for resume or verification and honor owner retention requests.

### 8. Make shared rules inherit explicitly

State which rules apply to every stage, including resource admission checks, source boundaries, accounting and suspension. Describe stage-specific exceptions only where necessary.

Omission from a shorter stage must not imply exemption from inherited policy.

### 9. Keep workflow steps about actions

Separate ordered actions and completion gates from reusable policy. A step should name the operation, its owner and its completion evidence. Include enough local context to execute it without repeatedly consulting policy sections.

Use precise read conditions for substantial references. Do not replace essential instructions with vague pointers or scatter one policy across multiple files.

### 10. Shorten supporting prose without changing literal output contracts

Review references, templates and examples as aggressively as the main skill. Remove repeated introductions, warnings, retention explanations and historical exposition.

Preserve required literal blocks, field names, schemas and syntax. Protect the actual output contract, not an entire file unnecessarily.

### 11. Prefer a minimal report contract/example

Replace long fictional reports with a small example that demonstrates required layout and fields when authorized. Remove invented measurements, duplicated policy and obsolete operational advice.

Keep required report contents authoritative in one place. An example should illustrate those requirements rather than create competing defaults or procedures.

### 12. Remove mechanics already guaranteed by tools

Audit existing tools before describing their internals in agent instructions. Require the verified entry point and its contract instead of repeating reservation, locking, publication or receipt algorithms.

Keep the policy values, obligations and exceptions the tool does not enforce. Document the limits of the guarantee; do not infer enforcement from the presence of a CLI.

### 14. Reuse Markdown reference links

Define repeated long destinations once and reuse short, descriptive labels. Avoid indirection when a destination occurs only once and the reference adds overhead.

### 15. Remove unnecessary definitions and use one vocabulary

Define only terms that remove real ambiguity. Map human-facing terms to existing implementation names once, then use them consistently without renaming public interfaces.

Use shorter names only when their definition and interpretation cost less than the repetition they remove. Prefer familiar words over invented abbreviations.

### 16. Prefer positive boundaries

State the allowed scope directly, such as “read only allowlisted completed target-loss views.” Retain explicit exclusions for important failure modes that the positive scope alone has not reliably prevented.

Do not remove security, visibility or ownership boundaries merely to avoid negative wording.

### 17. Resolve recurring ambiguities once

Turn repeated caveats into one authoritative decision. Separate missing external implementation detail from genuinely unspecified policy.

Resolve routine choices from authoritative records. Ask only when a behavioral decision cannot safely be inferred; do not silently invent a new quota, fallback, retry or permission. Explicit owner decisions supersede the old ambiguity.

### 18. Compress meaning through shared structure

Use tables only for information that is easy to compare in rows. Prefer prose for explanations and exceptions; split crowded tables. Consolidate repeated policy while keeping actions understandable where they appear.

Distinguish physical package size, total instructional size and context loaded for one stage. A technique may improve one without improving the others; report what actually changed.

## Additional approved rules

### 19. Inventory behaviors before sentences

Record required decisions, invariants, outputs and failure responses before editing. Preserve this inventory rather than the original wording, headings or step count. Mark owner-authorized behavior changes explicitly.

### 20. Justify every exception

Name the concrete case and why the general rule fails. Remove exceptions that merely restate the rule; retire obsolete behavior only with authorization. Keep refinement rationale outside operational instructions unless future decisions need it.

### 21. Separate policy from configuration values

Keep how a limit works in policy and its effective value in one authoritative configuration. Repeat a value only when setup requires the agent to choose it. Count configuration read by agents in the instruction metric.

### 22. Combine equivalent branches

When conditions have the same action, accounting and continuation, state that consequence once. Keep branches separate only where behavior differs.

### 23. Use the smallest valid scope

Put universal requirements in shared policy and mode-specific requirements beside their mode. Avoid repeating local restrictions or accidentally applying them globally.

### 24. Remove order without dependency

Use a checklist or completion gate for independent requirements. Numbered steps express execution dependencies, not merely presentation order. Preserve actual sequencing.

### 25. Audit deletions separately

Fresh reviewers can understand surviving text while missing a deleted obligation. Independently map every removed requirement to its retained authority, verified enforcement or explicit retirement authorization.

### 26. Check boundary scenarios

Compare pre/post actions for ties, missing evidence, exhausted resources, failed calibration and interrupted replay, plus task-specific boundaries. Happy-path agreement alone is insufficient; distinguish a policy walkthrough from an executable test.

### 27. Repair the exact ambiguity

Use reviewer disagreement to find the decision boundary at fault. Make a local correction rather than adding a broad paragraph that repeats surrounding rules.

### 28. Verify every reference promise

Before replacing prose with a pointer, confirm its target is accessible and actually states the promised guarantee. Give a clear read condition; a smaller document with a missing requirement is not valid compression.

### 29. Keep refinement history outside the skill

Store abandoned approaches, review discussions and wording-change rationale in refinement artifacts. Keep operational rationale only when it helps a future execution decision.

### 30. Measure usability cost

Track added lookups, clarification and mistakes as well as characters. A shorter skill that needs repeated explanation may have displaced complexity. Do not claim measured usability improvements from reviewer agreement alone.

### 31. Make new rules earn their cost

Add a rule to prevent a demonstrated mistake, resolve a real ambiguity or preserve a non-obvious requirement. Avoid accumulating speculative guardrails.

### 32. Change strategy when sentence edits stall

When local rewriting yields only small gains, inspect responsibilities, policy structure and contracts. Further reduction may need an authorized design change; do not replace readable prose with denser notation.

## Further approved updates

Apply these refinements to the numbered rules above rather than duplicating their requirements.

- **Rules 1/12 — Design tools to eliminate instructions.** Simplify complicated agent procedures through verified tool interfaces; remove prose only after implementation and enforcement are demonstrated.
- **Rule 10 — Separate producing from understanding output.** Give submitters their input obligations; let verified renderers own escaping and layout. Preserve literal output contracts and any interpretation duties.
- **Rule 27 — Replace ambiguity before appending caveats.** Rewrite the misleading sentence or category first; add explanation only when replacement cannot express the distinction.
- **Rules 18/30 — Compare unchanged requirements.** Freeze each behavior baseline and record added requirements separately from compression.

### 33. Give every fact one editable owner

Keep one authoritative definition for each requirement. Repeat a short explanation where it makes an action understandable without a lookup; keep repeated statements consistent. Count generated agent-facing copies; generation alone is not compression.

### 34. Prefer readable interfaces over teaching machine formats

A verified reader may expose complete readable evidence with exact identifiers instead of teaching codec internals. Remove decoding guidance only after verifying completeness, access boundaries and the agent's remaining responsibilities.

### 35. Choose examples by distinct behavior

Each example or repeated row should demonstrate a different requirement or boundary. Remove redundant illustrations only within output-preservation authorization; do not silently change protected literal blocks.

### 36. Separate deciding from recording

Keep agent judgment explicit; derive counts, hashes, paths, coverage and repeated metadata from authoritative records through verified tools. Remove manual transcription procedures only after reliable generation exists.

### 37. Test necessity by removal

For suspected redundancy, remove it in a candidate and check decisions against remaining authorities. Pair reader comprehension with independent deletion audits and boundary scenarios; reader success alone cannot prove an obligation unnecessary.

## Rejected approaches

- **Compression through repeated lookups:** do not replace useful command examples, local context or concrete identity requirements with discovery instructions, inherited host assumptions or abstract bundles merely to save characters.
- **Overcrowded tables and absolute deduplication:** retain brief repetition when it improves understanding; a single authoritative definition does not require every use to be only a pointer.

- **Symbolic policy languages or dense logical notation:** instructions must remain easily human-readable. Use ordinary prose and readable tables; retain familiar arithmetic only where it clarifies an actual quantity.
- **Encoded instructions:** no ZIP, Base64, opaque abbreviations, minification or similar tricks used to claim instruction reduction. Decoding restores the same information and makes the source harder to review.

## Verification and review

1. Before editing, read the full package and applicable authoring guidance. Record source identities and identify essential behavior separately from incidental presentation.
2. Generate an explanation of the incoming skill using the refinement explanation template. Keep explanations, reviews and one concise report outside the refined package.
3. After changes, run existing checks relevant to executable changes. Verify local references and literal output blocks where affected. Preserve unrelated workspace work.
4. Have three fresh GPT-6.1 Sol reviewers at low reasoning effort read only the refined package and explanation template. Withhold the original, previous explanations and orchestrator findings.
5. Compare their explanations by source step and normalized matrix item. Distinguish differences in grouping or wording from differences in behavior. Apply the smallest correction that fixes a misunderstanding.
6. Repeat verification/review as authorized until no misunderstanding remains. If the owner stops at step 3.4, report that the latest corrections have not received a fresh review.
7. Report the counted scope, character counts, retained essentials, authorized behavior changes, validation and remaining limitations. Reviewer agreement is evidence of comprehension, not proof of executable equivalence.

Session instructions govern pauses, iteration count, commits and delivery. This reference does not independently authorize a commit, installation, publication or unrelated controller rewrite.

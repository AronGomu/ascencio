# Automatic authoring refinement review

Status: five refinement iterations and 15 fresh comprehension reviews completed. Candidate remains separate; do not promote without a later explicit instruction.

Source: `.agents/skills/ai-bot-self-improvement/` (read-only to review).
Candidate: `.agents/skills/ai-bot-self-improvement-REFINED-pending-20261115/`.
Settings: reviewers spawned through supported controls with `gpt-6.1-sol`, reasoning `low`; orchestrator inherited Sol/low as supplied. Five iterations requested. Existing candidate preserved. A fresh reader is never reused across iterations; only package and explanation template are supplied. Concurrency is limited to two readers at once by the four-thread team limit.

Count scope: all Markdown/text/YAML in package plus 83 instructional characters in the controller comment; executable-only controller/declaration source excluded. Physical bytes cover all package files. External linked project documents remain unchanged on both sides; refinement artifacts are outside package and excluded. Counts are Unicode characters, physical sizes UTF-8 bytes. Aspirational 25% reduction yields to preserving behavior/readability.

Baseline source after owner default update: 50244 instructional characters; 53736 physical bytes. The default 250 matches (1000 games/evaluation) is an owner-authorized requirement delta, not compression. Pre-update source manifest is retained separately; source-manifest-after-default 250.json governs subsequent source-stability checks.

| Iteration | Instruction characters | Physical bytes | Review findings | Validation |
|---|---:|---:|---|---|
| 1 | 50069 | 53561 | Three fresh explanations agree core policy; eligible-stage timing and repair-mode restrictions could be clearer | Local links, literal reference blocks, unchanged scripts, source hashes pass |
| 2 | 50139 | 53633 | Three fresh explanations agree; eligible authorized Replay timing and mode blocking understood | Same checks pass |
| 3 | 49979 | 53473 | Three fresh explanations agree; ledger/reconstruction implementation remains an explicit limitation | Same checks pass |
| 4 | 49845 | 53339 | Three fresh explanations agree on threshold/discard and retention | Same checks pass |
| 5 | 49807 | 53301 | Three fresh explanations agree after the final edit; no behavioral disagreement remains | Same checks pass |

Final proposed reduction: 437 instructional characters (0.87%) and 435 physical bytes (0.81%). The 25% aspiration was not reached; preserving explicit policy and readable local context took priority in this already concise package. No added lookup, new resource or measured usability claim.

Preserved essentials and deletion mappings: audit.md. Incoming explanation: incoming-explanation.md. Reviews: iteration-N-review-a/b/c.md. Per-iteration checks and snapshots are separate artifacts.

Targeted local validation: controller tests 3/3 and setup tests 7/7 after default 250 test updates. Candidate task extraction preserves inherited policy and selects each of 8 active/suspended task stages. No campaign, game, replay or calibration executed; no campaign artifacts written; source skill not promoted or committed.

Limitations: the pre-existing runner link points to missing anchor `parallel-bot-session.md#minimum-runner-interface-for-aro2-18`; the file exists, but the external document also self-links to that absent section. No replacement contract was invented. Local-reference checks establish file existence, not external anchor guarantees. Existing replay tools do not implement the new durable cross-iteration ledger or prove exact current-policy reconstruction. The candidate requires orchestrator-owned durable bindings and blocked diagnostics when reconstruction is unavailable. Textual comprehension and policy walkthroughs cannot prove runtime equivalence. Source-mode compatibility still governs pending corrections. Ledger path/schema remains an operational choice subject to owning tool contracts; no invented fixed schema was added.

Final review: all 15 explanations contain the eight required template sections. Initial eligibility/mode clarity concerns were repaired in iteration 2 and understood in subsequent fresh reviews. No candidate edit followed the final three reports.

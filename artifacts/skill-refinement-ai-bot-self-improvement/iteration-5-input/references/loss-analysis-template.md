# Evaluation loss report

Read when merging completed slice findings. Write English `baseline/loss-analysis.md` or `iterations/iteration-N/loss-analysis.md`, bound to the evaluated AI/source. Review every newly played completed target loss; reuse only matching cached analysis.

Merge equivalent reasons globally. Include all groups affecting at least five distinct losses, ranked by count then severity; smaller groups enter neither final reasons nor replay jobs. Count a game once per reason, allowing overlaps. Preserve unclear losses and incomplete coverage. Judge visible information at the choice; identify supported mistakes without requiring proof an alternative wins before replay. Invent no attribution, gain estimates or confidence labels.

```markdown
# Loss Analysis — Baseline / Iteration N

N games · L losses reviewed · R eligible reasons.

1. **Reason** — K losses.
   Critical choice: one short sentence.
   Solution: one short sentence.
   Replay points: M001/G2@0-decision-42; M017/G3@1-decision-88; …

2. **Reason** — K losses.
   Critical choice: one short sentence.
   Solution: one short sentence.
   Replay points: …
```

For every reason enumerate all affected games and primary critical decision IDs relative to the linked source evaluation. Link that evaluation once; qualify IDs if mixing evaluations. Replay points are required inputs, not a second loss ledger. Retain report and source records until all reasons are replay-processed and validation/reuse/resume needs end; apply the skill's Artifact lifecycle at closure.

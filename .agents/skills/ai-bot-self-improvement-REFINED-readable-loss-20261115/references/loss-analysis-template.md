# Evaluation loss report

Read when merging slices. Write English `baseline/loss-analysis.md` or `iterations/iteration-N/loss-analysis.md`, bound to evaluated source. Coverage and reuse follow the slice protocol.

Apply the skill’s global eligibility/ranking gate to merged reasons. Count each game once per reason, allowing overlaps; report unclear/incomplete coverage. Judge visible information, not concealed facts. Supported mistakes need no pre-replay proof an alternative wins; invent no attribution, gain estimates or confidence labels.

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

For every reason enumerate all affected games and primary critical decision IDs relative to the linked source evaluation. Link that evaluation once; qualify IDs if mixing evaluations. Replay points are execution inputs, not another ledger.

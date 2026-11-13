# Loss analysis report

Write `baseline/loss-analysis.md` or `iterations/iteration-N/loss-analysis.md` in English. Review every newly played target loss; use prior analyses for cached results. List **all supported reasons affecting at least one loss**, ranked by affected losses, then severity. There is no limit on the number of reasons. Count each game once per reason; reasons may overlap, so counts need not sum to total losses.

Judge choices using information visible at the time. Distinguish observed mistakes from uncertain loss attribution; an alternative need not be proven to win before replay testing. Report losses with no supported reason as unclear; do not invent reasons.

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

For each reason, enumerate every affected game and its primary critical decision, using IDs relative to the report’s source evaluation. Link that evaluation once; qualify IDs by evaluation when multiple batches are included. These compact replay points are required execution inputs, not a separate loss ledger. State incomplete coverage and unclear-loss count; overlapping reason counts need not add up. Emit no gain estimates or confidence labels.

Keep source action records until the orchestrator has processed every eligible reason through replay validation. Delivery alone does not permit pruning; honor owner retention requests.

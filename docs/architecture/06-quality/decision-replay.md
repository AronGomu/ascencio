# Replay a decision

Run `scripts/bot-improvement/replay-game-decision.ts --help` for inputs. Node 26+ and installed dependencies are required. This is a diagnostic command; it leaves the improvement checkpoint unchanged and executes two additional games. Retain detailed source records until the comparisons you want are complete.

```sh
node --experimental-vm-modules scripts/bot-improvement/replay-game-decision.ts \
  --game /absolute/evaluation-run/matches/match-000037/games/game-3 \
  --actor a --decision 0-decision-727 \
  --pairing /absolute/evaluation-attempt/pairing.json \
  --strategy /absolute/updated-strategy.mjs \
  --out /absolute/new-comparison-directory
```

`--strategy` accepts a scoring module exporting `createStrategy`, with optional `selectCounts` and `sideboard`. Use `--bot` instead for a complete module exporting the normal bot contract. The selected actor keeps its recorded configuration. The decision ID is the exact ID from its machine record or compact log, without the log's `D` prefix. Actor A/B is stable across starting-side rotation; the numeric prefix in the decision ID refers to the original engine seat.

## Execution

1. Read both actor records and their linked game metadata, the evaluation manifest and the supplied pairing record. Verify content, engine, archived original bot sources and deck composition. Pruned records are insufficient.
2. Recreate the game with its original seed and source deck ordering. Apply recorded sideboard exchanges for post-side games. Only normal starting-order mode is currently supported; fixture mode is rejected.
3. Replay recorded choices for both actors before the selected decision. Compare every emitted event, the initial state/deck orders, and each prompt including its legal choices against the source records. Ignore elapsed decision timing. Compare consecutive, state-free card/player description-hint add/remove batches as multisets, preserving their complete contents, counts, contexts and sequence positions; the engine can emit these display hints in a different order. All other event ordering stays exact. Stop on the first discrepancy.
4. At the selected prompt, run an original-policy control to completion. Require its takeover choice and final outcome to match the recorded game before running the alternative.
5. Replay the verified prefix again and replace only the selected actor's bot immediately before that decision. Let both policies choose normally afterward.

Original bots are invoked during the forced prefix to build their internal state; their calculated choices do not replace recorded choices. The replacement starts with a **fresh instance** at takeover, receives ordinary actor-visible observations, and receives no opponent-private records. Its first input includes accumulated observed events since that actor's previous decision, as in normal play. It does not receive a reconstructed historical bot memory. For stateful policies, fresh takeover is an experimental change in its own right.

The branch tests a policy continuation from one decision, including all subsequent decisions by that policy. It does not isolate a single changed action while keeping future policy behavior fixed. Different continuations can consume randomness differently. Matching a prefix and observing a win establishes a result for this continuation, not a general win-rate gain or a complete engine-memory equivalence proof.

## Artifacts and failure

- `comparison.md`: verified prefix, original and alternative choices/outcomes, source links and replacement hash.
- `control.log`, `alternative.log`: readable event/decision traces; `TAKEOVER` marks the replacement boundary.
- `control.jsonl`, `alternative.jsonl`: machine host protocol, including prompts and selected choice IDs.
- `original-a.mjs`, `original-b.mjs`, `replacement.mjs`: frozen executable sources used by this experiment.
- `*-stderr.log`: host diagnostics.
- `failure.md`: failure reason when an execution or verification fails; no successful comparison is emitted. Event mismatches also retain expected/actual entries in the machine protocol for diagnosis.

An existing output directory is refused. Each child has an external wall timeout (recorded game limit plus 30 seconds for initialization) and a 128 MiB protocol limit. Source artifacts and regenerated baseline logs remain untouched. Newer runtime behavior that changes a recorded prefix is rejected rather than silently accepted.

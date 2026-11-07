# Generalist baseline acceptance, 2026-11-06

The ARO2-1 Rust evaluator completed the declared ARO2-2 comparison with **99 wins / 100 completed games (99%)**, one loss, zero draws, zero failures and zero skipped games. This exceeds the required 60% for this setup only.

- Run: `run-1793992444791`, 25 sequential four-game matches.
- Deck: independent copies of `assets/freeplay/decks/player.ydk`; the manifest retains the exact deck and its digest.
- Rules: MR5, `test/fixtures/bot-evaluation/three-copy-rules.json`.
- Bots: `builtin:generalist` vs `builtin:random`, empty configurations; no sideboard changes.
- Starting player: 50 games each, paired before and after sideboarding; normal engine shuffle.
- Limits: 10 seconds/game, 1 second/decision or sideboard hook, 200 turns and 100,000 decisions/game.
- Denominator: every completed comparison game, including draws; there were no incomplete matches.

[acceptance.xml](acceptance.xml) retains the exact machine-local invocation configuration. Replace its absolute paths when reproducing elsewhere. Run the existing evaluator with `evaluate --config <file>`; this is not a separate runner. [summary.xml](summary.xml) is the evaluator's unmodified summary.

[evaluator-reports.tar.gz](evaluator-reports.tar.gz) contains the final accepted run, the earlier passing run `run-1793992120037`, and the preceding failed run `run-1793992005595`. The initial run failed because random empty chain responses passed the shared validator but not the engine response encoder. That contract mismatch was fixed and covered by engine-binding regressions before the fresh accepted batch. It is excluded from acceptance, not hidden.

Archive SHA-256: `27d168e21750e7c9558ca7dbf8d10fac7b684459010bf2e62331b663a8a78ab5`.

Each complete evaluator directory includes its manifest, bundled bot source/revisions/configurations, exact deck, snapshot/rules identities, player reports with decision reasons, neutral results, starting-order evidence, and any failures. Bot source identities are captured independently of the checkout's pre-commit Git HEAD. Printed-stat heuristics remain approximate; this small straightforward deck does not establish strength across every deck or effect interaction.

The final batch was rerun after review added the selection-count/cancellation strategy hook. Targeted regressions verify optional multi-card selection, intentional cancellation, feasible constrained-count fallback, and rejection of invalid count preferences. The default policy behavior remains unchanged.

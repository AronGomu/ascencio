# Generalist baseline acceptance, 2026-11-06

The ARO2-1 Rust evaluator completed the declared ARO2-2 comparison with **100 wins / 100 completed games (100%)**, zero losses, zero draws, zero failures and zero skipped games. This exceeds the required 60% for this setup only.

- Run: `run-1793992120037`, 25 sequential four-game matches.
- Deck: independent copies of `content/freeplay/decks/player.ydk`; the manifest retains the exact deck and its digest.
- Rules: MR5, `tests/fixtures/bot-evaluation/three-copy-rules.json`.
- Bots: `builtin:generalist` vs `builtin:random`, empty configurations; no sideboard changes.
- Starting player: 50 games each, paired before and after sideboarding; normal engine shuffle.
- Limits: 10 seconds/game, 1 second/decision or sideboard hook, 200 turns and 100,000 decisions/game.
- Denominator: every completed comparison game, including draws; there were no incomplete matches.

[acceptance.xml](acceptance.xml) retains the exact machine-local invocation configuration. Replace its absolute paths when reproducing elsewhere. Run the existing evaluator with `evaluate --config <file>`; this is not a separate runner. [summary.xml](summary.xml) is the evaluator's unmodified summary.

[evaluator-reports.tar.gz](evaluator-reports.tar.gz) contains both the accepted run and the preceding failed run `run-1793992005595`. The initial run failed because random empty chain responses passed the shared validator but not the engine response encoder. That contract mismatch was fixed and covered by engine-binding regressions before the fresh accepted batch. It is excluded from acceptance, not hidden.

Archive SHA-256: `f6569eee61d248a4da84c608953fb762164946cf29d753c1e39d5e0a597d49f1`.

Each complete evaluator directory includes its manifest, bundled bot source/revisions/configurations, exact deck, snapshot/rules identities, player reports with decision reasons, neutral results, starting-order evidence, and any failures. Bot source identities are captured independently of the checkout's pre-commit Git HEAD. Printed-stat heuristics remain approximate; this small straightforward deck does not establish strength across every deck or effect interaction.

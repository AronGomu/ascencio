# Goat Control

`bot.json` describes this package. Editable TypeScript source lives in `ai/`; settings and recommended decks are package-local. `evaluation.json` selects the same policy and the adjacent deck.

Run `npm run bot:build -- goat-control` from the repository to produce the self-contained `dist/ai.mjs` module. Distribute the folder with its manifest, output, settings and declared resources. Source builds use the shared game contracts and legal-response machinery; the bundled output has no repository imports.

`ai/` can grow into knowledge, evaluation, planning, tactics and sideboarding modules as needed. Decision tests, benchmarks and offline tools belong under `ai/tests/`, `ai/benches/` and `ai/tools/` when added. Campaign outputs remain separate.

The default package version is `0.2.0`, selected by the owner on 2026-11-15. It includes 16 isolated replay-validated GOAT Control scoring improvements from candidate `48e7beff69af4eda106658794a227eba8cbfe30af96df8787ef9cb2cca3e30bd`. All 1,409 associated isolated replay cases completed; the combined candidate has not yet undergone its full 1,000-match paired evaluation. See [improvement history](improvement-history.md) for rule IDs and evidence. Customize `ai/evaluation/scoring.ts` for future strategy work.

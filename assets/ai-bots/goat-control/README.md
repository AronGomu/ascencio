# Goat Control

`bot.json` describes this package. Editable TypeScript source lives in `ai/`; settings and recommended decks are package-local. `evaluation.json` selects the same policy and the adjacent deck.

Run `npm run bot:build -- goat-control` from the repository to produce the self-contained `dist/ai.mjs` module. Distribute the folder with its manifest, output, settings and declared resources. Source builds use the shared game contracts and legal-response machinery; the bundled output has no repository imports.

`ai/` can grow into knowledge, evaluation, planning, tactics and sideboarding modules as needed. Decision tests, benchmarks and offline tools belong under `ai/tests/`, `ai/benches/` and `ai/tools/` when added. Campaign outputs remain separate.

GOAT Control currently uses an independent copy of the Generalist baseline; it has no specialized GOAT scoring yet. Customize `ai/evaluation/scoring.ts` for future strategy work.
